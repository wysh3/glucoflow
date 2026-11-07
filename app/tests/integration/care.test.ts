import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { CareCommand, CareProposal, CareWorkspace } from '@glucoflow/contracts';
import { buildServer } from '../../apps/api/src/server';
import { createAppContext, type AppContext } from '../../apps/api/src/context';
import { signLocalToken } from '../../apps/api/src/auth';
import { createFixture, createTestContext, removeClinic, type TestContext, type TestFixture } from './harness';

const base = '/api/v1/care';
const tokens: Record<string, string> = {};
let db: TestContext;
let fixture: TestFixture;
let api: AppContext;
let app: Awaited<ReturnType<typeof buildServer>>;

beforeAll(async () => {
  db = await createTestContext();
  fixture = await createFixture(db, 'care');
  api = await createAppContext();
  app = await buildServer(api);
  for (const [role, userId] of Object.entries({
    patient: fixture.patientUserId,
    owner: fixture.clinicianId,
    peer: fixture.reviewerId,
    other: fixture.otherReviewerId,
  })) {
    tokens[role] = (await signLocalToken(api.config, { userId, email: 'synthetic@test.local' })).accessToken;
  }
});

afterAll(async () => {
  await app?.close();
  await api?.pool.end();
  if (fixture) {
    await removeClinic(db, fixture.clinicId);
    await removeClinic(db, fixture.otherClinicId);
  }
  await db?.close();
});

function headers(role = 'owner') {
  return { authorization: `Bearer ${tokens[role]}` };
}

async function create(): Promise<CareWorkspace> {
  const res = await app.inject({ method: 'POST', url: `${base}/workspaces`, headers: headers() });
  expect(res.statusCode, res.body).toBe(201);
  return res.json();
}

function command(state: CareWorkspace, command: CareCommand, key = randomUUID()) {
  return app.inject({
    method: 'POST',
    url: `${base}/workspaces/${state.id}/commands`,
    headers: { ...headers(), 'idempotency-key': key },
    payload: { expectedRevision: state.revision, command },
  });
}

async function apply(state: CareWorkspace, input: CareCommand): Promise<CareWorkspace> {
  const res = await command(state, input);
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

it('seeds distinct synthetic workspaces and isolates their owners in the API and RLS', async () => {
  const state = await create();
  const fresh = await create();
  expect(state.id).not.toBe(fresh.id);
  expect(state.synthetic).toBe(true);
  expect(state.encounters).toHaveLength(3);
  expect(state.orders).toHaveLength(3);
  expect(state.events.map(({ kind }) => kind)).toContain('result_validated');
  expect(fresh.orders[0]!.id).not.toBe(state.orders[0]!.id);
  const url = `${base}/workspaces/${state.id}`;
  expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
  expect((await app.inject({ method: 'GET', url, headers: headers('patient') })).statusCode).toBe(403);
  for (const role of ['peer', 'other']) {
    expect((await app.inject({ method: 'GET', url, headers: headers(role) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `${url}/export`, headers: headers(role) })).statusCode).toBe(404);
  }
  expect(await db.asActor(fixture.reviewerId, async (client) =>
    (await client.query('select id from sutra.care_workspaces where id = $1', [state.id])).rowCount,
  )).toBe(0);
  const exported = await app.inject({ method: 'GET', url: `${url}/export`, headers: headers() });
  expect(exported.json().events).toEqual(state.events);
  expect(exported.headers['content-disposition']).toContain('attachment');
});

it('serializes matching retries and rejects a stale revision or conflicting key', async () => {
  const state = await create();
  const input = { type: 'set_role', role: 'nurse' } as const;
  const key = randomUUID();
  const [first, replay] = await Promise.all([command(state, input, key), command(state, input, key)]);
  expect(first.statusCode, first.body).toBe(200);
  expect(replay.statusCode, replay.body).toBe(200);
  expect(first.json().revision).toBe(state.revision + 1);
  expect(replay.json().revision).toBe(first.json().revision);
  expect((await command(state, { type: 'set_role', role: 'lab' }, key)).json().error.code).toBe('idempotency_conflict');
  expect((await command(state, input)).json().error.code).toBe('stale_revision');
  const withoutKey = await app.inject({
    method: 'POST', url: `${base}/workspaces/${state.id}/commands`, headers: headers(),
    payload: { expectedRevision: first.json().revision, command: input },
  });
  expect(withoutKey.statusCode).toBe(422);
});

it('confirms receipt from the matching LIS event and reverses it after a HIS cancellation', async () => {
  let state = await create();
  const order = state.orders[1]!;
  const task = state.tasks.find((item) => item.orderId === order.id)!;
  const receipt = {
    type: 'source_event', encounterId: order.encounterId, orderId: order.id, kind: 'specimen_received',
    source: 'LIS', sourceRef: 'LIS-RECEIPT-TEST',
  } as const;
  expect((await command(state, receipt)).statusCode).toBe(403);
  state = await apply(state, { type: 'set_role', role: 'lab' });
  expect((await command(state, { ...receipt, source: 'HIS' })).statusCode).toBe(422);
  expect((await command(state, { ...receipt, encounterId: state.encounters[0]!.id })).statusCode).toBe(422);
  state = await apply(state, receipt);
  const event = state.events.find((item) => item.sourceRef === receipt.sourceRef)!;
  expect(state.tasks.find((item) => item.id === task.id)).toMatchObject({
    status: 'source_confirmed', completionEventId: event.id,
  });
  const duplicate = await apply(state, receipt);
  expect(duplicate.events).toEqual(state.events);
  state = await apply(duplicate, { type: 'set_role', role: 'doctor' });
  state = await apply(state, { ...receipt, kind: 'order_cancelled', source: 'HIS', sourceRef: 'HIS-CANCEL-TEST' });
  expect(state.tasks.find((item) => item.id === task.id)).toMatchObject({ status: 'cancelled', completionEventId: null });
  expect(state.events).toContainEqual(event);
});

it('keeps the original result evidence and requires a fresh acknowledgement after correction', async () => {
  let state = await create();
  const order = state.orders[2]!;
  const task = state.tasks.find((item) => item.orderId === order.id)!;
  const acknowledge = {
    type: 'source_event', encounterId: order.encounterId, orderId: order.id, kind: 'result_acknowledged',
    source: 'HIS', sourceRef: 'HIS-ACK-ORIGINAL',
  } as const;
  state = await apply(state, acknowledge);
  expect(state.tasks.find((item) => item.id === task.id)?.status).toBe('source_confirmed');
  state = await apply(state, { type: 'set_role', role: 'lab' });
  state = await apply(state, { ...acknowledge, source: 'LIS', kind: 'result_corrected', sourceRef: 'LIS-CORRECTION-TEST' });
  expect(state.tasks.find((item) => item.id === task.id)).toMatchObject({ status: 'monitoring', completionEventId: null });
  expect(state.events.map(({ sourceRef }) => sourceRef)).toContain(acknowledge.sourceRef);
  state = await apply(state, { type: 'set_role', role: 'doctor' });
  state = await apply(state, acknowledge);
  expect(state.tasks.find((item) => item.id === task.id)?.status).toBe('monitoring');
  state = await apply(state, { ...acknowledge, sourceRef: 'HIS-ACK-CORRECTED' });
  expect(state.tasks.find((item) => item.id === task.id)?.status).toBe('source_confirmed');
});

it('does not create a second order monitor after matching source evidence closes the first', async () => {
  let state = await create();
  const order = state.orders[2]!;
  state = await apply(state, {
    type: 'source_event', encounterId: order.encounterId, orderId: order.id, kind: 'result_acknowledged',
    source: 'HIS', sourceRef: 'HIS-ACK-DUPLICATE-MONITOR',
  });
  const request = await command(state, {
    type: 'create_task', encounterId: order.encounterId, orderId: order.id,
    kind: 'result_acknowledgement', title: 'Duplicate acknowledgement monitor', durationMinutes: 60,
  });
  expect(request.statusCode, request.body).toBe(200);
  const reused = request.json();
  expect(reused.tasks).toEqual(state.tasks);
  expect(reused.revision).toBe(state.revision);
});

it('reports disconnected and stale evidence, then expires monitoring on a later server read', async () => {
  let state = await create();
  const task = state.tasks.find((item) => item.status === 'monitoring')!;
  state = await apply(state, { type: 'set_feed', source: 'LIS', connected: false });
  expect(state.tasks.find((item) => item.id === task.id)?.status).toBe('awaiting_evidence');
  state = await apply(state, { type: 'set_feed', source: 'LIS', connected: true });
  expect(state.tasks.find((item) => item.id === task.id)?.status).toBe('monitoring');
  state.feeds.LIS.lastSyncAt = '2026-01-01T00:00:00.000Z';
  const updateClock = () => db.owner(async (client) => {
    await client.query('update sutra.care_workspaces set state = $2 where id = $1', [state.id, JSON.stringify(state)]);
  });
  await updateClock();
  const url = `${base}/workspaces/${state.id}`;
  const reloaded = await app.inject({ method: 'GET', url, headers: headers() });
  expect(reloaded.json().tasks.find((item: { id: string }) => item.id === task.id).status).toBe('awaiting_evidence');
  state = reloaded.json();
  state.tasks.find((item) => item.id === task.id)!.expiresAt = '2026-01-01T00:00:00.000Z';
  await updateClock();
  const expired = await app.inject({ method: 'GET', url, headers: headers() });
  expect(expired.json().tasks.find((item: { id: string }) => item.id === task.id).status).toBe('expired');
  const repeated = await app.inject({ method: 'GET', url, headers: headers() });
  expect(repeated.json().revision).toBe(expired.json().revision);
});

it('keeps manual attestation separate and gates approval by simulation role', async () => {
  let state = await create();
  const task = state.tasks.find((item) => item.status === 'awaiting_approval')!;
  state = await apply(state, { type: 'set_role', role: 'nurse' });
  expect((await command(state, { type: 'task_action', taskId: task.id, action: 'approve' })).statusCode).toBe(403);
  state = await apply(state, { type: 'set_role', role: 'coordinator' });
  state = await apply(state, { type: 'task_action', taskId: task.id, action: 'approve' });
  expect(state.tasks.find((item) => item.id === task.id)?.status).toBe('monitoring');
  state = await apply(state, { type: 'task_action', taskId: task.id, action: 'attest', reason: 'Team confirmed by telephone.' });
  expect(state.tasks.find((item) => item.id === task.id)).toMatchObject({ status: 'human_attested', completionEventId: null });
  expect(state.activity.some((item) => item.taskId === task.id && item.detail.includes('Team confirmed by telephone.'))).toBe(true);
});

it('requires passing playbook tests and changes only future handover formatting', async () => {
  let state = await create();
  const task = state.tasks[0]!;
  state = await apply(state, { type: 'propose_playbook', title: 'Automatic treatment', body: '{"autoTreat":true}' });
  const unsafe = state.playbooks.at(-1)!;
  state = await apply(state, { type: 'test_playbook', playbookId: unsafe.id });
  expect(state.playbooks.at(-1)!.tests.some((test) => !test.passed)).toBe(true);
  expect((await command(state, { type: 'review_playbook', playbookId: unsafe.id, decision: 'approve' })).statusCode).toBe(409);
  state = await apply(state, { type: 'review_playbook', playbookId: unsafe.id, decision: 'reject' });
  state = await apply(state, { type: 'propose_playbook', title: 'Show source first', body: '{"handoverOrder":"source-first"}' });
  const valid = state.playbooks.at(-1)!;
  expect((await command(state, { type: 'review_playbook', playbookId: valid.id, decision: 'approve' })).statusCode).toBe(409);
  state = await apply(state, { type: 'test_playbook', playbookId: valid.id });
  expect(state.playbooks.at(-1)!.tests.every((test) => test.passed)).toBe(true);
  state = await apply(state, { type: 'review_playbook', playbookId: valid.id, decision: 'approve' });
  expect(state.tasks[0]!.playbookVersion).toBe(task.playbookVersion);
  state = await apply(state, { type: 'draft_handover', encounterId: state.encounters[0]!.id });
  expect(state.messages.at(-1)?.content).toContain('Evidence');
  expect(state.messages.at(-1)?.content.indexOf('Evidence')).toBeLessThan(state.messages.at(-1)?.content.indexOf('Owner') ?? -1);
  expect(state.messages.at(-1)?.sources).toContain(state.events[0]!.id);
  const original = state.playbooks[0]!;
  state = await apply(state, { type: 'rollback_playbook', playbookId: original.id });
  state = await apply(state, { type: 'draft_handover', encounterId: state.encounters[0]!.id });
  expect(state.messages.at(-1)?.content.indexOf('Owner')).toBeLessThan(state.messages.at(-1)?.content.indexOf('Evidence') ?? -1);
});

it('stores deterministic chat without applying proposals', async () => {
  const state = await create();
  const invalid = await app.inject({
    method: 'POST', url: `${base}/workspaces/${state.id}/chat`, headers: headers(),
    payload: { mode: 'offline', message: 'Draft a handover', languageCode: 'xx-IN' },
  });
  expect(invalid.statusCode).toBe(422);
  const result = await app.inject({
    method: 'POST', url: `${base}/workspaces/${state.id}/chat`, headers: headers(),
    payload: { mode: 'offline', message: 'Draft a handover', languageCode: 'hi-IN' },
  });
  expect(result.statusCode, result.body).toBe(200);
  const next: CareWorkspace = result.json();
  expect(next.messages.at(-1)).toMatchObject({
    engine: 'offline', languageCode: 'en-IN', content: expect.stringContaining('Deterministic helper · Synthetic workspace · English fallback'),
  });
  expect(next.messages.at(-1)?.proposals?.some((proposal) => proposal.kind === 'handover')).toBe(true);
  expect(next.tasks).toEqual(state.tasks);
  expect(next.events).toEqual(state.events);
});

it('surfaces runtime failures and rejects citations outside the workspace', async () => {
  const state = await create();
  let status = 503;
  let cited: string = randomUUID();
  let proposals: CareProposal[] = [];
  let forwardedLanguage: unknown;
  const bridgeToken = 'integration-test-sidecar-token';
  const sidecar = createServer((request, response) => {
    if (request.url === '/health') {
      response.end(JSON.stringify({ engine: 'hermes', available: true, configured: true, version: '0.23.0', model: 'synthetic-sidecar' }));
      return;
    }
    let payload = '';
    request.setEncoding('utf8').on('data', (chunk: string) => { payload += chunk; });
    request.on('end', () => {
      forwardedLanguage = JSON.parse(payload).languageCode;
      const authorized = request.headers.authorization === `Bearer ${bridgeToken}`;
      response.writeHead(authorized ? status : 401);
      response.end(JSON.stringify({
        reply: 'कार्य की स्थिति', engine: 'hermes', model: 'synthetic-sidecar', languageCode: 'hi-IN', proposals, sources: [cited],
      }));
    });
  });
  await new Promise<void>((resolve) => sidecar.listen(0, '127.0.0.1', resolve));
  const address = sidecar.address();
  if (!address || typeof address === 'string') throw new Error('Test sidecar address is unavailable.');
  vi.stubEnv('HERMES_URL', `http://127.0.0.1:${address.port}`);
  vi.stubEnv('HERMES_SERVICE_TOKEN', bridgeToken);
  const bridgeApi = await buildServer(api);
  try {
    const runtime = await bridgeApi.inject({ method: 'GET', url: `${base}/runtime`, headers: headers() });
    expect(runtime.json()).toMatchObject({ available: true, configured: true, engine: 'hermes', model: 'synthetic-sidecar' });
    const send = () => bridgeApi.inject({
      method: 'POST', url: `${base}/workspaces/${state.id}/chat`, headers: headers(),
      payload: { mode: 'hermes', message: 'What did the LIS confirm?', languageCode: 'hi-IN' },
    });
    const unavailable = await send();
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json().error.code).toBe('hermes_unavailable');
    status = 200;
    expect((await send()).statusCode).toBe(502);
    cited = state.events[0]!.id;
    const order = state.orders[0]!;
    proposals = [{
      kind: 'monitor', title: 'Propose receipt tracking', body: 'specimen_receipt',
      encounterId: order.encounterId, orderId: order.id, skillId: randomUUID(),
    }];
    expect((await send()).statusCode).toBe(502);
    const unchanged = await bridgeApi.inject({ method: 'GET', url: `${base}/workspaces/${state.id}`, headers: headers() });
    expect(unchanged.json().messages).toEqual([]);
    proposals = [];
    const delivered = await send();
    expect(delivered.statusCode, delivered.body).toBe(200);
    expect(forwardedLanguage).toBe('hi-IN');
    expect(delivered.json().messages.at(-1)).toMatchObject({ engine: 'hermes', languageCode: 'hi-IN', sources: [cited] });
  } finally {
    await bridgeApi.close();
    await new Promise<void>((resolve) => sidecar.close(() => resolve()));
    vi.unstubAllEnvs();
  }
});

it('makes the source-first handover prompt a playbook proposal in deterministic mode', async () => {
  const state = await create();
  const response = await app.inject({
    method: 'POST', url: `${base}/workspaces/${state.id}/chat`, headers: headers(),
    payload: { mode: 'offline', message: 'Propose a source-first handover layout so the next team sees evidence near the top' },
  });
  expect(response.statusCode).toBe(200);
  const next: CareWorkspace = response.json();
  expect(next.messages.at(-1)?.proposals).toEqual([
    expect.objectContaining({ kind: 'playbook', body: '{"handoverOrder":"source-first"}' }),
  ]);
  expect(next.playbooks).toEqual(state.playbooks);
});

it('keeps each sequential handover linked to its own HIS receipt', async () => {
  let state = await create();
  const encounterId = state.encounters[0]!.id;
  const proposal = {
    type: 'create_task', encounterId, orderId: null, kind: 'handover', title: 'Confirm receiving team handover', durationMinutes: 30,
  } as const;
  const receipt = {
    type: 'source_event', encounterId, orderId: null, kind: 'handover_received', source: 'HIS',
  } as const;
  state = await apply(state, { type: 'set_role', role: 'coordinator' });
  state = await apply(state, proposal);
  const first = state.tasks.at(-1)!;
  state = await apply(state, { type: 'task_action', taskId: first.id, action: 'approve' });
  state = await apply(state, { ...receipt, sourceRef: 'HIS-HANDOVER-FIRST' });
  const firstEvent = state.events.at(-1)!;
  state = await apply(state, proposal);
  const second = state.tasks.at(-1)!;
  state = await apply(state, { type: 'task_action', taskId: second.id, action: 'approve' });
  expect(state.tasks.find((task) => task.id === second.id)?.status).toBe('monitoring');
  state = await apply(state, { ...receipt, sourceRef: 'HIS-HANDOVER-SECOND' });
  const secondEvent = state.events.at(-1)!;
  expect(state.tasks.find((task) => task.id === first.id)?.completionEventId).toBe(firstEvent.id);
  expect(state.tasks.find((task) => task.id === second.id)?.completionEventId).toBe(secondEvent.id);
});

it('lists only the signed-in actor’s recoverable workspaces', async () => {
  const state = await create();
  const list = (role: string) => app.inject({ method: 'GET', url: `${base}/workspaces`, headers: headers(role) });
  const owned = await list('owner');
  expect(owned.statusCode).toBe(200);
  expect(owned.json().workspaces).toContainEqual(expect.objectContaining({ id: state.id, synthetic: true }));
  expect(owned.json().workspaces.find((item: { id: string }) => item.id === state.id)).not.toHaveProperty('encounters');
  expect((await list('peer')).json().workspaces).toEqual([]);
  expect((await list('other')).json().workspaces).toEqual([]);
  expect((await list('patient')).statusCode).toBe(403);
});

it('governs reuse of a source-confirmed receipt on a new encounter with fresh B evidence', async () => {
  await db.owner(async (client) => {
    await client.query('update sutra.memberships set clinician = false where user_id = $1', [fixture.reviewerId]);
  });
  let origin = await create();
  const orderA = origin.orders[1]!;
  const taskA = origin.tasks.find((task) => task.orderId === orderA.id)!;
  origin = await apply(origin, { type: 'set_role', role: 'lab' });
  origin = await apply(origin, {
    type: 'source_event', encounterId: orderA.encounterId, orderId: orderA.id,
    kind: 'specimen_received', source: 'LIS', sourceRef: 'LIS-SKILL-PRIVATE-ORIGIN',
  });
  const originEvent = origin.events.at(-1)!;
  const originUrl = `${base}/workspaces/${origin.id}/skills`;
  const capture = (payload: Record<string, unknown>) => app.inject({
    method: 'POST', url: originUrl, headers: headers(), payload,
  });
  expect((await capture({ taskId: taskA.id, rule: 'Change treatment based on this result' })).statusCode).toBe(422);
  expect((await capture({ taskId: origin.tasks[0]!.id })).statusCode).toBe(409);
  const captured = await capture({ taskId: taskA.id });
  expect(captured.statusCode, captured.body).toBe(201);
  const skill = captured.json();
  expect(skill).toMatchObject({
    pattern: 'specimen_receipt', status: 'draft', origin: { workspaceId: origin.id, taskId: taskA.id, eventId: originEvent.id },
  });
  expect((await capture({ taskId: taskA.id })).json().id).toBe(skill.id);

  const createAs = async (role: string) => (await app.inject({
    method: 'POST', url: `${base}/workspaces`, headers: headers(role),
  })).json() as CareWorkspace;
  const peer = await createAs('peer');
  const foreign = await createAs('other');
  const skillUrl = (workspace: CareWorkspace) => `${base}/workspaces/${workspace.id}/skills/${skill.id}`;
  const act = (workspace: CareWorkspace, actor: string, action: string) => app.inject({
    method: 'POST', url: `${skillUrl(workspace)}/actions`, headers: headers(actor), payload: { action },
  });
  const peerList = await app.inject({ method: 'GET', url: `${base}/workspaces/${peer.id}/skills`, headers: headers('peer') });
  expect(peerList.json()).toMatchObject({ canReview: false, skills: [{ id: skill.id, origin: null }] });
  expect(peerList.body).not.toContain(originEvent.id);
  expect(peerList.body).not.toContain('LIS-SKILL-PRIVATE-ORIGIN');
  expect((await act(peer, 'peer', 'approve')).statusCode).toBe(403);
  expect((await act(foreign, 'other', 'test')).statusCode).toBe(404);
  expect((await act(origin, 'owner', 'approve')).statusCode).toBe(409);
  const tested = await act(origin, 'owner', 'test');
  expect(tested.statusCode, tested.body).toBe(200);
  expect(tested.json().tests).toHaveLength(5);
  expect(tested.json().tests.every((item: { passed: boolean }) => item.passed)).toBe(true);
  expect((await act(origin, 'owner', 'approve')).json()).toMatchObject({ status: 'approved', approvedBy: 'Test Clinician' });

  let target = await create();
  const encounterId = target.encounters[0]!.id;
  target = await apply(target, { type: 'add_order', encounterId, testName: 'Synthetic B specimen', targetMinutes: 50 });
  const orderId = target.orders.at(-1)!.id;
  const preview = () => app.inject({
    method: 'POST', url: `${skillUrl(target)}/preview`, headers: headers(), payload: { encounterId, orderId },
  });
  expect((await preview()).json()).toMatchObject({ eligible: false, sourceEventId: null });
  const applySkill = { type: 'apply_skill', skillId: skill.id, encounterId, orderId } as const;
  expect((await command(target, applySkill)).statusCode).toBe(409);
  target = await apply(target, { type: 'set_role', role: 'nurse' });
  target = await apply(target, { type: 'source_event', encounterId, orderId, kind: 'specimen_collected', source: 'HIS', sourceRef: 'HIS-SKILL-TARGET' });
  const eventB = target.events.at(-1)!;
  expect((await preview()).json()).toMatchObject({ eligible: true, sourceEventId: eventB.id, task: { kind: 'specimen_receipt' } });
  target = await apply(target, { type: 'set_feed', source: 'LIS', connected: false });
  expect((await preview()).json().eligible).toBe(false);
  expect((await command(target, applySkill)).statusCode).toBe(409);
  target = await apply(target, { type: 'set_feed', source: 'LIS', connected: true });
  const proposed = await apply(target, applySkill);
  expect(proposed.tasks.at(-1)).toMatchObject({
    status: 'awaiting_approval', completionEventId: null, skillId: skill.id,
    skillVersion: 1, skillSourceEventId: eventB.id, encounterId, orderId,
  });
  expect(proposed.events).toEqual(target.events);
  expect((await act(origin, 'owner', 'retire')).json().status).toBe('retired');
  expect((await preview()).json()).toMatchObject({ eligible: false, sourceEventId: null });
  const rolledBack = await act(origin, 'owner', 'rollback');
  expect(rolledBack.json()).toMatchObject({ version: 2, status: 'approved' });
  expect(rolledBack.json().id).not.toBe(skill.id);
  expect((await act(origin, 'owner', 'rollback')).json().id).toBe(rolledBack.json().id);
});

it('excludes human attestation and a superseded result acknowledgement from skill capture', async () => {
  let state = await create();
  const first = state.tasks[0]!;
  state = await apply(state, { type: 'task_action', taskId: first.id, action: 'approve' });
  state = await apply(state, { type: 'task_action', taskId: first.id, action: 'attest', reason: 'Synthetic telephone report' });
  const capture = (taskId: string) => app.inject({
    method: 'POST', url: `${base}/workspaces/${state.id}/skills`, headers: headers(), payload: { taskId },
  });
  expect((await capture(first.id)).json().error.code).toBe('skill_outcome_required');

  const order = state.orders[2]!;
  const acknowledgement = {
    type: 'source_event', encounterId: order.encounterId, orderId: order.id, kind: 'result_acknowledged', source: 'HIS',
  } as const;
  const task = state.tasks.find((item) => item.orderId === order.id)!;
  state = await apply(state, { ...acknowledgement, sourceRef: 'HIS-ACK-BEFORE-CORRECTION-SKILL' });
  state = await apply(state, { type: 'set_role', role: 'lab' });
  state = await apply(state, {
    ...acknowledgement, kind: 'result_corrected', source: 'LIS', sourceRef: 'LIS-CORRECTED-BEFORE-SKILL',
  });
  expect((await capture(task.id)).json().error.code).toBe('skill_outcome_required');
  state = await apply(state, { type: 'set_role', role: 'doctor' });
  state = await apply(state, { ...acknowledgement, sourceRef: 'HIS-ACK-AFTER-CORRECTION-SKILL' });
  const captured = await capture(task.id);
  expect(captured.statusCode, captured.body).toBe(201);
  const skill = captured.json();
  expect(skill).toMatchObject({
    pattern: 'result_acknowledgement', provenance: { source: 'HIS', kind: 'result_acknowledged' },
    origin: { eventId: state.events.at(-1)!.id },
  });
  const action = (action: string) => app.inject({
    method: 'POST', url: `${base}/workspaces/${state.id}/skills/${skill.id}/actions`, headers: headers(), payload: { action },
  });
  expect((await action('test')).json().tests.every((item: { passed: boolean }) => item.passed)).toBe(true);
  expect((await action('approve')).json().status).toBe('approved');

  let target = await create();
  const encounterId = target.encounters[0]!.id;
  target = await apply(target, { type: 'add_order', encounterId, testName: 'Synthetic B result', targetMinutes: 40 });
  const orderId = target.orders.at(-1)!.id;
  const eventB = { type: 'source_event', encounterId, orderId } as const;
  target = await apply(target, { type: 'set_role', role: 'nurse' });
  target = await apply(target, { ...eventB, kind: 'specimen_collected', source: 'HIS', sourceRef: 'HIS-B-COLLECT-ACK' });
  target = await apply(target, { type: 'set_role', role: 'lab' });
  target = await apply(target, { ...eventB, kind: 'specimen_received', source: 'LIS', sourceRef: 'LIS-B-RECEIPT-ACK' });
  target = await apply(target, { ...eventB, kind: 'result_validated', source: 'LIS', sourceRef: 'LIS-B-VALIDATED-ACK' });
  target = await apply(target, { ...eventB, kind: 'result_corrected', source: 'LIS', sourceRef: 'LIS-B-CORRECTED-ACK' });
  const preview = await app.inject({
    method: 'POST', url: `${base}/workspaces/${target.id}/skills/${skill.id}/preview`, headers: headers(),
    payload: { encounterId, orderId },
  });
  expect(preview.json()).toMatchObject({
    eligible: true, sourceEventId: target.events.at(-1)!.id, task: { kind: 'result_acknowledgement' },
  });
  const proposal = await apply(target, { type: 'apply_skill', skillId: skill.id, encounterId, orderId });
  expect(proposal.tasks.at(-1)).toMatchObject({
    status: 'awaiting_approval', skillSourceEventId: target.events.at(-1)!.id, completionEventId: null,
  });
});

it('enforces transfer schema, receiving role and persisted ownership through authenticated commands', async () => {
  let state = await create();
  const task = state.tasks[1]!;
  state = await apply(state, {type:'request_transfer', taskId:task.id, owner:'Evening lab team',role:'lab',reason:'Shift change'});
  expect((await command(state,{type:'resolve_transfer',taskId:task.id,decision:'accept'})).statusCode).toBe(403);
  expect((await command(state,{type:'request_transfer',taskId:task.id,owner:'',role:'lab',reason:'Shift change'})).statusCode).toBe(422);
  state = await apply(state,{type:'set_role',role:'lab'});
  state = await apply(state,{type:'resolve_transfer',taskId:task.id,decision:'accept'});
  expect(state.tasks.find(t=>t.id===task.id)?.owner).toBe('Evening lab team');
  expect(state.tasks.find(t=>t.id===task.id)?.status).toBe('monitoring');
});

it('exposes immutable history through authorized paginated endpoints', async () => {
  const state = await create();
  const changed = await apply(state, { type: 'set_role', role: 'nurse' });
  const page = await app.inject({ method: 'GET', url: `${base}/workspaces/${state.id}/history`, headers: headers() });
  expect(page.statusCode, page.body).toBe(200);
  expect(page.json().revisions[0].revision).toBe(changed.revision);
  const revisionId = page.json().revisions[0].id;
  const detail = await app.inject({ method: 'GET', url: `${base}/workspaces/${state.id}/history/${revisionId}`, headers: headers() });
  expect(detail.statusCode, detail.body).toBe(200);
  expect(detail.json().state.role).toBe('nurse');
  const denied = await app.inject({ method: 'GET', url: `${base}/workspaces/${state.id}/history`, headers: headers('peer') });
  expect(denied.statusCode).toBe(404);
});

it('shares only an explicitly enrolled workspace and enforces assigned roles', async () => {
  const state = await create();
  const enrollment = await app.inject({ method: 'POST', url: `${base}/workspaces/${state.id}/team`, headers: headers(),
    payload: { userId: fixture.reviewerId, role: 'nurse' } });
  expect(enrollment.statusCode, enrollment.body).toBe(200);
  expect(enrollment.json().access.shared).toBe(true);
  const peer = await app.inject({ method: 'GET', url: `${base}/workspaces/${state.id}`, headers: headers('peer') });
  expect(peer.statusCode, peer.body).toBe(200);
  expect(peer.json().role).toBe('nurse');
  const switchRole = await app.inject({ method: 'POST', url: `${base}/workspaces/${state.id}/commands`,
    headers: {...headers('peer'), 'idempotency-key': randomUUID()},
    payload: {expectedRevision: peer.json().revision, command: {type:'set_role',role:'doctor'}} });
  expect(switchRole.statusCode, switchRole.body).toBe(403);
  const other = await app.inject({ method: 'POST', url: `${base}/workspaces/${state.id}/team`, headers: headers(),
    payload: {userId:fixture.otherReviewerId,role:'doctor'} });
  expect(other.statusCode).toBe(403);
  const revoked = await app.inject({ method:'POST',url:`${base}/workspaces/${state.id}/team`,headers:headers(),
    payload:{userId:fixture.reviewerId,role:'nurse',active:false} });
  expect(revoked.statusCode,revoked.body).toBe(200);
  const denied = await app.inject({ method:'GET',url:`${base}/workspaces/${state.id}`,headers:headers('peer') });
  expect(denied.statusCode).toBe(404);
});

it('streams scoped public action stages and one saved result without exposing other workspaces', async () => {
  const state = await create();
  const url = `${base}/workspaces/${state.id}/chat`;
  const input = { message: 'What is pending?', mode: 'offline' };
  for (const role of ['patient', 'other']) {
    const denied = await app.inject({ method: 'POST', url, headers: { ...headers(role), accept: 'application/x-ndjson' }, payload: input });
    expect(denied.statusCode).toBe(role === 'patient' ? 403 : 404);
    expect(denied.body).not.toContain('"type":"progress"');
  }
  const result = await app.inject({ method: 'POST', url, headers: { ...headers(), accept: 'application/x-ndjson' }, payload: input });
  expect(result.statusCode).toBe(200);
  expect(result.headers['content-type']).toContain('application/x-ndjson');
  expect(result.headers['cache-control']).toContain('no-store');
  const frames = result.body.trim().split('\n').map(line => JSON.parse(line));
  expect(frames.map(frame => frame.type)).toEqual(['progress', 'progress', 'result']);
  expect(frames[0]).toEqual({ type: 'progress', stage: 'context', sequence: 1 });
  expect(frames[1]).toEqual({ type: 'progress', stage: 'saving', sequence: 2 });
  expect(frames[2].workspace.id).toBe(state.id);
  expect(frames[2].workspace.messages).toHaveLength(2);
});

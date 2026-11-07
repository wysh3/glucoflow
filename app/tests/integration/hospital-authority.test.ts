import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { CareCommand, CareWorkspace, HospitalStaffAudit, HospitalStaffDirectory } from '@glucoflow/contracts';
import { buildServer } from '../../apps/api/src/server';
import { createAppContext, type AppContext } from '../../apps/api/src/context';
import { signLocalToken } from '../../apps/api/src/auth';
import { monitorCareBatch } from '../../apps/worker/src/care-monitor';
import { createTestContext, type TestContext } from './harness';

const accounts = {
  admin: randomUUID(), coordinator: randomUUID(), nurse: randomUUID(),
  doctor: randomUUID(), lab: randomUUID(), outsider: randomUUID(),
};
type Account = keyof typeof accounts;
const staff = '/api/v1/hospitals';
const care = '/api/v1/care/workspaces';
const tokens = {} as Record<Account, string>;
let db: TestContext;
let api: AppContext;
let app: Awaited<ReturnType<typeof buildServer>>;
let clinicId: string;

beforeAll(async () => {
  db = await createTestContext();
  api = await createAppContext();
  app = await buildServer(api);
  await db.owner(async (client) => {
    for (const [role, userId] of Object.entries(accounts) as [Account, string][]) {
      const email = `${userId}@example.invalid`;
      const displayName = role === 'lab' || role === 'nurse' ? 'Same Synthetic Name' : `Synthetic ${role}`;
      await client.query('insert into sutra.app_users(id,email,display_name) values($1,$2,$3)', [userId, email, displayName]);
      tokens[role] = (await signLocalToken(api.config, { userId, email })).accessToken;
    }
  });
});

beforeEach(async () => {
  clinicId = randomUUID();
  await db.owner(async (client) => {
    await client.query('insert into sutra.clinics(id,display_name,hospital_managed) values($1,$2,true)', [clinicId, 'Synthetic Hospital']);
    await client.query(`insert into sutra.memberships(clinic_id,user_id,administrator,care_role,clinician,active)
      values ($1,$2,true,null,false,true), ($1,$3,false,'coordinator',false,true), ($1,$4,false,null,false,false),
        ($1,$5,false,'doctor',true,true), ($1,$6,false,'lab',false,true)`,
    [clinicId, accounts.admin, accounts.coordinator, accounts.nurse, accounts.doctor, accounts.lab]);
    await client.query("insert into sutra.patients(clinic_id,clinic_identifier,display_name) values ($1,'S1','Synthetic patient')", [clinicId]);
  });
});

afterEach(async () => {
  await db.owner((client) => client.query('delete from sutra.clinics where id=$1', [clinicId]));
});

afterAll(async () => {
  await app?.close();
  await api?.pool.end();
  await db?.owner((client) => client.query('delete from sutra.app_users where id=any($1::uuid[])', [Object.values(accounts)]));
  await db?.close();
});

function request(actor: Account, method: 'GET' | 'PATCH' | 'POST', url: string, payload?: object, idempotencyKey = randomUUID()) {
  return app.inject({
    method, url, payload,
    headers: { authorization: `Bearer ${tokens[actor]}`, 'idempotency-key': idempotencyKey },
  });
}

async function assign(actor: Account, target: Account, careRole: CareWorkspace['role'] | null, active = true, administrator = false) {
  const { rows } = await db.owner((client) => client.query(
    'select sutra.hospital_staff_assignment(m) as assignment from sutra.memberships m where m.clinic_id=$1 and m.user_id=$2',
    [clinicId, accounts[target]],
  ));
  const expectedAssignment = rows[0]?.assignment ?? { careRole: null, active: false, administrator: false };
  return request(actor, 'PATCH', `${staff}/${clinicId}/staff/${accounts[target]}`, { careRole, active, administrator, expectedAssignment });
}

function create(actor: Account) {
  return request(actor, 'POST', care, { clinicId });
}

function enroll(actor: Account, workspace: CareWorkspace, target: Account, role: CareWorkspace['role']) {
  return request(actor, 'POST', `${care}/${workspace.id}/team`, { userId: accounts[target], role, active: true });
}

it('gates the directory, assignment, audit and patient data independently', async () => {
  expect((await app.inject({ method: 'GET', url: staff })).statusCode).toBe(401);
  expect((await request('admin', 'GET', staff)).json()).toMatchObject({ hospitals: [{ clinicId, administrator: true, careRole: null }] });
  expect((await request('nurse', 'GET', staff)).json()).toEqual({ hospitals: [] });
  expect((await request('outsider', 'GET', `${staff}/${clinicId}/staff`)).statusCode).toBe(404);
  expect((await request('coordinator', 'GET', `${staff}/${clinicId}/audit`)).statusCode).toBe(403);
  expect((await assign('coordinator', 'coordinator', 'doctor')).statusCode).toBe(403);
  expect((await assign('admin', 'admin', 'coordinator', true, true)).statusCode).toBe(403);
  expect((await assign('admin', 'nurse', 'doctor')).statusCode).toBe(403);
  expect((await assign('admin', 'outsider', 'coordinator')).statusCode).toBe(404);
  expect((await create('admin')).statusCode).toBe(403);

  const colleagues = (await request('coordinator', 'GET', `${staff}/${clinicId}/staff`)).json<HospitalStaffDirectory>();
  expect(colleagues.members.every((member) => member.active && member.email === null)).toBe(true);
  const directory = (await request('admin', 'GET', `${staff}/${clinicId}/staff`)).json<HospitalStaffDirectory>();
  expect(directory.members).toContainEqual(expect.objectContaining({ userId: accounts.nurse, active: false, email: expect.any(String) }));
  for (const role of ['admin', 'coordinator'] as const) {
    expect(await db.asActor(accounts[role], async (client) =>
      (await client.query('select 1 from sutra.patients where clinic_id=$1', [clinicId])).rowCount)).toBe(0);
  }

  expect((await assign('admin', 'nurse', 'nurse')).json()).toMatchObject({ userId: accounts.nurse, active: true, careRole: 'nurse' });
  expect((await assign('admin', 'nurse', 'nurse')).statusCode).toBe(200);
  const { events } = (await request('admin', 'GET', `${staff}/${clinicId}/audit`)).json<HospitalStaffAudit>();
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    actorId: accounts.admin, targetUserId: accounts.nurse,
    previous: { administrator: false, careRole: null, active: false },
    current: { administrator: false, careRole: 'nurse', active: true },
  });
});

it('binds creation, enrollment, clinical actions and live revocation to the hospital role', async () => {
  const created = await create('coordinator');
  expect(created.statusCode).toBe(201);
  const workspace = created.json<CareWorkspace>();
  expect(workspace).toMatchObject({ role: 'coordinator', synthetic: true });
  const teamUrl = `${care}/${workspace.id}/team`;
  expect((await request('coordinator', 'GET', teamUrl)).json()).toMatchObject({
    access: { role: 'coordinator', shared: true, hospitalClinicId: clinicId },
  });
  expect((await enroll('coordinator', workspace, 'coordinator', 'doctor')).statusCode).toBe(403);
  expect((await enroll('coordinator', workspace, 'lab', 'nurse')).statusCode).toBe(403);
  expect((await enroll('coordinator', workspace, 'lab', 'lab')).statusCode).toBe(200);
  expect((await enroll('coordinator', workspace, 'doctor', 'nurse')).statusCode).toBe(403);
  expect((await enroll('coordinator', workspace, 'doctor', 'doctor')).statusCode).toBe(200);
  const workspaceUrl = `${care}/${workspace.id}`;
  const labView = await request('lab', 'GET', workspaceUrl);
  expect(labView.json()).toMatchObject({ role: 'lab' });
  const order = workspace.orders[0]!;
  for (const command of [
    { type: 'set_role', role: 'doctor' },
    { type: 'add_order', encounterId: order.encounterId, testName: 'Synthetic test', targetMinutes: 30 },
    { type: 'source_event', encounterId: order.encounterId, orderId: order.id, kind: 'result_acknowledged', source: 'HIS', sourceRef: 'SYNTHETIC-ACK' },
  ]) {
    const forbidden = await request('lab', 'POST', `${workspaceUrl}/commands`, { expectedRevision: labView.json().revision, command });
    expect(forbidden.statusCode, JSON.stringify(forbidden.json())).toBe(403);
  }
  expect((await assign('admin', 'lab', 'nurse')).statusCode).toBe(200);
  expect((await request('lab', 'GET', workspaceUrl)).json()).toMatchObject({ role: 'nurse' });
  expect((await assign('admin', 'lab', 'nurse', false)).statusCode).toBe(200);
  expect((await request('lab', 'GET', workspaceUrl)).statusCode).toBe(403);
  expect((await assign('admin', 'coordinator', 'coordinator', false)).statusCode).toBe(200);
  expect((await request('coordinator', 'GET', workspaceUrl)).statusCode).toBe(403);
  expect(await db.asActor(accounts.coordinator, async (client) =>
    (await client.query('select id from sutra.care_workspaces where id=$1', [workspace.id])).rowCount)).toBe(0);
  expect((await request('doctor', 'GET', workspaceUrl)).json()).toMatchObject({ role: 'doctor' });
});

it('keeps one active administrator under concurrent opposing revocations', async () => {
  expect((await assign('admin', 'coordinator', 'coordinator', true, true)).statusCode).toBe(200);
  const results = await Promise.all([
    assign('admin', 'coordinator', 'coordinator', false),
    assign('coordinator', 'admin', null, false),
  ]);
  expect(results.map((response) => response.statusCode).sort()).toEqual([200, 403]);
  const winner = results[0]!.statusCode === 200 ? 'admin' : 'coordinator';
  const last = await assign(winner, winner, winner === 'admin' ? null : 'coordinator', false);
  expect(last.statusCode).toBe(409);
  expect(last.json().error.message).toMatch(/one active hospital administrator/i);
});

it('carries live managed enrollments across a synthetic continuation', async () => {
  const workspace = (await create('coordinator')).json<CareWorkspace>();
  expect((await enroll('coordinator', workspace, 'lab', 'lab')).statusCode).toBe(200);
  expect((await enroll('coordinator', workspace, 'doctor', 'doctor')).statusCode).toBe(200);
  expect((await assign('admin', 'lab', 'lab', false)).statusCode).toBe(200);
  // The continuation checks that open work is settled before archiving.
  await db.owner((client) => client.query(`update sutra.care_workspaces
    set state=jsonb_set(state,'{tasks}','[]'::jsonb) where id=$1`, [workspace.id]));
  const continued = await request('coordinator', 'POST', `${care}/${workspace.id}/continue`, { expectedRevision: workspace.revision });
  expect(continued.statusCode, JSON.stringify(continued.json())).toBe(200);
  const next = continued.json<{ workspace: CareWorkspace }>().workspace;
  expect(next).toMatchObject({ role: 'coordinator', previousWorkspaceId: workspace.id });
  expect((await request('doctor', 'GET', `${care}/${next.id}`)).json()).toMatchObject({ role: 'doctor' });
  expect((await assign('admin', 'lab', 'lab')).statusCode).toBe(200);
  expect((await request('lab', 'GET', `${care}/${next.id}`)).statusCode).toBe(404);
});

it('binds a task handover to the named shared account even when two roster names match', async () => {
  expect((await assign('admin', 'nurse', 'lab')).statusCode).toBe(200);
  const workspace = (await create('coordinator')).json<CareWorkspace>();
  const url = `${care}/${workspace.id}/commands`;
  const task = workspace.tasks[1]!;
  for (const account of ['lab', 'nurse'] as const) {
    expect((await enroll('coordinator', workspace, account, 'lab')).statusCode).toBe(200);
  }
  let state = workspace;
  for (const account of ['lab', 'nurse'] as const) {
    const registered = await request('coordinator', 'POST', url, {
      expectedRevision: state.revision,
      command: { type: 'coordination', action: 'register_staff', userId: accounts[account], name: 'Same Synthetic Name',
        team: 'Same synthetic laboratory', role: 'lab', capabilities: ['specimen_followup'], shiftEnd: new Date(Date.now() + 60_000).toISOString() },
    });
    expect(registered.statusCode, JSON.stringify(registered.json())).toBe(200);
    state = registered.json<CareWorkspace>();
  }
  const recipient = state.coordination!.staff.find((person) => person.userId === accounts.lab)!;
  const handover = () => request('coordinator', 'POST', url, {
    expectedRevision: state.revision,
    command: { type: 'request_transfer', taskId: task.id, recipientStaffId: recipient.id, reason: 'Synthetic shift change' },
  });
  expect((await assign('admin', 'lab', 'lab', false)).statusCode).toBe(200);
  expect((await handover()).statusCode).toBe(403);
  expect((await assign('admin', 'lab', 'lab')).statusCode).toBe(200);
  const pending = await handover();
  expect(pending.statusCode, JSON.stringify(pending.json())).toBe(200);
  state = pending.json<CareWorkspace>();
  expect(state.tasks.find((item) => item.id === task.id)).toMatchObject({
    owner: task.owner, transfer: { status: 'pending', recipientStaffId: recipient.id, recipientUserId: accounts.lab },
  });
  const accept = (account: Account) => request(account, 'POST', url, {
    expectedRevision: state.revision, command: { type: 'resolve_transfer', taskId: task.id, decision: 'accept' },
  });
  expect((await accept('nurse')).statusCode).toBe(403);
  const accepted = await accept('lab');
  expect(accepted.statusCode, JSON.stringify(accepted.json())).toBe(200);
  const updated = accepted.json<CareWorkspace>().tasks.find((item) => item.id === task.id);
  expect(updated).toMatchObject({
    owner: recipient.name, status: 'monitoring', completionEventId: null, transfer: { status: 'accepted' },
  });
});

it('lets the operator recover management for an existing eligible member without opening access to the admin', async () => {
  const workspace = (await create('coordinator')).json<CareWorkspace>();
  expect((await enroll('coordinator', workspace, 'doctor', 'doctor')).statusCode).toBe(200);
  const recover = (target: Account) => db.owner((client) => client.query(
    'select sutra.recover_hospital_workspace($1,$2,$3,$4)', [clinicId, workspace.id, accounts[target], 'SYNTHETIC-CHANGE'],
  ));
  await expect(recover('doctor')).rejects.toThrow('already has an active eligible owner');
  expect((await assign('admin', 'coordinator', 'coordinator', false)).statusCode).toBe(200);
  await expect(recover('admin')).rejects.toThrow('replacement must already be an active eligible workspace member');
  await expect(db.asActor(accounts.admin, (client) => client.query(
    'select sutra.recover_hospital_workspace($1,$2,$3,$4)', [clinicId, workspace.id, accounts.doctor, 'SYNTHETIC-CHANGE'],
  ))).rejects.toThrow('permission denied');
  await recover('doctor');
  expect((await request('admin', 'GET', `${care}/${workspace.id}`)).statusCode).toBe(403);
  expect((await request('doctor', 'GET', `${care}/${workspace.id}/team`)).json()).toMatchObject({
    access: { ownerId: accounts.doctor, role: 'doctor', shared: true },
  });
  expect((await request('doctor', 'GET', `${care}/${workspace.id}`)).json()).toMatchObject({
    revision: workspace.revision, tasks: workspace.tasks, events: workspace.events,
  });
  const { rows } = await db.asActor(accounts.admin, (client) => client.query(
    'select former_owner_id,new_owner_id,reference from sutra.hospital_workspace_recovery_audit where workspace_id=$1', [workspace.id],
  ));
  expect(rows).toEqual([{ former_owner_id: accounts.coordinator, new_owner_id: accounts.doctor, reference: 'SYNTHETIC-CHANGE' }]);
  expect((await enroll('doctor', workspace, 'lab', 'lab')).statusCode).toBe(200);
});

it('rechecks shared shift and handover recipients when a saved draft is approved or shared', async () => {
  let state = (await create('doctor')).json<CareWorkspace>();
  expect((await enroll('doctor', state, 'lab', 'lab')).statusCode).toBe(200);
  const command = (actor: Account, input: import('@glucoflow/contracts').CareCommand) => request(actor, 'POST', `${care}/${state.id}/commands`,
    { expectedRevision: state.revision, command: input });
  const apply = async (input: import('@glucoflow/contracts').CareCommand) => {
    const response = await command('doctor', input);
    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    state = response.json<CareWorkspace>();
  };
  await apply({ type: 'coordination', action: 'register_staff', userId: accounts.lab, name: 'Synthetic receiving staff', team: 'Lab',
    role: 'lab', capabilities: ['specimen_followup'], shiftEnd: new Date(Date.now() + 3_600_000).toISOString() });
  const recipient = state.coordination!.staff.find((person) => person.userId === accounts.lab)!;
  const encounterIds = [state.encounters[1]!.id];
  await apply({ type: 'shift_monitoring', action: 'create', scope: {
    encounterIds, rule: 'specimen_receipt', sources: ['HIS', 'LIS'], recipientStaffIds: [recipient.id],
    expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
  } });
  await apply({ type: 'handover_document', action: 'create', encounterIds, recipientStaffId: recipient.id });
  const approve = { type: 'shift_monitoring', action: 'approve', monitorId: state.shiftMonitoring![0]!.id, expectedVersion: 1 } as const;
  const share = { type: 'handover_document', action: 'share', documentId: state.handoverDocuments![0]!.id, expectedVersion: 1 } as const;
  expect((await assign('admin', 'lab', 'lab', false)).statusCode).toBe(200);
  expect((await command('doctor', approve)).statusCode).toBe(403);
  expect((await command('doctor', share)).statusCode).toBe(403);
  expect((await assign('admin', 'lab', 'lab')).statusCode).toBe(200);
  await apply(approve);
  await apply(share);
  const receipt = await command('lab', { ...share, action: 'receive' });
  expect(receipt.statusCode, JSON.stringify(receipt.json())).toBe(200);
  const received = receipt.json<CareWorkspace>();
  expect(received.handoverDocuments?.[0]?.versions[0]?.receivedBy).toMatchObject({ id: accounts.lab, simulated: false });
  expect(received.shiftMonitoring?.[0]?.status).toBe('monitoring');
  expect(received.tasks[1]?.owner).toBe(state.tasks[1]?.owner);
});

it('carries a synthetic result through separate admission, nursing, laboratory and physician accounts', async () => {
  const otherClinicId = randomUUID();
  await db.owner(async (client) => {
    await client.query("insert into sutra.clinics(id,display_name,hospital_managed) values ($1,'Other Synthetic Hospital',true)", [otherClinicId]);
    await client.query("insert into sutra.memberships(clinic_id,user_id,care_role) values ($1,$2,'lab')", [otherClinicId, accounts.outsider]);
  });
  try {
    const created = await create('doctor');
    expect(created.statusCode).toBe(201);
    let state = created.json<CareWorkspace>();
    expect(state.synthetic).toBe(true);
    expect((await assign('admin', 'nurse', 'nurse')).statusCode).toBe(200);
    for (const role of ['coordinator', 'nurse', 'lab'] as const) {
      expect((await enroll('doctor', state, role, role)).statusCode).toBe(200);
    }

    const url = `${care}/${state.id}`;
    const otherWorkspace = await request('outsider', 'POST', care, { clinicId: otherClinicId });
    expect(otherWorkspace.statusCode).toBe(201);
    expect((await request('outsider', 'GET', url)).statusCode).toBe(404);
    expect((await request('outsider', 'GET', `${url}/team`)).statusCode).toBe(404);
    expect((await request('outsider', 'GET', `${url}/history`)).statusCode).toBe(404);
    expect((await enroll('doctor', state, 'outsider', 'lab')).statusCode).toBe(403);
    expect((await request('doctor', 'GET', `${care}/${otherWorkspace.json<CareWorkspace>().id}`)).statusCode).toBe(404);

    const post = (actor: Account, command: CareCommand, expectedRevision = state.revision, key = randomUUID()) =>
      request(actor, 'POST', `${url}/commands`, { expectedRevision, command }, key);
    const apply = async (actor: Account, command: CareCommand) => {
      const response = await post(actor, command);
      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
      state = response.json<CareWorkspace>();
    };

    await apply('coordinator', { type: 'add_encounter', patientName: 'Synthetic cross-team patient', bed: 'Demo bed 21', documentedContext: [] });
    const encounter = state.encounters.at(-1)!;
    expect(encounter.registeredBy).toMatchObject({ id: accounts.coordinator, simulated: false, role: 'coordinator' });
    await apply('doctor', { type: 'add_order', encounterId: encounter.id, testName: 'Synthetic cross-team lab panel', targetMinutes: 30 });
    const order = state.orders.at(-1)!;
    const scope = { encounterId: encounter.id, orderId: order.id };
    const sourceEvent = (kind: CareWorkspace['events'][number]['kind'], source: 'HIS' | 'LIS', sourceRef: string) =>
      ({ type: 'source_event', kind, source, sourceRef, ...scope }) as const;
    expect(state.events.at(-1)).toMatchObject({ kind: 'order_placed', source: 'HIS', recordedBy: { id: accounts.doctor } });

    const shiftEnd = new Date(Date.now() + 60 * 60_000).toISOString();
    await apply('doctor', { type: 'coordination', action: 'register_staff', name: 'Synthetic shift nurse', userId: accounts.nurse,
      team: 'Synthetic ward', role: 'nurse', capabilities: ['specimen_followup'], shiftEnd });
    const nurse = state.coordination!.staff.find((person) => person.userId === accounts.nurse)!;
    for (const [kind, title] of [['specimen_receipt', 'Follow specimen receipt'], ['result_acknowledgement', 'Follow current result acknowledgement']] as const) {
      await apply('doctor', { type: 'create_task', ...scope, kind, title, durationMinutes: 30 });
      await apply('doctor', { type: 'task_action', action: 'approve', taskId: state.tasks.at(-1)!.id });
    }
    const findTask = (kind: 'specimen_receipt' | 'result_acknowledgement') => state.tasks.find((task) => task.orderId === order.id && task.kind === kind)!;
    await apply('doctor', { type: 'shift_monitoring', action: 'create', scope: {
      encounterIds: [encounter.id], rule: 'validated_result_acknowledgement', sources: ['HIS', 'LIS'],
      recipientStaffIds: [nurse.id], expiresAt: shiftEnd,
    } });
    const monitorId = state.shiftMonitoring![0]!.id;
    const approve = { type: 'shift_monitoring', action: 'approve', monitorId, expectedVersion: 1 } as const;
    expect((await post('nurse', approve)).statusCode).toBe(403);
    await apply('doctor', approve);

    const beforeSoftAck = state.events.length;
    await apply('nurse', { type: 'soft_acknowledge_task', taskId: findTask('specimen_receipt').id, note: 'I am following up on the specimen.' });
    expect(state.events).toHaveLength(beforeSoftAck);
    expect(findTask('specimen_receipt')).toMatchObject({ status: 'monitoring', completionEventId: null,
      softAcknowledgements: [{ actor: { id: accounts.nurse, role: 'nurse' } }],
    });
    const receipt = sourceEvent('specimen_received', 'LIS', 'SIM-E2E-RECEIPT');
    expect((await post('nurse', receipt)).statusCode).toBe(403);
    expect((await post('lab', { ...receipt, source: 'HIS' })).statusCode).toBe(422);
    expect((await post('outsider', receipt)).statusCode).toBe(404);
    await apply('nurse', sourceEvent('specimen_collected', 'HIS', 'SIM-E2E-COLLECTION'));
    expect(findTask('specimen_receipt').completionEventId).toBeNull();
    await apply('lab', receipt);
    const receiptProof = state.events.at(-1)!;
    expect(findTask('specimen_receipt')).toMatchObject({ status: 'source_confirmed', completionEventId: receiptProof.id });
    expect(receiptProof.recordedBy).toMatchObject({ id: accounts.lab, role: 'lab', simulated: false });

    await apply('lab', sourceEvent('result_validated', 'LIS', 'SIM-E2E-VALIDATED'));
    const validation = state.events.at(-1)!;
    const item = () => state.shiftMonitoring!.find((monitor) => monitor.id === monitorId)!.items[0]!;
    expect(item()).toMatchObject({ status: 'pending', orderId: order.id, sourceEventId: validation.id, existingTaskId: findTask('result_acknowledgement').id });
    expect(findTask('result_acknowledgement').completionEventId).toBeNull();
    const firstAck = { ...sourceEvent('result_acknowledged', 'HIS', 'SIM-E2E-PHYSICIAN-ACK'), occurredAt: validation.occurredAt };
    expect((await post('lab', firstAck)).statusCode).toBe(403);

    const acknowledgementRevision = state.revision;
    const keys = [randomUUID(), randomUUID()];
    const outcomes = await Promise.all(keys.map((key) => post('doctor', firstAck, acknowledgementRevision, key)));
    expect(outcomes.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const winner = outcomes.findIndex((response) => response.statusCode === 200);
    state = outcomes[winner]!.json<CareWorkspace>();
    const firstProof = state.events.at(-1)!;
    expect(firstProof.recordedBy).toMatchObject({ id: accounts.doctor, role: 'doctor', simulated: false });
    expect(item()).toMatchObject({ status: 'source_confirmed', sourceEventId: firstProof.id });
    const replay = await post('doctor', firstAck, acknowledgementRevision, keys[winner]!);
    expect(replay.statusCode).toBe(200);
    const replayedState = replay.json<CareWorkspace>();
    expect(replayedState.events.filter((event) => event.sourceRef === firstAck.sourceRef)).toHaveLength(1);
    expect(replayedState.revision).toBe(state.revision);
    expect(replayedState.shiftMonitoring).toEqual(state.shiftMonitoring);
    const nurseView = await request('nurse', 'GET', url);
    expect(nurseView.statusCode).toBe(200);
    expect(nurseView.json<CareWorkspace>()).toMatchObject({ role: 'nurse', revision: state.revision });
    // A worker can capture its batch timestamp before the source command commits.
    const staleBatchAt = new Date(Date.parse(firstProof.receivedAt) - 1).toISOString();
    const staleBatch = await db.asWorker(async (client) => {
      await client.query("update sutra.care_workspaces set monitor_checked_at='-infinity' where id=$1", [state.id]);
      return monitorCareBatch(client, staleBatchAt, state.id);
    });
    expect(staleBatch).toBe(0);

    await apply('lab', sourceEvent('result_corrected', 'LIS', 'SIM-E2E-CORRECTED'));
    const corrected = state.events.at(-1)!;
    expect(findTask('result_acknowledgement')).toMatchObject({ status: 'monitoring', completionEventId: null });
    expect(item()).toMatchObject({ status: 'pending', sourceEventId: corrected.id });
    expect(state.events).toContainEqual(firstProof);
    expect((await post('doctor', { ...firstAck, sourceRef: 'SIM-E2E-STALE-ACK' })).statusCode).toBe(409);
    await apply('doctor', sourceEvent('result_acknowledged', 'HIS', 'SIM-E2E-CORRECTED-ACK'));
    const currentProof = state.events.at(-1)!;
    expect(findTask('result_acknowledgement')).toMatchObject({ status: 'source_confirmed', completionEventId: currentProof.id });
    expect(item()).toMatchObject({ status: 'source_confirmed', sourceEventId: currentProof.id });

    const audit = await request('doctor', 'GET', `${url}/team/audit`);
    expect(audit.statusCode).toBe(200);
    expect(audit.json().events).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorId: accounts.nurse, actorRole: 'nurse', action: 'soft_acknowledge_task' }),
      expect.objectContaining({ actorId: accounts.lab, actorRole: 'lab', action: 'source_event' }),
      expect.objectContaining({ actorId: accounts.doctor, actorRole: 'doctor', action: 'shift_monitoring' }),
    ]));
    expect((await assign('admin', 'lab', 'lab', false)).statusCode).toBe(200);
    expect((await request('lab', 'GET', url)).statusCode).toBe(403);
    expect((await post('lab', sourceEvent('result_corrected', 'LIS', 'SIM-E2E-REVOKED-CORRECTION'))).statusCode).toBe(403);
    const exported = await request('doctor', 'GET', `${url}/export`);
    expect(exported.statusCode).toBe(200);
    expect(exported.json<CareWorkspace>()).toMatchObject({ synthetic: true, revision: state.revision, events: state.events });
  } finally {
    await db.owner((client) => client.query('delete from sutra.clinics where id=$1', [otherClinicId]));
  }
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  CareCommand, CareRuntimeStatus, CareSkill, CareSkillList, CareSkillPreview, CareWorkspace, GuideAnswer,
  SpeechCapabilities,
} from '@glucoflow/contracts';
import {
  SPEECH_MAX_DURATION_SECONDS, SPEECH_MAX_TEXT_CHARACTERS, SPEECH_STT_MODEL, SPEECH_TTS_MODEL,
} from '@glucoflow/contracts';
import { localRoot } from './lib/env';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && ['--offline-only', '--speech-only'].includes(args[0]!)),
    'Usage: pnpm exec tsx scripts/deploy-care-smoke.ts [--offline-only|--speech-only]');
  const hosted = JSON.parse(readFileSync(join(localRoot, 'azure-deployment-secrets.json'), 'utf8'));
  const fixture = JSON.parse(readFileSync(join(localRoot, 'hosted-demo-credentials.json'), 'utf8'));
  const accounts = fixture.accounts ?? fixture;
  const base = new URL('/api/v1', hosted.apiUrlPublic).href;

  async function signIn(role: 'clinic' | 'clinician' | 'other-clinic' | 'patient'): Promise<string> {
    const { email, password } = accounts[role];
    assert.ok(email.endsWith('@glucoflow.demo'), 'Smoke login must use a synthetic demo account');
    const response = await fetch(`${hosted.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: hosted.publishableKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 200, `Synthetic ${role} login HTTP status`);
    const { access_token } = (await response.json()) as { access_token?: string };
    assert.ok(access_token, `Synthetic ${role} login did not issue an access token`);
    return access_token;
  }

  async function api<T>(path: string, status: number, token?: string, body?: object, key?: string): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(token && { authorization: `Bearer ${token}` }),
        ...(body && { 'content-type': 'application/json' }),
        ...(key && { 'idempotency-key': key }),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(75_000),
    });
    assert.equal(response.status, status, `Care ${path.replace(/\/[a-f0-9-]{36}/, '/:id')} HTTP status`);
    return response.json() as Promise<T>;
  }

  if (args[0] === '--speech-only') {
    const capabilitiesPath = '/speech/capabilities';
    await api(capabilitiesPath, 401);
    for (const role of ['clinic', 'patient'] as const) {
      const capabilities = await api<SpeechCapabilities>(capabilitiesPath, 200, await signIn(role));
      assert.equal(capabilities.provider, 'sarvam');
      assert.equal(capabilities.retention, 'workspace_setting_unverified');
      assert.equal(capabilities.stt.status, 'configured');
      assert.equal(capabilities.stt.model, SPEECH_STT_MODEL);
      assert.equal(capabilities.stt.maxDurationSeconds, SPEECH_MAX_DURATION_SECONDS);
      assert.equal(capabilities.tts.status, 'configured');
      assert.equal(capabilities.tts.model, SPEECH_TTS_MODEL);
      assert.equal(capabilities.tts.maxTextCharacters, SPEECH_MAX_TEXT_CHARACTERS);
      assert.ok(capabilities.stt.languageCodes.includes('hi-IN') && capabilities.tts.languageCodes.includes('hi-IN'));
    }
    console.log('PASS Sarvam speech capabilities for clinic and patient, with unauthenticated denial and zero provider calls');
    return;
  }

  const [clinic, other, patient, clinician] = await Promise.all([
    signIn('clinic'), signIn('other-clinic'), signIn('patient'), signIn('clinician'),
  ]);
  const line = await api<{ items: { id: string }[] }>('/obligations?view=line', 200, clinician);
  const obligation = line.items[0];
  assert.ok(obligation?.id, 'Expected a synthetic item in the clinician line');
  for (const endpoint of [`/obligations/${obligation.id}`, `/results/${obligation.id}/proof`]) {
    await api(endpoint, 200, clinician);
    await api(endpoint, 404, other);
  }
  console.log('PASS Legacy obligation and proof reads for owning clinic, denied for another clinic');

  const queueStarted = performance.now();
  const queue = await api<{ items: unknown[] }>('/queue?state=awaiting_review', 200, clinic);
  assert.ok(Array.isArray(queue.items), 'Expected the filtered review queue response');
  console.log(`PASS Filtered clinic review queue (${Math.round(performance.now() - queueStarted)} ms)`);

  const runtime = await api<CareRuntimeStatus>('/care/runtime', 200, clinic);
  assert.equal(runtime.engine, 'hermes');
  assert.equal(runtime.version, '0.23.0');
  assert.equal(runtime.configured, true);
  assert.equal(runtime.available, true);
  console.log('PASS Hermes 0.23.0 sidecar available through authenticated API');

  const guide = await api<GuideAnswer>('/guide', 200, patient, {
    screen: 'home', message: 'Can you diagnose diabetes?',
  });
  assert.equal(guide.mode, 'local');
  assert.equal(guide.actions.length, 0);
  console.log('PASS Hosted guide route and deterministic clinical request boundary');

  let workspace = await api<CareWorkspace>('/care/workspaces', 201, clinic, {});
  assert.equal(workspace.synthetic, true);
  assert.ok(workspace.events.length > 0);
  const path = `/care/workspaces/${workspace.id}`;
  await api(path, 401);
  await api(path, 403, patient);
  await api(path, 404, other);
  await api(`${path}/export`, 404, other);
  console.log('PASS Synthetic workspace, unauthenticated, patient and other-clinic isolation');

  function send(command: CareCommand, state = workspace, key = randomUUID(), status = 200) {
    return api<CareWorkspace>(`${path}/commands`, status, clinic, { expectedRevision: state.revision, command }, key);
  }

  const initial = workspace;
  const key = randomUUID();
  const role = { type: 'set_role', role: 'lab' } as const;
  workspace = await send(role, initial, key);
  assert.equal(workspace.revision, initial.revision + 1);
  assert.equal((await send(role, initial, key)).revision, workspace.revision);
  await send(role, initial, randomUUID(), 409);
  console.log('PASS Committed retry is idempotent and stale revision is rejected');

  const pending = workspace.tasks.find((item) => item.kind === 'specimen_receipt' && item.status === 'monitoring');
  assert.ok(pending?.orderId, 'Expected a seeded specimen watch');
  const sourceRef = `LIS-SMOKE-${randomUUID().slice(0, 8)}`;
  workspace = await send({
    type: 'source_event', source: 'LIS', kind: 'specimen_received', sourceRef,
    orderId: pending.orderId, encounterId: pending.encounterId,
  });
  const evidence = workspace.events.find((item) => item.sourceRef === sourceRef);
  assert.ok(evidence);
  const completed = workspace.tasks.find((item) => item.id === pending.id);
  assert.equal(completed?.status, 'source_confirmed');
  assert.equal(completed.completionEventId, evidence.id);
  const exported = await api<CareWorkspace>(`${path}/export`, 200, clinic);
  assert.ok(exported.events.some((item) => item.id === evidence.id));
  console.log('PASS Independent LIS receipt confirms the watch and survives export');

  const library = await api<CareSkillList>(`${path}/skills`, 200, clinic);
  assert.ok(!library.skills.some((item) => item.pattern === 'specimen_receipt' && item.status === 'approved'),
    'The smoke must not supersede an active receipt skill in the shared library');
  const skill = await api<CareSkill>(`${path}/skills`, 201, clinic, { taskId: completed.id });
  assert.equal(skill.status, 'draft');
  assert.equal(skill.origin?.eventId, evidence.id);
  const skillPath = `${path}/skills/${skill.id}`;
  const tested = await api<CareSkill>(`${skillPath}/actions`, 200, clinic, { action: 'test' });
  assert.equal(tested.tests.length, 5);
  assert.ok(tested.tests.every((test) => test.passed), 'Hosted skill checks did not all pass');
  assert.equal((await api<CareSkill>(`${skillPath}/actions`, 200, clinic, { action: 'approve' })).status, 'approved');

  let target = await api<CareWorkspace>('/care/workspaces', 201, clinic, {});
  const targetPath = `/care/workspaces/${target.id}`;
  const targetSkills = await api<CareSkillList>(`${targetPath}/skills`, 200, clinic);
  assert.ok(targetSkills.skills.some((item) => item.id === skill.id && item.status === 'approved'),
    'Approved skill did not persist in the shared synthetic clinic library');
  await api(`${targetPath}/skills`, 404, other);
  const encounterId = target.encounters[0]!.id;
  assert.notEqual(encounterId, pending.encounterId, 'Expected a new synthetic encounter');
  const targetCommand = (command: CareCommand) => api<CareWorkspace>(
    `${targetPath}/commands`, 200, clinic, { expectedRevision: target.revision, command }, randomUUID(),
  );
  target = await targetCommand({ type: 'add_order', encounterId, testName: 'Synthetic B specimen', targetMinutes: 50 });
  const orderId = target.orders.at(-1)!.id;
  const preview = () => api<CareSkillPreview>(`${targetPath}/skills/${skill.id}/preview`, 200, clinic, {
    encounterId, orderId,
  });
  assert.equal((await preview()).eligible, false);
  target = await targetCommand({ type: 'set_role', role: 'nurse' });
  target = await targetCommand({
    type: 'source_event', source: 'HIS', kind: 'specimen_collected',
    sourceRef: `HIS-SMOKE-${randomUUID().slice(0, 8)}`, encounterId, orderId,
  });
  const targetEvidence = target.events.at(-1)!;
  const eligible = await preview();
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.sourceEventId, targetEvidence.id);
  target = await targetCommand({ type: 'apply_skill', skillId: skill.id, encounterId, orderId });
  const reloadedTarget = await api<CareWorkspace>(targetPath, 200, clinic);
  const proposal = reloadedTarget.tasks.find((item) => item.id === target.tasks.at(-1)?.id);
  assert.ok(proposal && proposal.orderId === orderId && proposal.encounterId === encounterId
    && proposal.status === 'awaiting_approval' && proposal.completionEventId === null
    && proposal.skillVersion === skill.version && proposal.skillSourceEventId === targetEvidence.id,
  'Persisted skill proposal must remain pending with only exact target evidence');
  assert.equal((await api<CareSkill>(`${skillPath}/actions`, 200, clinic, { action: 'retire' })).status, 'retired');
  console.log('PASS Shared skill test and approval, exact B evidence, persisted pending proposal and smoke skill retirement');

  const offline = await api<CareWorkspace>(`${path}/chat`, 200, clinic, {
    mode: 'offline', message: 'Draft a handover for the next shift',
  });
  assert.equal(offline.messages.at(-1)?.engine, 'offline');
  assert.deepEqual(offline.events, workspace.events, 'Offline chat changed source evidence');
  console.log('PASS Explicit offline mode preserves source evidence');
  if (args[0] === '--offline-only') return;

  const liveStarted = performance.now();
  const live = await api<CareWorkspace>(`${path}/chat`, 200, clinic, {
    mode: 'hermes',
    message: `What is the documented specimen receipt status for exact order ${pending.orderId}? Cite its source evidence.`,
  });
  const answer = live.messages.at(-1);
  assert.equal(answer?.engine, 'hermes');
  assert.ok(answer.content.length > 0);
  assert.ok(answer.sources?.includes(evidence.id), 'Live reply must include the independently emitted source');
  assert.deepEqual(live.events, offline.events, 'Live chat changed source evidence');
  assert.deepEqual(live.tasks, offline.tasks, 'Live chat changed workflow tasks');
  console.log(`PASS Live Hermes answered with authorized source evidence and left workflow state intact (${Math.round(performance.now() - liveStarted)} ms)`);
}

main().catch((error: unknown) => {
  // Suppress generic fetch errors and assertion diffs containing request/record data.
  console.error(error instanceof assert.AssertionError ? error.message : 'Hosted care smoke request failed.');
  process.exitCode = 1;
});

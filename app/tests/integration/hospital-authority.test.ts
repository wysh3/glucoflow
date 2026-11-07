import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { CareWorkspace, HospitalStaffAudit, HospitalStaffDirectory } from '@glucoflow/contracts';
import { buildServer } from '../../apps/api/src/server';
import { createAppContext, type AppContext } from '../../apps/api/src/context';
import { signLocalToken } from '../../apps/api/src/auth';
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

function request(actor: Account, method: 'GET' | 'PATCH' | 'POST', url: string, payload?: object) {
  return app.inject({
    method, url, payload,
    headers: { authorization: `Bearer ${tokens[actor]}`, 'idempotency-key': randomUUID() },
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

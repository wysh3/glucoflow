import {beforeAll, afterAll, it, expect} from 'vitest';
import {createTestContext,createFixture,removeClinic,type TestContext,type TestFixture} from './harness';
import {createWorkspace} from '../../apps/api/src/care/repository';
import {monitorCareBatch} from '../../apps/worker/src/care-monitor';
import type {CareWorkspace} from '@glucoflow/contracts';
let db:TestContext; let fixture:TestFixture;
beforeAll(async()=>{db=await createTestContext();fixture=await createFixture(db,'background');});
afterAll(async()=>{if(fixture){await removeClinic(db,fixture.clinicId);await removeClinic(db,fixture.otherClinicId);}await db?.close();});
it('persists expiry without any workspace read and does not duplicate transitions',async()=>{
  const state=await db.asActor(fixture.clinicianId,c=>createWorkspace(c,fixture.clinicianId,fixture.clinicId));
  const at=new Date(Date.now()+2*86400000).toISOString();
  await db.asWorker(c=>monitorCareBatch(c,at,state.id));
  const read=()=>db.asActor(fixture.clinicianId,async c=>(await c.query<{state:CareWorkspace}>('select state from sutra.care_workspaces where id=$1',[state.id])).rows[0]!.state);
  const after=await read();
  expect(after.tasks.every(t=>t.status==='expired')).toBe(true);
  expect(after.revision).toBe(state.revision+1);
  await db.asWorker(c=>monitorCareBatch(c,new Date(Date.parse(at)+30000).toISOString(),state.id));
  expect((await read()).activity).toEqual(after.activity);
});
it('marks stale evidence unknown without fabricating completion; scheduler metadata is not client-writable',async()=>{
  const state=await db.asActor(fixture.clinicianId,c=>createWorkspace(c,fixture.clinicianId,fixture.clinicId));
  await db.asWorker(c=>monitorCareBatch(c,new Date(Date.now()+16*60000).toISOString(),state.id));
  const after=await db.asActor(fixture.clinicianId,async c=>(await c.query<{state:CareWorkspace}>('select state from sutra.care_workspaces where id=$1',[state.id])).rows[0]!.state);
  expect(after.tasks[1]!.status).toBe('awaiting_evidence');
  expect(after.tasks[1]!.completionEventId).toBeNull();
  await expect(db.asActor(fixture.clinicianId,c=>c.query('update sutra.care_workspaces set monitor_checked_at=now() where id=$1',[state.id]))).rejects.toThrow();
});


it('skips locked workspaces and safely retries after release', async () => {
  const state = await db.asActor(fixture.clinicianId, c => createWorkspace(c, fixture.clinicianId, fixture.clinicId));
  const at = new Date(Date.now() + 2 * 86400000).toISOString();
  let locked!: () => void;
  const acquired = new Promise<void>(resolve => { locked = resolve; });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const holder = db.asActor(fixture.clinicianId, async c => {
    await c.query('select id from sutra.care_workspaces where id=$1 for update', [state.id]);
    locked();
    await held;
  });
  try {
    await acquired;
    expect(await db.asWorker(c => monitorCareBatch(c, at, state.id))).toBe(0);
  } finally {
    release();
    await holder;
  }
  expect(await db.asWorker(c => monitorCareBatch(c, at, state.id))).toBe(1);
});

it('concurrent monitors commit a transition once', async () => {
  const state = await db.asActor(fixture.clinicianId, c => createWorkspace(c, fixture.clinicianId, fixture.clinicId));
  const at = new Date(Date.now() + 2 * 86400000).toISOString();
  const changes = await Promise.all(Array.from({length: 4}, () => db.asWorker(c => monitorCareBatch(c, at, state.id))));
  expect(changes.reduce((sum, n) => sum + n, 0)).toBe(1);
  const after = await db.asActor(fixture.clinicianId, async c =>
    (await c.query<{state: CareWorkspace}>('select state from sutra.care_workspaces where id=$1', [state.id])).rows[0]!.state);
  expect(after.revision).toBe(state.revision + 1);
  expect(after.tasks.every(t => t.status === 'expired')).toBe(true);
});

it('rolls back transition and scheduling timestamp on interruption and retries safely', async () => {
  const state = await db.asActor(fixture.clinicianId, c => createWorkspace(c, fixture.clinicianId, fixture.clinicId));
  const at = new Date(Date.now() + 2 * 86400000).toISOString();
  await expect(db.asWorker(async c => {
    expect(await monitorCareBatch(c, at, state.id)).toBe(1);
    throw new Error('synthetic interruption before commit');
  })).rejects.toThrow('synthetic interruption before commit');
  const after = await db.asActor(fixture.clinicianId, async c =>
    (await c.query<{state: CareWorkspace}>('select state from sutra.care_workspaces where id=$1', [state.id])).rows[0]!.state);
  expect(after).toEqual(state);
  expect(await db.asWorker(c => monitorCareBatch(c, at, state.id))).toBe(1);
  expect(await db.asWorker(c => monitorCareBatch(c, at, state.id))).toBe(0);
});

it('expires shift monitoring in the worker when no individual task is active', async () => {
  const { applyCommand } = await import('../../apps/api/src/care/repository');
  const { randomUUID } = await import('node:crypto');
  const state = await db.asActor(fixture.clinicianId,c=>createWorkspace(c,fixture.clinicianId,fixture.clinicId));
  await db.owner((client) => client.query(
    "update sutra.care_workspaces set state=jsonb_set(state,'{tasks}','[]') where id=$1", [state.id],
  ));
  const expiry = new Date(Date.now()+60_000).toISOString();
  const prepared = await db.asActor(fixture.clinicianId,(client) => applyCommand(client,state.id,fixture.clinicianId,randomUUID(),{
    expectedRevision:state.revision, command:{ type:'shift_monitoring',action:'create',scope:{
      encounterIds:[state.encounters[2]!.id],rule:'validated_result_acknowledgement',sources:['HIS','LIS'],
      recipientStaffIds:[state.demoStaffId!],expiresAt:expiry,
    }},
  }));
  const monitor = prepared.shiftMonitoring![0]!;
  const approved = await db.asActor(fixture.clinicianId,(client) => applyCommand(client,state.id,fixture.clinicianId,randomUUID(),{
    expectedRevision:prepared.revision, command:{ type:'shift_monitoring',action:'approve',monitorId:monitor.id,expectedVersion:1 },
  }));
  const { continueWorkspace } = await import('../../apps/api/src/care/repository');
  await expect(db.asActor(fixture.clinicianId,(client) =>
    continueWorkspace(client,state.id,fixture.clinicianId,approved.revision))).rejects.toThrow('Stop or finish open shift monitoring');
  const afterExpiry = new Date(Date.parse(expiry)+30_000).toISOString();
  expect(await db.asWorker((client) => monitorCareBatch(client,afterExpiry,state.id))).toBe(1);
  const after = await db.asActor(fixture.clinicianId,async (client) =>
    (await client.query<{state:CareWorkspace}>('select state from sutra.care_workspaces where id=$1',[state.id])).rows[0]!.state);
  expect(after.shiftMonitoring?.[0]).toMatchObject({status:'expired'});
  expect(after.activity.filter((item) => item.kind==='shift_monitor_expired')).toHaveLength(1);
  expect(after.tasks).toEqual([]);
});

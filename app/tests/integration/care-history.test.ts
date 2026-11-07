import { beforeAll, afterAll, it, expect } from 'vitest';
import { createTestContext, createFixture, removeClinic, type TestContext, type TestFixture } from './harness';
import { createWorkspace } from '../../apps/api/src/care/repository';
import { listWorkspaceHistory, readWorkspaceHistory } from '../../apps/api/src/care/history';
import { monitorCareBatch } from '../../apps/worker/src/care-monitor';
let db: TestContext; let fixture: TestFixture;
beforeAll(async () => { db = await createTestContext(); fixture = await createFixture(db, 'history'); });
afterAll(async () => { if (fixture) { await removeClinic(db, fixture.clinicId); await removeClinic(db, fixture.otherClinicId); } await db?.close(); });
it('keeps source-bearing initial and background revisions atomically and prevents audit rewrites', async () => {
  const state = await db.asActor(fixture.clinicianId, c => createWorkspace(c, fixture.clinicianId, fixture.clinicId));
  const history = () => db.asActor(fixture.clinicianId, async c => (await c.query('select revision,state from sutra.care_workspace_history where workspace_id=$1 order by id', [state.id])).rows);
  expect(await history()).toEqual([{ revision: state.revision, state }]);
  const at = new Date(Date.now() + 2 * 86400000).toISOString();
  await expect(db.asWorker(async c => { await monitorCareBatch(c, at, state.id); throw new Error('rollback'); })).rejects.toThrow('rollback');
  expect(await history()).toHaveLength(1);
  await db.asWorker(c => monitorCareBatch(c, at, state.id));
  expect(await history()).toHaveLength(2);
  expect((await history())[0]!.state).toEqual(state);
  await db.asWorker(c => monitorCareBatch(c, new Date(Date.parse(at)+30000).toISOString(), state.id));
  expect(await history()).toHaveLength(2);
  await expect(db.asActor(fixture.clinicianId, c => c.query('update sutra.care_workspace_history set state=\'{}\' where workspace_id=$1',[state.id]))).rejects.toThrow();
  await expect(db.asActor(fixture.clinicianId, c => c.query('delete from sutra.care_workspace_history where workspace_id=$1',[state.id]))).rejects.toThrow();
  const other = await db.asActor(fixture.otherReviewerId, async c => (await c.query('select state from sutra.care_workspace_history where workspace_id=$1',[state.id])).rows);
  expect(other).toEqual([]);
  const colleague = await db.asActor(fixture.reviewerId, async c => (await c.query('select state from sutra.care_workspace_history where workspace_id=$1',[state.id])).rows);
  expect(colleague).toEqual([]);
});

it('pages audit summaries without omitting revisions and scopes individual snapshots', async () => {
  const state = await db.asActor(fixture.clinicianId, c => createWorkspace(c, fixture.clinicianId, fixture.clinicId));
  await db.asActor(fixture.clinicianId, async c => {
    for (let i=0;i<32;i++) await c.query("update sutra.care_workspaces set state=jsonb_set(state,'{revision}',to_jsonb((state->>'revision')::integer+1)) where id=$1",[state.id]);
  });
  const first = await db.asActor(fixture.clinicianId,c=>listWorkspaceHistory(c,state.id));
  expect(first.revisions).toHaveLength(30);
  expect(first.nextCursor).not.toBeNull();
  const second = await db.asActor(fixture.clinicianId,c=>listWorkspaceHistory(c,state.id,first.nextCursor!));
  expect(second.revisions).toHaveLength(3);
  expect(second.nextCursor).toBeNull();
  expect(new Set([...first.revisions,...second.revisions].map(r=>r.id)).size).toBe(33);
  expect(first.revisions[0]).not.toHaveProperty('state');
  const initial=await db.asActor(fixture.clinicianId,c=>readWorkspaceHistory(c,state.id,second.revisions.at(-1)!.id));
  expect(initial.state).toEqual(state);
  await expect(db.asActor(fixture.otherReviewerId,c=>readWorkspaceHistory(c,state.id,initial.id))).rejects.toMatchObject({status:404});
  await expect(db.asActor(fixture.clinicianId,c=>listWorkspaceHistory(c,state.id,'-1'))).rejects.toMatchObject({status:422});
});

it('uses numeric history ordering across an ID digit boundary',async()=>{
 const state=await db.asActor(fixture.clinicianId,c=>createWorkspace(c,fixture.clinicianId,fixture.clinicId));
 await db.owner(c=>c.query(`insert into sutra.care_workspace_history(id,workspace_id,revision,state) overriding system value
   select 999999999999999980::bigint+n,$1,1,$2::jsonb from generate_series(0,32) n`,[state.id,JSON.stringify(state)]));
 const first=await db.asActor(fixture.clinicianId,c=>listWorkspaceHistory(c,state.id));
 const next=await db.asActor(fixture.clinicianId,c=>listWorkspaceHistory(c,state.id,first.nextCursor!));
 expect(first.revisions[0]!.id).toBe('1000000000000000012');
 expect(new Set([...first.revisions,...next.revisions].map(r=>r.id)).size).toBe(34);
 expect(next.nextCursor).toBeNull();
});

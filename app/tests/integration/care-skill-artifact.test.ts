import { beforeAll, afterAll, it, expect } from 'vitest';
import { createTestContext, createFixture, removeClinic, type TestContext, type TestFixture } from './harness';
import { createWorkspace } from '../../apps/api/src/care/repository';
import { actOnSkill } from '../../apps/api/src/care/skills';
import { createSkillArtifact } from '../../apps/api/src/care/skill-artifact';
let db: TestContext;
let fixture: TestFixture;
let workspaceId: string;
beforeAll(async () => {
  db = await createTestContext(); fixture = await createFixture(db, 'skill-artifact');
  workspaceId = (await db.asActor(fixture.clinicianId, c => createWorkspace(c, fixture.clinicianId, fixture.clinicId))).id;
});
afterAll(async () => {
  if (fixture) { await removeClinic(db, fixture.clinicId); await removeClinic(db, fixture.otherClinicId); }
  await db?.close();
});
async function draft(version: number) {
  return db.asActor(fixture.clinicianId, async c => (await c.query<{id: string}>(
    `insert into sutra.care_skills (clinic_id,pattern,version,status,captured_at,created_by,artifact)
     values ($1,'specimen_receipt',$2,'draft',now(),$3,$4) returning id`,
    [fixture.clinicId, version, fixture.clinicianId, createSkillArtifact('specimen_receipt')],
  )).rows[0]!.id);
}
it('binds testing and approval to the stored artifact, then restores identical semantics', async () => {
  const id = await draft(1);
  const act = (skillId: string, action: 'test'|'approve'|'retire'|'rollback') =>
    db.asActor(fixture.clinicianId, c => actOnSkill(c, workspaceId, fixture.clinicianId, skillId, action));
  await expect(act(id, 'approve')).rejects.toMatchObject({code: 'skill_tests_required'});
  await act(id, 'test');
  await expect(act(id, 'approve')).resolves.toMatchObject({status: 'approved'});
  await act(id, 'retire');
  const restored = await act(id, 'rollback');
  const rows = await db.asActor(fixture.clinicianId, async c => (await c.query(
    'select artifact,tested_artifact from sutra.care_skills where id = any($1::uuid[])', [[id, restored.id]],
  )).rows);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toEqual(rows[1]);
  expect(rows[0].artifact).toEqual(rows[0].tested_artifact);
});
it('database rejects changing semantic history, even through an owner connection', async () => {
  const id = await draft(3);
  await expect(db.owner(c => c.query("update sutra.care_skills set artifact = artifact || '{\"durationMinutes\":60}' where id=$1", [id])))
    .rejects.toThrow('immutable');
});
it('database rejects publication with passing booleans but no artifact attestation', async () => {
  const id = await draft(4);
  await expect(db.asActor(fixture.clinicianId, c => c.query(
    `update sutra.care_skills set status='approved',approved_at=now(),approved_by=$2,
      test_results=array[true,true,true,true,true] where id=$1`, [id, fixture.clinicianId],
  ))).rejects.toThrow('bound to this artifact');
});
it('keeps artifacts invisible to another clinic and denies patient publication', async () => {
  const id = await draft(5);
  const otherRows = await db.asActor(fixture.otherReviewerId, async c => (await c.query(
    'select artifact from sutra.care_skills where id=$1', [id],
  )).rows);
  expect(otherRows).toEqual([]);
  await expect(db.asActor(fixture.patientUserId, c => actOnSkill(c, workspaceId, fixture.patientUserId, id, 'approve')))
    .rejects.toMatchObject({status: 404});
});

import { afterAll, beforeAll, expect, it } from 'vitest';
import { listHistory } from '@glucoflow/data';
import { createFixture, createTestContext, removeClinic, type TestContext, type TestFixture } from './harness';
let ctx: TestContext; let f: TestFixture;
beforeAll(async () => { ctx = await createTestContext(); f = await createFixture(ctx, 'demo-polish'); });
afterAll(async () => { await removeClinic(ctx, f.clinicId); await removeClinic(ctx, f.otherClinicId); await ctx.close(); });
it('worker audit events identify the actor as System', async () => {
  await ctx.owner(c => c.query("insert into sutra.audit_events(clinic_id,patient_id,action,entity_type,entity_id) values($1,$2,'export_completed','export',$3)", [f.clinicId, f.patientId, crypto.randomUUID()]));
  const history = await ctx.asActor(f.reviewerId, c => listHistory(c, f.patientId, {}));
  expect(history.items.find(e => e.action === 'export_completed')?.actorRole).toBe('System');
});
it('matching patient identifiers do not implicitly assign the supplied scenario', async () => {
  const row = await ctx.asActor(f.reviewerId, c => c.query('select master_scenario from sutra.patients where id=$1', [f.patientId]));
  expect(row.rows[0]?.master_scenario).toBe(false);
});

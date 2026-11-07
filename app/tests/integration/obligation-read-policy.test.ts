import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createResult, getObligation, getResultProof } from '@glucoflow/data';
import { createFixture, createTestContext, removeClinic, type TestContext, type TestFixture } from './harness';

let context: TestContext;
let fixture: TestFixture;
beforeAll(async () => { context = await createTestContext(); fixture = await createFixture(context, 'read-policy'); });
afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

it('repairs legacy-role source reads while keeping other clinics invisible', async () => {
  const now = new Date().toISOString();
  const id = await context.asActor(fixture.reviewerId, client => createResult(client, fixture.clinicId, {
    patientId: fixture.patientId, externalRef: `read-policy-${Date.now()}`, sourceChannel: 'whatsapp',
    labName: 'Synthetic laboratory', reportReceivedAt: now, labReleasedAt: now,
    patientNameRaw: 'Synthetic patient', patientIdentifierRaw: fixture.patientIdentifier,
    testName: 'Synthetic laboratory report', valueText: 'source text', labFlag: 'unknown', labHold: false,
    resultKind: 'unscheduled',
  }));
  const client = await context.ownerPool.connect();
  try {
    await client.query('begin');
    // Reproduce the hosted deployment: old policies belong to another role.
    for (const table of ['results', 'result_events', 'result_attempts']) {
      await client.query(`drop policy if exists ${table}_api_read on sutra.${table}`);
      await client.query(`alter policy ${table}_clinic_read on sutra.${table} to sutra_worker`);
    }
    await client.query('set local role sutra_api');
    await client.query("select set_config('app.actor_id', $1, true)", [fixture.reviewerId]);
    expect(await getObligation(client, id)).toBeNull();
    await client.query('reset role');
    await client.query(readFileSync('supabase/migrations/045_source_read_policies.sql', 'utf8'));
    await client.query('set local role sutra_api');
    expect((await getObligation(client, id))?.id).toBe(id);
    expect(await getResultProof(client, id)).not.toBeNull();
    await client.query("select set_config('app.actor_id', $1, true)", [fixture.otherReviewerId]);
    expect(await getObligation(client, id)).toBeNull();
    expect(await getResultProof(client, id)).toBeNull();
  } finally {
    await client.query('rollback');
    client.release();
  }
});

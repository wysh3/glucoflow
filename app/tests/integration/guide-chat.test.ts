import { beforeAll, afterAll, it, expect } from 'vitest';
import { buildServer } from '../../apps/api/src/server';
import { createAppContext } from '../../apps/api/src/context';
import { signLocalToken } from '../../apps/api/src/auth';
import {
  createTestContext,
  createFixture,
  removeClinic,
  stageFixtureUpload,
  runOneJob,
  latestBatch,
  type TestContext,
  type TestFixture,
} from './harness';
let ctx: TestContext,
  f: TestFixture,
  app: Awaited<ReturnType<typeof buildServer>>;
const tokens: Record<string, string> = {};
beforeAll(async () => {
  ctx = await createTestContext();
  f = await createFixture(ctx, 'chat');
  const api = await createAppContext();
  api.config = { ...api.config, GUIDE_MODE: 'local' };
  app = await buildServer(api);
  for (const [role, userId] of Object.entries({
    patient: f.patientUserId,
    doctor: f.clinicianId,
    other: f.otherReviewerId,
    reviewer: f.reviewerId,
  }))
    tokens[role] = (
      await signLocalToken(api.config, {
        userId,
        email: 'synthetic@glucoflow.demo',
      })
    ).accessToken;
  await ctx.owner(async (c) => {
    await c.query(
      'update sutra.memberships set clinician=false where user_id=$1',
      [f.reviewerId],
    );
    await c.query(
      "insert into sutra.patient_notes(clinic_id,patient_id,author_id,category,body,event_date) values($1,$2,$3,'symptoms','Synthetic note: a headache reported','2026-10-03')",
      [f.clinicId, f.patientId, f.patientUserId],
    );
  });
});
afterAll(async () => {
  await app.close();
  await removeClinic(ctx, f.clinicId);
  await removeClinic(ctx, f.otherClinicId);
  await ctx.close();
});
const send = (
  role: string,
  patientId = f.patientId,
  message = 'Summarize the records',
  extra: Record<string, unknown> = {},
) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/guide/chat',
    headers: tokens[role] ? { authorization: `Bearer ${tokens[role]}` } : {},
    payload: { screen: 'overview', patientId, message, history: [], ...extra },
  });
it('requires authentication on contextual chat', async () => {
  expect((await send('anonymous')).statusCode).toBe(401);
});
it('allows only this patient and their clinician to read the context', async () => {
  for (const role of ['patient', 'doctor']) {
    const r = await send(role);
    expect(r.statusCode).toBe(200);
    expect(r.json().patient.patientId).toBe(f.patientId);
  }
  expect((await send('patient', f.otherPatientId)).statusCode).toBe(404);
  expect((await send('other')).statusCode).toBe(404);
  expect((await send('reviewer')).statusCode).toBe(403);
});
it('returns patient-reported notes separately from approved facts', async () => {
  const r = await send('doctor', f.patientId, 'What symptoms were reported?');
  expect(r.statusCode).toBe(200);
  expect(r.json().cards).toEqual([
    expect.objectContaining({
      kind: 'reported',
      detail: 'Synthetic note: a headache reported',
      date: '2026-10-03',
    }),
  ]);
});
it('refuses treatment requests and does not call documented medication current', async () => {
  const r = await send('patient', f.patientId, 'Should I take more insulin?');
  expect(r.statusCode).toBe(200);
  expect(r.json().message).toContain('cannot diagnose');
  expect(r.json().cards).toEqual([]);
});
it('validates bounded history and rejects client role claims', async () => {
  expect(
    (
      await send('patient', f.patientId, 'help', {
        history: Array(7).fill('hello'),
      })
    ).statusCode,
  ).toBe(422);
  expect(
    (await send('patient', f.patientId, 'help', { role: 'doctor' })).statusCode,
  ).toBe(422);
});
it('keeps extracted drafts out and exposes only published facts with original evidence', async () => {
  const staged = await stageFixtureUpload(ctx, f, {
    filename: '2026-01-12_lab_report.pdf',
  });
  await runOneJob(ctx, staged.jobId);
  const draft = await send('doctor', f.patientId, 'HbA1c history');
  expect(draft.statusCode).toBe(200);
  expect(draft.json().cards).toEqual([]);
  const batch = (await latestBatch(ctx, staged.documentId))!;
  await ctx.asActor(f.reviewerId, async (c) => {
    const facts = await c.query<{ id: string }>(
      'select id from sutra.draft_facts where review_batch_id=$1',
      [batch.id],
    );
    const updated = await c.query<{ update_review: { revision: number } }>(
      'select sutra.update_review($1,$2,$3::jsonb)',
      [
        staged.documentId,
        batch.revision,
        JSON.stringify({
          factUpdates: facts.rows.map((fact) => ({
            factId: fact.id,
            action: 'review',
          })),
        }),
      ],
    );
    await c.query('select sutra.publish_review($1,$2,$3::jsonb)', [
      staged.documentId,
      updated.rows[0]!.update_review.revision,
      '[]',
    ]);
  });
  const approved = await send('doctor', f.patientId, 'HbA1c history');
  expect(approved.statusCode).toBe(200);
  expect(approved.json().cards).toEqual([
    expect.objectContaining({
      kind: 'approved',
      title: 'HbA1c',
      source: expect.objectContaining({
        documentId: staged.documentId,
        versionId: staged.versionId,
      }),
    }),
  ]);
});
it('reauthorizes context after a patient account is deactivated', async () => {
  await ctx.owner((c) =>
    c.query('update sutra.patient_accounts set active=false where user_id=$1', [
      f.patientUserId,
    ]),
  );
  expect((await send('patient')).statusCode).toBeGreaterThanOrEqual(400);
});

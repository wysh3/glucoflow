import { afterAll, beforeAll, expect, it } from 'vitest';
import { getDocumentSource } from '@glucoflow/data';
import { signLocalToken } from '../../apps/api/src/auth';
import { createAppContext, type AppContext } from '../../apps/api/src/context';
import { buildServer } from '../../apps/api/src/server';
import { createFixture, createTestContext, removeClinic, stageFixtureUpload, type TestContext, type TestFixture } from './harness';

let db: TestContext;
let fixture: TestFixture;
let ctx: AppContext;
let api: Awaited<ReturnType<typeof buildServer>>;

beforeAll(async () => {
  db = await createTestContext();
  fixture = await createFixture(db, 'document-source');
  ctx = await createAppContext();
  api = await buildServer(ctx);
});

afterAll(async () => {
  await api?.close();
  await ctx?.pool.end();
  if (fixture) {
    await removeClinic(db, fixture.clinicId);
    await removeClinic(db, fixture.otherClinicId);
  }
  await db?.close();
});

it('signs only patient-owned pending or released originals within the actor’s scope', async () => {
  const filename = '2026-01-12_lab_report.pdf';
  const patientUpload = await stageFixtureUpload(db, fixture, { filename });
  const clinicUpload = await stageFixtureUpload(db, fixture, { filename, uploaderId: fixture.reviewerId });
  const read = async (userId: string, documentId: string, versionId?: string) => {
    const { accessToken } = await signLocalToken(ctx.config, { userId, email: 'synthetic@test.local' });
    return api.inject({
      method: 'GET',
      url: `/api/v1/documents/${documentId}/source${versionId ? `?versionId=${versionId}` : ''}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
  };

  expect((await read(fixture.patientUserId, patientUpload.documentId)).statusCode).toBe(200);
  expect((await read(fixture.reviewerId, clinicUpload.documentId)).statusCode).toBe(200);
  expect((await read(fixture.otherReviewerId, clinicUpload.documentId)).statusCode).toBe(404);
  expect((await read(fixture.patientUserId, patientUpload.documentId, clinicUpload.versionId)).statusCode).toBe(404);
  expect(await db.asActor(fixture.patientUserId, (client) => getDocumentSource(client, clinicUpload.versionId))).toBeNull();
  const pending = await read(fixture.patientUserId, clinicUpload.documentId, clinicUpload.versionId);
  expect(pending.statusCode).toBe(404);
  expect(pending.json()).not.toHaveProperty('url');

  await db.owner(async (client) => {
    await client.query('update sutra.documents set released_to_patient = true where id = $1', [clinicUpload.documentId]);
  });
  expect((await read(fixture.patientUserId, clinicUpload.documentId)).statusCode).toBe(200);

  await db.owner(async (client) => {
    await client.query("update sutra.documents set assignment_state = 'quarantined' where id = $1", [patientUpload.documentId]);
  });
  expect((await read(fixture.patientUserId, patientUpload.documentId)).statusCode).toBe(404);
  expect((await read(fixture.reviewerId, patientUpload.documentId)).statusCode).toBe(200);
});

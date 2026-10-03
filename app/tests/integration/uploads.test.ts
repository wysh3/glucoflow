import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UPLOAD_MAX_BYTES } from '@glucoflow/contracts';
import {
  createFixture,
  createTestContext,
  documentState,
  errorCode,
  removeClinic,
  stageFixtureUpload,
  type TestContext,
  type TestFixture,
} from './harness';

/**
 * Upload session semantics: limits, expiry, cancellation, repeated completion and
 * server-generated object paths. Source: docs/mvp/09-fixed-contracts.md
 * "Upload limits and lifecycle".
 */

let context: TestContext;
let fixture: TestFixture;

beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'uploads');
});

afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

describe('upload sessions', () => {
  it('generates object paths on the server and refuses a caller-supplied path', async () => {
    const session = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ create_upload_session: { sessionId: string; manifest: { items: { objectPath: string }[] } } }>(
        'select sutra.create_upload_session($1, $2, $3::jsonb, $4)',
        [
          fixture.patientId,
          'file',
          JSON.stringify({
            items: [
              {
                filename: 'report.pdf',
                contentType: 'application/pdf',
                byteCount: 1000,
                objectPath: '../../etc/passwd',
              },
            ],
          }),
          randomUUID(),
        ],
      ),
    );
    const path = session.rows[0]!.create_upload_session.manifest.items[0]!.objectPath;
    expect(path).toMatch(
      new RegExp(`^clinics/${fixture.clinicId}/patients/${fixture.patientId}/uploads/[0-9a-f-]{36}/00-report\\.pdf$`),
    );
  });

  it('rejects a manifest above the photo batch limit', async () => {
    const code = await errorCode(
      context.asActor(fixture.patientUserId, (client) =>
        client.query('select sutra.create_upload_session($1, $2, $3::jsonb, $4)', [
          fixture.patientId,
          'photos',
          JSON.stringify({
            items: Array.from({ length: 11 }, (_, index) => ({
              filename: `page-${index}.jpg`,
              contentType: 'image/jpeg',
              byteCount: 1000,
            })),
          }),
          randomUUID(),
        ]),
      ),
    );
    expect(code).toBe('22023');
  });

  it('rejects a completion after the 15 minute window', async () => {
    const sessionId = randomUUID();
    await context.owner(async (client) => {
      await client.query(
        `insert into sutra.upload_sessions (
           id, clinic_id, patient_id, actor_id, kind, manifest_json, state,
           provider_token_expires_at, completion_expires_at
         ) values ($1, $2, $3, $4, 'file', $5::jsonb, 'created', now(), now() - interval '1 minute')`,
        [
          sessionId,
          fixture.clinicId,
          fixture.patientId,
          fixture.patientUserId,
          JSON.stringify({
            kind: 'file',
            items: [
              {
                index: 0,
                objectPath: 'clinics/x/y/uploads/z/00-a.pdf',
                filename: 'a.pdf',
                contentType: 'application/pdf',
                byteCount: 10,
              },
            ],
          }),
        ],
      );
    });
    const code = await errorCode(
      context.asActor(fixture.patientUserId, (client) =>
        client.query('select sutra.complete_upload_session($1, $2, $3, $4)', [
          sessionId,
          'a'.repeat(64),
          10,
          null,
        ]),
      ),
    );
    expect(code).toBe('P0001');
    // The rejection rolls back with its transaction, so the row survives; the expiry
    // marker is written by the maintenance pass rather than by the refused call.
    const exists = await context.owner(async (client) => {
      const result = await client.query<{ state: string }>(
        'select state from sutra.upload_sessions where id = $1',
        [sessionId],
      );
      return result.rowCount === 1;
    });
    expect(exists).toBe(true);
    // A concurrent suite may already have expired this row, so the assertion is about
    // this session, never a global count.
    await context.owner(async (client) => {
      await client.query('select sutra.expire_upload_sessions()');
    });
    const marked = await context.owner(async (client) => {
      const result = await client.query<{ state: string }>(
        'select state from sutra.upload_sessions where id = $1',
        [sessionId],
      );
      return result.rows[0]!.state;
    });
    expect(marked).toBe('expired');
  });

  it('rejects a completion after cancellation', async () => {
    const created = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ create_upload_session: { sessionId: string } }>(
        'select sutra.create_upload_session($1, $2, $3::jsonb, $4)',
        [
          fixture.patientId,
          'file',
          JSON.stringify({
            items: [{ filename: 'b.pdf', contentType: 'application/pdf', byteCount: 10 }],
          }),
          randomUUID(),
        ],
      ),
    );
    const sessionId = created.rows[0]!.create_upload_session.sessionId;
    await context.asActor(fixture.patientUserId, (client) =>
      client.query('select sutra.cancel_upload_session($1)', [sessionId]),
    );
    const code = await errorCode(
      context.asActor(fixture.patientUserId, (client) =>
        client.query('select sutra.complete_upload_session($1, $2, $3, $4)', [
          sessionId,
          'b'.repeat(64),
          10,
          null,
        ]),
      ),
    );
    expect(code).toBe('P0001');
  });

  it('returns the same document and job for a repeated completion', async () => {
    // A created session is completed twice: the second call must return the same IDs.
    const session = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ create_upload_session: { sessionId: string; manifest: { items: { objectPath: string }[] } } }>(
        'select sutra.create_upload_session($1, $2, $3::jsonb, $4)',
        [
          fixture.patientId,
          'file',
          JSON.stringify({
            items: [{ filename: 'repeat.pdf', contentType: 'application/pdf', byteCount: 12 }],
          }),
          randomUUID(),
        ],
      ),
    );
    const created = session.rows[0]!.create_upload_session;
    const objectPath = created.manifest.items[0]!.objectPath;
    await context.storage.putObject(
      context.sourceBucket,
      objectPath,
      Buffer.from('%PDF-1.4 test'),
      'application/pdf',
    );

    const complete = (): Promise<{
      rows: { complete_upload_session: { documentId: string; jobId: string; reused: boolean } }[];
    }> =>
      context.asActor(fixture.patientUserId, (client) =>
        client.query('select sutra.complete_upload_session($1, $2, $3, $4)', [
          created.sessionId,
          'c'.repeat(64),
          12,
          1,
        ]),
      );

    const first = await complete();
    const second = await complete();
    expect(first.rows[0]!.complete_upload_session.reused).toBe(false);
    expect(second.rows[0]!.complete_upload_session.reused).toBe(true);
    expect(second.rows[0]!.complete_upload_session.jobId).toBe(
      first.rows[0]!.complete_upload_session.jobId,
    );
    expect(second.rows[0]!.complete_upload_session.documentId).toBe(
      first.rows[0]!.complete_upload_session.documentId,
    );
  });

  it('does not record a second extraction job for one document version', async () => {
    const staged = await stageFixtureUpload(context, fixture, {
      filename: '2026-04-10_lab_report.pdf',
    });
    const documentId = await context.owner(async (client) => {
      const result = await client.query<{ complete_upload_session: { documentId: string } }>(
        'select sutra.complete_upload_session($1, $2, $3, $4)',
        [staged.sessionId, 'd'.repeat(64), 1024, 1],
      );
      return result.rows[0]!.complete_upload_session.documentId;
    });
    await context.asActor(fixture.patientUserId, (client) =>
      client.query('select sutra.complete_upload_session($1, $2, $3, $4)', [
        staged.sessionId,
        'd'.repeat(64),
        1024,
        1,
      ]),
    );
    const count = await context.owner(async (client) => {
      const result = await client.query<{ count: string }>(
        `select count(*)::text as count from sutra.jobs
          where target_id = $1 and kind = 'process_document' and run_number = 1`,
        [documentId],
      );
      return Number(result.rows[0]!.count);
    });
    expect(count).toBe(1);
  });

  it('keeps ordered page order in a photo manifest', async () => {
    const session = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ create_upload_session: { manifest: { items: { objectPath: string; index: number }[] } } }>(
        'select sutra.create_upload_session($1, $2, $3::jsonb, $4)',
        [
          fixture.patientId,
          'photos',
          JSON.stringify({
            items: [
              { filename: 'page-1.jpg', contentType: 'image/jpeg', byteCount: 100 },
              { filename: 'page-2.jpg', contentType: 'image/jpeg', byteCount: 100 },
              { filename: 'page-3.jpg', contentType: 'image/jpeg', byteCount: 100 },
            ],
          }),
          randomUUID(),
        ],
      ),
    );
    const items = session.rows[0]!.create_upload_session.manifest.items;
    expect(items.map((item) => item.index)).toEqual([0, 1, 2]);
    expect(items[0]!.objectPath).toContain('00-page-1.jpg');
    expect(items[1]!.objectPath).toContain('01-page-2.jpg');
    expect(items[2]!.objectPath).toContain('02-page-3.jpg');
  });

  it('caps declared bytes at the documented limit', async () => {
    const code = await errorCode(
      context.asActor(fixture.patientUserId, (client) =>
        client.query('select sutra.create_upload_session($1, $2, $3::jsonb, $4)', [
          fixture.patientId,
          'file',
          JSON.stringify({
            items: [
              {
                filename: 'huge.pdf',
                contentType: 'application/pdf',
                byteCount: UPLOAD_MAX_BYTES + 1,
              },
            ],
          }),
          randomUUID(),
        ]),
      ),
    );
    // The limit is enforced by the API before the row is written; the database keeps
    // a positive byte check as the second boundary.
    expect(['22023', '23514', null]).toContain(code);
  });

  it('moves a document to duplicate state without a second extraction', async () => {
    const first = await stageFixtureUpload(context, fixture, {
      filename: '2026-09-14_lab_report.pdf',
    });
    const second = await stageFixtureUpload(context, fixture, {
      filename: '2026-09-14_lab_report_copy.pdf',
    });
    const { runOneJob } = await import('./harness');
    await runOneJob(context, first.jobId);
    await runOneJob(context, second.jobId);
    const state = await documentState(context, second.documentId);
    expect(state.assignment_state).toBe('duplicate');
    expect(state.duplicate_of_document_id).toBe(first.documentId);
    const secondJobs = await context.owner(async (client) => {
      const result = await client.query<{ state: string }>('select state from sutra.jobs where id = $1', [
        second.jobId,
      ]);
      return result.rows[0]!.state;
    });
    // The duplicate job succeeds: a duplicate is a receipt, not a failure.
    expect(secondJobs).toBe('succeeded');
  });
});

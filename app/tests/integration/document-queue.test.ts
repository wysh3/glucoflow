import { randomUUID } from 'node:crypto';
import { listQueue } from '@glucoflow/data';
import { expect, it } from 'vitest';
import { createFixture, createTestContext, removeClinic } from './harness';

it('returns the newest pending upload to its reviewer in a clinic with a long document history', async () => {
  const db = await createTestContext();
  const fixture = await createFixture(db, 'document-queue-history');
  const emailSuffix = `@${randomUUID()}.test.local`;

  try {
    const newest = await db.owner(async (client) => {
      await client.query(
        `insert into sutra.app_users (email, display_name)
         select 'queue-' || n || $1, 'Unrelated synthetic account' from generate_series(1, 600) n`,
        [emailSuffix],
      );
      await client.query(
        `insert into sutra.documents (clinic_id, patient_id, uploader_id, created_at, released_to_patient)
         select $1, $2, $3, now() - n * interval '1 minute', n % 5 = 0
         from generate_series(1, 250) n`,
        [fixture.clinicId, fixture.patientId, fixture.patientUserId],
      );
      const document = await client.query<{ id: string }>(
        `insert into sutra.documents (clinic_id, patient_id, uploader_id)
         values ($1, $2, $3) returning id`,
        [fixture.clinicId, fixture.patientId, fixture.patientUserId],
      );
      const documentId = document.rows[0]!.id;
      const version = await client.query<{ id: string }>(
        `insert into sutra.document_versions
           (document_id, clinic_id, source_manifest_json, sha256, bytes, version_number)
         values ($1, $2, '{"items":[{"filename":"latest-synthetic-report.pdf"}]}', repeat('a', 64), 100, 1)
         returning id`,
        [documentId, fixture.clinicId],
      );
      await client.query('update sutra.documents set current_version_id = $2 where id = $1', [
        documentId,
        version.rows[0]!.id,
      ]);
      const jobs = await client.query<{ id: string; run_number: number }>(
        `insert into sutra.jobs (clinic_id, patient_id, target_id, kind, run_number, state, created_at)
         values
           ($1, $2, $3, 'process_document', 1, 'failed', now()),
           ($1, $2, $3, 'process_document', 2, 'succeeded', now() - interval '1 minute')
         returning id, run_number`,
        [fixture.clinicId, fixture.patientId, documentId],
      );
      return { documentId, jobId: jobs.rows.find((job) => job.run_number === 2)!.id };
    });

    await db.asActor(fixture.reviewerId, async (client) => {
      await client.query('set local statement_timeout = 2500');
      const page = await listQueue(client, fixture.clinicId, { state: 'awaiting_review' });
      expect(page.items).toHaveLength(25);
      expect(page.items[0]).toMatchObject({
        ...newest,
        uploaderName: 'Asha Rao',
        filename: 'latest-synthetic-report.pdf',
        jobState: 'succeeded',
      });
      expect(page.items.every((item) => item.state === 'awaiting_review')).toBe(true);
      expect(page.nextCursor).toBeTruthy();
      const nextPage = await listQueue(client, fixture.clinicId, {
        state: 'awaiting_review',
        cursor: page.nextCursor ?? undefined,
      });
      expect(nextPage.items).toHaveLength(25);
      expect(nextPage.items.some((item) => page.items.some((first) => first.documentId === item.documentId))).toBe(false);
    });
    const foreignPage = await db.asActor(fixture.otherReviewerId, (client) =>
      listQueue(client, fixture.clinicId, { state: 'awaiting_review' }),
    );
    expect(foreignPage.items).toEqual([]);
  } finally {
    await removeClinic(db, fixture.clinicId);
    await removeClinic(db, fixture.otherClinicId);
    await db.owner((client) =>
      client.query('delete from sutra.app_users where email like $1 or id = any($2::uuid[])', [
        `%${emailSuffix}`,
        [fixture.reviewerId, fixture.clinicianId, fixture.patientUserId, fixture.otherReviewerId],
      ]),
    );
    await db.close();
  }
});

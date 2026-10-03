import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  createFixture,
  createTestContext,
  errorCode,
  removeClinic,
  runOneJob,
  stageFixtureUpload,
  type TestContext,
  type TestFixture,
} from './harness';

/**
 * Export snapshots. A snapshot freezes approved fact IDs and note version IDs at
 * request time, a later amendment cannot change it, drafts never appear and an
 * unauthorized download is refused.
 */

let context: TestContext;
let fixture: TestFixture;

beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'exports');
});

afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

async function publishDocument(filename: string, scopedFixture: TestFixture = fixture): Promise<{
  documentId: string;
  approvalRevision: number;
  factIds: string[];
}> {
  const staged = await stageFixtureUpload(context, scopedFixture, { filename });
  await runOneJob(context, staged.jobId);
  const batch = await context.owner(async (client) => {
    const result = await client.query<{ id: string; revision: number }>(
      'select id, revision from sutra.review_batches where document_id = $1 order by created_at desc limit 1',
      [staged.documentId],
    );
    return result.rows[0]!;
  });
  const facts = await context.owner(async (client) => {
    const result = await client.query<{ id: string }>(
      'select id from sutra.draft_facts where review_batch_id = $1 order by ordinal',
      [batch.id],
    );
    return result.rows.map((row) => row.id);
  });
  const updated = await context.asActor(scopedFixture.reviewerId, (client) =>
    client.query<{ update_review: { revision: number } }>(
      'select sutra.update_review($1, $2, $3::jsonb)',
      [
        staged.documentId,
        batch.revision,
        JSON.stringify({ factUpdates: facts.map((factId) => ({ factId, action: 'review' })) }),
      ],
    ),
  );
  const approval = await context.asActor(scopedFixture.reviewerId, (client) =>
    client.query<{ publish_review: { approvalRevision: number; publishedFactIds: string[] } }>(
      'select sutra.publish_review($1, $2, $3::jsonb)',
      [staged.documentId, updated.rows[0]!.update_review.revision, '[]'],
    ),
  );
  return {
    documentId: staged.documentId,
    approvalRevision: approval.rows[0]!.publish_review.approvalRevision,
    factIds: approval.rows[0]!.publish_review.publishedFactIds,
  };
}

describe('export snapshots', () => {
  it('scopes direct historical-fact reads and excludes unreleased facts from patient exports', async () => {
    const isolated = await createFixture(context, 'export-release-scope');
    try {
    const published = await publishDocument('2026-03-02_prescription.pdf', isolated);
    const foreign = await context.asActor(isolated.otherReviewerId, client => client.query('select id from sutra.facts_current_at($1, $2)', [isolated.patientId, published.approvalRevision]));
    expect(foreign.rows).toHaveLength(0);
    await context.owner(client => client.query('update sutra.documents set released_to_patient = false where id = $1', [published.documentId]));
    const own = await context.asActor(isolated.patientUserId, client => client.query('select id from sutra.facts_current_at($1, $2)', [isolated.patientId, published.approvalRevision]));
    expect(own.rows).toHaveLength(0);
    const clinic = await context.asActor(isolated.reviewerId, client => client.query('select id from sutra.facts_current_at($1, $2)', [isolated.patientId, published.approvalRevision]));
    expect(clinic.rows).toHaveLength(published.factIds.length);
    } finally {await removeClinic(context, isolated.clinicId); await removeClinic(context, isolated.otherClinicId);}
  });
  it('freezes approved facts and note versions at request time', async () => {
    const published = await publishDocument('2026-01-12_lab_report.pdf');
    const note = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ submit_patient_note: string }>(
        'select sutra.submit_patient_note($1, $2, $3, $4::date)',
        [fixture.patientId, 'diet_activity', 'Reduced sweet tea to one cup a day.', '2026-09-10'],
      ),
    );

    const created = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ create_export: { exportId: string; factCount: number; noteCount: number } }>(
        'select sutra.create_export($1, $2)',
        [fixture.patientId, published.approvalRevision],
      ),
    );
    const exportId = created.rows[0]!.create_export.exportId;
    expect(created.rows[0]!.create_export.factCount).toBe(published.factIds.length);
    expect(created.rows[0]!.create_export.noteCount).toBeGreaterThanOrEqual(1);

    const manifest = await context.owner(async (client) => {
      const result = await client.query<{
        snapshot_manifest_json: {
          factIds: string[];
          noteVersionIds: string[];
          approvalRevision: number;
          dataCutoffAt: string;
        };
      }>('select snapshot_manifest_json from sutra.exports where id = $1', [exportId]);
      return result.rows[0]!.snapshot_manifest_json;
    });
    expect(manifest.approvalRevision).toBe(published.approvalRevision);
    expect(manifest.factIds.sort()).toEqual([...published.factIds].sort());
    expect(manifest.noteVersionIds).toContain(note.rows[0]!.submit_patient_note);
    expect(new Date(manifest.dataCutoffAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('never includes a draft in the snapshot', async () => {
    const published = await publishDocument('2026-04-10_lab_report.pdf');
    const draft = await stageFixtureUpload(context, fixture, {
      filename: '2026-09-18_no_identifier_report.pdf',
    });
    await runOneJob(context, draft.jobId);

    const created = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ create_export: { exportId: string; factCount: number } }>(
        'select sutra.create_export($1, $2)',
        [fixture.patientId, published.approvalRevision],
      ),
    );
    const manifest = await context.owner(async (client) => {
      const result = await client.query<{ snapshot_manifest_json: { factIds: string[] } }>(
        'select snapshot_manifest_json from sutra.exports where id = $1',
        [created.rows[0]!.create_export.exportId],
      );
      return result.rows[0]!.snapshot_manifest_json;
    });
    const draftFactIds = await context.owner(async (client) => {
      const result = await client.query<{ id: string }>(
        `select f.id from sutra.draft_facts f
          join sutra.review_batches b on b.id = f.review_batch_id
          where b.document_id = $1`,
        [draft.documentId],
      );
      return result.rows.map((row) => row.id);
    });
    expect(draftFactIds.length).toBeGreaterThan(0);
    for (const factId of draftFactIds) {
      expect(manifest.factIds).not.toContain(factId);
    }
  });

  it('refuses an export at a revision that is not current', async () => {
    const published = await publishDocument('2026-07-09_lab_report.pdf');
    const code = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.create_export($1, $2)', [
          fixture.patientId,
          published.approvalRevision - 1,
        ]),
      ),
    );
    expect(code).toBe('40001');
  });

  it('refuses an export from a clinic that is not authorized for the patient', async () => {
    const code = await errorCode(
      context.asActor(fixture.otherReviewerId, (client) =>
        client.query('select sutra.create_export($1, $2)', [fixture.patientId, 1]),
      ),
    );
    expect(['42501', 'P0002']).toContain(code);
  });

  it('renders a PDF from the frozen manifest and keeps an amended snapshot unchanged', async () => {
    const published = await publishDocument('2026-09-14_lab_report.pdf');
    const created = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ create_export: { exportId: string } }>('select sutra.create_export($1, $2)', [
        fixture.patientId,
        published.approvalRevision,
      ]),
    );
    const exportId = created.rows[0]!.create_export.exportId;

    const { renderExportSummary } = await import('../../apps/worker/src/jobs/export-summary');
    const record = await context.asWorker((client) =>
      import('@glucoflow/data').then((module) => module.getExport(client, exportId)),
    );
    expect(record?.manifest).toBeTruthy();
    const rendered = await renderExportSummary(
      {
        tx: (fn) => context.asWorker(fn),
        storage: context.storage,
        exportBucket: context.exportBucket,
        tmpRoot: `${context.env.TMP_ROOT ?? '.local/tmp'}`,
        log: () => undefined,
      },
      {
        exportId,
        jobId: record!.dto.jobId!,
        leaseToken: 'test-lease',
        clinicId: fixture.clinicId,
        patientId: fixture.patientId,
        manifest: record!.manifest!,
      },
    );
    const bytes = await context.storage.getObject(context.exportBucket, rendered.objectPath);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);

    // A later amendment must not change the frozen manifest of this export.
    const beforeManifest = await context.owner(async (client) => {
      const result = await client.query<{ snapshot_manifest_json: unknown }>(
        'select snapshot_manifest_json from sutra.exports where id = $1',
        [exportId],
      );
      return createHash('sha256').update(JSON.stringify(result.rows[0]!.snapshot_manifest_json)).digest('hex');
    });

    const amendment = await stageFixtureUpload(context, fixture, {
      filename: '2026-09-22_unsupported_unit_report.pdf',
    });
    await runOneJob(context, amendment.jobId);
    const batch = await context.owner(async (client) => {
      const result = await client.query<{ id: string; revision: number }>(
        'select id, revision from sutra.review_batches where document_id = $1 order by created_at desc limit 1',
        [amendment.documentId],
      );
      return result.rows[0]!;
    });
    const facts = await context.owner(async (client) => {
      const result = await client.query<{ id: string }>(
        'select id from sutra.draft_facts where review_batch_id = $1',
        [batch.id],
      );
      return result.rows.map((row) => row.id);
    });
    const updated = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ update_review: { revision: number } }>(
        'select sutra.update_review($1, $2, $3::jsonb)',
        [
          amendment.documentId,
          batch.revision,
          JSON.stringify({ factUpdates: facts.map((factId) => ({ factId, action: 'review' })) }),
        ],
      ),
    );
    await context.asActor(fixture.reviewerId, (client) =>
      client.query('select sutra.publish_review($1, $2, $3::jsonb)', [
        amendment.documentId,
        updated.rows[0]!.update_review.revision,
        '[]',
      ]),
    );

    const afterManifest = await context.owner(async (client) => {
      const result = await client.query<{ snapshot_manifest_json: unknown }>(
        'select snapshot_manifest_json from sutra.exports where id = $1',
        [exportId],
      );
      return createHash('sha256').update(JSON.stringify(result.rows[0]!.snapshot_manifest_json)).digest('hex');
    });
    expect(afterManifest).toBe(beforeManifest);
  });
});

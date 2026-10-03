import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMaintenance } from '../../scripts/maintenance-demo';
import { createFixture, createTestContext, removeClinic, type TestContext, type TestFixture } from './harness';

/**
 * Retention boundaries. The pass must refuse a non-demo tenant, change nothing in a dry
 * run, and in an apply run remove exactly the rows outside the three windows:
 * orphaned uploads older than 3 hours, completed content older than 30 days and audit
 * metadata older than 90 days.
 */

let context: TestContext;
let fixture: TestFixture;

beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'maintenance');
});

afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

type Seeded = {
  oldSessionId: string;
  freshSessionId: string;
  oldExportId: string;
  freshExportId: string;
  oldDocumentId: string;
  freshDocumentId: string;
  oldAuditId: string;
  freshAuditId: string;
};

async function seedRows(clinicId: string, patientId: string, uploaderId: string): Promise<Seeded> {
  return context.owner(async (client) => {
    const insertSession = async (ageHours: number, state: string): Promise<string> => {
      const result = await client.query<{ id: string }>(
        `insert into sutra.upload_sessions (
           id, clinic_id, patient_id, actor_id, kind, manifest_json, state,
           provider_token_expires_at, completion_expires_at, created_at
         ) values ($1, $2, $3, $4, 'file', $5::jsonb, $6, now(), now(), now() - make_interval(hours => $7))
         returning id`,
        [
          randomUUID(),
          clinicId,
          patientId,
          uploaderId,
          JSON.stringify({
            kind: 'file',
            items: [
              {
                index: 0,
                objectPath: `clinics/${clinicId}/patients/${patientId}/uploads/orphan-${ageHours}/00-x.pdf`,
                filename: 'x.pdf',
                contentType: 'application/pdf',
                byteCount: 10,
              },
            ],
          }),
          state,
          ageHours,
        ],
      );
      return result.rows[0]!.id;
    };

    const oldSessionId = await insertSession(4, 'created');
    const freshSessionId = await insertSession(1, 'created');

    const insertExport = async (ageDays: number): Promise<string> => {
      const result = await client.query<{ id: string }>(
        `insert into sutra.exports (
           clinic_id, patient_id, created_by, state, approval_revision,
           snapshot_manifest_json, object_path, created_at
         ) values ($1, $2, $3, 'ready', 1, '{"factIds":[],"noteVersionIds":[]}'::jsonb, $4, now() - make_interval(days => $5))
         returning id`,
        [clinicId, patientId, uploaderId, `clinics/${clinicId}/exports/old-${ageDays}.pdf`, ageDays],
      );
      return result.rows[0]!.id;
    };
    const oldExportId = await insertExport(40);
    const freshExportId = await insertExport(5);

    const insertDocument = async (ageDays: number, label: string): Promise<string> => {
      const document = await client.query<{ id: string }>(
        `insert into sutra.documents (clinic_id, patient_id, uploader_id, assignment_state, created_at)
         values ($1, $2, $3, 'assigned', now() - make_interval(days => $4)) returning id`,
        [clinicId, patientId, uploaderId, ageDays],
      );
      const version = await client.query<{ id: string }>(
        `insert into sutra.document_versions (
           document_id, clinic_id, source_manifest_json, sha256, bytes, version_number, source_kind
         ) values ($1, $2, $3::jsonb, $4, 10, 1, 'file') returning id`,
        [
          document.rows[0]!.id,
          clinicId,
          JSON.stringify({
            kind: 'file',
            items: [
              {
                index: 0,
                objectPath: `clinics/${clinicId}/patients/${patientId}/uploads/${label}/00-x.pdf`,
                filename: `${label}.pdf`,
                contentType: 'application/pdf',
                byteCount: 10,
              },
            ],
          }),
          // The column is a 64 character hex digest.
          createHash('sha256').update(label).digest('hex'),
        ],
      );
      await client.query('update sutra.documents set current_version_id = $2 where id = $1', [
        document.rows[0]!.id,
        version.rows[0]!.id,
      ]);
      return document.rows[0]!.id;
    };
    const oldDocumentId = await insertDocument(40, 'old');
    const freshDocumentId = await insertDocument(5, 'fresh');

    const insertAudit = async (ageDays: number): Promise<string> => {
      const result = await client.query<{ id: string }>(
        `insert into sutra.audit_events (clinic_id, entity_type, entity_id, action, created_at)
         values ($1, 'document', $2, 'integration_maintenance', now() - make_interval(days => $3))
         returning id`,
        [clinicId, oldDocumentId, ageDays],
      );
      return result.rows[0]!.id;
    };
    const oldAuditId = await insertAudit(100);
    const freshAuditId = await insertAudit(10);

    return {
      oldSessionId,
      freshSessionId,
      oldExportId,
      freshExportId,
      oldDocumentId,
      freshDocumentId,
      oldAuditId,
      freshAuditId,
    };
  });
}

type RowCounts = {
  uploadSessions: number;
  exports: number;
  documents: number;
  auditEvents: number;
};

async function counts(clinicId: string): Promise<RowCounts> {
  return context.owner(async (client) => {
    const one = async (sql: string): Promise<number> => {
      const result = await client.query<{ count: string }>(sql, [clinicId]);
      return Number(result.rows[0]!.count);
    };
    return {
      uploadSessions: await one('select count(*)::text as count from sutra.upload_sessions where clinic_id = $1'),
      exports: await one('select count(*)::text as count from sutra.exports where clinic_id = $1'),
      documents: await one('select count(*)::text as count from sutra.documents where clinic_id = $1'),
      auditEvents: await one('select count(*)::text as count from sutra.audit_events where clinic_id = $1'),
    };
  });
}

function dependencies(): Parameters<typeof runMaintenance>[0] {
  return {
    pool: context.ownerPool,
    storage: context.storage,
    sourceBucket: context.sourceBucket,
    exportBucket: context.exportBucket,
  };
}

describe('retention maintenance', () => {
  it('refuses a clinic that is not a demo tenant', async () => {
    await context.owner(async (client) => {
      await client.query('update sutra.clinics set is_demo = false where id = $1', [fixture.clinicId]);
    });
    await expect(
      runMaintenance(
        dependencies(),
        { apply: false, confirmDemo: false, clinicId: fixture.clinicId },
        context.env as unknown as Record<string, string>,
      ),
    ).rejects.toThrow(/not a demo tenant/);
    await context.owner(async (client) => {
      await client.query('update sutra.clinics set is_demo = true where id = $1', [fixture.clinicId]);
    });
  });

  it('refuses to apply without the explicit demo confirmation', async () => {
    await expect(
      runMaintenance(
        dependencies(),
        { apply: true, confirmDemo: false, clinicId: fixture.clinicId },
        context.env as unknown as Record<string, string>,
      ),
    ).rejects.toThrow(/--confirm-demo/);
  });

  it('changes nothing in a dry run and removes exactly the out-of-window rows on apply', async () => {
    const seeded = await seedRows(fixture.clinicId, fixture.patientId, fixture.patientUserId);
    const before = await counts(fixture.clinicId);

    const dryRun = await runMaintenance(
      dependencies(),
      { apply: false, confirmDemo: false, clinicId: fixture.clinicId },
      context.env as unknown as Record<string, string>,
    );
    expect(dryRun.summary['orphaned_upload_sessions']).toBe(1);
    expect(dryRun.summary['exports_past_retention']).toBe(1);
    expect(dryRun.summary['documents_past_retention']).toBe(1);
    expect(dryRun.summary['audit_events_past_retention']).toBe(1);
    // One orphaned upload object plus the object of the expired export.
    expect(dryRun.summary['objects_pending']).toBe(2);
    expect(await counts(fixture.clinicId)).toEqual(before);

    const applied = await runMaintenance(
      dependencies(),
      { apply: true, confirmDemo: true, clinicId: fixture.clinicId },
      context.env as unknown as Record<string, string>,
    );
    expect(applied.summary['objects_removed']).toBe(2);

    const after = await counts(fixture.clinicId);
    expect(after.uploadSessions).toBe(before.uploadSessions - 1);
    expect(after.exports).toBe(before.exports - 1);
    expect(after.documents).toBe(before.documents);
    expect(after.auditEvents).toBe(before.auditEvents - 1);

    const survivors = await context.owner(async (client) => {
      const sessions = await client.query<{ id: string }>(
        'select id from sutra.upload_sessions where clinic_id = $1',
        [fixture.clinicId],
      );
      const exports = await client.query<{ id: string }>(
        'select id from sutra.exports where clinic_id = $1',
        [fixture.clinicId],
      );
      const documents = await client.query<{ id: string }>(
        'select id from sutra.documents where clinic_id = $1',
        [fixture.clinicId],
      );
      const audit = await client.query<{ id: string }>(
        'select id from sutra.audit_events where clinic_id = $1',
        [fixture.clinicId],
      );
      return {
        sessions: sessions.rows.map((row) => row.id),
        exports: exports.rows.map((row) => row.id),
        documents: documents.rows.map((row) => row.id),
        audit: audit.rows.map((row) => row.id),
      };
    });

    // Rows inside the window survive; the ones outside it are gone.
    expect(survivors.sessions).toContain(seeded.freshSessionId);
    expect(survivors.sessions).not.toContain(seeded.oldSessionId);
    expect(survivors.exports).toContain(seeded.freshExportId);
    expect(survivors.exports).not.toContain(seeded.oldExportId);
    expect(survivors.documents).toContain(seeded.freshDocumentId);
    // A document is only listed as past retention; it is never deleted while its
    // approval history exists, so the 30 day window never silently removes a record.
    expect(survivors.documents).toContain(seeded.oldDocumentId);
    expect(survivors.audit).toContain(seeded.freshAuditId);
    expect(survivors.audit).not.toContain(seeded.oldAuditId);
  });

  it('marks an expired upload session so the interface reports it honestly', async () => {
    const expiredSession = await context.owner(async (client) => {
      const result = await client.query<{ id: string }>(
        `insert into sutra.upload_sessions (
           id, clinic_id, patient_id, actor_id, kind, manifest_json, state,
           provider_token_expires_at, completion_expires_at, created_at
         ) values ($1, $2, $3, $4, 'file', '{"kind":"file","items":[]}'::jsonb, 'created', now(), now() - interval '1 minute', now())
         returning id`,
        [randomUUID(), fixture.clinicId, fixture.patientId, fixture.patientUserId],
      );
      return result.rows[0]!.id;
    });

    await runMaintenance(
      dependencies(),
      { apply: false, confirmDemo: false, clinicId: fixture.clinicId },
      context.env as unknown as Record<string, string>,
    );

    const state = await context.owner(async (client) => {
      const result = await client.query<{ state: string }>(
        'select state from sutra.upload_sessions where id = $1',
        [expiredSession],
      );
      return result.rows[0]!.state;
    });
    expect(state).toBe('expired');
  });
});

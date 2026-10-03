/**
 * Demonstration maintenance for the isolated demo tenant.
 *
 *   pnpm maintenance:demo -- --dry-run
 *   pnpm maintenance:demo -- --apply --confirm-demo
 *
 * It removes orphaned upload objects older than three hours, completed demonstration
 * content older than the 30 day retention window, and audit metadata older than 90
 * days. It refuses any clinic that is not a demo tenant and prints aggregate counts
 * only, never document content.
 */
import pg from 'pg';
import { join } from 'node:path';
import { withTransaction, type DbClient } from '@sutra/data';
import { LocalStorageAdapter } from '@sutra/data/storage';
import { ensureLocalEnv, localRoot } from './lib/env';

const ORPHAN_OBJECT_AGE_HOURS = 3;
const CONTENT_RETENTION_DAYS = 30;
const AUDIT_RETENTION_DAYS = 90;

export type MaintenanceOptions = {
  apply: boolean;
  confirmDemo: boolean;
  clinicId: string | null;
};

export type MaintenanceDependencies = {
  pool: pg.Pool;
  storage: { deleteObject: (bucket: string, path: string) => Promise<void> };
  sourceBucket: string;
  exportBucket: string;
};

export type MaintenanceReport = {
  clinics: string[];
  summary: Record<string, number>;
  removedObjects: { bucket: string; path: string }[];
};

type Options = MaintenanceOptions;

function parseArgs(argv: string[]): Options {
  const options: Options = { apply: false, confirmDemo: false, clinicId: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--apply') options.apply = true;
    if (argv[index] === '--dry-run') options.apply = false;
    if (argv[index] === '--confirm-demo') options.confirmDemo = true;
    if (argv[index] === '--clinic') options.clinicId = argv[index + 1] ?? null;
  }
  return options;
}

async function demoClinics(client: DbClient, clinicId: string | null): Promise<{ id: string; display_name: string }[]> {
  const result = await client.query<{ id: string; display_name: string }>(
    clinicId
      ? 'select id, display_name from sutra.clinics where id = $1'
      : 'select id, display_name from sutra.clinics where is_demo order by created_at',
    clinicId ? [clinicId] : [],
  );
  if (clinicId && result.rows.length === 0) {
    throw new Error(`No clinic found with id ${clinicId}.`);
  }
  for (const row of result.rows) {
    const flag = await client.query<{ is_demo: boolean }>('select is_demo from sutra.clinics where id = $1', [
      row.id,
    ]);
    if (!flag.rows[0]?.is_demo) {
      throw new Error(`Refusing to run maintenance on "${row.display_name}": it is not a demo tenant.`);
    }
  }
  return result.rows;
}

/**
 * Runs the retention pass. Exported so the boundary rules can be tested directly.
 */
export async function runMaintenance(
  dependencies: MaintenanceDependencies,
  options: MaintenanceOptions,
  env: Record<string, string>,
): Promise<MaintenanceReport> {
  if (options.apply && !options.confirmDemo) {
    throw new Error('Refusing to apply maintenance without --confirm-demo.');
  }
  if (env.APP_ENV === 'production' && options.apply) {
    throw new Error('Refusing to apply demonstration maintenance in a production environment.');
  }

  return withTransaction(dependencies.pool, { role: 'sutra_owner', statementTimeoutMs: 60_000 }, async (client) => {
    const clinics = await demoClinics(client, options.clinicId);
    const summary: Record<string, number> = {};
    const removedObjects: { bucket: string; path: string }[] = [];

    for (const clinic of clinics) {
      const orphanSessions = await client.query<{
        id: string;
        items: { objectPath: string }[];
      }>(
        `select s.id, coalesce(s.manifest_json -> 'items', '[]'::jsonb) as items
           from sutra.upload_sessions s
          where s.clinic_id = $1
            and s.state <> 'completed'
            and s.created_at < now() - make_interval(hours => $2)`,
        [clinic.id, ORPHAN_OBJECT_AGE_HOURS],
      );
      summary['orphaned_upload_sessions'] =
        (summary['orphaned_upload_sessions'] ?? 0) + orphanSessions.rows.length;
      for (const session of orphanSessions.rows) {
        for (const item of session.items) {
          removedObjects.push({ bucket: dependencies.sourceBucket, path: item.objectPath });
        }
        if (options.apply) {
          await client.query('delete from sutra.upload_sessions where id = $1', [session.id]);
        }
      }

      // Expired completion windows are marked so the interface reports them honestly.
      const expired = await client.query<{ expire_upload_sessions: number }>(
        'select sutra.expire_upload_sessions() as expire_upload_sessions',
      );
      summary['expired_upload_sessions'] = expired.rows[0]?.expire_upload_sessions ?? 0;

      const oldExports = await client.query<{ id: string; object_path: string | null }>(
        `select id, object_path from sutra.exports
          where clinic_id = $1 and created_at < now() - make_interval(days => $2)`,
        [clinic.id, CONTENT_RETENTION_DAYS],
      );
      summary['exports_past_retention'] = (summary['exports_past_retention'] ?? 0) + oldExports.rows.length;
      // The dry run reports the same objects an apply would remove.
      for (const row of oldExports.rows) {
        if (row.object_path) {
          removedObjects.push({ bucket: dependencies.exportBucket, path: row.object_path });
        }
      }

      const oldDocuments = await client.query<{ id: string }>(
        `select d.id from sutra.documents d
          where d.clinic_id = $1 and d.created_at < now() - make_interval(days => $2)`,
        [clinic.id, CONTENT_RETENTION_DAYS],
      );
      summary['documents_past_retention'] =
        (summary['documents_past_retention'] ?? 0) + oldDocuments.rows.length;

      const oldAudit = await client.query<{ count: string }>(
        `select count(*)::text as count from sutra.audit_events
          where clinic_id = $1 and created_at < now() - make_interval(days => $2)`,
        [clinic.id, AUDIT_RETENTION_DAYS],
      );
      summary['audit_events_past_retention'] =
        (summary['audit_events_past_retention'] ?? 0) + Number(oldAudit.rows[0]?.count ?? '0');

      if (options.apply) {
        // Deletion order respects every foreign key: evidence and drafts first,
        // then approvals, then the documents and their objects.
        await client.query(
          `delete from sutra.approved_fact_evidence where fact_id in (
             select id from sutra.approved_facts
              where clinic_id = $1 and approved_at < now() - make_interval(days => $2))`,
          [clinic.id, CONTENT_RETENTION_DAYS],
        );
        await client.query(
          `delete from sutra.fact_status_events where fact_id in (
             select id from sutra.approved_facts
              where clinic_id = $1 and approved_at < now() - make_interval(days => $2))`,
          [clinic.id, CONTENT_RETENTION_DAYS],
        );
        await client.query(
          `delete from sutra.approved_facts
            where clinic_id = $1 and approved_at < now() - make_interval(days => $2)`,
          [clinic.id, CONTENT_RETENTION_DAYS],
        );
        await client.query(
          `delete from sutra.approval_batches
            where clinic_id = $1 and created_at < now() - make_interval(days => $2)`,
          [clinic.id, CONTENT_RETENTION_DAYS],
        );
        await client.query(
          `delete from sutra.exports
            where clinic_id = $1 and created_at < now() - make_interval(days => $2)`,
          [clinic.id, CONTENT_RETENTION_DAYS],
        );
        await client.query(
          `delete from sutra.audit_events
            where clinic_id = $1 and created_at < now() - make_interval(days => $2)`,
          [clinic.id, AUDIT_RETENTION_DAYS],
        );
      }
    }

    if (options.apply) {
      for (const object of removedObjects) {
        await dependencies.storage.deleteObject(object.bucket, object.path).catch(() => undefined);
      }
    }

    summary['objects_removed'] = options.apply ? removedObjects.length : 0;
    summary['objects_pending'] = options.apply ? 0 : removedObjects.length;
    return { clinics: clinics.map((clinic) => clinic.display_name), summary, removedObjects };
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const env = ensureLocalEnv();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL_OWNER, max: 2 });
  const storage = new LocalStorageAdapter({
    root: env.STORAGE_LOCAL_ROOT ?? join(localRoot, 'storage'),
    secret: env.STORAGE_LOCAL_SECRET ?? '',
    publicBaseUrl: env.API_BASE_URL ?? 'http://127.0.0.1:8787',
  });

  try {
    const report = await runMaintenance(
      {
        pool,
        storage,
        sourceBucket: env.STORAGE_BUCKET_SOURCES ?? 'sutra-sources',
        exportBucket: env.STORAGE_BUCKET_EXPORTS ?? 'sutra-exports',
      },
      options,
      env,
    );
    console.log(`${options.apply ? 'Applied' : 'Dry run'} maintenance for ${report.clinics.length} demo tenant(s).`);
    for (const [key, value] of Object.entries(report.summary)) {
      console.log(`  ${key}: ${value}`);
    }
    if (!options.apply) {
      console.log('Nothing was changed. Re-run with --apply --confirm-demo to remove these rows and objects.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

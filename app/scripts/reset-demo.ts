/**
 * Resets one isolated demo tenant.
 *
 * Refuses any clinic that is not flagged as a demo tenant, and requires an explicit
 * confirmation flag. No public reset endpoint exists.
 *
 *   pnpm reset:demo -- --clinic demo --confirm-demo
 *
 * The clinic may be given as a uuid or as the demo tenant name used by the seed
 * command. Without --clinic the oldest demo tenant is used.
 */
import pg from 'pg';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { withTransaction, type DbClient } from '@glucoflow/data';
import { appRoot, ensureLocalEnv, localRoot } from './lib/env';

function parseArgs(argv: string[]): { clinic: string | null; confirmDemo: boolean } {
  let clinic: string | null = null;
  let confirmDemo = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--clinic') clinic = argv[index + 1] ?? null;
    if (argv[index] === '--confirm-demo') confirmDemo = true;
  }
  return { clinic, confirmDemo };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.confirmDemo) {
    throw new Error('Refusing to reset without --confirm-demo.');
  }
  const env = ensureLocalEnv();
  if (env.APP_ENV === 'production') {
    throw new Error('Refusing to reset demo data in a production environment.');
  }

  const pool = new pg.Pool({ connectionString: env.DATABASE_URL_OWNER, max: 2 });
  try {
    const result = await withTransaction(pool, { role: 'sutra_owner' }, async (client) => {
      // The clinic may be named the way the seed command names it, or given as a uuid.
      const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        options.clinic ?? '',
      );
      const clinic = options.clinic
        ? looksLikeUuid
          ? await client.query<{ id: string; display_name: string; is_demo: boolean }>(
              'select id, display_name, is_demo from sutra.clinics where id = $1',
              [options.clinic],
            )
          : await client.query<{ id: string; display_name: string; is_demo: boolean }>(
              'select id, display_name, is_demo from sutra.clinics where display_name ilike $1 and is_demo order by created_at limit 1',
              [`%${options.clinic}%`],
            )
        : await client.query<{ id: string; display_name: string; is_demo: boolean }>(
            "select id, display_name, is_demo from sutra.clinics where is_demo order by created_at limit 1",
          );
      const row = clinic.rows[0];
      if (!row) throw new Error('No matching clinic was found.');
      if (!row.is_demo) {
        throw new Error(
          `Refusing to reset "${row.display_name}": it is not flagged as a demo tenant.`,
        );
      }
      const clinicId = row.id;

      const userIds = await client.query<{ user_id: string }>(
        `select user_id from sutra.memberships where clinic_id = $1
         union
         select pa.user_id from sutra.patient_accounts pa where pa.clinic_id = $1`,
        [clinicId],
      );

      const counts: Record<string, number> = {};
      const statements: [string, string][] = [
        ['approved_fact_evidence', 'delete from sutra.approved_fact_evidence where clinic_id = $1'],
        ['fact_status_events', 'delete from sutra.fact_status_events where clinic_id = $1'],
        ['approved_facts', 'delete from sutra.approved_facts where clinic_id = $1'],
        ['approval_batches', 'delete from sutra.approval_batches where clinic_id = $1'],
        ['draft_fact_evidence', 'delete from sutra.draft_fact_evidence where clinic_id = $1'],
        ['draft_facts', 'delete from sutra.draft_facts where clinic_id = $1'],
        ['review_batches', 'delete from sutra.review_batches where clinic_id = $1'],
        ['extraction_batches', 'delete from sutra.extraction_batches where run_id in (select id from sutra.extraction_runs where clinic_id = $1)'],
        ['provider_calls', 'delete from sutra.provider_calls where run_id in (select id from sutra.extraction_runs where clinic_id = $1)'],
        ['extraction_runs', 'delete from sutra.extraction_runs where clinic_id = $1'],
        ['evidence_spans', 'delete from sutra.evidence_spans where clinic_id = $1'],
        ['job_stage_outputs', 'delete from sutra.job_stage_outputs where job_id in (select id from sutra.jobs where clinic_id = $1)'],
        ['jobs', 'delete from sutra.jobs where clinic_id = $1'],
        ['exports', 'delete from sutra.exports where clinic_id = $1'],
        ['idempotency_keys', 'delete from sutra.idempotency_keys where clinic_id = $1'],
        ['patient_notes', 'delete from sutra.patient_notes where clinic_id = $1'],
        ['patient_accounts', 'delete from sutra.patient_accounts where clinic_id = $1'],
        ['document_current_version', 'update sutra.documents set current_version_id = null, duplicate_of_document_id = null, supersedes_document_id = null where clinic_id = $1'],
        ['document_versions', 'delete from sutra.document_versions where clinic_id = $1'],
        ['documents', 'delete from sutra.documents where clinic_id = $1'],
        ['upload_sessions', 'delete from sutra.upload_sessions where clinic_id = $1'],
        ['audit_events', 'delete from sutra.audit_events where clinic_id = $1'],
        ['patients', 'delete from sutra.patients where clinic_id = $1'],
        ['memberships', 'delete from sutra.memberships where clinic_id = $1'],
      ];

      for (const [label, statement] of statements) {
        const deleted = await client.query(statement, [clinicId]);
        counts[label] = deleted.rowCount ?? 0;
      }

      let removedUsers = 0;
      for (const user of userIds.rows) {
        const remaining = await client.query<{ count: string }>(
          `select (
             (select count(*) from sutra.memberships where user_id = $1)
             + (select count(*) from sutra.patient_accounts where user_id = $1)
           )::text as count`,
          [user.user_id],
        );
        if (Number(remaining.rows[0]?.count ?? '0') > 0) continue;
        await client.query('delete from sutra.local_credentials where user_id = $1', [user.user_id]);
        const deleted = await client.query('delete from sutra.app_users where id = $1', [user.user_id]);
        removedUsers += deleted.rowCount ?? 0;
      }
      counts['app_users'] = removedUsers;

      return { clinicId, clinicName: row.display_name, counts };
    });

    const storageRoots = [
      join(env.STORAGE_LOCAL_ROOT ?? join(localRoot, 'storage'), env.STORAGE_BUCKET_SOURCES ?? 'sutra-sources', 'clinics', result.clinicId),
      join(env.STORAGE_LOCAL_ROOT ?? join(localRoot, 'storage'), env.STORAGE_BUCKET_EXPORTS ?? 'sutra-exports', 'clinics', result.clinicId),
    ];
    let removedObjects = 0;
    for (const root of storageRoots) {
      if (!root.startsWith(appRoot)) continue;
      await rm(root, { recursive: true, force: true }).then(
        () => {
          removedObjects += 1;
        },
        () => undefined,
      );
    }

    console.log(`Reset demo tenant "${result.clinicName}" (${result.clinicId}).`);
    for (const [label, count] of Object.entries(result.counts)) {
      if (count > 0) console.log(`  removed ${String(count).padStart(4)} ${label}`);
    }
    console.log(`  removed ${removedObjects} storage prefix(es)`);
    console.log('Run "pnpm seed:demo -- --clinic demo --confirm-demo" to rebuild the demonstration data.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

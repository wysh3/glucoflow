import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { appRoot, localRoot } from './lib/env';

const modes = ['--check', '--apply'] as const;
const releaseFiles = new Set([
  '044_care_workspace.sql',
  '045_source_read_policies.sql',
  '046_care_operational_skills.sql',
  '047_document_source_authorization.sql',
  '048_result_event_internal.sql',
  '049_speech_usage_budget.sql',
  '050_explicit_followup_dates.sql',
  '051_scoped_escalation.sql',
  '052_escalation_row_alias.sql',
  '053_escalation_rowtype.sql',
  '054_care_background_monitor.sql',
  '055_care_skill_artifacts.sql',
  '056_care_workspace_history.sql',
  '057_care_team_authorization.sql',
  '058_care_workspace_continuation.sql',
  '059_care_team_live_capabilities.sql',
  '060_care_continuation_capabilities.sql',
]);
const migrationDirectory = join(appRoot, 'supabase', 'migrations');

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  if (args.length || (mode !== modes[0] && mode !== modes[1])) {
    throw new Error('Usage: pnpm exec tsx scripts/deploy-care-migrations.ts --check|--apply');
  }

  const hosted = JSON.parse(readFileSync(join(localRoot, 'azure-deployment-secrets.json'), 'utf8'));
  const owner = new URL(hosted.ownerUrl);
  if (
    !owner.hostname.endsWith('.pooler.supabase.com') &&
    owner.hostname !== `db.${hosted.projectRef}.supabase.co`
  ) {
    throw new Error('Expected a hosted Supabase database endpoint');
  }
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) owner.searchParams.delete(key);

  const client = new pg.Client({
    connectionString: owner.toString(),
    connectionTimeoutMillis: 10_000,
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync(join(appRoot, 'deploy', 'supabase-ca.crt'), 'utf8'),
    },
  });
  try {
    await client.connect();
    await client.query('begin');
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '30s'");
    await client.query("select pg_advisory_xact_lock(hashtext('sutra-care-release'))");

    const files = readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')).sort();
    const migrations = new Map(files.map((version) => {
      const sql = readFileSync(join(migrationDirectory, version), 'utf8');
      return [version, { sql, checksum: createHash('sha256').update(sql).digest('hex') }];
    }));
    const { rows } = await client.query<{ version: string; checksum: string }>(
      'select version, checksum from sutra.schema_migrations order by version',
    );
    for (const { version, checksum } of rows) {
      if (migrations.get(version)?.checksum !== checksum) {
        throw new Error(`Hosted migration checksum could not be verified for ${version}`);
      }
      migrations.delete(version);
    }
    const pending = Array.from(migrations.keys());
    if (pending.some((file) => !releaseFiles.has(file))) {
      throw new Error(`Unexpected pending migration(s): ${pending.join(', ')}`);
    }
    if (mode === '--apply' && !Array.from(releaseFiles).every((file) => files.includes(file))) {
      throw new Error('Every allowlisted release migration must exist before hosted apply');
    }

    console.log(`Verified ${rows.length} hosted migration checksums.`);
    console.log(pending.length ? `Pending release migrations: ${pending.join(', ')}` : 'No pending migrations.');
    if (mode === '--apply') {
      for (const [version, { sql, checksum }] of migrations) {
        await client.query(sql.replaceAll(':api_role', 'sutra_api'));
        await client.query('insert into sutra.schema_migrations (version, checksum) values ($1, $2)', [version, checksum]);
      }
      await client.query('commit');
      console.log(`Applied ${pending.length} hosted release migration(s) transactionally.`);
    } else {
      await client.query('rollback');
    }
  } catch (error) {
    // PostgreSQL errors can contain query details or connection strings. Emit only the code.
    if (error instanceof pg.DatabaseError || (error instanceof Error && 'code' in error)) {
      throw new Error(`Hosted database operation failed (${error.code}).`);
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Hosted migration check failed');
  process.exitCode = 1;
});

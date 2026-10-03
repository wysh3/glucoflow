/**
 * Migration runner.
 *
 * Applies every file in supabase/migrations in filename order, inside a transaction,
 * and records a checksum so later edits to an applied migration are detected.
 *
 *   pnpm db:migrate                       # local development (role: sutra_api)
 *   pnpm db:migrate -- --api-role authenticated   # hosted Supabase
 *   pnpm db:migrate -- --reset            # drop the sutra schema and reapply (never in production)
 *
 * `:api_role` in a migration is replaced by the API privilege role for this
 * environment, so the same files work locally and on a hosted Supabase project.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { appRoot, ensureLocalEnv, LOCAL_DEFAULTS } from './lib/env';

const MIGRATIONS_DIR = join(appRoot, 'supabase', 'migrations');
const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

function parseArgs(argv: string[]) {
  const args = { reset: false, apiRole: 'sutra_api', ownerUrl: '' as string };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--reset') args.reset = true;
    else if (value === '--api-role') args.apiRole = argv[++i] ?? '';
    else if (value === '--database-url') args.ownerUrl = argv[++i] ?? '';
  }
  return args;
}

async function main(): Promise<void> {
  const env = ensureLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  const ownerUrl = args.ownerUrl || env.DATABASE_URL_OWNER;
  if (!IDENTIFIER_RE.test(args.apiRole)) {
    throw new Error(`--api-role must be a simple SQL identifier, received: ${args.apiRole}`);
  }
  if (env.APP_ENV === 'production' && args.reset) {
    throw new Error('refusing to reset a production database (APP_ENV=production)');
  }

  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query('create schema if not exists sutra');
    await client.query(`
      create table if not exists sutra.schema_migrations (
        version text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    if (args.reset) {
      console.log('Resetting schema sutra (development only)...');
      await client.query('drop schema if exists sutra cascade');
      await client.query('create schema sutra');
      await client.query(`
        create table if not exists sutra.schema_migrations (
          version text primary key,
          checksum text not null,
          applied_at timestamptz not null default now()
        )
      `);
    }

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort();

    const applied = new Map<string, string>();
    const rows = await client.query<{ version: string; checksum: string }>(
      'select version, checksum from sutra.schema_migrations',
    );
    for (const row of rows.rows) applied.set(row.version, row.checksum);

    let appliedCount = 0;
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = applied.get(file);
      if (previous === checksum) {
        continue;
      }
      if (previous && previous !== checksum) {
        throw new Error(
          `${file} changed after it was applied. Add a new migration instead of editing an applied one.`,
        );
      }
      const prepared = sql.replaceAll(':api_role', args.apiRole);
      process.stdout.write(`applying ${file} ... `);
      try {
        await client.query('begin');
        await client.query(prepared);
        await client.query('insert into sutra.schema_migrations (version, checksum) values ($1, $2)', [
          file,
          checksum,
        ]);
        await client.query('commit');
        appliedCount += 1;
        console.log('ok');
      } catch (error) {
        await client.query('rollback');
        console.log('failed');
        throw error;
      }
    }
    console.log(
      appliedCount === 0
        ? `Database up to date (${files.length} migrations).`
        : `Applied ${appliedCount} migration(s).`,
    );

    if (args.apiRole === 'sutra_api') {
      await ensureLocalLoginRoles(client, env);
    }
  } finally {
    await client.end();
  }
}

/**
 * Local development logins. The API and worker connect as these login roles and
 * immediately `set local role sutra_api | sutra_worker`, so RLS applies to the
 * privilege role and not to a table owner.
 */
async function ensureLocalLoginRoles(
  client: pg.Client,
  env: ReturnType<typeof ensureLocalEnv>,
): Promise<void> {
  const pairs: [string, string, string][] = [
    [LOCAL_DEFAULTS.PG_API_LOGIN, env.LOCAL_PG_API_PASSWORD ?? '', 'sutra_api'],
    [LOCAL_DEFAULTS.PG_WORKER_LOGIN, env.LOCAL_PG_WORKER_PASSWORD ?? '', 'sutra_worker'],
  ];
  for (const [login, password, privilege] of pairs) {
    if (!password) continue;
    const exists = await client.query('select 1 from pg_roles where rolname = $1', [login]);
    if (exists.rowCount === 0) {
      await client.query(`create role ${login} login password '${password.replace(/'/g, "''")}'`);
    } else {
      await client.query(`alter role ${login} with login password '${password.replace(/'/g, "''")}'`);
    }
    await client.query(`grant ${privilege} to ${login}`);
    await client.query(`alter role ${login} set search_path = sutra, public`);
  }
  console.log(`Local login roles ready: ${pairs.map(([login]) => login).join(', ')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

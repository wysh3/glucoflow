/**
 * Database isolation and constraint tests.
 *
 * This is the local equivalent of `supabase test db`: it runs the SQL suite in
 * supabase/tests against a disposable schema and reports every assertion. Run it with
 * `pnpm db:test` after `pnpm db:start` and `pnpm db:migrate`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { appRoot, ensureLocalEnv } from './lib/env';

async function main(): Promise<void> {
  const env = ensureLocalEnv();
  const testsDir = join(appRoot, 'supabase', 'tests');
  const files = readdirSync(testsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (files.length === 0) throw new Error('No SQL test files were found.');

  const client = new pg.Client({ connectionString: env.DATABASE_URL_OWNER });
  await client.connect();
  let failures = 0;
  try {
    for (const file of files) {
      const sql = readFileSync(join(testsDir, file), 'utf8');
      process.stdout.write(`running ${file} ... `);
      try {
        await client.query(sql);
        const results = await client.query<{ test: string; ok: boolean; detail: string }>(
          'select test, ok, detail from sutra_test_results order by ordinal',
        );
        const failed = results.rows.filter((row) => !row.ok);
        failures += failed.length;
        console.log(failed.length === 0 ? `ok (${results.rowCount} checks)` : `FAILED (${failed.length})`);
        for (const row of results.rows) {
          console.log(`  ${row.ok ? 'PASS' : 'FAIL'}  ${row.test} — ${row.detail}`);
        }
      } catch (error) {
        failures += 1;
        console.log('error');
        console.error(error instanceof Error ? error.message : error);
      }
    }
  } finally {
    await client.end();
  }

  if (failures > 0) {
    console.error(`${failures} database check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('All database isolation and constraint checks passed.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

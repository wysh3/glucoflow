import pg from 'pg';
import { QUEUE_PAUSE_LOCK_KEY } from '@glucoflow/data';
import { ensureLocalEnv } from '../scripts/lib/env';

/**
 * Vitest global setup.
 *
 * The integration suites own their jobs, so a development worker running against the
 * same database would compete for them. This holds the queue pause lock for the whole
 * run: the worker stops leasing new jobs and the suites become deterministic. The lock
 * is released when the run ends, and it is an advisory lock, so a crashed run cannot
 * leave the queue stuck.
 */
let client: pg.Client | null = null;

export async function setup(): Promise<void> {
  const env = ensureLocalEnv();
  if (!env.DATABASE_URL_OWNER) {
    throw new Error(
      'No local database configuration. Run "pnpm db:start" and "pnpm db:migrate" before "pnpm test".',
    );
  }
  client = new pg.Client({ connectionString: env.DATABASE_URL_OWNER });
  await client.connect();
  await client.query('select pg_advisory_lock($1)', [QUEUE_PAUSE_LOCK_KEY]);
  process.stdout.write(
    `Queue pause lock held for this run (key ${QUEUE_PAUSE_LOCK_KEY}); a running worker will not lease jobs.\n`,
  );
}

export async function teardown(): Promise<void> {
  if (!client) return;
  await client.query('select pg_advisory_unlock($1)', [QUEUE_PAUSE_LOCK_KEY]).catch(() => undefined);
  await client.end().catch(() => undefined);
  client = null;
}

import pg from 'pg';

/**
 * Scoped database access.
 *
 * Every transaction is pinned to one connection, sets its actor transaction-locally
 * and switches to the privilege role, so row level security is evaluated for that
 * actor and nothing leaks between pooled connections.
 *
 * The API role never owns the tables and does not have BYPASSRLS.
 */

export type DbPool = pg.Pool;
export type DbClient = pg.PoolClient;

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

export type PoolOptions = {
  connectionString: string;
  max?: number;
  applicationName: string;
  statementTimeoutMs?: number;
};

export function createPool(options: PoolOptions): DbPool {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 10,
    application_name: options.applicationName,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: false,
  });
  pool.on('error', (error) => {
    console.error(`[db] idle client error: ${error.message}`);
  });
  return pool;
}

function quoteIdentifier(value: string): string {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(`refusing to use an unsafe database role name: ${value}`);
  }
  return `"${value}"`;
}

async function beginScoped(
  pool: DbPool,
  role: string,
  settings: Record<string, string | null>,
  statementTimeoutMs: number,
): Promise<DbClient> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local statement_timeout = ${Math.max(1000, statementTimeoutMs)}`);
    await client.query(`set local role ${quoteIdentifier(role)}`);
    for (const [key, value] of Object.entries(settings)) {
      if (value === null) continue;
      await client.query('select set_config($1, $2, true)', [key, value]);
    }
    return client;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    client.release();
    throw error;
  }
}

export type TransactionOptions = {
  role: string;
  actorId?: string | null;
  clinicId?: string | null;
  workerId?: string | null;
  statementTimeoutMs?: number;
  /** Additional transaction-local settings, for example app.auth_purpose. */
  settings?: Record<string, string>;
};

export async function withTransaction<T>(
  pool: DbPool,
  options: TransactionOptions,
  fn: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = await beginScoped(
    pool,
    options.role,
    {
      'app.actor_id': options.actorId ?? null,
      'app.clinic_id': options.clinicId ?? null,
      'app.worker_id': options.workerId ?? null,
      ...(options.settings ?? {}),
    },
    options.statementTimeoutMs ?? 15_000,
  );
  try {
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Actor-scoped transaction for API requests. */
export function withActor<T>(
  pool: DbPool,
  role: string,
  actorId: string,
  fn: (client: DbClient) => Promise<T>,
  statementTimeoutMs?: number,
): Promise<T> {
  return withTransaction(pool, { role, actorId, statementTimeoutMs }, fn);
}

/** Elevated worker transaction. Credentials for this role stay server-side. */
export function withWorker<T>(
  pool: DbPool,
  role: string,
  workerId: string,
  fn: (client: DbClient) => Promise<T>,
  statementTimeoutMs?: number,
): Promise<T> {
  return withTransaction(
    pool,
    { role, workerId, statementTimeoutMs: statementTimeoutMs ?? 120_000 },
    fn,
  );
}

/** Administrative transaction used by local operator scripts only. */
export function withOwner<T>(
  pool: DbPool,
  ownerRole: string,
  fn: (client: DbClient) => Promise<T>,
  statementTimeoutMs?: number,
): Promise<T> {
  return withTransaction(
    pool,
    { role: ownerRole, statementTimeoutMs: statementTimeoutMs ?? 120_000 },
    fn,
  );
}

export type Queryable = {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>>;
};

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

export function isCheckViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23514';
}

export function pgErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export type { pg };

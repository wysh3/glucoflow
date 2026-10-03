import { apiConfig, type ApiConfig } from './config';
import { createTokenVerifier, type TokenVerifier } from './auth';
import { createPool, withTransaction, type DbPool } from '@glucoflow/data/pool';
import {
  LocalStorageAdapter,
  SupabaseStorageAdapter,
  type StorageAdapter,
} from '@glucoflow/data/storage';

export type AppContext = {
  config: ApiConfig;
  pool: DbPool;
  storage: StorageAdapter;
  verifyToken: TokenVerifier;
};

export function createStorage(config: ApiConfig): StorageAdapter {
  if (config.STORAGE_MODE === 'supabase') {
    if (!config.SUPABASE_URL || !config.SUPABASE_STORAGE_SERVER_KEY) {
      throw new Error('Supabase storage mode needs SUPABASE_URL and SUPABASE_STORAGE_SERVER_KEY');
    }
    return new SupabaseStorageAdapter({
      supabaseUrl: config.SUPABASE_URL,
      serviceKey: config.SUPABASE_STORAGE_SERVER_KEY,
    });
  }
  if (!config.STORAGE_LOCAL_SECRET) {
    throw new Error('Local storage mode needs STORAGE_LOCAL_SECRET');
  }
  return new LocalStorageAdapter({
    root: config.storageRoot,
    secret: config.STORAGE_LOCAL_SECRET,
    publicBaseUrl: process.env.API_BASE_URL ?? `http://127.0.0.1:${config.PORT}`,
  });
}

export function extractionMode(config: ApiConfig): 'fixture' | 'live' {
  return config.EXTRACTION_PROVIDER === 'fixture' ? 'fixture' : 'live';
}

export function extractionLabel(config: ApiConfig): string {
  return config.EXTRACTION_PROVIDER === 'fixture'
    ? 'Fixture data: deterministic rule engine, not an AI model'
    : `Live extraction model: ${config.EXTRACTION_MODEL}`;
}

export async function createAppContext(): Promise<AppContext> {
  const config = apiConfig();
  const pool = createPool({
    connectionString: process.env.DATABASE_URL_API ?? '',
    applicationName: 'sutra-api',
    max: Number(process.env.API_DB_POOL_MAX ?? 10),
  });

  if (config.APP_ENV === 'production') {
    await assertNoLocalCredentials(pool, config);
  }

  return {
    config,
    pool,
    storage: createStorage(config),
    verifyToken: createTokenVerifier(config),
  };
}

/**
 * A production deployment authenticates through Supabase Auth. If development
 * credentials exist there, the process refuses to start rather than silently
 * accepting them.
 */
export async function assertNoLocalCredentials(pool: DbPool, config: ApiConfig): Promise<void> {
  const count = await withTransaction(
    pool,
    { role: config.apiRole, settings: { 'app.auth_purpose': 'signin' } },
    async (client) => {
      const result = await client.query<{ count: string }>(
        'select count(*)::text as count from sutra.local_credentials',
      );
      return Number(result.rows[0]?.count ?? '0');
    },
  );
  if (count > 0) {
    throw new Error(
      `APP_ENV=production but ${count} local development credential(s) exist. Remove them before deploying.`,
    );
  }
}

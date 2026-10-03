import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

export const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const envPath = join(appRoot, '.env');
export const localRoot = join(appRoot, '.local');

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Minimal .env reader. No script in this repository prints these values. */
export function readEnvFile(path: string = envPath): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadEnvFileIntoProcess(): void {
  for (const [key, value] of Object.entries(readEnvFile())) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function appendEnv(entries: Record<string, string>): void {
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const lines: string[] = [];
  for (const [key, value] of Object.entries(entries)) {
    if (new RegExp(`^${key}=`, 'm').test(existing)) continue;
    lines.push(`${key}=${value}`);
  }
  if (lines.length === 0) return;
  const header = existing ? '' : '# Generated local development configuration. Not committed.\n';
  writeFileSync(envPath, `${existing}${header}${lines.join('\n')}\n`, { mode: 0o600 });
}

export const LOCAL_DEFAULTS = {
  PG_HOST: '127.0.0.1',
  PG_PORT: '55432',
  PG_DATABASE: 'sutra',
  PG_OWNER: 'sutra_owner',
  PG_API_LOGIN: 'sutra_api_login',
  PG_WORKER_LOGIN: 'sutra_worker_login',
} as const;

function urlFor(user: string, password: string): string {
  const { PG_HOST, PG_PORT, PG_DATABASE } = LOCAL_DEFAULTS;
  return `postgres://${user}:${encodeURIComponent(password)}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`;
}

export type LocalEnv = Record<string, string>;

/**
 * Creates app/.env with generated local secrets when values are missing.
 * Returns the effective local configuration. Existing values are never overwritten.
 */
export function ensureLocalEnv(): LocalEnv {
  mkdirSync(localRoot, { recursive: true });
  const current = readEnvFile();
  const generated: Record<string, string> = {};
  if (!current.LOCAL_PG_OWNER_PASSWORD) generated.LOCAL_PG_OWNER_PASSWORD = randomSecret(18);
  if (!current.LOCAL_PG_API_PASSWORD) generated.LOCAL_PG_API_PASSWORD = randomSecret(18);
  if (!current.LOCAL_PG_WORKER_PASSWORD) generated.LOCAL_PG_WORKER_PASSWORD = randomSecret(18);
  if (!current.AUTH_LOCAL_JWT_SECRET) generated.AUTH_LOCAL_JWT_SECRET = randomSecret(32);
  if (!current.STORAGE_LOCAL_SECRET) generated.STORAGE_LOCAL_SECRET = randomSecret(32);
  if (Object.keys(generated).length > 0) appendEnv(generated);

  const env: LocalEnv = { ...readEnvFile(), ...(process.env as Record<string, string>) };

  // Connection strings and local defaults are persisted so the documented commands
  // work for every process. Values already present are never overwritten.
  const ownerUrl = urlFor(LOCAL_DEFAULTS.PG_OWNER, env.LOCAL_PG_OWNER_PASSWORD ?? '');
  const apiUrl = urlFor(LOCAL_DEFAULTS.PG_API_LOGIN, env.LOCAL_PG_API_PASSWORD ?? '');
  const workerUrl = urlFor(LOCAL_DEFAULTS.PG_WORKER_LOGIN, env.LOCAL_PG_WORKER_PASSWORD ?? '');
  appendEnv({
    DATABASE_URL_OWNER: ownerUrl,
    DATABASE_URL_API: apiUrl,
    DATABASE_URL_WORKER: workerUrl,
    STORAGE_LOCAL_ROOT: env.STORAGE_LOCAL_ROOT ?? join(localRoot, 'storage'),
    TMP_ROOT: env.TMP_ROOT ?? join(localRoot, 'tmp'),
    API_BASE_URL: env.API_BASE_URL ?? 'http://127.0.0.1:8787',
    CLIENT_BASE_URL: env.CLIENT_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  return {
    ...LOCAL_DEFAULTS,
    APP_ENV: env.APP_ENV ?? 'development',
    DATABASE_URL_OWNER: ownerUrl,
    DATABASE_URL_API: apiUrl,
    DATABASE_URL_WORKER: workerUrl,
    LOCAL_PG_OWNER_PASSWORD: env.LOCAL_PG_OWNER_PASSWORD ?? '',
    LOCAL_PG_API_PASSWORD: env.LOCAL_PG_API_PASSWORD ?? '',
    LOCAL_PG_WORKER_PASSWORD: env.LOCAL_PG_WORKER_PASSWORD ?? '',
    AUTH_MODE: env.AUTH_MODE ?? 'local',
    AUTH_LOCAL_JWT_SECRET: env.AUTH_LOCAL_JWT_SECRET ?? '',
    AUTH_LOCAL_ISSUER: env.AUTH_LOCAL_ISSUER ?? 'sutra-local',
    AUTH_LOCAL_AUDIENCE: env.AUTH_LOCAL_AUDIENCE ?? 'sutra-api',
    STORAGE_MODE: env.STORAGE_MODE ?? 'local',
    STORAGE_LOCAL_ROOT: env.STORAGE_LOCAL_ROOT ?? join(localRoot, 'storage'),
    STORAGE_LOCAL_SECRET: env.STORAGE_LOCAL_SECRET ?? '',
    STORAGE_BUCKET_SOURCES: env.STORAGE_BUCKET_SOURCES ?? 'sutra-sources',
    STORAGE_BUCKET_EXPORTS: env.STORAGE_BUCKET_EXPORTS ?? 'sutra-exports',
    EXTRACTION_PROVIDER: env.EXTRACTION_PROVIDER ?? 'fixture',
    EXTRACTION_MODE: env.EXTRACTION_MODE ?? '',
    EXTRACTION_MODEL: env.EXTRACTION_MODEL ?? 'deterministic-rules-v1',
    EXTRACTION_BASE_URL: env.EXTRACTION_BASE_URL ?? '',
    EXTRACTION_API_KEY: env.EXTRACTION_API_KEY ?? '',
    MAX_DOCUMENT_MODEL_CALLS: env.MAX_DOCUMENT_MODEL_CALLS ?? '12',
    MAX_RUN_TOKENS: env.MAX_RUN_TOKENS ?? '',
    MAX_DOCUMENT_COST_USD: env.MAX_DOCUMENT_COST_USD ?? '',
    MAX_RUN_COST_USD: env.MAX_RUN_COST_USD ?? '',
    MAX_DOCUMENT_USD_PER_MTOK_INPUT: env.MAX_DOCUMENT_USD_PER_MTOK_INPUT ?? '',
    MAX_DOCUMENT_USD_PER_MTOK_OUTPUT: env.MAX_DOCUMENT_USD_PER_MTOK_OUTPUT ?? '',
    EXTRACTION_REQUEST_TIMEOUT_MS: env.EXTRACTION_REQUEST_TIMEOUT_MS ?? '',
    EXTRACTION_PAGES_PER_REQUEST: env.EXTRACTION_PAGES_PER_REQUEST ?? '',
    PORT: env.PORT ?? '8787',
    API_BASE_URL: env.API_BASE_URL ?? 'http://127.0.0.1:8787',
    CLIENT_BASE_URL: env.CLIENT_BASE_URL ?? 'http://127.0.0.1:5173',
    ALLOWED_ORIGINS:
      env.ALLOWED_ORIGINS ??
      // The Capacitor Android WebView serves bundled assets from https://localhost.
      'http://127.0.0.1:5173,http://localhost:5173,https://localhost,capacitor://localhost,http://localhost',
    DEMO_LABEL: env.DEMO_LABEL ?? 'Synthetic demo',
    UPLOAD_MAX_BYTES: env.UPLOAD_MAX_BYTES ?? '15728640',
    UPLOAD_MAX_PAGES: env.UPLOAD_MAX_PAGES ?? '10',
    WORKER_CONCURRENCY: env.WORKER_CONCURRENCY ?? '2',
    OCR_ENABLED: env.OCR_ENABLED ?? 'true',
    TMP_ROOT: env.TMP_ROOT ?? join(localRoot, 'tmp'),
  };
}

export function requireEnv(env: LocalEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is not configured. Run "pnpm db:start" and "pnpm db:migrate" first.`);
  }
  return value;
}

/** Environment visible to the API process when started by `pnpm dev`. */
export function apiProcessEnv(env: LocalEnv): Record<string, string> {
  return {
    APP_ENV: env.APP_ENV ?? 'development',
    PORT: env.PORT ?? '8787',
    DATABASE_URL_API: env.DATABASE_URL_API ?? '',
    AUTH_MODE: env.AUTH_MODE ?? 'local',
    AUTH_LOCAL_JWT_SECRET: env.AUTH_LOCAL_JWT_SECRET ?? '',
    AUTH_LOCAL_ISSUER: env.AUTH_LOCAL_ISSUER ?? 'sutra-local',
    AUTH_LOCAL_AUDIENCE: env.AUTH_LOCAL_AUDIENCE ?? 'sutra-api',
    STORAGE_MODE: env.STORAGE_MODE ?? 'local',
    STORAGE_LOCAL_ROOT: env.STORAGE_LOCAL_ROOT ?? '',
    STORAGE_LOCAL_SECRET: env.STORAGE_LOCAL_SECRET ?? '',
    STORAGE_BUCKET_SOURCES: env.STORAGE_BUCKET_SOURCES ?? 'sutra-sources',
    STORAGE_BUCKET_EXPORTS: env.STORAGE_BUCKET_EXPORTS ?? 'sutra-exports',
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS ?? '',
    UPLOAD_MAX_BYTES: env.UPLOAD_MAX_BYTES ?? '15728640',
    UPLOAD_MAX_PAGES: env.UPLOAD_MAX_PAGES ?? '10',
    EXTRACTION_PROVIDER: env.EXTRACTION_PROVIDER ?? 'fixture',
    EXTRACTION_MODEL: env.EXTRACTION_MODEL ?? 'deterministic-rules-v1',
    DEMO_LABEL: env.DEMO_LABEL ?? 'Synthetic demo',
  };
}

/** Environment visible to the worker process when started by `pnpm dev`. */
export function workerProcessEnv(env: LocalEnv): Record<string, string> {
  return {
    APP_ENV: env.APP_ENV ?? 'development',
    DATABASE_URL_WORKER: env.DATABASE_URL_WORKER ?? '',
    STORAGE_MODE: env.STORAGE_MODE ?? 'local',
    STORAGE_LOCAL_ROOT: env.STORAGE_LOCAL_ROOT ?? '',
    STORAGE_LOCAL_SECRET: env.STORAGE_LOCAL_SECRET ?? '',
    STORAGE_BUCKET_SOURCES: env.STORAGE_BUCKET_SOURCES ?? 'sutra-sources',
    STORAGE_BUCKET_EXPORTS: env.STORAGE_BUCKET_EXPORTS ?? 'sutra-exports',
    EXTRACTION_PROVIDER: env.EXTRACTION_PROVIDER ?? 'fixture',
    EXTRACTION_MODEL: env.EXTRACTION_MODEL ?? 'deterministic-rules-v1',
    MAX_DOCUMENT_MODEL_CALLS: env.MAX_DOCUMENT_MODEL_CALLS ?? '12',
    WORKER_CONCURRENCY: env.WORKER_CONCURRENCY ?? '2',
    OCR_ENABLED: env.OCR_ENABLED ?? 'true',
    TMP_ROOT: env.TMP_ROOT ?? '',
    DEMO_LABEL: env.DEMO_LABEL ?? 'Synthetic demo',
  };
}

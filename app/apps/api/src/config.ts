import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { apiEnvSchema, formatEnvError, type ApiEnv } from '@glucoflow/contracts';
import { findAppRoot, loadDotEnv, resolveFromAppRoot } from '@glucoflow/data/runtime';

export type ApiConfig = ApiEnv & {
  allowedOrigins: string[];
  apiRole: string;
  storageRoot: string;
};

let cached: ApiConfig | null = null;

export function apiConfig(): ApiConfig {
  if (cached) return cached;
  const appRoot = findAppRoot(dirname(fileURLToPath(import.meta.url)));
  loadDotEnv(appRoot);

  const parsed = apiEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`API configuration is invalid:\n${formatEnvError(parsed.error)}`);
  }
  const env = parsed.data;
  cached = {
    ...env,
    allowedOrigins: env.ALLOWED_ORIGINS.split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    apiRole: process.env.DATABASE_ROLE_API ?? 'sutra_api',
    storageRoot: resolveFromAppRoot(appRoot, env.STORAGE_LOCAL_ROOT),
  };
  return cached;
}

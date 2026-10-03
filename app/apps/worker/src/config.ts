import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatEnvError, workerEnvSchema, type WorkerEnv } from '@glucoflow/contracts';
import { findAppRoot, loadDotEnv, resolveFromAppRoot } from '@glucoflow/data/runtime';

export type WorkerConfig = WorkerEnv & {
  appRoot: string;
  workerRole: string;
  storageRoot: string;
  tmpRoot: string;
  workerId: string;
};

let cached: WorkerConfig | null = null;

export function workerConfig(): WorkerConfig {
  if (cached) return cached;
  const appRoot = findAppRoot(dirname(fileURLToPath(import.meta.url)));
  loadDotEnv(appRoot);

  const parsed = workerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Worker configuration is invalid:\n${formatEnvError(parsed.error)}`);
  }
  const env = parsed.data;
  cached = {
    ...env,
    appRoot,
    workerRole: process.env.DATABASE_ROLE_WORKER ?? 'sutra_worker',
    storageRoot: resolveFromAppRoot(appRoot, env.STORAGE_LOCAL_ROOT),
    tmpRoot: resolveFromAppRoot(appRoot, env.TMP_ROOT),
    workerId: env.WORKER_ID ?? `worker-${process.pid}`,
  };
  return cached;
}

export function storageOptions(config: WorkerConfig): {
  mode: 'local' | 'supabase';
  root?: string;
  secret?: string;
  supabaseUrl?: string;
  serviceKey?: string;
} {
  if (config.STORAGE_MODE === 'supabase') {
    return {
      mode: 'supabase',
      supabaseUrl: config.SUPABASE_URL,
      serviceKey: config.SUPABASE_STORAGE_SERVER_KEY,
    };
  }
  return { mode: 'local', root: config.storageRoot, secret: config.STORAGE_LOCAL_SECRET };
}

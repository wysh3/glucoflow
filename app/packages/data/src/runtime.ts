import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Runtime paths shared by the API, the worker and the local scripts.
 * Application root is the directory that holds pnpm-workspace.yaml.
 */
export function findAppRoot(startDirectory: string): string {
  let current = resolve(startDirectory);
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve(startDirectory);
}

/**
 * Loads app/.env into process.env when present. Never overwrites an existing
 * process environment value, so container configuration always wins.
 */
export function loadDotEnv(appRoot: string): void {
  const envFile = join(appRoot, '.env');
  if (!existsSync(envFile)) return;
  try {
    process.loadEnvFile(envFile);
  } catch {
    // A malformed local file must not stop a deployed process.
  }
}

export function resolveFromAppRoot(appRoot: string, path: string): string {
  return path.startsWith('/') ? path : join(appRoot, path);
}

/**
 * Starts the API, the worker and the client for local development.
 *
 *   pnpm dev
 *
 * Each process receives only the environment it needs. Privileged values stay in the
 * server processes; the client receives public configuration only.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { apiProcessEnv, ensureLocalEnv, workerProcessEnv } from './lib/env';

const env = ensureLocalEnv();

type Service = { name: string; command: string; args: string[]; env: NodeJS.ProcessEnv };

const services: Service[] = [
  {
    name: 'api',
    command: 'pnpm',
    args: ['--filter', '@sutra/api', 'dev'],
    env: { ...process.env, ...apiProcessEnv(env), API_BASE_URL: env.API_BASE_URL ?? '' },
  },
  {
    name: 'worker',
    command: 'pnpm',
    args: ['--filter', '@sutra/worker', 'dev'],
    env: { ...process.env, ...workerProcessEnv(env) },
  },
  {
    name: 'client',
    command: 'pnpm',
    args: ['--filter', '@sutra/client', 'dev'],
    env: {
      ...process.env,
      VITE_API_BASE_URL: env.API_BASE_URL ?? 'http://127.0.0.1:8787',
      VITE_DEMO_LABEL: env.DEMO_LABEL ?? 'Synthetic demo',
    },
  },
];

const children: ChildProcess[] = [];

for (const service of services) {
  const child = spawn(service.command, service.args, {
    env: service.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) console.log(`[${service.name}] ${line.trim()}`);
    }
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) console.error(`[${service.name}] ${line.trim()}`);
    }
  });
  child.on('exit', (code) => {
    console.log(`[${service.name}] exited with code ${code ?? 'unknown'}`);
  });
  children.push(child);
}

console.log('');
console.log(`Client:  ${env.CLIENT_BASE_URL ?? 'http://127.0.0.1:5173'}`);
console.log(`API:     ${env.API_BASE_URL ?? 'http://127.0.0.1:8787'}`);
console.log('Press Ctrl+C to stop every process.');
console.log('');

const shutdown = (): void => {
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

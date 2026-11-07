/** Bounded synthetic localhost HTTP exercise. No live providers, credentials in reports, or DB reset.
 * Run from app/: pnpm exec tsx scripts/stress-care-api.ts
 * Creates nine disposable synthetic Care workspaces in the existing local database.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { appRoot, localRoot } from './lib/env';

const base = 'http://127.0.0.1:8787'; // Deliberately no remote override.
const runId = randomUUID();
const startedAt = new Date().toISOString();
let token = '';
let requestCount = 0;
type State = { id: string; revision: number; encounters: { id: string; patientName: string }[]; messages: { engine?: string }[] };
type Sample = { status: number; ms: number; code?: string; body?: State };
type Stage = ReturnType<typeof summarize>;
const stages: Stage[] = [];
const assertions: { name: string; passed: boolean }[] = [];
function assert(name: string, passed: boolean) { assertions.push({ name, passed }); }
async function request(path: string, body?: unknown, key?: string): Promise<Sample> {
  if (++requestCount > 190) throw new Error('Hard request budget exceeded');
  const start = performance.now();
  try {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
        'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json() as State & { error?: { code?: string }; accessToken?: string };
    if (path.endsWith('local-sign-in') && response.ok) token = payload.accessToken ?? '';
    return { status: response.status, ms: performance.now() - start,
      ...(payload.error?.code ? { code: payload.error.code } : {}), body: payload };
  } catch {
    return { status: 0, ms: performance.now() - start, code: 'transport_or_decode_failure' };
  }
}
function summarize(name: string, concurrency: number, samples: Sample[], elapsedMs: number) {
  const sorted = samples.map(x => x.ms).sort((a, b) => a - b);
  const counts: Record<string, number> = {};
  const codes: Record<string, number> = {};
  for (const sample of samples) {
    counts[sample.status] = (counts[sample.status] ?? 0) + 1;
    if (sample.code) codes[sample.code] = (codes[sample.code] ?? 0) + 1;
  }
  return { name, concurrency, requests: samples.length, elapsedMs: Math.round(elapsedMs),
    requestsPerSecond: Number((samples.length / (elapsedMs / 1000)).toFixed(2)),
    p50Ms: Number(sorted[Math.ceil(sorted.length * 0.5) - 1]!.toFixed(2)),
    p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1]!.toFixed(2)),
    statusCounts: counts, errorCodes: codes,
    conflicts409: samples.filter(x => x.status === 409).length,
    throttled429: samples.filter(x => x.status === 429).length,
    server5xx: samples.filter(x => x.status >= 500).length,
    transportFailures: samples.filter(x => x.status === 0).length };
}
async function wave(name: string, concurrency: number, count: number, fn: (i: number) => Promise<Sample>) {
  const started = performance.now();
  const samples: Sample[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < count) { const i = next++; samples[i] = await fn(i); }
  }));
  const stage = summarize(name, concurrency, samples, performance.now() - started);
  stages.push(stage);
  console.log(JSON.stringify(stage));
  return samples;
}
async function workspace() {
  const created = await request('/api/v1/care/workspaces', {});
  if (created.status !== 201 || !created.body?.id) throw new Error(`Synthetic workspace setup failed: HTTP ${created.status}`);
  return created.body;
}
async function main() {
  const creds = JSON.parse(readFileSync(join(localRoot, 'demo-credentials.json'), 'utf8')) as {
    accounts: Record<string, { email: string; password: string }>;
  };
  const account = creds.accounts.clinic;
  if (!account) throw new Error('Local synthetic clinic credentials missing');
  const auth = await request('/api/v1/auth/local-sign-in', { email: account.email, password: account.password });
  if (auth.status !== 200 || !token) throw new Error(`Local sign-in failed: HTTP ${auth.status}`);
  for (const concurrency of [1, 5, 10]) {
    const readState = await workspace();
    const path = `/api/v1/care/workspaces/${readState.id}`;
    const reads = await wave('same-workspace reads', concurrency, 30, () => request(path));
    assert(`read wave c${concurrency}: all HTTP 200`, reads.every(x => x.status === 200));
    const mutationState = await workspace();
    const commandPath = `/api/v1/care/workspaces/${mutationState.id}/commands`;
    const mutation = { expectedRevision: mutationState.revision, command: {
      type: 'add_encounter', patientName: `SYNTHETIC LOAD ${runId}`, bed: 'SIM-ONLY', documentedContext: ['Synthetic HTTP concurrency probe; no real patient.'],
    } };
    const mutations = await wave('distinct keys competing at same revision', concurrency, concurrency,
      i => request(commandPath, mutation, `${runId}-compete-${concurrency}-${i}`));
    assert(`contention c${concurrency}: one winner and stale-revision conflicts`,
      mutations.filter(x => x.status === 200).length === 1 &&
      mutations.filter(x => x.status === 409 && x.code === 'stale_revision').length === concurrency - 1);
    const current = await request(`/api/v1/care/workspaces/${mutationState.id}`);
    if (current.status !== 200 || !current.body) throw new Error('Could not inspect mutation state');
    const repeatBody = { ...mutation, expectedRevision: current.body.revision,
      command: { ...mutation.command, patientName: `SYNTHETIC REPLAY ${runId}` } };
    const repeatKey = `${runId}-replay-${concurrency}`;
    const repeats = await wave('same-key concurrent replay', concurrency, concurrency,
      () => request(commandPath, repeatBody, repeatKey));
    const after = await request(`/api/v1/care/workspaces/${mutationState.id}`);
    assert(`replay c${concurrency}: all 200 and exactly one encounter added`,
      repeats.every(x => x.status === 200) &&
      after.body?.encounters.filter(x => x.patientName === repeatBody.command.patientName).length === 1);
    const mismatched = await request(commandPath, { ...repeatBody, command: { ...repeatBody.command, bed: 'DIFFERENT' } }, repeatKey);
    assert(`replay c${concurrency}: changed payload rejected`, mismatched.status === 409 && mismatched.code === 'idempotency_conflict');
    const chatState = await workspace();
    const chats = await wave('offline chat shared-workspace contention and actor throttle', concurrency, concurrency,
      () => request(`/api/v1/care/workspaces/${chatState.id}/chat`, {
        mode: 'offline', languageCode: 'en-IN', message: 'Show the synthetic workspace source evidence and handover status.',
      }));
    assert(`offline chat c${concurrency}: success, revision conflict or explicit throttle only`,
      chats.every(x => x.status === 200 || (x.status === 409 && x.code === 'stale_revision') || x.status === 429));
    const successfulChats = chats.filter(x => x.status === 200);
    if (concurrency === 1) assert('offline chat baseline: at least one successful reply', successfulChats.length > 0);
    assert(`offline chat c${concurrency}: successful responses identify offline engine`,
      successfulChats.every(x => x.body?.messages.some(m => m.engine === 'offline')));
  }
}
let fatal: string | null = null;
try { await main(); } catch (error) {
  // Only errors created above are reported; never serialize credential objects or HTTP bodies.
  fatal = error instanceof Error && /^(Local|Synthetic|Could not|Hard)/.test(error.message)
    ? error.message : 'Harness setup failed; inspect local configuration privately.';
}
const report = {
  runId, startedAt, finishedAt: new Date().toISOString(), baseUrl: base,
  command: 'cd app && pnpm exec tsx scripts/stress-care-api.ts', synthetic: true,
  requestCount, fatal, stages, assertions,
  limitations: [
    'Synthetic HTTP requests from one local process and one clinic identity; not human testers or independent user sessions.',
    'Concurrency 1/5/10 is a bounded smoke load, not capacity certification; only 30 reads per level.',
    'Read throughput targets one workspace and includes its database row lock; not a production deployment benchmark.',
    'Offline deterministic chat only; no Hermes/provider call, paid inference, or clinical-quality evaluation.',
    'Chat has a 12 requests/minute actor limit; 429 is reported separately from expected optimistic conflicts and server errors.',
    'Creates nine persistent disposable synthetic workspaces; does not reset database or modify prior workspaces.',
    'No browser/Android rendering, upload, worker throughput, long soak, or distributed multi-host traffic tested.',
  ],
};
mkdirSync(join(appRoot, 'reports'), { recursive: true });
const output = join(appRoot, 'reports', 'india-api-load-latest.json');
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ report: 'reports/india-api-load-latest.json', requestCount, assertionsPassed: assertions.filter(x => x.passed).length, assertionsTotal: assertions.length, fatal }));
if (fatal || assertions.some(x => !x.passed) || stages.some(x => x.server5xx || x.transportFailures)) process.exitCode = 1;

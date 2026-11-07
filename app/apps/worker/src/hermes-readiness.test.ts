import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, it, vi, beforeEach } from 'vitest';

const runtimeChecks = vi.hoisted(() => ({ monitor: vi.fn(async () => 0), lease: vi.fn(async () => null), paused: false }));
vi.mock('@glucoflow/data/pool', async (original) => ({
  ...await original<typeof import('@glucoflow/data/pool')>(),
  withTransaction: async (_pool: unknown, _options: unknown, fn: (client: unknown) => Promise<unknown>) => fn({}),
}));
vi.mock('@glucoflow/data', async (original) => ({
  ...await original<typeof import('@glucoflow/data')>(),
  isQueuePaused: async () => runtimeChecks.paused,
  recoverExpiredLeases: async () => undefined,
  leaseJob: runtimeChecks.lease,
}));
vi.mock('./care-monitor', () => ({ monitorCareBatch: runtimeChecks.monitor }));
beforeEach(() => { vi.clearAllMocks(); runtimeChecks.paused = false; });
import { workerConfig } from './config';
import { createRuntime } from './main';
import { waitForHermesExtraction } from './hermes-readiness';

const token = 'synthetic-hermes-health-token';
const model = 'synthetic-health-model';
const ready = {
  engine: 'hermes', version: '0.23.0', model, configured: true, available: true, extractionAvailable: true,
};
const shortWait = { startupTimeoutMs: 500, probeTimeoutMs: 50, pollIntervalMs: 10 };

async function healthServer(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing health fixture address.');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    }),
  };
}

async function until(check: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!check() && Date.now() < deadline) await delay(10);
}

it('monitors care during Hermes cold start without leasing document jobs', async () => {
  const requests: string[] = [];
  const sidecar = await healthServer((request, response) => {
    requests.push(request.url ?? '');
    response.end(JSON.stringify({ ...ready, extractionAvailable: false }));
  });
  const runtime = createRuntime({
    ...workerConfig(), EXTRACTION_PROVIDER: 'hermes', EXTRACTION_MODEL: model,
    HERMES_URL: sidecar.url, HERMES_SERVICE_TOKEN: token,
    MAX_RUN_TOKENS: 100_000, MAX_DOCUMENT_COST_USD: 1,
    MAX_DOCUMENT_USD_PER_MTOK_INPUT: 1, MAX_DOCUMENT_USD_PER_MTOK_OUTPUT: 2,
  });
  const running = runtime.run();
  try {
    await until(() => requests.length > 0 && runtimeChecks.monitor.mock.calls.length > 0);
    expect(requests).toEqual(['/health']);
    expect(runtimeChecks.monitor).toHaveBeenCalledTimes(1);
    expect(runtimeChecks.lease).not.toHaveBeenCalled();
  } finally {
    runtime.stop();
    await running;
    await sidecar.close();
  }
});

it('requires the exact version and model and the native extraction readiness flag', async () => {
  const states = [
    { ...ready, extractionAvailable: false },
    { ...ready, version: '0.22.0' },
    { ...ready, model: 'unexpected-model' },
    ready,
  ];
  const seen: (string | undefined)[] = [];
  const sidecar = await healthServer((request, response) => {
    seen.push(request.headers.authorization);
    response.end(JSON.stringify(states[seen.length - 1]));
  });
  try {
    await expect(waitForHermesExtraction(
      { url: sidecar.url, token, model }, new AbortController().signal, shortWait,
    )).resolves.toBe(true);
    expect(seen).toEqual(Array(4).fill(`Bearer ${token}`));
  } finally {
    await sidecar.close();
  }
});

it('ends startup on rejected service credentials without retrying', async () => {
  let attempts = 0;
  const sidecar = await healthServer((_request, response) => {
    attempts += 1;
    response.writeHead(401).end();
  });
  try {
    await expect(waitForHermesExtraction(
      { url: sidecar.url, token, model }, new AbortController().signal, shortWait,
    )).rejects.toThrow('readiness authentication failed');
    expect(attempts).toBe(1);
  } finally {
    await sidecar.close();
  }
});

it('bounds startup when the runtime never answers a health probe', async () => {
  const sidecar = await healthServer(() => undefined);
  try {
    await expect(waitForHermesExtraction(
      { url: sidecar.url, token, model }, new AbortController().signal,
      { ...shortWait, startupTimeoutMs: 100 },
    )).rejects.toThrow('did not become ready within 0.1s');
  } finally {
    await sidecar.close();
  }
});

it('keeps care monitoring alive after readiness rejection without retrying or leasing', async () => {
  let attempts = 0;
  const sidecar = await healthServer((_request, response) => {
    attempts += 1;
    response.writeHead(401).end();
  });
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const runtime = createRuntime({
    ...workerConfig(), EXTRACTION_PROVIDER: 'hermes', EXTRACTION_MODEL: model,
    HERMES_URL: sidecar.url, HERMES_SERVICE_TOKEN: token,
    MAX_RUN_TOKENS: 100_000, MAX_DOCUMENT_COST_USD: 1,
    MAX_DOCUMENT_USD_PER_MTOK_INPUT: 1, MAX_DOCUMENT_USD_PER_MTOK_OUTPUT: 2,
  });
  let stopped = false;
  const running = runtime.run().finally(() => { stopped = true; });
  try {
    await until(() => log.mock.calls.some(([message]) => String(message).includes('disabled until restart')));
    expect(log.mock.calls.some(([message]) => String(message).includes('disabled until restart'))).toBe(true);
    await delay(550);
    expect(attempts).toBe(1);
    expect(stopped).toBe(false);
    expect(runtimeChecks.monitor).toHaveBeenCalled();
    expect(runtimeChecks.lease).not.toHaveBeenCalled();
  } finally {
    runtime.stop();
    await running;
    await sidecar.close();
    log.mockRestore();
  }
});

it('respects the maintenance pause for care and document work', async () => {
  runtimeChecks.paused = true;
  const runtime = createRuntime({...workerConfig(), EXTRACTION_PROVIDER: 'fixture'});
  const running = runtime.run();
  try {
    await delay(30);
    expect(runtimeChecks.monitor).not.toHaveBeenCalled();
    expect(runtimeChecks.lease).not.toHaveBeenCalled();
  } finally {
    runtime.stop();
    await running;
  }
});

it('does not overlap monitor batches or allow duplicate runtime loops', async () => {
  let release!: () => void;
  runtimeChecks.monitor.mockImplementationOnce(() => new Promise<number>(resolve => { release = () => resolve(0); }));
  const runtime = createRuntime({...workerConfig(), EXTRACTION_PROVIDER: 'fixture'});
  const running = runtime.run();
  try {
    await until(() => runtimeChecks.monitor.mock.calls.length === 1);
    await expect(runtime.run()).rejects.toThrow('only be started once');
    await delay(550);
    expect(runtimeChecks.monitor).toHaveBeenCalledTimes(1);
    expect(runtimeChecks.lease).not.toHaveBeenCalled();
  } finally {
    runtime.stop();
    release();
    await running;
  }
});

it('isolates a care batch failure so ready document work can still be leased', async () => {
  runtimeChecks.monitor.mockRejectedValueOnce(new Error('synthetic monitor failure'));
  const runtime = createRuntime({...workerConfig(), EXTRACTION_PROVIDER: 'fixture'});
  const running = runtime.run();
  try {
    await until(() => runtimeChecks.lease.mock.calls.length > 0);
    expect(runtimeChecks.monitor).toHaveBeenCalledTimes(1);
    expect(runtimeChecks.lease).toHaveBeenCalled();
  } finally {
    runtime.stop();
    await running;
  }
});

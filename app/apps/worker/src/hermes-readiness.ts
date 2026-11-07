import { setTimeout as delay } from 'node:timers/promises';
import { HERMES_EXTRACTION_RUNTIME_VERSION, parseHermesServiceOrigin } from '@glucoflow/extraction';

const defaults = { startupTimeoutMs: 60_000, probeTimeoutMs: 2_000, pollIntervalMs: 2_000 };

function canExtract(body: unknown, model: string): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const health = body as Record<string, unknown>;
  return health.engine === 'hermes' && health.version === HERMES_EXTRACTION_RUNTIME_VERSION &&
    health.model === model && health.configured === true && health.available === true &&
    health.extractionAvailable === true;
}

/** Wait for a compatible native extraction runtime before the queue is opened. */
export async function waitForHermesExtraction(
  config: { url: string; token: string; model: string },
  stopped: AbortSignal,
  options = defaults,
): Promise<boolean> {
  const endpoint = new URL('/health', parseHermesServiceOrigin(config.url));
  const deadline = AbortSignal.any([stopped, AbortSignal.timeout(options.startupTimeoutMs)]);
  while (!deadline.aborted) {
    const signal = AbortSignal.any([deadline, AbortSignal.timeout(options.probeTimeoutMs)]);
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${config.token}` },
      redirect: 'error',
      signal,
    }).catch(() => null);
    if (response?.ok) {
      const health: unknown = await response.json().catch(() => null);
      if (!deadline.aborted && canExtract(health, config.model)) return true;
    } else if (response) {
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 401 || response.status === 403) {
        throw new Error('Hermes extraction readiness authentication failed. Check HERMES_SERVICE_TOKEN.');
      }
    }
    await delay(options.pollIntervalMs, undefined, { signal: deadline }).catch(() => undefined);
  }
  if (stopped.aborted) return false;
  throw new Error(
    `Hermes extraction did not become ready within ${options.startupTimeoutMs / 1000}s. Check the runtime version, model, and extraction skill configuration.`,
  );
}

import { HEARTBEAT_SECONDS } from '@glucoflow/contracts';
import {
  completeJob,
  failJob,
  getExport,
  heartbeat,
  isQueuePaused,
  leaseJob,
  recoverExpiredLeases,
  saveExportResult,
  failExport,
  type DbClient,
  type LeasedJob,
} from '@glucoflow/data';
import {
  LocalStorageAdapter,
  SupabaseStorageAdapter,
  type StorageAdapter,
} from '@glucoflow/data/storage';
import { createExtractionProvider, processDocumentJob } from '@glucoflow/extraction';
import type { ProviderBudget } from '@glucoflow/extraction';
import { createPool, type DbPool } from '@glucoflow/data/pool';
import { withTransaction } from '@glucoflow/data/pool';
import { renderExportSummary } from './jobs/export-summary';
import { workerConfig, type WorkerConfig } from './config';
import { monitorCareBatch } from './care-monitor';
import { waitForHermesExtraction } from './hermes-readiness';

/**
 * Worker process: leases durable jobs, heartbeats the lease every 15 seconds and
 * writes each durable result in its own committed transaction.
 * Source: docs/mvp/03-architecture.md "Durable job contract".
 */

const IDLE_SLEEP_MS = 500;
const BUSY_SLEEP_MS = 50;

export type WorkerRuntime = {
  pool: DbPool;
  storage: StorageAdapter;
  stop: () => void;
  run: () => Promise<void>;
};

export function createStorage(config: WorkerConfig): StorageAdapter {
  if (config.STORAGE_MODE === 'supabase') {
    if (!config.SUPABASE_URL || !config.SUPABASE_STORAGE_SERVER_KEY) {
      throw new Error('Supabase storage mode needs SUPABASE_URL and SUPABASE_STORAGE_SERVER_KEY');
    }
    return new SupabaseStorageAdapter({
      supabaseUrl: config.SUPABASE_URL,
      serviceKey: config.SUPABASE_STORAGE_SERVER_KEY,
    });
  }
  if (!config.STORAGE_LOCAL_SECRET) throw new Error('Local storage mode needs STORAGE_LOCAL_SECRET');
  return new LocalStorageAdapter({
    root: config.storageRoot,
    secret: config.STORAGE_LOCAL_SECRET,
    // The worker never signs client URLs; this base URL is only a placeholder.
    publicBaseUrl: 'http://127.0.0.1',
  });
}

export function createRuntime(config: WorkerConfig): WorkerRuntime {
  const pool = createPool({
    connectionString: process.env.DATABASE_URL_WORKER ?? '',
    applicationName: 'sutra-worker',
    max: Math.max(4, config.WORKER_CONCURRENCY * 2 + 2),
  });
  const storage = createStorage(config);
  let running = true;
  let runStarted = false;
  const startupStop = new AbortController();
  const providerSelection = {
    provider: config.EXTRACTION_PROVIDER,
    model: config.EXTRACTION_MODEL,
    maxCalls: config.MAX_DOCUMENT_MODEL_CALLS,
    ...(config.EXTRACTION_BASE_URL ? { baseUrl: config.EXTRACTION_BASE_URL } : {}),
    ...(config.EXTRACTION_API_KEY ? { apiKey: config.EXTRACTION_API_KEY } : {}),
    ...(config.HERMES_URL ? { hermesUrl: config.HERMES_URL } : {}),
    ...(config.HERMES_SERVICE_TOKEN ? { hermesServiceToken: config.HERMES_SERVICE_TOKEN } : {}),
    ...(config.MAX_DOCUMENT_COST_USD !== undefined ? { maxDocumentCostUsd: config.MAX_DOCUMENT_COST_USD } : {}),
    ...(config.MAX_RUN_TOKENS !== undefined ? { maxRunTokens: config.MAX_RUN_TOKENS } : {}),
    ...(config.MAX_DOCUMENT_USD_PER_MTOK_INPUT !== undefined
      ? { usdPerMillionInputTokens: config.MAX_DOCUMENT_USD_PER_MTOK_INPUT }
      : {}),
    ...(config.MAX_DOCUMENT_USD_PER_MTOK_OUTPUT !== undefined
      ? { usdPerMillionOutputTokens: config.MAX_DOCUMENT_USD_PER_MTOK_OUTPUT }
      : {}),
  };

  const tx = <T>(fn: (client: DbClient) => Promise<T>): Promise<T> =>
    withTransaction(
      pool,
      { role: config.workerRole, workerId: config.workerId, statementTimeoutMs: 60_000 },
      fn,
    );

  const log = (message: string, data?: Record<string, unknown>): void => {
    console.log(JSON.stringify({ level: 'info', message, workerId: config.workerId, ...data }));
  };

  async function handleJob(job: LeasedJob): Promise<void> {
    const beat = setInterval(() => {
      void tx((client) => heartbeat(client, job.jobId, job.leaseToken)).catch(() => undefined);
    }, HEARTBEAT_SECONDS * 1000);
    try {
      if (job.kind === 'process_document') {
        await processDocumentJob(
          {
            tx,
            storage,
            sourceBucket: config.STORAGE_BUCKET_SOURCES,
            tmpRoot: config.tmpRoot,
            enableOcr: config.OCR_ENABLED,
            ...(config.OCR_LANG_PATH ? { ocrLanguagePath: config.OCR_LANG_PATH } : {}),
            maxPages: 10,
            maxCalls: config.MAX_DOCUMENT_MODEL_CALLS,
            createProvider: (budget: ProviderBudget) => createExtractionProvider(providerSelection, budget),
            heartbeat: () => undefined,
            log,
          },
          job,
        );
        return;
      }

      if (job.kind === 'render_export') {
        const record = await tx((client) => getExport(client, job.targetId));
        if (!record || !record.manifest) {
          await tx((client) =>
            failJob(client, job.jobId, job.leaseToken, {
              code: 'export_missing',
              message: 'The export request for this task no longer exists.',
              retryable: false,
            }),
          );
          return;
        }
        try {
          const rendered = await renderExportSummary(
            {
              tx,
              storage,
              exportBucket: config.STORAGE_BUCKET_EXPORTS,
              tmpRoot: config.tmpRoot,
              log,
            },
            {
              exportId: record.dto.exportId,
              jobId: job.jobId,
              leaseToken: job.leaseToken,
              clinicId: record.manifest.clinicId,
              patientId: record.manifest.patientId,
              manifest: record.manifest,
            },
          );
          await tx(async (client) => {
            await saveExportResult(client, {
              exportId: record.dto.exportId,
              jobId: job.jobId,
              leaseToken: job.leaseToken,
              objectPath: rendered.objectPath,
              coverageNotes: [],
            });
            await completeJob(client, job.jobId, job.leaseToken);
          });
        } catch (error) {
          log('export render failed', {
            exportId: record.dto.exportId,
            error: error instanceof Error ? error.message : 'unknown',
          });
          await tx(async (client) => {
            await failExport(client, record.dto.exportId, 'render_failed');
            await failJob(client, job.jobId, job.leaseToken, {
              code: 'render_failed',
              message: error instanceof Error ? error.message : 'export rendering failed',
              retryable: true,
            });
          });
        }
        return;
      }

      await tx((client) =>
        failJob(client, job.jobId, job.leaseToken, {
          code: 'unknown_job_kind',
          message: `Unsupported job kind: ${job.kind}`,
          retryable: false,
        }),
      );
    } catch (error) {
      log('job failed unexpectedly', {
        jobId: job.jobId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      await tx((client) =>
        failJob(client, job.jobId, job.leaseToken, {
          code: 'worker_error',
          message: error instanceof Error ? error.message : 'worker error',
          retryable: true,
        }),
      ).catch(() => undefined);
    } finally {
      clearInterval(beat);
    }
  }

  async function run(): Promise<void> {
    if (runStarted) throw new Error('Worker runtime can only be started once.');
    runStarted = true;
    let extractionReady = config.EXTRACTION_PROVIDER !== 'hermes';
    let readiness: Promise<void> = Promise.resolve();
    // The provider is constructed once at startup so a live configuration fails here,
    // loudly, rather than on the first document. The prompt hash identifies exactly which
    // instructions the model will be given.
    let startupProvider: ReturnType<typeof createExtractionProvider>;
    try {
      startupProvider = createExtractionProvider(providerSelection, {
        reserve: async () => ({ allowed: false, ordinal: null, reason: 'startup check' }),
        reconcile: async () => undefined,
      });
      if (config.EXTRACTION_PROVIDER === 'hermes') {
        if (startupProvider.name !== 'hermes' || !config.HERMES_URL || !config.HERMES_SERVICE_TOKEN) {
          throw new Error('Hermes extraction requires HERMES_URL, HERMES_SERVICE_TOKEN, and positive budget limits.');
        }
        log('waiting for Hermes extraction readiness');
        // Readiness probes are bounded by their own deadline. Care monitoring does
        // not need the model, so it starts immediately; document leasing stays closed.
        readiness = waitForHermesExtraction({
          url: config.HERMES_URL, token: config.HERMES_SERVICE_TOKEN, model: config.EXTRACTION_MODEL,
        }, startupStop.signal).then((ready) => {
          extractionReady = ready;
          if (ready) log('Hermes extraction ready; document queue enabled');
        }).catch(() => {
          // One bounded startup attempt, not an infinite retry loop. Keep the
          // deterministic monitor alive and require an operator restart to retry.
          log('Hermes extraction unavailable; document queue disabled until restart; care monitoring remains active');
        });
      }
    } catch (error) {
      await pool.end();
      throw error;
    }
    log('worker started', {
      concurrency: config.WORKER_CONCURRENCY,
      extractionProvider: startupProvider.name,
      extractionMode: startupProvider.mode,
      extractionModel: startupProvider.model,
      promptHash: startupProvider.promptHash,
      storageMode: config.STORAGE_MODE,
      ocrEnabled: config.OCR_ENABLED,
    });
    const active = new Set<Promise<void>>();
    let pauseLogged = false;
    let lastCareCheck = 0;

    while (running) {
      try {
        // A maintenance or test process can hold the queue pause lock. Work already in
        // flight finishes; no new job is leased while the lock is held.
        const paused = await tx((client) => isQueuePaused(client));
        if (paused) {
          if (!pauseLogged) {
            log('queue paused by another process; waiting');
            pauseLogged = true;
          }
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          continue;
        }
        if (pauseLogged) {
          log('queue pause released; resuming');
          pauseLogged = false;
        }

        if (Date.now() - lastCareCheck >= 5_000) {
          lastCareCheck = Date.now();
          try {
            const changed = await tx((client) => monitorCareBatch(client));
            if (changed) log('care monitoring reconciled', {workspacesChanged: changed});
          } catch {
            // Do not log workspace contents or let a monitoring failure starve document jobs.
            log('care monitoring batch failed');
          }
        }

        while (running && extractionReady && active.size < config.WORKER_CONCURRENCY) {
          const job = await tx(async (client) => {
            await recoverExpiredLeases(client);
            return leaseJob(client);
          });
          if (!job) break;
          const promise = handleJob(job).finally(() => active.delete(promise));
          active.add(promise);
        }
      } catch (error) {
        log('lease loop error', {
          error: error instanceof Error ? error.message : 'unknown',
        });
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, active.size > 0 ? BUSY_SLEEP_MS : IDLE_SLEEP_MS));
    }

    startupStop.abort();
    await readiness;
    await Promise.allSettled([...active]);
    await pool.end();
    log('worker stopped');
  }

  return {
    pool,
    storage,
    stop: () => {
      running = false;
      startupStop.abort();
    },
    run,
  };
}

async function main(): Promise<void> {
  const config = workerConfig();
  const runtime = createRuntime(config);
  const shutdown = (signal: string): void => {
    console.log(JSON.stringify({ level: 'info', message: 'shutdown requested', signal }));
    runtime.stop();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  await runtime.run();
}

// The development entry point is src/main.ts and the bundled entry point is
// dist/worker.mjs, so both names count as a direct invocation.
const invokedDirectly =
  process.argv[1] !== undefined && /(main|worker)\.(ts|mjs|js)$/.test(process.argv[1]);

if (invokedDirectly) {
  void main().catch((error: unknown) => {
    console.error(JSON.stringify({
      level: 'error', message: error instanceof Error ? error.message : 'Worker startup failed.',
    }));
    process.exitCode = 1;
  });
}

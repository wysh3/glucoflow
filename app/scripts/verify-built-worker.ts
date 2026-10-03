/**
 * End-to-end verification of the built worker against a local model stub.
 *
 *   pnpm verify:built-worker
 *
 * This exists because the source-level tests cannot see two classes of defect that the
 * independent review found:
 *
 *  - the prompt was loaded from a path relative to the module, which moves when the code
 *    is bundled, so a live run in `apps/worker/dist/worker.mjs` failed before calling out;
 *  - the worker passed no page-image callback, so rendering was disabled and uploaded
 *    scans skipped OCR entirely.
 *
 * The script stages a real scanned upload, starts the *built* worker with a live provider
 * pointed at a local stub, and asserts what actually left the process: an authenticated
 * request carrying the prompt, the evidence ids and a page image. Nothing here proves
 * anything about a real model; it proves the wiring.
 */
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appRoot, ensureLocalEnv } from './lib/env';
import {
  createTestContext,
  createFixture,
  stageFixtureUpload,
  jobState,
  removeClinic,
  type TestContext,
} from '../tests/integration/harness';

const STUB_PORT = 8795;

type CapturedRequest = {
  authorization: string | null;
  body: {
    messages?: { role: string; content: unknown }[];
    response_format?: unknown;
  };
};

/** A schema-valid answer that cites an evidence id the worker supplied. */
function stubPayload(evidenceId: string): string {
  return JSON.stringify({
    documentIdentity: { nameRaw: null, identifierRaw: null },
    facts: [
      {
        kind: 'observation',
        rawLabel: 'HbA1c',
        rawValue: '7.4',
        rawUnit: '%',
        eventDate: '2026-09-14',
        dateRaw: '14 September 2026',
        dateKind: 'collection',
        datePrecision: 'day',
        normalized: {
          testCode: 'hba1c',
          numericValue: 7.4,
          unitCode: '%',
          rawNumericText: '7.4',
          referenceRangeText: '4.0-5.6',
          plotEligible: false,
          groupId: null,
        },
        evidenceIds: [evidenceId],
        groupId: null,
      },
    ],
    newEvidence: [],
    unhandledPages: [],
    usage: { inputTokens: 900, outputTokens: 120, latencyMs: 0 },
  });
}

async function main(): Promise<void> {
  const env = ensureLocalEnv();
  const captured: CapturedRequest[] = [];
  let stub: Server | null = null;

  const startStub = async (): Promise<void> => {
    stub = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        let body: CapturedRequest['body'] = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as CapturedRequest['body'];
        } catch {
          body = {};
        }
        captured.push({ authorization: request.headers.authorization ?? null, body });
        const text = JSON.stringify(body.messages ?? []);
        // Cite the first evidence id the worker actually sent.
        const match = /([a-z0-9-]+) \| page \d+ \|/i.exec(text);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            choices: [{ message: { content: stubPayload(match?.[1] ?? 'p1-text-0') } }],
            usage: { prompt_tokens: 900, completion_tokens: 120 },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => stub!.listen(STUB_PORT, '127.0.0.1', resolve));
  };

  let context: TestContext | null = null;
  let worker: ChildProcess | null = null;
  let clinicId: string | null = null;

  try {
    await startStub();
    console.log(`Model stub listening on http://127.0.0.1:${STUB_PORT} (not a model)`);

    context = await createTestContext();
    const fixture = await createFixture(context, 'built-worker-verification');
    clinicId = fixture.clinicId;
    // A scanned page: the machine-readable text layer is empty, so OCR is the only way to
    // read it. This is the case that silently produced zero facts.
    const scan = readFileSync(
      join(appRoot, 'fixtures', 'synthetic', 'eval-corpus', 'eval-11_E3010.pdf'),
    );
    const staged = await stageFixtureUpload(context, fixture, {
      bytes: scan,
      filename: 'built-worker-scan.pdf',
      contentType: 'application/pdf',
      queueJob: true,
    });
    console.log(`Staged scanned upload ${staged.documentId}`);

    // The worker leases the job itself, so the harness must not hold it.
    const builtWorker = join(appRoot, 'apps', 'worker', 'dist', 'worker.mjs');
    worker = spawn(process.execPath, [builtWorker], {
      cwd: appRoot,
      env: {
        ...process.env,
        APP_ENV: 'development',
        DATABASE_URL_WORKER: env.DATABASE_URL_WORKER,
        STORAGE_MODE: 'local',
        STORAGE_LOCAL_ROOT: env.STORAGE_LOCAL_ROOT,
        STORAGE_LOCAL_SECRET: env.STORAGE_LOCAL_SECRET,
        TMP_ROOT: env.TMP_ROOT,
        WORKER_CONCURRENCY: '1',
        OCR_ENABLED: 'true',
        EXTRACTION_PROVIDER: 'openai-compatible',
        EXTRACTION_MODE: 'live',
        EXTRACTION_MODEL: 'stub-model-v1',
        EXTRACTION_BASE_URL: `http://127.0.0.1:${STUB_PORT}/v1`,
        EXTRACTION_API_KEY: 'stub-key-not-a-credential',
        MAX_DOCUMENT_COST_USD: '0.5',
        MAX_RUN_TOKENS: '2000000',
        MAX_DOCUMENT_USD_PER_MTOK_INPUT: '1',
        MAX_DOCUMENT_USD_PER_MTOK_OUTPUT: '2',
      },
    });

    let workerLog = '';
    worker.stdout?.on('data', (chunk: Buffer) => {
      workerLog += chunk.toString('utf8');
    });
    worker.stderr?.on('data', (chunk: Buffer) => {
      workerLog += chunk.toString('utf8');
    });

    const deadline = Date.now() + 180_000;
    let state = (await jobState(context, staged.jobId)).state;
    while (Date.now() < deadline && state !== 'succeeded' && state !== 'failed') {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      state = (await jobState(context, staged.jobId)).state;
    }

    const failures: string[] = [];
    const startup = workerLog.split('\n').find((line) => line.includes('worker started')) ?? '';
    console.log(`Worker startup line: ${startup.trim() || '(none)'}`);
    if (!startup.includes('openai-compatible')) {
      failures.push('the built worker did not start with the live provider configured');
    }
    if (captured.length === 0) {
      failures.push('the built worker never called the model endpoint');
    }
    const first = captured[0];
    if (first) {
      if (first.authorization !== 'Bearer stub-key-not-a-credential') {
        failures.push('the request did not carry the configured bearer token');
      }
      const text = JSON.stringify(first.body.messages ?? []);
      if (!text.includes('Glucoflow laboratory and clinical document extraction')) {
        failures.push('the request did not contain the extraction prompt');
      }
      if (!text.includes('EVIDENCE LINES')) {
        failures.push('the request did not contain the evidence ids the prompt requires');
      }
      if (!text.includes('image_url')) {
        failures.push('the request carried no page image, so the model is text-only');
      }
    }
    if (state !== 'succeeded') failures.push(`the job ended as ${state}, not succeeded`);

    const facts = await context.owner((client) =>
      client.query<{ count: string }>(
        'select count(*)::text as count from sutra.draft_facts where document_id = $1',
        [staged.documentId],
      ),
    );
    const factCount = Number(facts.rows[0]?.count ?? '0');
    console.log(`Job ${state}; model requests ${captured.length}; draft facts ${factCount}`);
    if (factCount === 0) failures.push('the scanned upload produced no facts through the worker');

    const report = [
      'Built-worker verification against a local model stub',
      `Run: ${new Date().toISOString()}`,
      `Job state: ${state}`,
      `Model requests captured: ${captured.length}`,
      `Draft facts written: ${factCount}`,
      `Startup line: ${startup.trim()}`,
      '',
      failures.length === 0
        ? 'All wiring checks passed: prompt, evidence ids, bearer token and page image all reached the model endpoint.'
        : `FAILED:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`,
      '',
    ].join('\n');
    console.log(report);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(appRoot, 'reports', 'raw', 'built-worker-verification.txt'), report);
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    worker?.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    worker?.kill('SIGKILL');
    if (stub) await new Promise<void>((resolve) => stub!.close(() => resolve()));
    if (context && clinicId) await removeClinic(context, clinicId);
    if (context) await context.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

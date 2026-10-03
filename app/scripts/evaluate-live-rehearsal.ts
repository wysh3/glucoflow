/**
 * Live-evaluation rehearsal against a protocol stub.
 *
 *   pnpm evaluate:live-rehearsal
 *
 * The evaluation harness for a live model is complete, but it cannot be run for real
 * without credentials and a spending limit. This script starts a local server that speaks
 * the same OpenAI-compatible chat completions protocol, points the *unmodified* evaluation
 * path at it, and reports what the harness measures: complete-field accuracy, processing
 * time, provider calls and reserved cost per document.
 *
 * The stub returns a fixed, deliberately imperfect answer. Its numbers are a rehearsal of
 * the harness, **not** a measurement of any model, and the report it writes says so.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { appRoot } from './lib/env';

const PORT = 8791;

/**
 * A fixed answer with one right fact and one wrong one, so the harness has something
 * imperfect to measure. It is not derived from the document.
 */
const STUB_FACTS = [
  {
    kind: 'observation',
    rawLabel: 'HbA1c',
    rawValue: '7.6',
    rawUnit: '%',
    eventDate: '2026-08-12',
    dateRaw: '12 Aug 2026',
    dateKind: 'collection',
    datePrecision: 'day',
    normalized: {
      testCode: 'hba1c',
      numericValue: 7.6,
      unitCode: '%',
      rawNumericText: '7.6',
      referenceRangeText: '4.0-5.6',
      plotEligible: true,
      groupId: null,
    },
    evidenceIds: ['p1-ocr-1'],
    groupId: null,
  },
  {
    kind: 'observation',
    rawLabel: 'Glucose, fasting',
    rawValue: '132',
    rawUnit: 'mg/dL',
    // Deliberately one day out, so the harness has a date error to count.
    eventDate: '2026-08-13',
    dateRaw: '12 Aug 2026',
    dateKind: 'collection',
    datePrecision: 'day',
    normalized: {
      testCode: 'glucose_fasting',
      numericValue: 132,
      unitCode: 'mg/dl',
      rawNumericText: '132',
      referenceRangeText: '70-100',
      plotEligible: true,
      groupId: null,
    },
    evidenceIds: ['p1-ocr-1'],
    groupId: null,
  },
];

const STUB_PAYLOAD = {
  documentIdentity: { nameRaw: 'Asha Rao', identifierRaw: 'P0482' },
  facts: STUB_FACTS,
  newEvidence: [],
  unhandledPages: [],
  // Usage is part of the provider contract; the ledger prices the call from it.
  usage: { inputTokens: 1450, outputTokens: 260, latencyMs: 0 },
};

async function main(): Promise<void> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      // Only the documented request shape is accepted; anything else is a harness fault.
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
        model?: string;
        response_format?: unknown;
        messages?: unknown[];
      };
      const text = JSON.stringify(body.messages ?? []);
      const images = (text.match(/image_url/g) ?? []).length;
      console.log(
        `  request: ${request.method} ${request.url} · ${Buffer.concat(chunks).length} bytes · messages ${body.messages?.length ?? 0} · auth ${request.headers.authorization ? 'yes' : 'no'} · page images ${images} · evidence block ${text.includes('EVIDENCE LINES') ? 'yes' : 'no'}`,
      );
      if (!request.headers.authorization?.startsWith('Bearer ')) {
        response.writeHead(401, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'missing bearer token' } }));
        return;
      }
      if (body.response_format === undefined) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'response_format is required' } }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          id: 'stub-completion',
          model: body.model ?? 'stub-model',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify(STUB_PAYLOAD),
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 1450, completion_tokens: 260, total_tokens: 1710 },
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Protocol stub listening on http://127.0.0.1:${PORT} (not a model)`);

  try {
    // Spawned rather than run synchronously: the stub runs in this process, and a
    // blocking call would stop the event loop from ever answering the child.
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        'pnpm',
        [
          'exec',
          'tsx',
          'scripts/evaluate-extraction.ts',
          '--live',
          '--corpus',
          'eval-corpus-external',
          '--label',
          'protocol-stub',
          ...(process.argv.includes('--limit') ? ['--limit', '1'] : []),
        ],
        {
          cwd: appRoot,
          env: {
          ...process.env,
          EXTRACTION_PROVIDER: 'openai-compatible',
          EXTRACTION_MODE: 'live',
          EXTRACTION_MODEL: 'stub-model-v1',
          EXTRACTION_BASE_URL: `http://127.0.0.1:${PORT}/v1`,
          EXTRACTION_API_KEY: 'stub-key-not-a-credential',
          EXTRACTION_MAX_CALLS: '200',
          MAX_RUN_TOKENS: '2000000',
          MAX_DOCUMENT_COST_USD: '0.5',
          MAX_RUN_COST_USD: '5',
            MAX_DOCUMENT_USD_PER_MTOK_INPUT: '1',
            MAX_DOCUMENT_USD_PER_MTOK_OUTPUT: '2',
          },
        },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(Object.assign(new Error(stderr.trim() || `exit code ${code}`), { stdout, stderr }));
      });
    });
    console.log(output.split('\n').slice(-14).join('\n'));
    console.log(
      '\nThese numbers come from a fixed stub answer, not from a model. They show that the live path measures complete-field accuracy, time and cost; they are not an accuracy claim.',
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((error: unknown) => {
  const failure = error as { message?: string; stdout?: string; stderr?: string };
  console.error(failure.message ?? error);
  if (failure.stdout) console.error(failure.stdout.split('\n').slice(-20).join('\n'));
  if (failure.stderr) console.error(failure.stderr.split('\n').slice(-20).join('\n'));
  process.exitCode = 1;
});

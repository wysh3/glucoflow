import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createExtractionProvider,
  ProviderRequestError,
  runExtractionPipeline,
  type ProviderBudget,
} from '@sutra/extraction';
import { appRoot } from '../../scripts/lib/env';

/**
 * Live extraction adapter, verified against a local protocol stub.
 *
 * This suite does **not** call a real model and makes no accuracy claim about one. It
 * stands up an HTTP server that speaks the same OpenAI-compatible chat completions
 * protocol and checks the adapter's own behaviour: the request it sends, how it reads a
 * valid response, how it repairs a response that does not match the schema, how it maps
 * provider errors, and that it never falls back to fixture output.
 *
 * A real-model evaluation still requires credentials and a positive budget, and is
 * reported separately (`pnpm evaluate:extraction -- --live`).
 */

type StubBehaviour =
  | { kind: 'valid' }
  | { kind: 'schema_error_then_valid' }
  | { kind: 'always_schema_error' }
  | { kind: 'status'; status: number }
  | { kind: 'invalid_json' }
  | { kind: 'hang' };

let server: Server;
let baseUrl = '';
let behaviour: StubBehaviour = { kind: 'valid' };
let requests: { body: Record<string, unknown>; authorization: string | null }[] = [];

const validPayload = {
  documentIdentity: { nameRaw: 'Asha Rao', identifierRaw: 'P0482' },
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
        plotEligible: true,
        groupId: null,
      },
      evidenceIds: ['p1-ocr-1'],
      groupId: null,
    },
  ],
  newEvidence: [],
  unhandledPages: [],
  usage: { inputTokens: 120, outputTokens: 40, latencyMs: 0 },
};

function budget(overrides: Partial<ProviderBudget> = {}): ProviderBudget {
  return {
    maxCalls: 4,
    callsUsed: 0,
    maxCostUsd: 1,
    reservedCostUsd: 0,
    maxTokens: 100_000,
    tokensUsed: 0,
    reserve: async () => ({ allowed: true, ordinal: 1 }),
    reconcile: async () => undefined,
    ...overrides,
  } as ProviderBudget;
}

function providerConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    baseUrl,
    apiKey: 'stub-key-not-a-credential',
    model: 'stub-model-v1',
    maxCalls: 4,
    usdPerMillionInputTokens: 1,
    usdPerMillionOutputTokens: 2,
    maxRunTokens: 100_000,
    maxDocumentCostUsd: 1,
    requestTimeoutMs: 5_000,
    pagesPerRequest: 2,
    ...overrides,
  };
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      } catch {
        body = {};
      }
      requests.push({ body, authorization: request.headers.authorization ?? null });

      const reply = (status: number, payload: unknown): void => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(payload));
      };

      switch (behaviour.kind) {
        case 'status':
          reply(behaviour.status, { error: { message: 'stub failure' } });
          return;
        case 'invalid_json':
          reply(200, { choices: [{ message: { content: 'not json at all' } }], usage: {} });
          return;
        case 'hang':
          // Never answers: the adapter's own timeout must fire.
          return;
        case 'always_schema_error':
          reply(200, {
            choices: [{ message: { content: JSON.stringify({ facts: 'not-an-array' }) } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          });
          return;
        case 'schema_error_then_valid':
          if (requests.length === 1) {
            reply(200, {
              choices: [{ message: { content: JSON.stringify({ facts: 'not-an-array' }) } }],
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            });
            return;
          }
          reply(200, {
            choices: [{ message: { content: JSON.stringify(validPayload) } }],
            usage: { prompt_tokens: 120, completion_tokens: 40 },
          });
          return;
        case 'valid':
        default:
          reply(200, {
            choices: [{ message: { content: JSON.stringify(validPayload) } }],
            usage: { prompt_tokens: 120, completion_tokens: 40 },
          });
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('stub server did not bind');
  baseUrl = `http://127.0.0.1:${address.port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function reset(next: StubBehaviour): void {
  behaviour = next;
  requests = [];
}

async function runPipeline(provider: ReturnType<typeof createExtractionProvider>): Promise<Awaited<ReturnType<typeof runExtractionPipeline>>> {
  const bytes = readFileSync(join(appRoot, 'fixtures', 'synthetic', 'sources', '2026-09-14_lab_report.pdf'));
  return runExtractionPipeline(
    provider,
    {
      bytes,
      filename: '2026-09-14_lab_report.pdf',
      contentType: 'application/pdf',
      documentVersionId: '00000000-0000-4000-8000-000000000001',
      patientIdentifier: 'P0482',
      patientName: 'Asha Rao',
      existingObservations: [],
      enableOcr: false,
      maxPages: 10,
      workDir: join(appRoot, '.local', 'tmp', 'live-stub'),
    },
    new AbortController().signal,
  );
}

describe('live provider adapter (protocol stub, not a real model)', () => {
  it('refuses to extract when credentials or a positive budget are missing', async () => {
    // An empty credential or budget value yields an unavailable provider, and any attempt
    // to use it fails with an auth error. Fixture output is never substituted.
    for (const incomplete of [{ apiKey: '' }, { baseUrl: '' }, { maxDocumentCostUsd: undefined }]) {
      const provider = createExtractionProvider({ ...providerConfig(), ...incomplete } as never, budget());
      expect(provider.name).toBe('unavailable');
      const error = await runPipeline(provider).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ProviderRequestError);
      expect((error as ProviderRequestError).detail.category).toBe('auth');
    }

    // A zero budget is refused outright rather than starting a run that cannot be paid for.
    expect(() =>
      createExtractionProvider({ ...providerConfig(), maxDocumentCostUsd: 0 } as never, budget()),
    ).toThrow(/MAX_DOCUMENT_COST_USD/);
    expect(() =>
      createExtractionProvider({ ...providerConfig(), maxRunTokens: 0 } as never, budget()),
    ).toThrow(/MAX_RUN_TOKENS/);

    // Nothing was dispatched to the stub for any of them.
    expect(requests).toHaveLength(0);
  });

  it('sends the documented request and reads a valid response into proposals', async () => {
    reset({ kind: 'valid' });
    const provider = createExtractionProvider(providerConfig() as never, budget());
    const result = await runPipeline(provider);

    expect(requests).toHaveLength(1);
    const body = requests[0]!.body;
    expect(body.model).toBe('stub-model-v1');
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: 'json_object' });

    // The prompt requires every fact to cite a worker-supplied evidence id, so the ids
    // must actually be in the request.
    const text = JSON.stringify(body.messages);
    expect(text).toContain('EVIDENCE LINES');
    expect(text).toContain('p1-text-1');
    const messages = body.messages as { role: string; content: unknown }[];
    expect(messages[0]!.role).toBe('system');
    expect(messages[1]!.role).toBe('user');
    expect(requests[0]!.authorization).toBe('Bearer stub-key-not-a-credential');

    // The proposal is carried through validation, not taken on trust.
    expect(result.provider.mode).toBe('live');
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.facts[0]!.input.rawLabel).toBe('HbA1c');
    expect(result.identityState).toBe('matched');
  });

  it('repairs a response that does not match the schema and reserves a call for it', async () => {
    reset({ kind: 'schema_error_then_valid' });
    let reserved = 0;
    const provider = createExtractionProvider(
      providerConfig() as never,
      budget({
        reserve: async () => {
          reserved += 1;
          return { allowed: true, ordinal: reserved };
        },
      }),
    );
    const result = await runPipeline(provider);

    // Two dispatches: the malformed answer and the repair.
    expect(requests).toHaveLength(2);
    expect(reserved).toBe(2);
    const second = JSON.stringify(requests[1]!.body);
    expect(second).toContain('Correction needed');
    expect(result.facts.length).toBeGreaterThan(0);
  });

  it('fails rather than falling back to fixture output when the schema cannot be satisfied', async () => {
    reset({ kind: 'always_schema_error' });
    const provider = createExtractionProvider(providerConfig() as never, budget());
    await expect(runPipeline(provider)).rejects.toThrow(/structure|schema|read/i);
    // Two dispatches, and no fixture proposal was produced.
    expect(requests).toHaveLength(2);
  });

  it('maps a rate limit to a retryable error and a client error to a permanent one', async () => {
    reset({ kind: 'status', status: 429 });
    const rateLimited = createExtractionProvider(providerConfig() as never, budget());
    const rateLimitError = await runPipeline(rateLimited).catch((error: unknown) => error);
    expect(rateLimitError).toBeInstanceOf(ProviderRequestError);
    expect((rateLimitError as ProviderRequestError).detail.category).toBe('rate_limit');
    expect((rateLimitError as ProviderRequestError).detail.retryable).toBe(true);

    reset({ kind: 'status', status: 400 });
    const badRequest = createExtractionProvider(providerConfig() as never, budget());
    const badRequestError = await runPipeline(badRequest).catch((error: unknown) => error);
    expect(badRequestError).toBeInstanceOf(ProviderRequestError);
    expect((badRequestError as ProviderRequestError).detail.retryable).toBe(false);
    // A permanent failure is dispatched once.
    expect(requests).toHaveLength(1);
  });

  it('refuses to dispatch when the run budget is exhausted', async () => {
    reset({ kind: 'valid' });
    const provider = createExtractionProvider(
      providerConfig() as never,
      budget({ reserve: async () => ({ allowed: false, ordinal: null, reason: 'call_limit' }) }),
    );
    const error = await runPipeline(provider).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProviderRequestError);
    expect((error as ProviderRequestError).detail.category).toBe('budget');
    // Nothing was sent: the ledger refused before dispatch.
    expect(requests).toHaveLength(0);
  });

  it('reports unreadable model output instead of inventing facts', async () => {
    reset({ kind: 'invalid_json' });
    const provider = createExtractionProvider(providerConfig() as never, budget());
    const error = await runPipeline(provider).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProviderRequestError);
    expect((error as ProviderRequestError).detail.category).toBe('invalid_response');
  });

  it('gives up on a provider that never answers', async () => {
    reset({ kind: 'hang' });
    const provider = createExtractionProvider(
      providerConfig({ requestTimeoutMs: 700 }) as never,
      budget(),
    );
    const error = await runPipeline(provider).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProviderRequestError);
    expect((error as ProviderRequestError).detail.retryable).toBe(true);
  }, 30_000);
});

import { createHash } from 'node:crypto';
import type { DraftFactInput, ExtractionResult } from '@glucoflow/contracts';
import {
  ProviderRequestError,
  type ExtractionInput,
  type ExtractionProvider,
  type ProviderExtraction,
} from '../types';
import { RulesFixtureProvider } from './rules';

/**
 * Fixture adapter registry entry. The fixture adapter is a deterministic rule
 * engine that reads prepared page text. It reports mode = 'fixture' so every
 * interface that shows its output can say so, and it never stands in for a live
 * model call that failed.
 */
export class FixtureProvider implements ExtractionProvider {
  readonly name = 'fixture';
  readonly model: string;
  readonly mode = 'fixture' as const;
  readonly promptHash: string;
  private readonly inner: RulesFixtureProvider;

  constructor(model = 'deterministic-rules-v1', ocrTolerance = true) {
    this.inner = new RulesFixtureProvider(ocrTolerance);
    this.model = model;
    this.promptHash = createHash('sha256')
      .update(`fixture-rules-v1::${model}`)
      .digest('hex')
      .slice(0, 32);
  }

  extract(input: ExtractionInput, signal: AbortSignal): Promise<ProviderExtraction> {
    return this.inner.extract(input, signal);
  }
}

/** A provider that fails loudly instead of silently substituting fixture output. */
export class UnavailableProvider implements ExtractionProvider {
  readonly name = 'unavailable';
  readonly model = 'none';
  readonly mode = 'live' as const;
  readonly promptHash = 'none';

  async extract(_input: ExtractionInput, _signal: AbortSignal): Promise<ProviderExtraction> {
    throw new ProviderRequestError({
      category: 'auth',
      retryable: false,
      message:
        'Live extraction is not configured. Set EXTRACTION_PROVIDER, EXTRACTION_API_KEY, EXTRACTION_BASE_URL and the budget limits to enable it.',
    });
  }
}

export type { DraftFactInput, ExtractionResult };
export { RulesFixtureProvider };

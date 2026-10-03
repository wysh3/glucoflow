import type { ExtractionResult, EvidenceOrigin } from '@sutra/contracts';

/**
 * Extraction provider boundary.
 * Source: docs/mvp/04-extraction-engine.md "Provider interface".
 *
 * The provider proposes facts; it has no authority over approval, permissions or
 * clinical interpretation, and it never receives an authorized clinic or patient ID.
 */

export type EvidenceSpan = {
  id: string;
  documentVersionId: string;
  page: number;
  quote: string;
  bbox?: [number, number, number, number] | null;
  origin: EvidenceOrigin;
};

export type ExtractionInput = {
  documentVersionId: string;
  pages: { page: number; text: string; evidence: EvidenceSpan[]; imagePath?: string }[];
  schemaVersion: '1';
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /** Provider calls actually dispatched for this result. */
  calls: number;
};

export type ProviderExtraction = ExtractionResult & { usage: ProviderUsage };

export interface ExtractionProvider {
  readonly name: string;
  readonly model: string;
  readonly mode: 'fixture' | 'live';
  readonly promptHash: string;
  extract(input: ExtractionInput, signal: AbortSignal): Promise<ProviderExtraction>;
}

export type ProviderBudget = {
  /** Reserves the next call in the run ledger before dispatch. */
  reserve(): Promise<{ allowed: boolean; ordinal: number | null; reason?: string }>;
  reconcile(
    ordinal: number,
    usage: { costUsd: number; tokens: number; state: 'succeeded' | 'failed' },
  ): Promise<void>;
};

export type ProviderError = {
  category: 'timeout' | 'rate_limit' | 'server' | 'invalid_response' | 'budget' | 'auth' | 'unknown';
  retryable: boolean;
  message: string;
  retryAfterSeconds?: number;
};

export class ProviderRequestError extends Error {
  constructor(readonly detail: ProviderError) {
    super(detail.message);
    this.name = 'ProviderRequestError';
  }
}

import { FixtureProvider, UnavailableProvider } from './fixture';
import { LiveExtractionProvider, type LiveProviderConfig } from './openai-compatible';
import type { ExtractionProvider, ProviderBudget } from '../types';

export type ProviderSelection = {
  provider: 'fixture' | 'openai-compatible';
  model: string;
  baseUrl?: string;
  apiKey?: string;
  maxCalls: number;
  maxDocumentCostUsd?: number;
  maxRunTokens?: number;
  usdPerMillionInputTokens?: number;
  usdPerMillionOutputTokens?: number;
  requestTimeoutMs?: number;
  /** Set false to disable the OCR-tolerant matching pass (measurement and ablation). */
  ocrTolerance?: boolean;
};

/**
 * Provider selection. `fixture` is the deterministic rule engine used for local
 * development and the labelled demo. `openai-compatible` requires real credentials
 * and positive budget limits; when they are missing the worker refuses to process
 * instead of substituting fixture output.
 */
export function createExtractionProvider(
  selection: ProviderSelection,
  budget: ProviderBudget,
): ExtractionProvider {
  if (selection.provider === 'fixture') {
    return new FixtureProvider(selection.model, selection.ocrTolerance ?? true);
  }
  const required = {
    apiKey: selection.apiKey,
    baseUrl: selection.baseUrl,
    maxDocumentCostUsd: selection.maxDocumentCostUsd,
    maxRunTokens: selection.maxRunTokens,
    usdPerMillionInputTokens: selection.usdPerMillionInputTokens,
    usdPerMillionOutputTokens: selection.usdPerMillionOutputTokens,
  };
  if (Object.values(required).some((value) => value === undefined || value === null || value === '')) {
    return new UnavailableProvider();
  }
  const config: LiveProviderConfig = {
    baseUrl: selection.baseUrl!,
    apiKey: selection.apiKey!,
    model: selection.model,
    maxCalls: selection.maxCalls,
    maxDocumentCostUsd: selection.maxDocumentCostUsd!,
    maxRunTokens: selection.maxRunTokens!,
    usdPerMillionInputTokens: selection.usdPerMillionInputTokens!,
    usdPerMillionOutputTokens: selection.usdPerMillionOutputTokens!,
    requestTimeoutMs: selection.requestTimeoutMs ?? 60_000,
    pagesPerRequest: 2,
  };
  return new LiveExtractionProvider(config, budget);
}

export { FixtureProvider, UnavailableProvider, LiveExtractionProvider };
export type { ExtractionProvider, ProviderBudget, LiveProviderConfig };

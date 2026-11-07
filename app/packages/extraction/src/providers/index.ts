import { FixtureProvider, UnavailableProvider } from './fixture';
import { LiveExtractionProvider, type LiveProviderConfig } from './openai-compatible';
import type { ExtractionProvider, ProviderBudget } from '../types';

export type ProviderSelection = {
  provider: 'fixture' | 'openai-compatible' | 'hermes';
  model: string;
  baseUrl?: string;
  apiKey?: string;
  hermesUrl?: string;
  hermesServiceToken?: string;
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
 * development and the labelled demo. Live transports require credentials and
 * positive budget limits and fail explicitly if they are unavailable.
 */
export function createExtractionProvider(
  selection: ProviderSelection,
  budget: ProviderBudget,
): ExtractionProvider {
  if (selection.provider === 'fixture') {
    return new FixtureProvider(selection.model, selection.ocrTolerance ?? true);
  }
  const useHermes = selection.provider === 'hermes';
  const apiKey = useHermes ? selection.hermesServiceToken : selection.apiKey;
  const baseUrl = useHermes ? selection.hermesUrl : selection.baseUrl;
  const required = {
    apiKey,
    baseUrl,
    maxDocumentCostUsd: selection.maxDocumentCostUsd,
    maxRunTokens: selection.maxRunTokens,
    usdPerMillionInputTokens: selection.usdPerMillionInputTokens,
    usdPerMillionOutputTokens: selection.usdPerMillionOutputTokens,
  };
  if (Object.values(required).some((value) => value === undefined || value === null || value === '')) {
    return new UnavailableProvider(useHermes ? 'Hermes extraction requires HERMES_URL, HERMES_SERVICE_TOKEN and positive budget limits.' : undefined);
  }
  const config: LiveProviderConfig = {
    baseUrl: baseUrl!,
    apiKey: apiKey!,
    transport: useHermes ? 'hermes' : 'openai-compatible',
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
export { HERMES_EXTRACTION_RUNTIME_VERSION, parseHermesServiceOrigin } from './openai-compatible';
export type { ExtractionProvider, ProviderBudget, LiveProviderConfig };

import { readChatStream, type ChatProgressStage } from './chat-progress';
/**
 * Patient and public API client.
 *
 * Every request carries the bearer token issued by the configured identity
 * provider. The active patient or clinic is reauthorized by the server on every
 * call; the client never sends a tenant claim that the server trusts.
 */

export type ApiErrorPayload = {
  error: { code: string; message: string; requestId: string; fields?: Record<string, string> };
};

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isStale(): boolean {
    return this.code === 'stale_revision';
  }

  get isOffline(): boolean {
    return this.code === 'network_unavailable';
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | string[] | number | undefined | null>;
  idempotencyKey?: string;
  rawBody?: NonNullable<RequestInit['body']>;
  rawContentType?: string;
  signal?: AbortSignal;
  expect?: 'json' | 'void';
  timeoutMs?: number;
  onProgress?: (stage: ChatProgressStage) => void;
};

export type ApiClient = {
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
  baseUrl: string;
};

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export function createApiClient(options: {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
}): ApiClient {
  const request = async <T>(path: string, requestOptions: RequestOptions = {}): Promise<T> => {
    const token = options.getToken();
    const headers: Record<string, string> = { accept: requestOptions.onProgress ? 'application/x-ndjson' : 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (requestOptions.idempotencyKey) headers['Idempotency-Key'] = requestOptions.idempotencyKey;
    let body: NonNullable<RequestInit['body']> | undefined;
    if (requestOptions.rawBody) {
      body = requestOptions.rawBody;
      if (requestOptions.rawContentType) headers['content-type'] = requestOptions.rawContentType;
    } else if (requestOptions.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(requestOptions.body);
    }

    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(requestOptions.signal?.reason);
    if (requestOptions.signal?.aborted) abort();
    else requestOptions.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, requestOptions.timeoutMs ?? 30_000);
    let rejectAborted: () => void = () => {};
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAborted = () => reject(controller.signal.reason ?? new Error('Request aborted'));
      if (controller.signal.aborted) rejectAborted();
      else controller.signal.addEventListener('abort', rejectAborted, { once: true });
    });
    try {
    // Release UI state even if a browser transport does not settle promptly on abort.
    // The underlying fetch still receives the signal; late results cannot be adopted.
    const response = await Promise.race([aborted, fetch(buildUrl(options.baseUrl, path, requestOptions.query), {
        method: requestOptions.method ?? 'GET',
        headers,
        ...(body !== undefined ? { body } : {}),
        signal: controller.signal,
      })]);
    if (response.status === 204 || requestOptions.expect === 'void') {
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
        throw toError(response.status, payload);
      }
      return undefined as T;
    }

    if (response.ok && requestOptions.onProgress && response.headers.get('content-type')?.includes('application/x-ndjson')) {
      return await readChatStream<T>(response, aborted, requestOptions.onProgress);
    }
    const text = await Promise.race([aborted, response.text()]);
    if (requestOptions.signal?.aborted) throw new ApiRequestError(0, 'request_cancelled', 'Request cancelled.', null);
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch {
      throw new ApiRequestError(response.status, 'request_failed', 'The service returned an unreadable response. Try again.', null);
    }
    if (!response.ok) {
      const error = toError(response.status, payload as ApiErrorPayload | null);
      if (error.isUnauthorized) options.onUnauthorized?.();
      throw error;
    }
    return payload as T;
    } catch (error) {
      if (error instanceof ApiRequestError) throw error;
      if (timedOut) throw new ApiRequestError(0, 'request_timeout', 'The service took too long to respond. Refresh the view before retrying an action.', null);
      if (requestOptions.signal?.aborted) throw new ApiRequestError(0, 'request_cancelled', 'Request cancelled.', null);
      throw new ApiRequestError(0, 'network_unavailable', 'The service could not be reached. Check your connection and try again.', null);
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', rejectAborted);
      requestOptions.signal?.removeEventListener('abort', abort);
    }
  };

  return { request, baseUrl: options.baseUrl };
}

function toError(status: number, payload: ApiErrorPayload | null): ApiRequestError {
  const error = payload?.error;
  return new ApiRequestError(
    status,
    error?.code ?? 'request_failed',
    error?.message ?? 'The request could not be completed.',
    error?.requestId ?? null,
    error?.fields,
  );
}

export function randomIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `key-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export type PublicConfig = {
  appEnv: string;
  authMode: 'local' | 'supabase';
  supabaseUrl: string | null;
  storageMode: 'local' | 'supabase';
  demoLabel: string;
  extraction: { mode: 'fixture' | 'live'; provider: string; model: string; label: string };
  limits: { uploadMaxBytes: number; uploadMaxPages: number; photoBatchMax: number };
  serverTime: string;
};

export async function fetchPublicConfig(baseUrl: string): Promise<PublicConfig> {
  return createApiClient({ baseUrl, getToken: () => null }).request<PublicConfig>('/api/v1/config', { timeoutMs: 10_000 });
}

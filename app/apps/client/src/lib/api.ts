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
    return this.status === 0;
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | string[] | number | undefined | null>;
  idempotencyKey?: string;
  rawBody?: BodyInit;
  rawContentType?: string;
  signal?: AbortSignal;
  expect?: 'json' | 'void';
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
    const headers: Record<string, string> = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (requestOptions.idempotencyKey) headers['Idempotency-Key'] = requestOptions.idempotencyKey;
    let body: BodyInit | undefined;
    if (requestOptions.rawBody) {
      body = requestOptions.rawBody;
      if (requestOptions.rawContentType) headers['content-type'] = requestOptions.rawContentType;
    } else if (requestOptions.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(requestOptions.body);
    }

    let response: Response;
    try {
      response = await fetch(buildUrl(options.baseUrl, path, requestOptions.query), {
        method: requestOptions.method ?? 'GET',
        headers,
        ...(body !== undefined ? { body } : {}),
        ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
      });
    } catch (error) {
      // A transport failure is reported as an offline condition, not a server error.
      throw new ApiRequestError(
        0,
        'network_unavailable',
        'You are offline. Reconnect to continue.',
        null,
      );
    }

    if (response.status === 204 || requestOptions.expect === 'void') {
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
        throw toError(response.status, payload);
      }
      return undefined as T;
    }

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : null;
    if (!response.ok) {
      const error = toError(response.status, payload as ApiErrorPayload | null);
      if (error.isUnauthorized) options.onUnauthorized?.();
      throw error;
    }
    return payload as T;
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
  const response = await fetch(`${baseUrl}/api/v1/config`);
  if (!response.ok) throw new Error('The service configuration could not be read.');
  return (await response.json()) as PublicConfig;
}

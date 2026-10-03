import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MeResponse } from '@sutra/contracts';
import {
  ApiRequestError,
  createApiClient,
  fetchPublicConfig,
  type ApiClient,
  type PublicConfig,
} from '../lib/api';
import { createSessionStorage, type SessionStorage } from '../platform/session-storage';

/**
 * Session state.
 *
 * Two providers are supported. In the local development mode the API issues a
 * signed token after checking a generated credential. In the hosted mode Supabase
 * Auth issues the access token and the API verifies it against the project JWKS.
 * Signing out clears the token, the in-memory session and every cached record.
 */

const TOKEN_KEY = 'sutra.access-token';

export type SessionStatus = 'loading' | 'signed-out' | 'signed-in' | 'unavailable';

export type SessionContextValue = {
  status: SessionStatus;
  me: MeResponse | null;
  config: PublicConfig | null;
  api: ApiClient;
  storageMode: SessionStorage['mode'];
  storageDescription: string;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

export function useApi(): ApiClient {
  return useSession().api;
}

export function SessionProvider({
  children,
  apiBaseUrl,
}: {
  children: React.ReactNode;
  apiBaseUrl: string;
}): React.ReactElement {
  const queryClient = useQueryClient();
  const [token, setToken] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [config, setConfig] = React.useState<PublicConfig | null>(null);
  const [status, setStatus] = React.useState<SessionStatus>('loading');
  // The token is held in a ref as well as in state: the API client reads it when a
  // request starts, so a request issued immediately after sign-in already carries it.
  const tokenRef = React.useRef<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const storageRef = React.useRef<SessionStorage | null>(null);
  const [storageDescription, setStorageDescription] = React.useState('');

  const clearSession = React.useCallback(() => {
    tokenRef.current = null;
    setToken(null);
    setMe(null);
    setStatus('signed-out');
    // Logout clears cached records so nothing remains on screen.
    queryClient.clear();
  }, [queryClient]);

  const api = React.useMemo(
    () =>
      createApiClient({
        baseUrl: apiBaseUrl,
        getToken: () => tokenRef.current,
        onUnauthorized: () => clearSession(),
      }),
    [apiBaseUrl, clearSession],
  );
  const apiRef = React.useRef(api);
  apiRef.current = api;

  const loadMe = React.useCallback(async (): Promise<void> => {
    const response = await apiRef.current.request<MeResponse>('/api/v1/me');
    setMe(response);
    setStatus('signed-in');
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const storage = await createSessionStorage();
      storageRef.current = storage;
      if (cancelled) return;
      setStorageDescription(storage.describe());
      try {
        const publicConfig = await fetchPublicConfig(apiBaseUrl);
        if (cancelled) return;
        setConfig(publicConfig);
      } catch {
        if (cancelled) return;
        setStatus('unavailable');
        setError('The service is not reachable. Check that the API is running.');
        return;
      }
      const stored = await storage.get(TOKEN_KEY);
      if (cancelled) return;
      if (!stored) {
        setStatus('signed-out');
        return;
      }
      tokenRef.current = stored;
      setToken(stored);
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/me`, {
          headers: { authorization: `Bearer ${stored}` },
        });
        if (cancelled) return;
        if (!response.ok) {
          await storage.remove(TOKEN_KEY);
          setStatus('signed-out');
          return;
        }
        setMe((await response.json()) as MeResponse);
        setStatus('signed-in');
      } catch {
        if (cancelled) return;
        setStatus('unavailable');
        setError('The service is not reachable. Reconnect and sign in again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const signIn = React.useCallback(
    async (email: string, password: string) => {
      setError(null);
      const storage = storageRef.current ?? (await createSessionStorage());
      storageRef.current = storage;

      if (config?.authMode === 'supabase') {
        const supabaseUrl = config.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error('This build has no Supabase project URL configured.');
        }
        const { createClient } = await import('@supabase/supabase-js');
        const client = createClient(supabaseUrl, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '', {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
        if (signInError || !data.session) {
          throw new Error('That email address and password combination was not accepted.');
        }
        tokenRef.current = data.session.access_token;
        setToken(data.session.access_token);
        await storage.set(TOKEN_KEY, data.session.access_token);
        await loadMe();
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/v1/auth/local-sign-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          payload?.error?.message ?? 'That email address and password combination was not accepted.',
        );
      }
      const payload = (await response.json()) as { accessToken: string };
      tokenRef.current = payload.accessToken;
      setToken(payload.accessToken);
      await storage.set(TOKEN_KEY, payload.accessToken);
      await loadMe();
    },
    [apiBaseUrl, config, loadMe],
  );

  const signOut = React.useCallback(async () => {
    const storage = storageRef.current;
    if (storage) await storage.remove(TOKEN_KEY);
    if (config?.authMode === 'supabase') {
      // Sign out only this device session.
      try {
        const supabaseUrl = config.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
        if (supabaseUrl) {
          const { createClient } = await import('@supabase/supabase-js');
          const client = createClient(supabaseUrl, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '', {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await client.auth.signOut({ scope: 'local' });
        }
      } catch {
        // Local state is cleared regardless.
      }
    }
    clearSession();
  }, [clearSession, config]);

  const value = React.useMemo<SessionContextValue>(
    () => ({
      status,
      me,
      config,
      api,
      storageMode: storageRef.current?.mode ?? 'memory-only',
      storageDescription,
      error,
      signIn,
      signOut,
      refreshMe: loadMe,
    }),
    [status, me, config, api, storageDescription, error, signIn, signOut, loadMe],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function describeApiError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.isOffline) return 'You are offline. Reconnect to continue.';
    if (error.isStale) return 'This record changed while you were reviewing it. Reload to continue.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Try again.';
}

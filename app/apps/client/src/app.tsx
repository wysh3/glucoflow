import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@glucoflow/ui';
import { SessionProvider } from './auth/session';
import { AppRoutes } from './routes';

/**
 * Server state lives in TanStack Query. Queries are never mirrored into a global
 * store, and the cache is keyed by actor so a role change or sign-out clears it.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status ?? 0;
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      networkMode: 'always',
    },
  },
});

export function App({ apiBaseUrl }: { apiBaseUrl: string }): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider apiBaseUrl={apiBaseUrl}>
          <AppRoutes />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

import * as React from 'react';
import { EmptyState, ErrorState, Skeleton, Spinner } from '@glucoflow/ui';
import { describeApiError } from '../auth/session';

/** Shared loading, empty, failure and incomplete states. */

export function LoadingBlock({ label = 'Loading' }: { label?: string }): React.ReactElement {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-6 py-8">
      <Spinner label={label} />
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }): React.ReactElement {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRetry,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  if (isLoading) return <LoadingBlock />;
  if (error) {
    return (
      <ErrorState
        title="This could not be loaded"
        description={describeApiError(error)}
        action={
          onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 rounded-[10px] border border-line bg-surface px-4 text-sm text-ink"
            >
              Try again
            </button>
          ) : null
        }
      />
    );
  }
  if (isEmpty) {
    return <EmptyState title={emptyTitle ?? 'Nothing here yet'} description={emptyDescription} action={emptyAction} />;
  }
  return <>{children}</>;
}

/** Honest wording for a screen that cannot recover unsent work. */
export const PROCESS_LOSS_NOTICE =
  'If the operating system stops the app, an unsent photo or form cannot be recovered. Uploads that already reached the server can be resumed after sign-in.';

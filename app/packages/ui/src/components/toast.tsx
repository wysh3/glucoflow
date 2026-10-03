import * as React from 'react';
import { cn } from '../utils';

/**
 * Minimal toast surface. Messages describe what happened; they are never used to
 * simulate progress that has not been observed.
 */

export type Toast = {
  id: string;
  title: string;
  description?: string;
  tone?: 'neutral' | 'success' | 'error' | 'review';
};

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = React.useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2 sm:bottom-6"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto rounded-[12px] border px-4 py-3 text-sm shadow-sm',
              toast.tone === 'error'
                ? 'border-danger/30 bg-danger-bg text-danger'
                : toast.tone === 'success'
                  ? 'border-success/30 bg-success-bg text-success'
                  : toast.tone === 'review'
                    ? 'border-review/30 bg-review-bg text-review'
                    : 'border-line bg-surface text-ink',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{toast.title}</p>
                {toast.description ? <p className="mt-0.5 text-[13px] opacity-90">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded px-1 text-xs opacity-70 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}

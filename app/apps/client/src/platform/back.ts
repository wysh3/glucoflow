import { Capacitor } from '@capacitor/core';

/**
 * Android hardware Back handling.
 *
 * Back closes an open sheet before it leaves the route, and asks before discarding
 * unsent form changes. When the platform plugin is unavailable the browser history
 * is used, so the behaviour stays the same on web.
 */

export type BackGuard = () => 'handled' | 'discard' | 'block';

const guards: BackGuard[] = [];

export function registerBackGuard(guard: BackGuard): () => void {
  guards.push(guard);
  return () => {
    const index = guards.indexOf(guard);
    if (index >= 0) guards.splice(index, 1);
  };
}

function runGuards(): void {
  for (const guard of [...guards].reverse()) {
    const result = guard();
    if (result === 'handled') return;
    if (result === 'discard') {
      guards.length = 0;
      if (typeof window !== 'undefined') window.history.back();
      return;
    }
    if (result === 'block') return;
  }
  if (typeof window !== 'undefined') window.history.back();
}

export async function installBackHandler(): Promise<() => void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { App } = await import('@capacitor/app');
      const listener = await App.addListener('backButton', () => {
        runGuards();
      });
      return () => {
        void listener.remove();
      };
    } catch {
      // Fall through to the history-based handler.
    }
  }
  const handler = (): void => {
    if (guards.length > 0) runGuards();
  };
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}

export function confirmDiscard(message = 'Discard the unsent changes on this screen?'): boolean {
  if (typeof window === 'undefined') return true;
  return window.confirm(message);
}

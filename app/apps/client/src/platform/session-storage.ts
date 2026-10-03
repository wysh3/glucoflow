import { Capacitor } from '@capacitor/core';

/**
 * Session storage for the access token.
 *
 * Web uses the browser storage supported by the identity SDK. Android uses an
 * audited secure-storage adapter backed by the Android Keystore. Refresh tokens are
 * never written to plain Capacitor Preferences. If the adapter is unavailable the
 * session is kept in memory only and sign-in is required after a restart; that
 * limitation is reported on the account screen rather than hidden.
 */

export type SessionStorageMode = 'browser' | 'secure-native' | 'memory-only';

export type SessionStorage = {
  mode: SessionStorageMode;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
  describe: () => string;
};

const memory = new Map<string, string>();

function memoryStorage(reason: string): SessionStorage {
  return {
    mode: 'memory-only',
    get: async (key) => memory.get(key) ?? null,
    set: async (key, value) => {
      memory.set(key, value);
    },
    remove: async (key) => {
      memory.delete(key);
    },
    describe: () => `This device keeps the session in memory only (${reason}). You will sign in again after the app restarts.`,
  };
}

function browserStorage(): SessionStorage {
  return {
    mode: 'browser',
    get: async (key) => window.localStorage.getItem(key),
    set: async (key, value) => {
      window.localStorage.setItem(key, value);
    },
    remove: async (key) => {
      window.localStorage.removeItem(key);
    },
    describe: () => 'The session is stored by this browser for this site only.',
  };
}

export async function createSessionStorage(): Promise<SessionStorage> {
  if (!Capacitor.isNativePlatform()) return browserStorage();
  try {
    const module = await import('@aparajita/capacitor-secure-storage');
    const storage = module.SecureStorage;
    // A round trip confirms the plugin is present before relying on it.
    await storage.set('sutra:probe', 'ok');
    const probe = await storage.get('sutra:probe');
    await storage.remove('sutra:probe');
    if (probe !== 'ok') throw new Error('secure storage probe failed');
    return {
      mode: 'secure-native',
      get: async (key) => {
        const value = await storage.get(key);
        return typeof value === 'string' ? value : null;
      },
      set: async (key, value) => {
        await storage.set(key, value);
      },
      remove: async (key) => {
        await storage.remove(key);
      },
      describe: () =>
        'The session is stored with the Android Keystore-backed secure storage adapter.',
    };
  } catch (error) {
    return memoryStorage(error instanceof Error ? error.message : 'secure storage unavailable');
  }
}

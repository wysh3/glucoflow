import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/src/**/*.test.ts',
      'apps/**/src/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/extraction/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'apps/client/**'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
    // Holds the queue pause lock for the run so a development worker cannot lease the
    // jobs these suites own.
    globalSetup: ['./tests/global-setup.ts'],
    reporters: ['default'],
  },
});

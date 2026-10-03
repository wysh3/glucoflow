import { defineConfig, devices } from '@playwright/test';

/**
 * Browser workflow checks against a real API, worker and database.
 *
 * The three processes are started automatically and reused when they are already
 * running, so `pnpm e2e` works on a machine where `pnpm dev` is open.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  // The dev server transforms route modules on first request, so the first visit to
  // a screen can take longer than a production build.
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'reports/playwright-report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @glucoflow/api exec tsx src/main.ts',
      url: 'http://127.0.0.1:8787/health/live',
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @glucoflow/worker exec tsx src/main.ts',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @glucoflow/client dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});

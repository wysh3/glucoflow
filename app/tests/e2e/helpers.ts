import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { buildSyntheticReport, smokerunDate } from '../../scripts/lib/synthetic-report';

/**
 * Shared helpers for the browser checks.
 *
 * Credentials come from the generated local file (app/.local/demo-credentials.json).
 * They are never committed and never printed by a test.
 */

export type DemoCredentials = {
  patientId: string;
  demoClinicId: string;
  accounts: Record<string, { email: string; password: string; role: string }>;
};

let cached: DemoCredentials | null = null;

export function demoCredentials(): DemoCredentials {
  if (cached) return cached;
  const path = join(process.cwd(), '.local', 'demo-credentials.json');
  try {
    cached = JSON.parse(readFileSync(path, 'utf8')) as DemoCredentials;
  } catch {
    throw new Error(
      `No demo credentials at ${path}. Run "pnpm db:migrate" and "pnpm seed:demo -- --clinic demo --confirm-demo" first.`,
    );
  }
  return cached;
}

export async function signIn(page: Page, account: 'patient' | 'clinic' | 'reviewer' | 'clinician'): Promise<void> {
  const credentials = demoCredentials().accounts[account];
  if (!credentials) throw new Error(`No seeded account named ${account}`);
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
}

/**
 * Uploads a freshly generated synthetic report as the patient and waits for the worker
 * to finish. The value is unique per call, so a repeated run is never mistaken for an
 * exact duplicate of an earlier upload.
 */
export async function uploadSyntheticReport(
  page: Page,
  options: { hba1c?: string; identifier?: string } = {},
): Promise<{ filename: string; hba1c: string }> {
  const hba1c = options.hba1c ?? (6 + ((Date.now() % 190) + 10) / 100).toFixed(2);
  const filename = `e2e-${Date.now()}-lab-report.pdf`;
  const bytes = await buildSyntheticReport({
    identifier: options.identifier ?? 'P0482',
    patientName: 'Asha Rao',
    collectedOn: smokerunDate(0).printed,
    hba1c,
    filename,
  });
  const directory = join(process.cwd(), '.local', 'tmp');
  mkdirSync(directory, { recursive: true });
  const path = join(directory, filename);
  writeFileSync(path, bytes);

  await signIn(page, 'patient');
  await page.goto('/patient/add-report');
  const dialog = page.getByRole('dialog', { name: 'Upload a report' });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="file"]').setInputFiles(path);
  await expect(dialog.getByText(filename)).toBeVisible();
  await dialog.getByRole('button', { name: 'Upload report' }).click();
  await expect(dialog.getByText('Upload complete', { exact: false }).first()).toBeVisible({
    timeout: 60_000,
  });
  return { filename, hba1c };
}

/** Signs the current session out and signs in as another seeded account. */
export async function switchAccount(
  page: Page,
  account: 'patient' | 'clinic' | 'reviewer' | 'clinician',
): Promise<void> {
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await page.waitForURL(/\/sign-in/);
  await signIn(page, account);
}

export async function openDemoPatient(page: Page): Promise<void> {
  await page.goto('/clinic/patients');
  await page.getByRole('link', { name: 'Open patient' }).first().click();
  await page.waitForURL(/\/clinic\/patients\/[0-9a-f-]+\/progression/);
}

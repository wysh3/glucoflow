import { test, expect } from '@playwright/test';
import { signIn, demoCredentials } from './helpers';

test('home reports show source values without clinical thresholds or derived review flags', async ({ page }) => {
  await signIn(page, 'patient');
  await page.goto('/patient/master');
  await expect(page.getByRole('heading', { name: 'Add a home glucose reading' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Safety radar' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Drift monitoring' })).toHaveCount(0);
  await expect(page.getByText(/Pre-diabetes|Flagged for physician review|Normal ≥90/)).toHaveCount(0);
  await expect(page.getByText('No tracking rule configured', { exact: true }).first()).toBeVisible();
});

test('tracking requires an explicitly configured interval', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto(`/clinic/patients/${demoCredentials().patientId}/master`);
  await expect(page.getByLabel('Configured interval (days)')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Save tracking rule' })).toBeVisible();
});

test('overview preserves month and year source date precision', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.route('**/api/v1/patients/*/timeline*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const source = body.observations[0];
    expect(source).toBeTruthy();
    body.observations = [
      { ...source, factId: 'precision-month', displayName: 'Month precision example', date: '2026-11-01', datePrecision: 'month' },
      { ...source, factId: 'precision-year', displayName: 'Year precision example', date: '2025-01-01', datePrecision: 'year' },
    ];
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/clinic/patients/${demoCredentials().patientId}/overview`);
  const month = page.locator('article').filter({ hasText: 'Month precision example' });
  await expect(month).toContainText('November 2026');
  await expect(month).not.toContainText('01 November');
  const year = page.locator('article').filter({ hasText: 'Year precision example' });
  await expect(year).toContainText('2025');
  await expect(year).not.toContainText('January');
});

import { test, expect } from '@playwright/test';
import { demoCredentials, signIn } from './helpers';

test('retired patient views redirect to the same protected record', async ({ page }) => {
  await signIn(page, 'clinic');
  const id = demoCredentials().patientId;
  for (const old of ['delta', 'bodymap']) {
    await page.goto(`/clinic/patients/${id}/${old}`);
    await expect(page).toHaveURL(new RegExp(`/clinic/patients/${id}/overview$`), { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Visit overview', exact: true })).toBeVisible();
  }
});

test('retired demo leads to the current walkthrough', async ({ page }) => {
  await page.goto('/demo/delta');
  await expect(page).toHaveURL(/\/showcase$/, { timeout: 5000 });
  await expect(page.getByRole('heading', { name: 'Care workspace walkthrough' })).toBeVisible();
});

test('patient cannot use a retired URL to enter clinic records', async ({ page }) => {
  await signIn(page, 'patient');
  await page.goto(`/clinic/patients/${demoCredentials().patientId}/bodymap`);
  await expect(page).toHaveURL(/\/patient\/records$/);
});


test('keyboard users can skip repeated navigation', async ({ page }) => {
  await signIn(page, 'patient');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeAttached();
  await expect(page.getByRole('button', { name: 'Ask Gluco', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth")).toBe(true);
});

test('simplified public and record views remain readable', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Less chasing. More continuity.' })).toBeVisible();
  const mobileNavigation = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await mobileNavigation.isVisible()) await mobileNavigation.click();
  await expect(page.getByRole('link', { name: 'Walkthrough', exact: true })).toHaveCount(1);
  if (await page.getByRole('dialog').isVisible()) await page.keyboard.press('Escape');
  await page.screenshot({ path: `reports/evidence/removal-2026-11-07/${testInfo.project.name}-landing.png`, fullPage: true });
  await signIn(page, 'clinic');
  await page.goto(`/clinic/patients/${demoCredentials().patientId}/overview`);
  await expect(page.getByRole('heading', { name: 'Visit overview', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Progression', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Latest approved measurements', exact: true })).toBeVisible();
  await page.screenshot({ path: `reports/evidence/removal-2026-11-07/${testInfo.project.name}-record.png`, fullPage: true });
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth")).toBe(true);
});

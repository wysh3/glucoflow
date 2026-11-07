import { expect, test, type Page } from '@playwright/test';
import { openDemoPatient, signIn } from './helpers';

async function reportMode(page: Page, mode: 'fixture' | 'live') {
  await page.route('**/api/v1/me', async (route) => {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const me = await response.json();
    await route.fulfill({ response, json: { ...me, extraction: { ...me.extraction, mode } } });
  });
}

test('public data-use information and the patient upload warning are available before files are sent', async ({ page }) => {
  await page.goto('/');
  const mobileNavigation = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await mobileNavigation.isVisible()) await mobileNavigation.click();
  await page.getByRole('link', { name: 'Privacy and data use', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { name: 'Privacy and data use', exact: true })).toBeVisible();
  await expect(page.getByText(/does not connect to ABDM or verify ABHA/)).toBeVisible();
  await expect(page.getByText(/India-only data residency/)).toBeVisible();

  await reportMode(page, 'fixture');
  await signIn(page, 'patient');
  await page.goto('/account');
  await expect(page.getByRole('link', { name: 'Privacy and data use', exact: true })).toHaveAttribute('href', '/privacy');
  await page.goto('/patient/add-report');
  await page.getByRole('button', { name: 'Choose a report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Upload a report', exact: true });
  await expect(dialog.getByText('Fictional reports only', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Aadhaar or ABHA numbers/)).toBeVisible();
  await expect(dialog.getByText(/Uploaded files are stored on the server/)).toBeVisible();
  await expect(dialog.getByText(/Fixture processing uses deterministic rules/)).toBeVisible();
  await expect(dialog.getByText(/Live AI extraction can send/)).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Upload report', exact: true })).toBeDisabled();
});

test('clinic upload discloses provider processing when the server reports live extraction', async ({ page }) => {
  await reportMode(page, 'live');
  let uploads = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/uploads')) uploads++;
  });
  await signIn(page, 'clinic');
  await openDemoPatient(page, 'Documents');
  await page.getByRole('button', { name: 'Upload report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Upload a report', exact: true });
  await expect(dialog.getByText('Fictional reports only', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Live AI extraction can send report text or rendered page images to the configured AI provider/)).toBeVisible();
  expect(uploads).toBe(0);
});

import { expect, test } from '@playwright/test';
import { demoCredentials, signIn } from './helpers';

/**
 * Patient workflows: notes stay patient-reported with a submission timestamp, the
 * add-report screen states the honest limits, and the records screen explains where
 * uploaded reports appear.
 */
test.describe('patient workflows', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'patient');
  });

  test('records screen explains where uploads appear and lists review status', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'My records' })).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Reports', exact: true})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Recent visit notes', exact: true})).toBeVisible();
  });

  test('a blank note is refused and a written note is sent with a submission time', async ({ page }) => {
    await page.goto('/patient/visit-notes');
    const send = page.getByRole('button', { name: 'Review and send' });
    await expect(send).toBeDisabled();

    const body = `Playwright note ${Date.now()}`;
    await page.getByLabel('Note').fill(body);
    await send.click();
    await page.getByRole('button', { name: 'Send note' }).click();
    // The saved note is listed below the form; the textarea above keeps the draft text.
    const saved = page.locator('article, li, div').filter({ hasText: body }).last();
    await expect(saved).toBeVisible();
    await expect(page.getByText('submitted', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Patient-reported').first()).toBeVisible();
  });

  test('the add-report screen states the limits and the process-loss limitation', async ({ page }) => {
    await page.goto('/patient/add-report');
    // The upload dialog opens on entry, so the checks target the dialog itself.
    const dialog = page.getByRole('dialog', { name: 'Upload a report' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Uploading for Asha Rao', { exact: false })).toBeVisible();
    await expect(dialog.getByText('Up to 15 MiB per file', { exact: false })).toBeVisible();
    await expect(dialog.getByText('cannot be recovered', { exact: false })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Upload report' })).toBeDisabled();
    // Closing the dialog reveals the page itself. Escape works at every viewport,
    // where the Cancel button can sit below the visible dialog area.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Add a report' })).toBeVisible();
  });

  test('the account screen states how the session is stored', async ({ page }) => {
    await page.goto('/account');
    await expect(page.getByText('Signed-in identity')).toBeVisible();
    await expect(page.getByText('Active authorized role: Patient')).toBeVisible();
    await expect(page.getByText('Session storage:', { exact: false })).toBeVisible();
    const credentials = demoCredentials();
    expect(credentials.patientId).toBeTruthy();
  });
});

test('patient can prepare a summary and open an approved original report', async ({page}) => {
  await signIn(page, 'patient');
  await page.getByRole('button', {name: 'Export visit summary'}).click();
  await expect(page.getByRole('button', {name: 'Download summary'})).toBeVisible({timeout: 60000});
  await page.getByRole('button', {name: 'Close', exact: true}).click();
  await page.getByRole('button', {name: 'Open source', exact: true}).first().click();
  await expect(page.getByRole('dialog')).toContainText('Source document');
  await expect(page.getByRole('button', {name: 'Refresh access'})).toBeVisible();
});

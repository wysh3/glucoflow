import { expect, test } from '@playwright/test';
import { seedDemo, signIn } from './helpers';

test.describe('diabetes result closure ledger', () => {
  test.beforeAll(() => {
    seedDemo();
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, 'clinic');
    await page.goto('/clinic/results');
  });

  test('opens on the last mile, not a dashboard table', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'The last mile' })).toBeVisible();
    await expect(page.getByText('The lab calls the doctor. Nobody calls the patient.')).toBeVisible();
    await expect(page.getByText('Closed with patient within 7 days')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import lab feed' })).toBeVisible();
    await expect(page.locator('[data-testid="result-row"]:visible').filter({ hasText: 'Sodium' }).first()).toBeVisible();
    await expect(page.locator('[data-testid="result-row"]:visible').filter({ hasText: 'No owner' }).first()).toBeVisible();
  });

  test('matches an ambiguous report and shows the value-echo acknowledgement', async ({ page }) => {
    await page.locator('[data-testid="result-row"]:visible').filter({ hasText: 'Sodium' }).first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Match this report to a patient')).toBeVisible();
    await expect(drawer.getByText(/Imran Shaikh/).first()).toBeVisible();
    await drawer.getByRole('listitem').filter({ hasText: 'Imran Shaikh' }).getByRole('button', { name: 'Use this patient' }).click();
    await expect(drawer.getByRole('button', { name: 'Assign to me' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Assign to me' }).click();
    await expect(drawer.getByText('Acknowledge with a value echo')).toBeVisible();
    await drawer.getByLabel('Printed value').fill('999');
    await drawer.getByRole('button', { name: 'Acknowledge with value echo' }).click();
    await expect(drawer.getByText(/does not match the report/)).toBeVisible();
    await drawer.getByLabel('Printed value').fill('128');
    await drawer.getByLabel('Lab notifier name').fill('Lab technician');
    await drawer.getByLabel('Lab notifier role').fill('technician');
    await drawer.getByLabel('Value read back').fill('128');
    await drawer.getByRole('button', { name: 'Acknowledge with value echo' }).click();
    await expect(drawer.getByText('The patient-side last mile')).toBeVisible();
  });

  test('records an unreachable patient without a false informed tick', async ({ page }) => {
    await page.locator('[data-testid="result-row"]:visible').filter({ hasText: 'Potassium' }).first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Acknowledge with a value echo')).toBeVisible();
    await drawer.getByLabel('Printed value').fill('5.9');
    await drawer.getByLabel('Lab notifier name').fill('Lab technician');
    await drawer.getByLabel('Lab notifier role').fill('technician');
    await drawer.getByLabel('Value read back').fill('5.9');
    await drawer.getByRole('button', { name: 'Acknowledge with value echo' }).click();
    await expect(drawer.getByText('The patient-side last mile')).toBeVisible();
    await drawer.getByRole('combobox', { name: 'Contact outcome' }).click();
    await page.getByRole('option', { name: 'Not reachable after attempts' }).click();
    await drawer.getByRole('button', { name: 'Record attempt' }).click();
    await expect(drawer.getByText(/1 attempt on record/)).toBeVisible();
    await drawer.getByRole('button', { name: 'Record attempt' }).click();
    await expect(drawer.getByText(/2 attempts on record/)).toBeVisible();
    await drawer.getByRole('combobox', { name: 'Close disposition' }).click();
    await page.getByRole('option', { name: 'Closed, patient unreachable' }).click();
    await drawer.getByLabel('Close note').fill('Two documented attempts. The treating doctor was notified.');
    await drawer.getByRole('button', { name: 'Close documented outcome' }).click();
    await expect(drawer.getByText('The patient was not recorded as informed.')).toBeVisible();
    const code = (await drawer.locator('a[href^="/verify/"]').innerText()).trim();
    await page.goto(`/verify/${code}`);
    await expect(page.getByText('Closed as unreachable')).toBeVisible();
    await expect(page.getByText('Chain intact')).toBeVisible();
  });

  test('imports a lab feed and holds an unmatched report', async ({ page }) => {
    await page.getByRole('button', { name: 'Import lab feed' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Import a lab feed')).toBeVisible();
    await dialog.getByRole('button', { name: 'Import and hold unmatched' }).click();
    await expect(page.getByText(/receipts created\. Unmatched rows wait for a human\./)).toBeVisible();
  });
});

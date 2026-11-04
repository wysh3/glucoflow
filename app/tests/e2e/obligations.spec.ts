import { expect, test } from '@playwright/test';
import { seedDemo, signIn } from './helpers';

test.describe('role-separated obligation workspace', () => {
  test.beforeAll(() => {
    seedDemo();
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, 'clinic');
  });

  test('the clinician sees one line and closes a review with one tap', async ({ page }) => {
    await page.goto('/clinic/line');
    await expect(page.getByRole('heading', { name: 'Before patient one' })).toBeVisible();

    const seen = page.getByRole('button', { name: 'Seen' });
    await expect(seen.first()).toBeVisible();
    const before = await seen.count();
    expect(before).toBeGreaterThan(0);

    await seen.first().click();
    await expect(seen).toHaveCount(before - 1, { timeout: 15_000 });
  });

  test('the nurse records a contact and the call leaves the queue', async ({ page }) => {
    await page.goto('/clinic/calls');
    await expect(page.getByRole('heading', { name: 'The calls' })).toBeVisible();

    const recordButtons = page.getByRole('button', { name: 'Record contact' });
    await expect(recordButtons.first()).toBeVisible();
    const before = await recordButtons.count();
    if (await recordButtons.first().isDisabled()) {
      await page.getByLabel(/Value read back/).first().check();
    }
    await recordButtons.first().click();
    await expect(recordButtons).toHaveCount(before - 1, { timeout: 15_000 });
  });

  test('the register renders and offers a print', async ({ page }) => {
    await page.goto('/clinic/register');
    await expect(page.getByRole('heading', { name: 'The register' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print A4 register' })).toBeVisible();
    await expect(page.getByText('Result closure register')).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('intake offers custody and identity actions', async ({ page }) => {
    await page.goto('/clinic/intake');
    await expect(page.getByRole('heading', { name: 'Intake' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Accept custody|Match patient/ }).first(),
    ).toBeVisible();
  });
});

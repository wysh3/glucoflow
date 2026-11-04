import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('result accountability ledger', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'clinic');
    await page.goto('/clinic/results');
  });

  test('shows the open critical receipt and the ownership gap', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Result ledger' })).toBeVisible();
    await expect(page.getByText(/critical results? (is|are) still open/)).toBeVisible();
    await expect(page.locator('[data-testid="result-row"]:visible').filter({ hasText: 'Sodium' }).first()).toBeVisible();
    await expect(page.locator('[data-testid="result-row"]:visible').filter({ hasText: 'No owner' }).first()).toBeVisible();
    await expect(page.getByText('Median acknowledge')).toBeVisible();
  });

  test('opens a receipt with its audit trail and the next action', async ({ page }) => {
    await page.locator('[data-testid="result-row"]:visible').first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Audit trail')).toBeVisible();
    await expect(drawer.getByText(/does not interpret either/)).toBeVisible();
    await expect(drawer.getByText('The clinician remains responsible for the clinical decision.')).toBeVisible();
  });

  test('shows a verified receipt chain and a public verification', async ({ page }) => {
    await page.locator('[data-testid="result-row"]:visible').first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Chain verified')).toBeVisible();
    const code = (await drawer.locator('a[href^="/verify/"]').innerText()).trim();
    await page.goto(`/verify/${code}`);
    await expect(page.getByText('Receipt chain intact')).toBeVisible();
    await expect(page.getByText(/audit events verified/)).toBeVisible();
  });

  test('filters to unowned results', async ({ page }) => {
    await page.getByRole('button', { name: 'Unowned' }).click();
    await expect(page.locator('[data-testid="result-row"]:visible').filter({ hasText: 'No owner' }).first()).toBeVisible();
    await expect(page.locator('[data-testid="result-row"]:visible').filter({ hasText: 'Ready to assign' }).first()).toBeVisible();
  });
});

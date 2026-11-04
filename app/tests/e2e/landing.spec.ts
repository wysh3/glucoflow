import { test, expect } from '@playwright/test';

test('the public home opens the synthetic result ledger in one click', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('landing')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The result nobody owns.', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /Open the result ledger/ }).first().click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByTestId('demo-card-clinic').click();
  await expect(page).toHaveURL(/\/clinic\/results$/);
  await expect(page.getByRole('heading', { name: 'Result ledger' })).toBeVisible();
});

test('the demo role cards sign in without a password', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByTestId('demo-card-clinic').click();
  await expect(page).toHaveURL(/\/clinic\/results$/);
  await expect(page.getByRole('heading', { name: 'Result ledger' })).toBeVisible();
});

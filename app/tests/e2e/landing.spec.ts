import { test, expect } from '@playwright/test';

test('the public home opens the synthetic delta in one click', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('landing')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The 60-second delta.' })).toBeVisible();
  await page.getByRole('link', { name: /Open the synthetic demo/ }).first().click();
  await expect(page).toHaveURL(/\/demo\/delta$/);
  await expect(page.getByText('3 need your decision')).toBeVisible();
});

test('the demo role cards sign in without a password', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByTestId('demo-card-clinic').click();
  await expect(page).toHaveURL(/\/clinic\/patients$/);
  await expect(page.getByRole('link', { name: 'Open patient' }).first()).toBeVisible();
});

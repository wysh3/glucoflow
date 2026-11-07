import { test, expect } from '@playwright/test';

test('the public home opens the synthetic inpatient care workspace in one click', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Less chasing. More continuity.', level: 1 })).toBeVisible();
  await page.getByTestId('demo-card-clinic').click();
  await expect(page).toHaveURL(/\/clinic\/care$/);
  await expect(page.getByRole('heading', { name: 'Care workspace', level: 1 })).toBeVisible();
});

test('the demo role cards sign in without a password', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByTestId('demo-card-clinic').click();
  await expect(page).toHaveURL(/\/clinic\/care$/);
  await expect(page.getByRole('button', { name: 'Create workspace' })).toBeVisible();
});

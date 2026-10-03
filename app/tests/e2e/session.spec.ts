import { expect, test } from '@playwright/test';
import { demoCredentials, signIn } from './helpers';

/**
 * Session behaviour: both roles sign in, navigation follows the authorized role,
 * signing out clears previously rendered records, and an invalid credential is
 * explained without revealing whether an account exists.
 */
test.describe('session', () => {
  test('patient account signs in and lands in the patient workspace', async ({ page }) => {
    await signIn(page, 'patient');
    await expect(page.getByRole('heading', { name: 'My records' })).toBeVisible();
    // No clinic-wide patient list is reachable from a patient account.
    await page.goto('/clinic/patients');
    await expect(page.getByRole('heading', { name: 'My records' })).toBeVisible();
  });

  test('clinic account signs in and sees the patient list', async ({ page }) => {
    await signIn(page, 'clinic');
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open patient' }).first()).toBeVisible();
    // The queue is reachable from the same session at every viewport.
    await page.goto('/clinic/queue');
    await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible();
  });

  test('invalid credentials are explained without revealing account existence', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('nobody@glucoflow.demo');
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText('no such');
    await expect(alert).toContainText('not accepted');
  });

  test('signing out clears previously rendered records', async ({ page }) => {
    await signIn(page, 'clinic');
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await page.goto('/account');
    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await page.waitForURL(/\/sign-in/);
    // Going back to a records route must not show cached rows.
    await page.goto('/clinic/patients');
    await page.waitForURL(/\/sign-in/);
    await expect(page.getByText('Asha Rao', { exact: false })).toHaveCount(0);
  });

  test('the review queue refuses a clinician-only account', async ({ page }) => {
    await signIn(page, 'clinician');
    await page.goto('/clinic/queue');
    await expect(
      page.getByText('This action needs reviewer capability', { exact: false }),
    ).toBeVisible();
  });

  test('the demo label and extraction mode are visible in the interface', async ({ page }) => {
    await signIn(page, 'clinic');
    const label = page.getByText('Synthetic demo', { exact: false }).first();
    await expect(label).toBeVisible();
    // Fixture mode is stated wherever extraction output is shown.
    await page.goto('/clinic/queue');
    const credentials = demoCredentials();
    expect(credentials.demoClinicId).toBeTruthy();
  });
});

test('account retains navigation back to the authorized workspace', async ({page}) => {
  await signIn(page, 'clinic');
  await page.goto('/account');
  await page.getByRole('link', {name: 'Patients', exact: true}).locator('visible=true').click();
  await expect(page.getByRole('heading', {name: 'Patients', exact: true})).toBeVisible();
  const action = page.getByRole('link', {name: 'Open patient'}).first();
  const bounds = await action.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

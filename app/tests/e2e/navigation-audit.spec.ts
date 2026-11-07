import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('switching accounts opens the new account home rather than the prior clinic route', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/line');
  await page.getByRole('button', { name: /^(Switch account|Switch)$/ }).click();
  await page.getByTestId('demo-card-reviewer').click();
  await expect(page).toHaveURL(/\/clinic\/care$/);
  await expect(page.getByRole('heading', { name: 'Care workspace' })).toBeVisible();
});

test('first simulator action has matching evidence and exposes completion', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await page.locator('#care-simulator summary').click();
  await expect(page.getByRole('combobox', { name: 'Encounter', exact: true })).toHaveText(/Sara Khan/);
  const result = page.waitForResponse((response) => response.url().endsWith('/commands') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Emit synthetic event', exact: true }).click();
  expect((await result).status()).toBe(200);
  await expect(page.getByRole('button', { name: /Inspect completed task/ })).toBeVisible();
});

test('a chosen assistant mode persists on reload for the same workspace', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  const mode = page.getByRole('combobox', { name: 'Assistant mode' });
  await mode.click();
  await page.getByRole('option', { name: 'Deterministic helper' }).click();
  await page.reload();
  await expect(mode).toHaveText('Deterministic helper');
});

test('an unreachable receipt has no completion marks for patient contact or the next step', async ({ page }) => {
  await page.route('**/api/v1/public/receipts/GLF-AUDIT12345', (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    json: { found: true, valid: true, stage: 'closed_unreachable' },
  }));
  await page.goto('/verify/GLF-AUDIT12345');
  await expect(page.getByText('Closed as unreachable', { exact: true })).toBeVisible();
  await expect(page.getByText('Chain intact', { exact: true })).toBeVisible();
  await expect(page.getByText('Patient contact not confirmed', { exact: true })).toBeVisible();
  await expect(page.getByText('Next step not confirmed', { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: /Patient contact(?:ed| not confirmed)/ }).locator('svg.lucide-check')).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: /Next step (?:completed|not confirmed)/ }).locator('svg.lucide-check')).toHaveCount(0);
});

test('clinic navigation groups retained closure screens at either viewport', async ({ page }) => {
  await signIn(page, 'clinic');
  const main = page.getByRole('navigation', { name: 'Main', exact: true }).locator('visible=true');
  await expect(main.getByRole('link')).toHaveText(['Care', 'Patient records', 'Result closure', 'Account']);
  await main.getByRole('link', { name: 'Result closure', exact: true }).click();
  const stages = page.getByRole('navigation', { name: 'Result closure sections' });
  await stages.getByRole('link', { name: 'Clinician review', exact: true }).click();
  await expect(page).toHaveURL(/\/clinic\/line$/);
  await expect(main.getByRole('link', { name: 'Result closure', exact: true })).toHaveAttribute('aria-current', 'page');
  await stages.getByRole('link', { name: 'Patient calls', exact: true }).click();
  await expect(page).toHaveURL(/\/clinic\/calls$/);
});

test('a simulated event can safely retry after the server saved it but the response was lost', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  const simulator = page.locator('#care-simulator');
  await simulator.locator('summary').click();
  const requests: { body: unknown; key?: string }[] = [];
  await page.route('**/api/v1/care/workspaces/*/commands', async (route) => {
    requests.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] });
    if (requests.length === 1) {
      const committed = await route.fetch();
      expect(committed.status()).toBe(200);
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  const emit = simulator.getByRole('button', { name: 'Emit synthetic event', exact: true });
  await emit.click();
  await expect(simulator.getByRole('alert')).toBeVisible();
  const refreshed = page.waitForResponse((response) =>
    /\/workspaces\/[^/]+$/.test(response.url()) && response.request().method() === 'GET');
  await page.evaluate('document.dispatchEvent(new Event("visibilitychange"))');
  await refreshed;

  await expect(simulator.getByRole('combobox', { name: 'Encounter', exact: true })).toHaveText(/Sara Khan/);
  await emit.click();
  await expect(simulator.getByRole('button', { name: 'Inspect source event', exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0]?.key).toBeTruthy();
  expect(requests[1]).toEqual(requests[0]);
});

test('trailing slash keeps the care section active and hides the retained guide launcher', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care/');
  await expect(page.getByRole('heading', { name: 'Care workspace', exact: true })).toBeVisible();
  const main = page.getByRole('navigation', { name: 'Main', exact: true }).locator('visible=true');
  await expect(main.getByRole('link', { name: 'Care', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Ask Gluco', exact: true })).toHaveCount(0);
  await expect(page).toHaveTitle('Care · GlucoFlow');
});

test('trailing slash keeps the retained closure section active', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/line/');
  const main = page.getByRole('navigation', { name: 'Main', exact: true }).locator('visible=true');
  await expect(main.getByRole('link', { name: 'Result closure', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: 'Result closure sections' })).toBeVisible();
  await expect(page).toHaveTitle('Clinician review · GlucoFlow');
});

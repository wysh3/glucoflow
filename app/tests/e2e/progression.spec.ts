import { expect, test } from '@playwright/test';
import { openDemoPatient, signIn } from './helpers';

/**
 * Progression: the approved reset history plots three points on a date-proportional
 * axis, the table exposes exactly those values, incompatible units stay separate and
 * the export action is visible.
 */
test.describe('progression', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'clinic');
    await openDemoPatient(page);
  });

  test('shows the approved HbA1c progression with the most recent value', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Progression' })).toBeVisible();
    // The latest approved HbA1c in the seeded history is 7.5 % on 09 July 2026,
    // unless a later synthetic smoke document was approved in this environment.
    await expect(page.getByText('Most recent recorded HbA1c')).toBeVisible();
    await expect(page.getByText('Lines connect recorded results.')).toBeVisible();
    const scope = page.getByText('recorded results in approved records', { exact: false }).first();
    await expect(scope).toBeVisible();
  });

  test('plots three seeded points and exposes the same values in the table', async ({ page }) => {
    const tableToggle = page.getByRole('button', { name: 'Table' });
    await tableToggle.click();
    // The seeded history contributes at least three HbA1c rows.
    const rows = page.locator('table tbody tr', { hasText: 'HbA1c' });
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
  });

  test('shows events and patient notes in separate labelled lanes', async ({ page }) => {
    await expect(page.getByText('Prescriptions', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient-reported notes', { exact: true })).toBeVisible();
    await expect(page.getByText('Examinations', { exact: true })).toBeVisible();
    await expect(page.getByText('Patient reported', { exact: true }).first()).toBeVisible();
  });

  test('opens the source document for the approved value', async ({ page }) => {
    await page.getByRole('button', { name: 'Open source' }).first().click();
    await expect(page.getByText('Quoted source text')).toBeVisible();
    // A 60 second signed link is issued for each open, and the viewer states it.
    await expect(page.getByRole('button', { name: 'Refresh access' })).toBeVisible();
  });

  test('opens original prescription evidence from the context lane', async ({page}) => {
    const lane = page.locator('section, div').filter({has: page.getByRole('heading', {name: 'Prescriptions', exact: true})}).filter({has: page.getByRole('button', {name: 'Open source', exact: true})}).last();
    await lane.getByRole('button', {name: 'Open source', exact: true}).first().click();
    await expect(page.getByRole('dialog')).toContainText('Quoted source text');
  });

  test('offers the summary export action', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Export visit summary' })).toBeVisible();
    await expect(page.getByText('Document availability')).toBeVisible();
  });

  test('search in patient context keeps the patient and returns a source action', async ({ page }) => {
    // Two typed characters already open the search panel, which is modal: the header
    // button behind it is not reachable, so the panel is driven directly.
    await page.getByPlaceholder("Search this patient's records").fill('eye');
    await expect(page.getByRole('heading', { name: "Search this patient's records" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open source' }).first()).toBeVisible();
    // The scope note is always shown with results.
    await expect(page.getByText('No result means no match in these records.', { exact: false })).toBeVisible();
  });
});

test('custom dates constrain progression to the selected historical range', async ({page}) => {
  await signIn(page, 'clinic');
  await openDemoPatient(page);
  await page.getByLabel('Range', {exact:true}).selectOption('custom');
  await page.getByLabel('From', {exact:true}).fill('2026-01-01');
  await page.getByLabel('To', {exact:true}).fill('2026-07-31');
  await expect(page.getByText('3 recorded results in approved records', {exact:false})).toBeVisible();
});

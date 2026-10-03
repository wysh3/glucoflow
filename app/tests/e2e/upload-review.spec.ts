import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { buildSyntheticReport, smokerunDate } from '../../scripts/lib/synthetic-report';
import { signIn } from './helpers';

/**
 * The full demonstration path: a patient uploads a synthetic report, the worker
 * processes it, the reviewer approves every proposed entry, and the approved value
 * appears in the patient's progression.
 *
 * The report is generated for this run with a unique value, so a repeated run is never
 * mistaken for an exact duplicate of an earlier upload. It is a labelled synthetic
 * document; no real patient data is used.
 */
test.describe('upload to approval', () => {
  test('a patient upload reaches the review queue and can be approved', async ({ page }) => {
    const hba1c = (6 + ((Date.now() % 190) + 10) / 100).toFixed(2);
    const collectedOn = smokerunDate(0).printed;
    const filename = `e2e-${Date.now()}-lab-report.pdf`;
    const bytes = await buildSyntheticReport({
      identifier: 'P0482',
      patientName: 'Asha Rao',
      collectedOn,
      hba1c,
      filename,
    });
    const directory = join(process.cwd(), '.local', 'tmp');
    mkdirSync(directory, { recursive: true });
    const path = join(directory, filename);
    writeFileSync(path, bytes);

    // 1. Patient uploads the synthetic report.
    await signIn(page, 'patient');
    await page.goto('/patient/add-report');
    const dialog = page.getByRole('dialog', { name: 'Upload a report' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles(path);
    await expect(dialog.getByText(filename)).toBeVisible();
    await dialog.getByRole('button', { name: 'Upload report' }).click();

    // 2. The upload is accepted by the server and processed by the worker.
    await expect(dialog.getByText('Upload complete', { exact: false }).first()).toBeVisible({ timeout: 60_000 });

    // 3. The reviewer sees it in the queue.
    await page.goto('/account');
    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await page.waitForURL(/\/sign-in/);
    await signIn(page, 'clinic');
    await page.goto('/clinic/queue');
    await page.getByRole('button', { name: 'Awaiting review' }).click();
    // Both queue layouts are in the DOM; only one is visible at this width.
    await expect(page.getByText(filename).locator('visible=true').first()).toBeVisible({
      timeout: 60_000,
    });

    // 4. Open the review screen and decide every entry.
    const uploadedQueueItem = page
      .locator('tr, div[class*="lg:hidden"] > div')
      .filter({ has: page.getByText(filename, { exact: true }) })
      .locator('visible=true');
    await uploadedQueueItem.locator('a[href^="/clinic/review/"]').click();
    await page.waitForURL(/\/clinic\/review\//);
    await expect(page.getByText('Fixture data: rule engine')).toBeVisible();

    const reviewButtons = page.getByRole('button', { name: 'Review', exact: true });
    const entryCount = await reviewButtons.count();
    for (let index = 0; index < entryCount; index += 1) {
      await reviewButtons.nth(index).click();
    }
    // Every entry must actually be recorded as reviewed before publication is offered.
    const approve = page.getByRole('button', {
      name: new RegExp(`Approve ${entryCount} reviewed`),
    });
    await expect(approve).toBeEnabled({ timeout: 30_000 });
    await approve.click();

    // The publication must be accepted, not refused as stale.
    await expect(page.getByText('This review was already published', { exact: false })).toBeVisible({
      timeout: 30_000,
    });

    // 5. The document is listed with its new state and the value is visible in the
    // patient progression with its own source document.
    await page.goto('/clinic/queue?state=all');
    await expect(page.getByText(filename).locator('visible=true').first()).toBeVisible({
      timeout: 30_000,
    });
    await page.goto('/clinic/patients');
    await page.getByRole('link', { name: 'Open patient' }).first().click();
    await expect(page.getByRole('heading', { name: 'Progression' })).toBeVisible();
    // The table lists every recorded value, including the one just approved.
    await page.getByRole('button', { name: 'Table' }).click();
    // Numeric records intentionally do not preserve PDF display padding (6.20 → 6.2).
    await expect(page.getByRole('cell', { name: String(Number(hba1c)), exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});

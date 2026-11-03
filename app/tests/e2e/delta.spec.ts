import { expect, test } from '@playwright/test';

test.describe('60-second delta demo', () => {
  test('puts the three decisions above the fold', async ({ page }) => {
    await page.goto('/demo/delta');
    await expect(page.getByRole('heading', { name: 'Asha Rao (synthetic)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /3 need your decision/ })).toBeVisible();
    await expect(page.locator('[data-tour="decision-1"]')).toContainText('eGFR -15');
    await expect(page.locator('[data-tour="decision-2"]')).toContainText('Eye review has no later record');
    await expect(page.locator('[data-tour="decision-3"]')).toContainText('Patient says Atorvastatin was stopped');
    await expect(page.locator('[data-count="changed"]')).toHaveAttribute('data-value', '7');
    await expect(page.locator('[data-count="unresolved"]')).toHaveAttribute('data-value', '3');
    await expect(page.locator('[data-count="conflict"]')).toHaveAttribute('data-value', '2');
    await expect(page.locator('[data-count="unknown"]')).toHaveAttribute('data-value', '3');
  });

  test('walks the brief, opens a source, reviews a decision and drafts the note', async ({ page }) => {
    await page.goto('/demo/delta');
    await page.getByRole('button', { name: /Tour|Start the tour/i }).click();
    await expect(page.getByText('Three decisions, not forty pages')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('The largest change')).toBeVisible();
    await expect(page.locator('[data-tour="decision-1"]')).toHaveAttribute('data-tour-focus', 'true');
    await page.getByRole('button', { name: 'Skip the tour' }).click();

    const first = page.locator('[data-tour="decision-1"]');
    await first.getByRole('button', { name: 'Source' }).click();
    await expect(page.getByText('Synthetic source page')).toBeVisible();
    await expect(page.getByText(/eGFR 55/)).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Review', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Decision 1 of 3' })).toBeVisible();
    await page.getByRole('button', { name: 'Accept into the note' }).click();
    await expect(page.getByRole('heading', { name: 'Decision 2 of 3' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Draft note' }).click();
    const note = page.getByRole('dialog');
    await expect(note.getByRole('heading', { name: 'Draft visit note' })).toBeVisible();
    await expect(note.getByText(/eGFR -15/)).toBeVisible();
    await expect(note.getByText('Context for the visit')).toBeVisible();
    await expect(
      note.getByText('Nothing has been written to the record. The doctor edits and signs.'),
    ).toBeVisible();
  });
});

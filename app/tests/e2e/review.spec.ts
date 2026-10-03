import { expect, test } from '@playwright/test';
import { signIn, switchAccount, uploadSyntheticReport } from './helpers';

/**
 * Reviewer workflow: the queue exposes processing and review states, an open review
 * shows every proposed entry with its evidence, and approval requires a decision for
 * each entry. The same flow is exercised at a 390 px mobile viewport with the
 * explicit Source and Fields tabs.
 */
test.describe('review', () => {
  test('the queue lists documents with an observed state', async ({ page }) => {
    await signIn(page, 'clinic');
    await page.goto('/clinic/queue');
    await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible();
    for (const filter of ['All', 'Processing', 'Awaiting review', 'In review', 'Could not finish']) {
      await expect(page.getByRole('button', { name: filter, exact: true })).toBeVisible();
    }
  });

  test('an approved document offers a reasoned correction rather than another initial review', async ({ page }) => {
    await signIn(page, 'clinic');
    await page.goto('/clinic/queue?state=all');
    // Open the first patient document list instead: the review route needs a document id.
    await page.goto('/clinic/patients');
    await page.getByRole('link', { name: 'Open patient' }).first().click();
    await page.getByRole('link', { name: 'Documents' }).click();
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    const approved = page.locator('[data-document-row]:visible').filter({hasText: 'Approved'}).first();
    await expect(approved.getByRole('link', {name: 'Review', exact: true})).toHaveCount(0);
    await approved.getByRole('button', {name: 'Correct entries'}).click();
    await expect(page.getByRole('button', {name: 'Open correction review'})).toBeDisabled();
    await page.getByLabel('Reason for correction').fill('Checked the source report');
    await expect(page.getByRole('button', {name: 'Open correction review'})).toBeEnabled();
    await page.getByRole('button', {name: 'Cancel', exact: true}).click();
  });

  test('the reviewer queue shows the retry control only for a failed run', async ({ page }) => {
    await signIn(page, 'clinic');
    await page.goto('/clinic/queue');
    await page.getByRole('button', { name: 'Could not finish' }).click();
    const retry = page.getByRole('button', { name: 'Retry' });
    const count = await retry.count();
    if (count > 0) {
      await expect(retry.first()).toBeEnabled();
    } else {
      await expect(page.getByText('Nothing in this filter')).toBeVisible();
    }
  });

  test('review screen keeps patient identity and the fixture label visible', async ({ page }) => {
    await uploadSyntheticReport(page);
    await switchAccount(page, 'clinic');
    await page.goto('/clinic/queue?state=awaiting_review');
    // Both queue layouts are in the DOM; only the visible one can be clicked.
    const reviewLinks = page.locator('a[href^="/clinic/review/"]:visible');
    await expect(reviewLinks.first()).toBeVisible();
    await reviewLinks.first().click();
    await page.waitForURL(/\/clinic\/review\//);
    await expect(page.getByText('P0482', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Fixture data: rule engine')).toBeVisible();
    await expect(page.getByRole('button', { name: /Approve \d+ reviewed/ })).toBeVisible();
  });
});

test.describe('review on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows the review action without horizontal scrolling', async ({ page }) => {
    // A real awaiting-review document is created for this check, so the layout is
    // exercised on a row that actually carries the action.
    const { filename } = await uploadSyntheticReport(page);
    await switchAccount(page, 'clinic');
    await page.goto('/clinic/queue?state=awaiting_review');

    // Both layouts are in the DOM; only one is visible at this width.
    const action = page.locator('a[href^="/clinic/review/"]:visible').first();
    await expect(action).toBeVisible();

    // The action must sit inside the viewport, not off to the right of a scrolling table.
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);

    // The document, its patient and its upload line stay together on the card.
    await expect(page.getByText(filename).locator('visible=true').first()).toBeVisible();
    await expect(page.getByText('Uploaded', { exact: false }).locator('visible=true').first()).toBeVisible();

    // The page itself does not scroll sideways.
    const scrollWidth = await page.evaluate('document.documentElement.scrollWidth');
    expect(Number(scrollWidth)).toBeLessThanOrEqual(391);

    await action.click();
    await page.waitForURL(/\/clinic\/review\//);
  });

  test('offers explicit Source and Fields tabs', async ({ page }) => {
    await uploadSyntheticReport(page);
    await switchAccount(page, 'clinic');
    await page.goto('/clinic/queue?state=awaiting_review');
    // Both layouts are in the DOM; only the visible one can be clicked at this width.
    const reviewLinks = page.locator('a[href^="/clinic/review/"]:visible');
    await expect(reviewLinks.first()).toBeVisible();
    await reviewLinks.first().click();
    await page.waitForURL(/\/clinic\/review\//);
    await expect(page.getByRole('tab', { name: 'Fields' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Source' })).toBeVisible();
    await page.getByRole('tab', { name: 'Source' }).click();
    await expect(page.getByText('Source', { exact: true }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Fields' }).click();
    await expect(page.getByText('Proposed entries').first()).toBeVisible();
  });
});

test('two uploaded photos remain separately accessible during review', async ({page}) => {
  await signIn(page, 'patient');
  await page.goto('/patient/add-report');
  const upload = page.getByRole('dialog', {name: 'Upload a report'});
  await upload.locator('input[type="file"]').setInputFiles([
    'fixtures/synthetic/photos/2026-09-14_lab_report_photo_a.jpg',
    'fixtures/synthetic/photos/2026-09-14_lab_report_photo_b.jpg',
  ]);
  const completedDocument = page.waitForResponse(r => /\/api\/v1\/documents\/[0-9a-f-]+$/.test(r.url()) && r.request().method() === 'GET' && r.status() === 200);
  await upload.getByRole('button', {name: 'Upload 2 pages', exact: true}).click();
  await expect(upload.getByText(/Upload complete|Already uploaded/).first()).toBeVisible({timeout:60000});
  const document = await (await completedDocument).json();
  await switchAccount(page, 'clinic');
  await page.goto(`/clinic/review/${document.duplicateOfDocumentId ?? document.documentId}`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', {name:'Source', exact:true}).click();
  await expect(page.getByRole('button', {name:'Next page', exact:true}).locator('visible=true')).toBeVisible();
  await page.getByRole('button', {name:'Next page', exact:true}).locator('visible=true').click();
  await expect(page.getByText('2026-09-14_lab_report_photo_b.jpg', {exact:true}).locator('visible=true')).toBeVisible();
  await expect(page.getByRole('img', {name:'Source document page'}).locator('visible=true')).toBeVisible();
});

import { test, expect, type Page } from '@playwright/test';

const evidence = async (name: string, page: Page) => {
  await page.waitForTimeout(700); // let the spotlight finish scrolling
  await page.screenshot({ path: `reports/completion-evidence/showcase-${name}-${page.viewportSize()!.width}.png` });
};

test('the guided doctor tour runs a real source event that closes work by evidence', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('demo-tour').click();
  const tour = page.getByRole('dialog', { name: 'Your diabetes unit shift starts now' });
  await expect(tour).toBeVisible();
  await expect(page).toHaveURL(/\/clinic\/care$/);
  await evidence('welcome', page);

  const board = page.getByRole('region', { name: 'Unit board' });
  await expect(board.getByRole('listitem')).toHaveCount(9);
  await expect(board.getByText('Corrected · re-acknowledge')).toBeVisible();
  await expect(board.getByText('Overdue for lab receipt').first()).toBeVisible();

  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Your shift in four numbers' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'The unit board, most urgent first' })).toBeVisible();
  await evidence('board', page);
  await page.getByRole('button', { name: 'Next' }).click();
  const feedStep = page.getByRole('dialog', { name: 'Now, play the hospital lab' });
  await expect(feedStep).toBeVisible();
  await evidence('feed-step', page);

  // The evaluator performs the real action; the tour advances when evidence arrives.
  const feed = page.locator('[data-tour="feed-button"]');
  await expect(feed).toContainText('Simulate LIS: Lab receipt');
  await feed.click();
  const receipt = page.locator('[data-tour="feed-receipt"]');
  await expect(receipt).toContainText('Recorded as');
  await expect(receipt).toContainText('Gluco closed “Confirm specimen receipt”');
  await expect(page.getByRole('dialog', { name: 'Closed by evidence, not by a tick-box' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Switch demo person/ })).toContainText('Dr Mira Rao');
  await evidence('closed-by-evidence', page);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'A corrected result reopens the work' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'One patient, every team' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Write a question for me' }).click();
  await expect(page.getByLabel('Message Gluco', { exact: true })).toHaveValue(/What needs my attention this shift/);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'That is the whole loop' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('dialog', { name: 'That is the whole loop' })).toHaveCount(0);
});

test('the how-it-works page reports the live API and what is not claimed', async ({ page }) => {
  await page.goto('/how-it-works');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Coordination you can audit');
  await expect(page.getByRole('status')).toContainText(/Live API responded in \d+ ms/);
  await expect(page.getByRole('heading', { name: 'Not claimed' })).toBeVisible();
  await evidence('how-it-works', page);
});

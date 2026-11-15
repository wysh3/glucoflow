import { test, expect, type Page } from '@playwright/test';

const evidence = async (name: string, page: Page) => {
  await page.waitForTimeout(700); // let the spotlight finish moving
  await page.screenshot({ path: `reports/completion-evidence/showcase-${name}-${page.viewportSize()!.width}.png` });
};
const card = (page: Page) => page.locator('.gf-tour-card');
const title = (page: Page, text: string) => expect(card(page).locator('#gf-tour-title')).toHaveText(text);
const next = (page: Page) => card(page).getByRole('button', { name: /^(Next|Skip)/ }).click();

test('the quick tour runs a real source event that closes work by evidence', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('demo-tour').click();
  await title(page, 'Your diabetes unit shift starts now');
  await expect(page).toHaveURL(/\/clinic\/care$/);
  await evidence('welcome', page);

  const board = page.getByRole('region', { name: 'Unit board' });
  await expect(board.getByRole('listitem')).toHaveCount(9);
  await expect(board.getByText('Corrected · re-acknowledge')).toBeVisible();
  await expect(board.getByText('Overdue for lab receipt').first()).toBeVisible();

  await next(page); await title(page, 'Your shift in four numbers');
  await next(page); await title(page, 'A ward board that updates itself');
  await evidence('board', page);
  await next(page); await title(page, 'Now, play the hospital lab');
  await evidence('feed-step', page);

  const feed = page.locator('[data-tour="feed-button"]');
  await expect(feed).toContainText('Simulate LIS: Lab receipt');
  await feed.click();
  const receipt = page.locator('[data-tour="feed-receipt"]');
  await expect(receipt).toContainText('Gluco closed “Confirm specimen receipt”');
  await title(page, 'Closed by evidence, not a tick-box');
  await expect(page.getByRole('button', { name: /Switch demo person/ })).toContainText('Dr Mira Rao');
  await evidence('closed-by-evidence', page);

  await next(page); await title(page, 'A corrected result reopens the work');
  await next(page); await title(page, 'One order, every team');
  await expect(page.getByRole('dialog', { name: 'Care pipeline' }).locator('.gf-tour-card')).toBeVisible();
  await evidence('pipeline', page);
  await next(page); await title(page, 'Ask the way you would ask a colleague');
  await card(page).getByRole('button', { name: 'Write a question for me' }).click();
  await expect(page.getByLabel('Message Gluco', { exact: true })).toHaveValue(/What needs my attention this shift/);
  await next(page); await title(page, 'That is the core loop');
  await card(page).getByRole('button', { name: 'Continue: full tour' }).click();
  await title(page, 'Every answer shows its evidence');
  await card(page).getByRole('button', { name: 'Close guided tour' }).click();
  await expect(card(page)).toHaveCount(0);
});

test('the full A–Z tour visits every chapter across pages, dialogs and roles', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.getByTestId('demo-card-clinic').click();
  await expect(page.getByRole('region', { name: 'Unit board' })).toBeVisible();
  await page.getByRole('button', { name: 'Open the guided tour' }).click();
  await title(page, 'GlucoFlow from A to Z');
  await expect(card(page).locator('.gf-tour-chapters button')).toHaveCount(9);
  await evidence('full-welcome', page);

  // Jump straight to the episode chapter and walk the remainder.
  await card(page).getByRole('button', { name: /3\. Follow one patient/ }).click();
  await title(page, 'One order, every team');
  await next(page); await title(page, 'The episode: everything about one patient');
  await expect(page.getByRole('dialog', { name: /Episode/ }).locator('.gf-tour-card')).toBeVisible();
  await evidence('episode', page);
  await next(page); await title(page, 'The worklist: what needs attention');
  await expect(page).toHaveURL(/view=worklist/);
  await next(page); await title(page, 'You approve the scope, the owner and the expiry');
  await expect(page.locator('[role="dialog"][data-state="open"] .gf-tour-card')).toBeVisible();
  await evidence('approve-task', page);
  await next(page); await title(page, 'Delegate a whole shift, within limits');
  await expect(page.getByRole('dialog', { name: 'Shift monitoring' }).locator('.gf-tour-card')).toBeVisible();
  await next(page); await title(page, 'A handover someone actually receives');
  await expect(page.locator('#shift-handover')).toBeVisible();
  await next(page); await title(page, 'The nurse sees "My shift"');
  await expect(page.getByRole('button', { name: /Switch demo person/ })).toContainText('Anita Joseph');
  await evidence('nurse', page);
  await next(page); await title(page, 'The lab sees its own queue');
  await expect(page.getByRole('button', { name: /Switch demo person/ })).toContainText('Priya Shah');
  await next(page); await title(page, 'Back to Dr Mira Rao');
  await expect(page.getByRole('button', { name: /Switch demo person/ })).toContainText('Dr Mira Rao');
  await next(page); await title(page, 'A system that learns your workflows as skills');
  await expect(page.getByRole('region', { name: 'Learning loop' })).toBeVisible();
  await expect(page).toHaveURL(/view=learning/);
  await next(page); await title(page, 'An activity log of every change');
  await next(page); await title(page, 'Append-only history');
  await expect(page.getByRole('dialog', { name: 'Workspace history' }).locator('.gf-tour-card')).toBeVisible();
  await next(page); await title(page, 'Outpatient records, reviewed by people');
  await expect(page).toHaveURL(/\/clinic\/patients$/);
  await card(page).getByRole('button', { name: 'Open Asha Rao' }).click();
  await title(page, 'One visit overview');
  await expect(page).toHaveURL(/\/clinic\/patients\/[^/]+\/overview/);
  await evidence('records-overview', page);
  await next(page); await title(page, 'Trends you can trace back');
  await expect(page).toHaveURL(/\/progression$/);
  await evidence('progression', page);
  await next(page); await title(page, 'The review queue');
  await expect(page).toHaveURL(/\/clinic\/queue$/);
  await next(page); await title(page, 'Real software, simulated hospital');
  await expect(page).toHaveURL(/\/how-it-works$/);
  await next(page); await title(page, 'From one ward to a hospital network');
  await evidence('scale', page);
  await next(page); await title(page, 'Rules the server enforces');
  await next(page); await title(page, 'You have seen all of GlucoFlow');
  await card(page).getByRole('button', { name: 'Back to the care desk' }).click();
  await expect(page).toHaveURL(/\/clinic\/care/);
  await expect(card(page)).toHaveCount(0);
});

test('the how-it-works page reports the live API and what is not claimed', async ({ page }) => {
  await page.goto('/how-it-works');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Coordination you can audit');
  await expect(page.getByRole('status')).toContainText(/Live API responded in \d+ ms/);
  await expect(page.getByRole('heading', { name: 'Not claimed' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'From one ward to a hospital network' })).toBeVisible();
  await evidence('how-it-works', page);
});

import { test, expect } from '@playwright/test';
import { openDemoPatient, signIn } from './helpers';
test('Record assistant supports factual follow-ups and clear chat', async ({
  page,
}) => {
  await signIn(page, 'clinician');
  await openDemoPatient(page, 'Visit overview');
  await page
    .getByRole('button', { name: 'Ask Gluco', exact: true })
    .click();
  const chat = page.getByRole('dialog', { name: 'Gluco guide', exact: true });
  await expect(chat.getByTestId('guide-patient')).toContainText('Asha');
  const input = chat.getByRole('textbox', { name: 'Ask Gluco', exact: true });
  await input.fill('What is the latest HbA1c?');
  await expect(input).toHaveValue('What is the latest HbA1c?');
  await input.press('Enter');
  await expect(
    chat.getByText('latest precisely dated', { exact: false }),
  ).toBeVisible();
  await expect(
    chat.getByText('What is the latest HbA1c?', { exact: true }),
  ).toBeInViewport({ timeout: 3000 });
  await expect(
    chat
      .getByRole('button', { name: 'Open source for HbA1c', exact: true })
      .first(),
  ).toBeVisible();
  await chat
    .getByRole('button', { name: 'And the previous one?', exact: true })
    .click();
  await expect(
    chat.getByText('previous dated', { exact: false }),
  ).toBeVisible();
  await input.fill('Is this result normal?');
  await input.press('Enter');
  await expect(
    chat.getByText('cannot diagnose', { exact: false }),
  ).toBeVisible();
  await chat
    .getByRole('button', { name: 'Clear conversation', exact: true })
    .click();
  await expect(
    chat.getByText('Is this result normal?', { exact: true }),
  ).toHaveCount(0);
  const bounds = await chat.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
});
test('patient chat opens only their own context without ornamental animation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page, 'patient');
  await page
    .getByRole('button', { name: 'Ask Gluco', exact: true })
    .click();
  const chat = page.getByRole('dialog', { name: 'Gluco guide', exact: true });
  await expect(chat.getByTestId('guide-patient')).toContainText('Your records');
  await expect(chat.getByRole('combobox')).toHaveCount(0);
  await expect(chat.locator('.gluco-orb')).toHaveCount(0);
  const input = chat.getByRole('textbox', { name: 'Ask Gluco', exact: true });
  await input.fill('What notes were reported?');
  await input.press('Shift+Enter');
  expect(await input.inputValue()).toContain('\n');
  await input.press('Enter');
  await expect(
    chat.getByText(/patient reported|patient notes are available/).first(),
  ).toBeVisible();
});
test('changing patient scope clears conversation and draft', async ({
  page,
}) => {
  await signIn(page, 'clinician');
  await openDemoPatient(page, 'Visit overview');
  await page
    .getByRole('button', { name: 'Ask Gluco', exact: true })
    .click();
  const chat = page.getByRole('dialog', { name: 'Gluco guide', exact: true });
  const input = chat.getByRole('textbox', { name: 'Ask Gluco' });
  await input.fill('What is the latest HbA1c?');
  await input.press('Enter');
  await expect(chat.getByText('latest precisely dated', { exact: false })).toBeVisible();
  await input.fill('PRIVATE SYNTHETIC DRAFT');
  await chat.getByRole('button', { name: 'Close guide' }).click();
  await page
    .getByRole('link', { name: 'Records', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/clinic\/patients$/);
  await expect(page.getByRole('button', { name: 'Ask Gluco', exact: true })).toHaveCount(0);
  await openDemoPatient(page, 'Visit overview');
  await page.getByRole('button', { name: 'Ask Gluco', exact: true }).click();
  await expect(chat.getByRole('textbox', { name: 'Ask Gluco' })).toHaveValue('');
  await expect(chat.getByText('What is the latest HbA1c?', { exact: true })).toHaveCount(0);
  await expect(chat.getByTestId('guide-patient')).toContainText('Asha');
});

test('Gluco recovers from a failed request and opens original evidence', async ({
  page,
}) => {
  await signIn(page, 'clinician');
  await openDemoPatient(page, 'Visit overview');
  await page
    .getByRole('button', { name: 'Ask Gluco', exact: true })
    .click();
  const chat = page.getByRole('dialog', { name: 'Gluco guide', exact: true });
  let release: () => void = () => {};
  const pending = new Promise<void>((r) => (release = r));
  await page.route('**/api/v1/guide/chat', async (route) => {
    await pending;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'unavailable',
          message: 'Synthetic temporary error',
          requestId: 'synthetic',
        },
      }),
    });
  });
  const input = chat.getByRole('textbox', { name: 'Ask Gluco' });
  await input.fill('latest HbA1c');
  await input.press('Enter');
  await expect(chat.getByText('Looking through the records…', { exact: true })).toBeVisible();
  await expect(chat.getByText('latest HbA1c', { exact: true })).toBeVisible({
    timeout: 3000,
  });
  release();
  await expect(chat.getByRole('alert')).toContainText(
    'Synthetic temporary error',
  );
  await expect(input).toHaveValue('latest HbA1c');
  await expect(chat.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await page.unroute('**/api/v1/guide/chat');
  await input.press('Enter');
  await expect(chat.getByRole('alert')).toHaveCount(0);
  await expect(
    chat.getByRole('button', { name: 'Open source for HbA1c' }).first(),
  ).toBeVisible();
  await chat
    .getByRole('button', { name: 'Open source for HbA1c' })
    .first()
    .click();
  const source = page.getByRole('dialog', {
    name: 'Source document',
    exact: true,
  });
  await expect(source).toBeVisible();
  await expect(
    source.getByText('HbA1c', { exact: false }).first(),
  ).toBeVisible();
  await source.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(chat).toBeVisible();
  const controls = await chat
    .getByRole('button', { name: 'Close guide' })
    .boundingBox();
  const dialog = await chat.boundingBox();
  expect(controls!.x + controls!.width).toBeLessThanOrEqual(
    dialog!.x + dialog!.width,
  );
  expect(controls!.y).toBeLessThan(dialog!.y + 90);
});

test('first guide click is retained while its code is still loading', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const loading = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/features/guide/gluco-guide.tsx*', async route => {
    requested();
    await gate;
    await route.continue();
  });
  await signIn(page, 'patient');
  await loading;
  await page.getByRole('button', { name: 'Ask Gluco', exact: true }).click();
  release();
  await expect(page.getByRole('dialog', { name: 'Gluco guide', exact: true }).getByTestId('guide-patient')).toContainText('Your records');
});

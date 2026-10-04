import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test('landing is inset and primary roles fit the viewport without scrolling', async ({
  page,
}) => {
  await page.goto('/sign-in');
  const panel = page.getByTestId('welcome-panel');
  await expect(panel).toBeVisible({ timeout: 5000 });
  const bounds = await panel.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(24);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height - 16,
  );
  expect(
    await page.evaluate(
      'document.documentElement.scrollHeight <= window.innerHeight + 2',
    ),
  ).toBe(true);
  for (const name of ['Doctor', 'Clinic team', 'Reviewer', 'Patient'])
    await expect(
      page.getByRole('button', { name: new RegExp(`^${name} `) }),
    ).toBeVisible();
});
test('dropdowns open an in-app listbox and support keyboard selection', async ({
  page,
}) => {
  await signIn(page, 'patient');
  await page.goto('/patient/master');
  const menu = page.getByRole('combobox', {
    name: 'Reading type',
    exact: true,
  });
  await menu.click();
  await expect(page.getByRole('listbox')).toBeVisible({ timeout: 5000 });
  await page.getByRole('option', { name: 'Post-meal', exact: true }).click();
  await expect(menu).toContainText('Post-meal');
  await menu.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  await expect(
    page.getByRole('option', { name: 'Random', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toContainText('Random');
});
test('doctor overview consolidates approved facts and source links', async ({
  page,
}) => {
  await signIn(page, 'clinician');
  await page
    .getByRole('link', { name: 'Open patient', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Visit overview', exact: true }),
  ).toBeVisible({ timeout: 5000 });
  await expect(
    page.getByRole('heading', {
      name: 'Latest approved measurements',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Documented prescriptions',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Patient-reported notes', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Open source for HbA1c', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Source document', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Back', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'Progression', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Progression', exact: true }),
  ).toBeVisible();
});
test('orb guide helps navigate without providing clinical advice', async ({
  page,
}) => {
  await signIn(page, 'patient');
  await page
    .getByRole('button', { name: 'Open Gluco guide', exact: true })
    .click();
  const chat = page.getByRole('dialog', { name: 'Gluco guide', exact: true });
  await expect(chat).toBeVisible({ timeout: 5000 });
  const bounds = await chat.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await chat
    .getByRole('textbox', { name: 'Ask about the app', exact: true })
    .fill('Where can I upload a report?');
  await chat.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    chat.getByRole('link', { name: 'Add report', exact: true }),
  ).toBeVisible();
  await chat.getByRole('link', { name: 'Add report', exact: true }).click();
  await expect(page).toHaveURL(/\/patient\/add-report$/);
  await expect(
    page.getByRole('dialog', { name: 'Upload a report' }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Upload a report' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open Gluco guide', exact: true })
    .click();
  await chat
    .getByRole('textbox', { name: 'Ask about the app', exact: true })
    .fill('What insulin dose should I take?');
  await chat.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    chat.getByText(
      'I can help you use Glucoflow, but I cannot diagnose, interpret results or recommend treatment.',
      { exact: false },
    ),
  ).toBeVisible();
});

test('screening menu preserves implicit option values', async ({page}) => {
 await signIn(page,'clinician');await page.getByRole('link',{name:'Open patient',exact:true}).first().click();await page.getByRole('link',{name:'Home reports',exact:true}).click();
 const menu=page.getByRole('combobox',{name:'Review',exact:true});await expect(menu).toContainText('Retinal screening');await menu.click();await expect(page.getByRole('option')).toHaveCount(4);await page.getByRole('option',{name:'Renal monitoring',exact:true}).click();await expect(menu).toContainText('Renal monitoring');
});

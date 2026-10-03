import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test('home reading and problem timestamps are independent', async ({ page }) => {
  await signIn(page, 'patient');
  await page.goto('/patient/master');
  const symptom = page.getByLabel('Occurred at');
  await expect(symptom).toBeVisible();
  const original = await symptom.inputValue();
  await page.getByLabel('Measured at').fill('2026-09-12T08:15');
  await expect(symptom).toHaveValue(original);
});

test('a correction opens an editable draft before sending a new version', async ({ page }) => {
  await signIn(page, 'patient');
  await page.goto('/patient/visit-notes');
  const text = `Synthetic correction check ${Date.now()}`;
  await page.getByLabel('Note', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Review and send', exact: true }).click();
  await page.getByRole('button', { name: 'Send note', exact: true }).click();
  const note = page.getByRole('listitem').filter({ hasText: text });
  await expect(note).toContainText('version 1');
  await note.getByRole('button', { name: 'Send a corrected version' }).click();
  await expect(page.getByLabel('Note', { exact: true })).toHaveValue(text);
  await expect(note).toContainText('version 1');
  await page.getByLabel('Note', { exact: true }).fill(`${text} — corrected`);
  await page.getByRole('button', { name: 'Review and send', exact: true }).click();
  await page.getByRole('button', { name: 'Send correction', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: `${text} — corrected` })).toContainText('version 2');
});

test('demo samples are available without choosing a local file', async ({ page }) => {
  await signIn(page, 'patient');
  await page.goto('/patient/add-report');
  const dialog = page.getByRole('dialog', { name: 'Upload a report' });
  await expect(dialog.getByText('Try a synthetic sample', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Upload lab sample', exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Preview lab sample', exact: true })).toHaveAttribute('href', /demo\/.*pdf/);
});

test('published reviews show success and lock further draft actions', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/patients');
  await page.getByRole('link', { name: 'Open patient' }).first().click();
  const response = page.waitForResponse(r => new URL(r.url()).pathname.startsWith('/api/v1/patients/') && new URL(r.url()).pathname.endsWith('/documents') && r.request().method() === 'GET' && r.status() === 200);
  await page.getByRole('link', { name: 'Documents', exact: true }).click();
  const documents = await (await response).json();
  const row = page.locator('[data-document-row]:visible').filter({ hasText: 'Approved' }).first();
  await expect(row).toBeVisible();
  const documentId = documents.items.find((d: {state:string}) => d.state === 'approved').documentId;
  await page.goto(`/clinic/review/${documentId}`);
  await expect(page.getByText('Published to the approved record', { exact: true })).toBeVisible();
  await expect(page.getByText('This review is not ready to publish', { exact: true })).toHaveCount(0);
  for (const button of await page.getByRole('button', { name: /^(Review|Exclude|Correct|Add entry)$/ }).all()) {
    await expect(button).toBeDisabled();
  }
});

test('sample upload leads to an available review even on a repeated run', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/patients');
  await page.getByRole('link', { name: 'Open patient' }).first().click();
  await page.getByRole('link', { name: 'Documents', exact: true }).click();
  for (let run = 0; run < 2; run++) {
  await page.getByRole('button', { name: 'Upload report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Upload a report' });
  await dialog.getByRole('button', { name: 'Upload lab sample', exact: true }).click();
  await expect(dialog.getByRole('link', { name: /Review this report|Open existing report/ })).toBeVisible({timeout:90000});
  await dialog.getByRole('link', { name: /Review this report|Open existing report/ }).click();
  await expect(page.locator('h2:visible').filter({hasText:'Proposed entries'})).toBeVisible();
  await expect(page.locator('li:visible').filter({hasText:'HbA1c'}).first()).toBeVisible();
  await page.getByRole('link', {name:'Back', exact:true}).click();
  }
});

test('a saved SOS snapshot downloads JSON without leaving the workspace', async ({ page }) => {
  await signIn(page, 'patient');
  await page.goto('/patient/master');
  await page.getByRole('button', {name:'Send SOS snapshot',exact:true}).click();
  await expect(page.getByText('Snapshot delivered to the demo clinic desk.', {exact:true})).toBeVisible();
  const download = page.waitForEvent('download', {timeout:10000});
  await page.getByRole('button', {name:'Download JSON',exact:true}).first().click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/glucoflow-snapshot-.*\.json/);
  await expect(page).toHaveURL(/\/patient\/master$/);
});

test('clinic note submission dates use the same local calendar day as patient notes', async ({ page }) => {
  await signIn(page, 'patient');
  await page.goto('/patient/visit-notes');
  const body = `Synthetic calendar date check ${Date.now()}`;
  await page.getByLabel('Note', {exact:true}).fill(body);
  await page.getByRole('button',{name:'Review and send',exact:true}).click();
  await page.getByRole('button',{name:'Send note',exact:true}).click();
  const day = await page.evaluate(() => new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}));
  await expect(page.getByRole('listitem').filter({hasText:body})).toContainText(`submitted ${day}`);
  await page.goto('/account');
  await page.getByRole('button',{name:'Sign out',exact:true}).first().click();
  await signIn(page,'clinic');
  await page.goto('/clinic/patients');
  await page.getByRole('link',{name:'Open patient'}).first().click();
  await page.getByRole('link',{name:'Progression',exact:true}).click();
  await expect(page.getByText(body,{exact:true}).locator('..')).toContainText(`submitted ${day}`);
});

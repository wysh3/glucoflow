import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test('episode navigation keeps encounter sources and tasks together and supports browser back', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await page.getByRole('link', { name: 'Encounters', exact: true }).click();
  await page.getByRole('button', { name: 'Open episode for Dev Mehta' }).click();
  const episode = page.getByRole('dialog', { name: 'Episode · Dev Mehta' });
  await expect(episode).toContainText('known CKD');
  await expect(episode).toContainText('Lab team');
  await expect(episode).not.toContainText('Sara Khan');
  await expect(page).toHaveURL(/encounter=/);
  await page.reload();
  await expect(episode).toBeVisible();
  await episode.getByRole('region', { name: 'Episode source timeline' })
    .getByRole('button', { name: 'HIS · Specimen collected', exact: true }).click();
  const source = page.getByRole('dialog', { name: 'Source event', exact: true });
  await expect(source).toContainText('Dev Mehta');
  await source.getByRole('button', { name: 'Close', exact: true }).click();
  await page.goBack();
  await expect(episode).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Encounters', exact: true })).toBeVisible();
});

test('appointment preview requires explicit details and review; changing details clears approval', async ({ page }) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await page.locator('summary[aria-label="Workspace menu"]').click();
  await page.getByRole('button', { name: 'Appointment preview', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Appointment message', exact: true })).toBeVisible();
  const preview = page.getByRole('region', { name: 'Appointment message preview' });
  await expect(preview.getByRole('button', { name: 'Approve demo preview' })).toBeDisabled();
  await preview.getByLabel('Appointment date and time').fill('2026-12-01T10:00');
  await preview.getByLabel('Clinic location').fill('Synthetic clinic desk A');
  await preview.getByRole('button', { name: 'Approve demo preview' }).click();
  await expect(preview.getByRole('status')).toContainText('Approved for this demo preview');
  await expect(preview).toContainText('Nothing is scheduled or sent');
  await preview.getByLabel('Clinic location').fill('Synthetic clinic desk B');
  await expect(preview.getByRole('status')).toHaveCount(0);
  await expect(preview).not.toContainText('insulin');
  expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
});

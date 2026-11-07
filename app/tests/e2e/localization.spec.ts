import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('Hindi follows the patient through records, notes, upload entry and account', async ({ page }) => {
  await signIn(page, 'patient');
  const language = page.getByRole('combobox', { name: 'Language', exact: true });
  await expect(language).toBeVisible({ timeout: 2000 });
  await language.selectOption('hi-IN');
  await expect(page.getByTestId('language-coverage')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi-IN');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'मेरे रिकॉर्ड', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'भाषा', exact: true })).toHaveValue('hi-IN');

  const main = page.getByRole('navigation', { name: 'मुख्य नेविगेशन', exact: true }).locator('visible=true');
  await page.getByRole('link', { name: 'नोट लिखें', exact: true }).click();
  const note = page.getByLabel('नोट', { exact: true });
  await note.fill('यह केवल एक काल्पनिक परीक्षण नोट है।');
  await page.getByRole('button', { name: 'जाँचें और भेजें', exact: true }).click();
  await expect(page.getByText('भेजने से पहले जाँचें', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'बदलें', exact: true }).click();
  await expect(note).toHaveValue('यह केवल एक काल्पनिक परीक्षण नोट है।');

  await page.goto('/patient/records');
  await page.getByRole('link', { name: 'रिपोर्ट जोड़ें', exact: true }).click();
  await page.getByRole('button', { name: 'रिपोर्ट चुनें', exact: true }).click();
  const upload = page.getByRole('dialog', { name: 'रिपोर्ट अपलोड करें', exact: true });
  await expect(upload.getByText('केवल काल्पनिक रिपोर्ट', { exact: true })).toBeVisible();
  await expect(upload.getByText(/आधार या ABHA नंबर अपलोड न करें/)).toBeVisible();
  await expect(upload.getByRole('button', { name: 'रिपोर्ट अपलोड करें', exact: true })).toBeDisabled();
  await upload.getByRole('button', { name: 'रद्द करें', exact: true }).click();
  await main.getByRole('link', { name: 'खाता', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'खाता', exact: true })).toBeVisible();
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
});

test('Urdu preview applies right-to-left direction and explains the English fallback', async ({ page }) => {
  await signIn(page, 'patient');
  const selector = page.getByRole('combobox', { name: 'Language', exact: true });
  await expect(selector.locator('option[value="ur-IN"]')).toHaveText(/Preview/);
  await expect(selector.locator('option[value="sat-Olck-IN"]')).toHaveCount(0);
  await selector.selectOption('ur-IN');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur-IN');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'میرے ریکارڈ', exact: true })).toBeVisible();
  await expect(page.getByTestId('language-coverage')).toContainText(/باقی متن انگریزی میں ہو سکتا ہے/);
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
  await page.getByRole('combobox', { name: 'زبان', exact: true }).selectOption('en-IN');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'My records', exact: true })).toBeVisible();
});

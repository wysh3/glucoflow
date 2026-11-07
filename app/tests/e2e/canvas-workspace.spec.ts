import { test, expect } from '@playwright/test';
import { signIn, demoCredentials } from './helpers';

test('the upstream shell wraps the public entry and stays within the viewport', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Your care team, a little more connected.',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
});

test('working panels preserve the conversation draft and browser history', async ({page}, testInfo) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', {name:'Create workspace',exact:true}).click();
  const draft = page.getByLabel('Message Gluco', {exact:true});
  await draft.fill('Synthetic navigation draft — do not send');
  let calls = 0;
  page.on('request', r => { if(r.method()==='POST' && r.url().endsWith('/chat')) calls++; });
  await page.getByRole('link', {name:'Worklist',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Worklist',exact:true})).toBeVisible();
  await expect(draft).not.toBeVisible();
  await expect(page.getByRole('link', {name:'Home & chat',exact:true})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('worklist.png')});
  await page.goBack();
  await expect(draft).toBeVisible();
  await expect(draft).toHaveValue('Synthetic navigation draft — do not send');
  await page.getByRole('link', {name:'Encounters',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Encounters',exact:true})).toBeVisible();
  await page.getByRole('link', {name:'Home & chat',exact:true}).click();
  await expect(draft).toHaveValue('Synthetic navigation draft — do not send');
  expect(calls).toBe(0);
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
});

test('sidebar controls keep authorized record navigation usable', async ({page}) => {
  await signIn(page, 'clinic');
  if(page.viewportSize()!.width >= 768) {
    const resize = page.getByRole('separator', {name:'Resize sidebar'});
    await resize.focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', {name:'Collapse navigation',exact:true}).click();
    await expect(page.getByRole('button', {name:'Expand navigation',exact:true})).toBeVisible();
    await page.reload();
    await page.getByRole('button', {name:'Expand navigation',exact:true}).click();
  } else {
    await page.getByRole('button', {name:'Open navigation',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.goto(`/clinic/patients/${demoCredentials().patientId}/overview`);
  await expect(page.getByRole('heading', {name:'Visit overview',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Open source for HbA1c',exact:true}).first().click();
  await expect(page.getByRole('dialog', {name:'Source document',exact:true})).toBeVisible();
});

test('resizing the sidebar cannot squeeze the conversation into an unusable split', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop resize behavior');
  await page.setViewportSize({width:1280,height:900});
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', {name:'Create workspace',exact:true}).click();
  await page.getByRole('link', {name:'Worklist',exact:true}).click();
  const menu = page.locator('summary[aria-label="Workspace menu"]');
  const resize = page.getByRole('separator', {name:'Resize sidebar'});
  await resize.focus();
  await page.keyboard.press('Home');
  await menu.click();
  await page.getByRole('button', {name:'Show conversation',exact:true}).click();
  const draft = page.getByLabel('Message Gluco',{exact:true});
  await expect(draft).toBeVisible();
  await resize.focus();
  await page.keyboard.press('End');
  await expect(draft).not.toBeVisible();
  await expect(page.getByRole('heading', {name:'Worklist',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Collapse navigation',exact:true}).click();
  await expect(draft).toBeVisible();
  await expect(page.getByRole('heading', {name:'Worklist',exact:true})).toBeVisible();
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
});

test('collapsed desktop navigation remains a labelled icon rail after reload', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop rail only');
  await signIn(page, 'clinic');
  await page.getByRole('button', {name: 'Collapse navigation', exact: true}).click();
  const rail = page.locator('.desktop-sidebar');
  await expect(rail).toBeVisible();
  expect((await rail.boundingBox())?.width).toBe(64);
  await expect(rail.getByRole('link', {name: 'Home & chat', exact: true})).toHaveAttribute('title', 'Home & chat');
  await rail.getByRole('link', {name: 'Account', exact: true}).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.reload();
  await expect(rail).toBeVisible();
  expect((await rail.boundingBox())?.width).toBe(64);
  await page.getByRole('button', {name: 'Expand navigation', exact: true}).click();
  expect((await rail.boundingBox())!.width).toBeGreaterThan(64);
});

import { test, expect } from '@playwright/test';
import { signIn, demoCredentials } from './helpers';

test('the upstream shell wraps the public entry and stays within the viewport', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Less chasing. More continuity.',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
});

test('working panels preserve the conversation draft and browser history', async ({page}, testInfo) => {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', {name:'Create workspace',exact:true}).click();
  const draft = page.getByLabel('Message GlucoFlow', {exact:true});
  await draft.fill('Synthetic navigation draft — do not send');
  let calls = 0;
  page.on('request', r => { if(r.method()==='POST' && r.url().endsWith('/chat')) calls++; });
  await page.getByRole('tab', {name:'My Worklist',exact:true}).click();
  await expect(page.getByRole('heading', {name:'My Worklist',exact:true})).toBeVisible();
  if(page.viewportSize()!.width >= 1100) await expect(draft).toBeVisible();
  else await expect(page.getByRole('button', {name:'Back to conversation',exact:true})).toBeVisible();
  await page.screenshot({path: `reports/evidence/canvas-2026-11-07/${testInfo.project.name}-worklist.png`});
  await page.goBack();
  await expect(draft).toBeVisible();
  await expect(draft).toHaveValue('Synthetic navigation draft — do not send');
  await page.getByRole('tab', {name:'My Care Teams',exact:true}).click();
  await expect(page.getByRole('heading', {name:'My Care Teams',exact:true})).toBeVisible();
  await page.getByRole('tab', {name:'Ask GlucoFlow',exact:true}).click();
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
  await page.getByRole('tab', {name:'My Worklist',exact:true}).click();
  const resize = page.getByRole('separator', {name:'Resize sidebar'});
  await resize.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('button', {name:'Back to conversation',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Collapse navigation',exact:true}).click();
  await expect(page.getByLabel('Message GlucoFlow',{exact:true})).toBeVisible();
  await expect(page.getByRole('button', {name:'Close working panel',exact:true})).toBeVisible();
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
});

test('collapsed desktop navigation remains a labelled icon rail after reload', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop rail only');
  await signIn(page, 'clinic');
  await page.getByRole('button', {name: 'Collapse navigation', exact: true}).click();
  const rail = page.locator('.desktop-sidebar');
  await expect(rail).toBeVisible();
  expect((await rail.boundingBox())?.width).toBe(64);
  await expect(rail.getByRole('link', {name: 'Workspace', exact: true})).toHaveAttribute('title', 'Workspace');
  await rail.getByRole('link', {name: 'Account', exact: true}).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.reload();
  await expect(rail).toBeVisible();
  expect((await rail.boundingBox())?.width).toBe(64);
  await page.getByRole('button', {name: 'Expand navigation', exact: true}).click();
  expect((await rail.boundingBox())!.width).toBeGreaterThan(64);
});

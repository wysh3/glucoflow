import { test, expect, type Locator, type Page } from '@playwright/test';
import { signIn } from './helpers';

async function openWorkspace(page: Page) {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Doctor care desk', exact: true })).toBeVisible();
}

test('a tester creates a workspace, asks with explicit offline mode, and reloads persisted answers', async ({ page }) => {
  await openWorkspace(page);
  await useWorkspaceHelper(page);
  await page.getByLabel('Message Gluco', { exact: true }).fill('Summarize the pending handoffs for this shift.');
  const reply = page.waitForResponse(response => response.url().endsWith('/chat') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  expect((await reply).status()).toBe(200);
  const conversation = page.getByRole('log', { name: 'Care conversation' });
  await expect(conversation).toContainText('Summarize the pending handoffs');
  await expect(conversation).toContainText('Deterministic');
  await expect(page.locator('[data-openui-devtools-auto-mount]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('log', { name: 'Care conversation' })).toContainText('Summarize the pending handoffs');
  expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
});

test('source evidence opens from the worklist without leaving the workspace', async ({ page }) => {
  await openWorkspace(page);
  await page.goto('/clinic/care?view=worklist');
  const exception = page.getByRole('listitem').filter({ hasText: 'Dev Mehta · Awaiting lab receipt' });
  await exception.locator('summary').click();
  await exception.getByRole('button', { name: 'HIS · Specimen collected', exact: true }).click();
  const source = page.getByRole('dialog', { name: 'Source event', exact: true });
  await expect(source).toBeVisible();
  await expect(source).toContainText('Source reference');
  await expect(source).toContainText('Synthetic');
  await expect(source).toContainText('Received by GlucoFlow');
  await source.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(source).not.toBeVisible();
  await expect(page).toHaveURL(/\/clinic\/care\?view=worklist$/);
  expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
});

test('saved workspaces recover after a failed reopen without mixing conversations', async ({ page }) => {
  const firstResponse = page.waitForResponse(response => response.url().endsWith('/care/workspaces') && response.request().method() === 'POST');
  await openWorkspace(page);
  const first = await (await firstResponse).json() as import('@glucoflow/contracts').CareWorkspace;
  await useWorkspaceHelper(page);
  const firstMessage = 'Show recorded events for workspace recovery verification.';
  await page.getByLabel('Message Gluco', { exact: true }).fill(firstMessage);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('log', { name: 'Care conversation' })).toContainText(firstMessage);
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  const newChat = page.getByRole('dialog', { name: 'Start a new chat?' });
  await newChat.getByRole('button', { name: 'Start new chat', exact: true }).click();
  await expect(newChat).not.toBeVisible();
  await expect(page.getByRole('log', { name: 'Care conversation' })).not.toBeVisible();

  await workspaceMenu(page, 'Saved workspaces');
  const recovery = page.getByRole('dialog', { name: 'Open a saved workspace' });
  const firstRow = recovery.locator(`[data-workspace-id="${first.id}"]`);
  let failNextReopen = true;
  await page.route(`**/care/workspaces/${first.id}`, async (route) => {
    if (!failNextReopen || route.request().method() !== 'GET') return route.continue();
    failNextReopen = false;
    const response = await route.fetch();
    return route.fulfill({ response, status: 503,
      json: { error: { code: 'unavailable', message: 'Temporary workspace load failure.', requestId: 'synthetic-check' } },
    });
  });
  await revealSavedWorkspace(recovery, firstRow);
  await firstRow.getByRole('button', { name: /Reopen workspace created/ }).click();
  await expect(recovery).toContainText('Temporary workspace load failure.');
  await expect(recovery.getByText('Open now', { exact: true })).toBeVisible();
  await recovery.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('log', { name: 'Care conversation' })).not.toBeVisible();

  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('glucoflow.care.workspace.')) sessionStorage.removeItem(key);
    }
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Explore the DKA handover demo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Saved workspaces', exact: true }).click();
  await revealSavedWorkspace(recovery, firstRow);
  await firstRow.getByRole('button', { name: /Reopen workspace created/ }).click();
  await expect(recovery).not.toBeVisible();
  await expect(page.getByRole('log', { name: 'Care conversation' })).toContainText(firstMessage);
  await page.reload();
  await expect(page.getByRole('log', { name: 'Care conversation' })).toContainText(firstMessage);
});

async function revealSavedWorkspace(recovery: Locator, workspace: Locator) {
  const rows = recovery.locator('[data-workspace-id]');
  const older = recovery.getByRole('button', { name: 'Load older workspaces', exact: true });
  await expect(rows.first()).toBeVisible();
  while (!await workspace.isVisible() && await older.isVisible()) {
    const before = await rows.count();
    await older.click();
    await expect(rows).not.toHaveCount(before);
  }
  await expect(workspace).toBeVisible();
}

async function workspaceMenu(page: Page, action: string) {
  await page.locator('summary[aria-label="Workspace menu"]').click();
  await page.getByRole('button', { name: action, exact: true }).click();
}

async function useWorkspaceHelper(page: Page) {
  await page.getByRole('button', { name: 'Chat options', exact: true }).click();
  await choose(page, 'Response mode', 'Workspace helper · no AI');
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function commandResult(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse(item => item.url().endsWith('/commands') && item.request().method() === 'POST');
  await action();
  const result = await response;
  expect(result.status()).toBe(200);
  return result.json() as Promise<import('@glucoflow/contracts').CareWorkspace>;
}

test('source-confirmed monitoring becomes a reviewed skill and proposes a new task with target evidence', async ({ page }) => {
  await openWorkspace(page);
  await page.goto('/clinic/care?view=worklist');
  await page.getByRole('button', { name: 'Review task', exact: true }).click();
  const task = page.getByRole('dialog', { name: 'Confirm specimen receipt', exact: true });
  await choose(page, 'Task action', 'Approve monitoring');
  const approved = await commandResult(page, () => task.getByRole('button', { name: 'Approve monitoring', exact: true }).click());
  const encounter = approved.encounters.find(item => item.patientName === 'Asha Shah')!;
  const watched = approved.tasks.find(item => item.encounterId === encounter.id)!;
  expect(watched.status).toBe('monitoring');
  expect(watched.completionEventId).toBeNull();
  await task.getByRole('button', { name: 'Close', exact: true }).click();
  await workspaceMenu(page, 'Demo controls');
  await commandResult(page, () => choose(page, 'Simulation role', 'Nurse'));
  const collected = await commandResult(page, () => page.getByRole('button', { name: 'Emit synthetic event', exact: true }).click());
  expect(collected.tasks.find(item => item.id === watched.id)?.status).toBe('monitoring');
  await commandResult(page, () => choose(page, 'Simulation role', 'Lab staff'));
  const completed = await commandResult(page, () => page.getByRole('button', { name: 'Emit synthetic event', exact: true }).click());
  const done = completed.tasks.find(item => item.id === watched.id)!;
  expect(done.status).toBe('source_confirmed');
  expect(completed.events.find(item => item.id === done.completionEventId)?.kind).toBe('specimen_received');
  const downloadPromise = page.waitForEvent('download');
  await workspaceMenu(page, 'Export JSON');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^glucoflow-synthetic-.+-snapshot\.json$/);
  expect(await download.failure()).toBeNull();

  await page.getByRole('button', { name: /Inspect completed task/ }).click();
  await expect(task).toContainText('Completion evidence');
  const captured = page.waitForResponse(response => response.url().endsWith('/skills') && response.request().method() === 'POST');
  await task.getByRole('button', { name: 'Capture routine draft', exact: true }).click();
  const captureResponse = await captured;
  expect(captureResponse.status()).toBe(201);
  const skill = await captureResponse.json() as import('@glucoflow/contracts').CareSkill;
  expect(skill.origin?.eventId).toBe(done.completionEventId);
  await task.getByRole('link', { name: 'Open care routines', exact: true }).click();
  const card = page.locator(`[data-skill-id="${skill.id}"]`);
  await expect(card.getByRole('button', { name: 'Approve routine', exact: true })).toBeDisabled();
  await card.getByRole('button', { name: 'Run routine tests', exact: true }).click();
  await expect(card).toContainText('5/5 passed');
  await card.getByRole('button', { name: 'Approve routine', exact: true }).click();
  await page.getByRole('dialog', { name: 'Approve routine', exact: true }).getByRole('button', { name: 'Approve routine', exact: true }).click();
  await expect(card).toContainText('Approved · Active');

  if (!await page.locator('#care-simulator[open]').count()) {
    await workspaceMenu(page, 'Demo controls');
  }
  await commandResult(page, () => choose(page, 'Simulation role', 'Doctor'));
  await page.getByRole('link', { name: 'Encounters', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'Dev Mehta' }).click();
  await page.getByRole('button', { name: 'Add lab order', exact: true }).click();
  await page.getByLabel('Test name', { exact: true }).fill('Synthetic skill reuse order');
  const withOrder = await commandResult(page, () => page.getByRole('button', { name: 'Create lab order', exact: true }).click());
  const targetOrder = withOrder.orders.find(item => item.testName === 'Synthetic skill reuse order')!;
  const targetLabel = `${targetOrder.testName} · ${targetOrder.specimenId}`;
  await commandResult(page, () => choose(page, 'Simulation role', 'Nurse'));
  await choose(page, 'Encounter', 'Dev Mehta · ICU 07');
  await choose(page, 'Order', targetLabel);
  await choose(page, 'Event type', 'Specimen collected · HIS');
  await page.getByLabel('Source reference (optional)', { exact: true }).fill('HIS-SKILL-REUSE-TARGET');
  const withTarget = await commandResult(page, () => page.getByRole('button', { name: 'Emit synthetic event', exact: true }).click());
  const targetEvent = withTarget.events.find(item => item.sourceRef === 'HIS-SKILL-REUSE-TARGET')!;
  await commandResult(page, () => choose(page, 'Simulation role', 'Doctor'));

  await workspaceMenu(page, 'Care routines');
  await card.getByRole('button', { name: 'Preview application', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Preview care routine', exact: true });
  await choose(page, 'Target encounter', 'Dev Mehta · DEMO-102');
  await choose(page, 'Target laboratory order', targetLabel);
  const apply = preview.getByRole('button', { name: 'Create approval request', exact: true });
  await expect(apply).toBeDisabled();
  await preview.getByRole('button', { name: 'Check applicability', exact: true }).click();
  await expect(preview).toContainText('Eligible for proposal');
  await preview.getByRole('button', { name: 'HIS · Specimen collected', exact: true }).click();
  const source = page.getByRole('dialog', { name: 'Source event', exact: true });
  await expect(source).toContainText('HIS-SKILL-REUSE-TARGET');
  await source.getByRole('button', { name: 'Close', exact: true }).click();
  const proposed = await commandResult(page, () => apply.click());
  const newTask = proposed.tasks.find(item => item.skillId === skill.id && item.orderId === targetOrder.id)!;
  expect(newTask.status).toBe('awaiting_approval');
  expect(newTask.skillSourceEventId).toBe(targetEvent.id);
  expect(newTask.skillSourceEventId).not.toBe(done.completionEventId);
});

test('a workflow layout is tested, approved, and rolled back through human review', async ({ page }) => {
  await openWorkspace(page);
  await workspaceMenu(page, 'Care routines');
  await page.getByRole('button', { name: 'Propose layout', exact: true }).click();
  await page.getByLabel('Layout title', { exact: true }).fill('Evidence first handover');
  await choose(page, 'Handover layout', 'Evidence before owner');
  await commandResult(page, () => page.getByRole('button', { name: 'Save draft', exact: true }).click());
  await expect(page.getByRole('button', { name: 'Approve layout', exact: true })).toBeDisabled();
  await commandResult(page, () => page.getByRole('button', { name: 'Run sandbox tests', exact: true }).click());
  await page.getByRole('button', { name: 'Approve layout', exact: true }).click();
  const approve = page.getByRole('dialog', { name: 'Approve version', exact: true });
  const accepted = await commandResult(page, () => approve.getByRole('button', { name: 'Approve version', exact: true }).click());
  expect(accepted.playbooks.find(item => item.status === 'approved')?.version).toBe(2);
  await page.getByRole('button', { name: 'Restore this version', exact: true }).click();
  const restore = page.getByRole('dialog', { name: 'Restore version', exact: true });
  const rolledBack = await commandResult(page, () => restore.getByRole('button', { name: 'Restore version', exact: true }).click());
  expect(rolledBack.playbooks.find(item => item.status === 'approved')?.version).toBe(3);
  expect(rolledBack.playbooks.find(item => item.status === 'approved')?.body).toContain('owner-first');
});

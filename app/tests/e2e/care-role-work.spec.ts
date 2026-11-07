import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { CareCommand, CareRole, CareWorkspace } from '@glucoflow/contracts';
import { randomUUID } from 'node:crypto';
import { demoCredentials } from './helpers';

const api = `${process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787'}/api/v1`;
async function openRoleView(page: Page, role: CareRole, view = 'worklist') {
  const { email, password } = demoCredentials().accounts.clinic!;
  const signIn = await page.request.post(`${api}/auth/local-sign-in`, { data: { email, password } });
  expect(signIn.status()).toBe(200);
  const { accessToken } = await signIn.json() as { accessToken: string };
  const headers = { authorization: `Bearer ${accessToken}` };
  const me = await page.request.get(`${api}/me`, { headers });
  expect(me.status()).toBe(200);
  const { actor: { userId: actorId } } = await me.json();
  const created = await page.request.post(`${api}/care/workspaces`, { headers, data: {} });
  expect(created.status()).toBe(201);
  let workspace = await created.json() as CareWorkspace;
  const path = `${api}/care/workspaces/${workspace.id}`;
  if (role !== 'doctor') {
    const staffId = workspace.coordination!.staff.find(staff => staff.role === role)!.id;
    const changed = await page.request.post(`${path}/commands`, {
      headers: { ...headers, 'idempotency-key': randomUUID() },
      data: { expectedRevision: workspace.revision, command: { type: 'set_demo_staff', staffId } },
    });
    expect(changed.status()).toBe(200);
    workspace = await changed.json();
  }
  const commands: CareCommand[] = [];
  page.on('request', request => {
    if (request.url() === `${path}/commands` && request.method() === 'POST') commands.push(request.postDataJSON().command);
  });
  await page.addInitScript(({ accessToken, actorId, workspaceId }) => {
    localStorage.setItem('sutra.access-token', accessToken);
    sessionStorage.setItem(`glucoflow.care.workspace.${actorId}`, workspaceId);
  }, { accessToken, actorId, workspaceId: workspace.id });
  await page.goto(`/clinic/care?view=${view}`);
  const read = async () => (await (await page.request.get(path, { headers })).json()) as CareWorkspace;
  const post = async (command: CareCommand) => {
    const response = await page.request.post(`${path}/commands`, {
      headers: { ...headers, 'idempotency-key': randomUUID() },
      data: { expectedRevision: (await read()).revision, command },
    });
    expect(response.status()).toBe(200);
  };
  return { workspace, commands, read, post };
}

test('nurse sees a source-backed specimen exception and can soft-acknowledge without closure', async ({ page }) => {
  const { workspace, commands, read } = await openRoleView(page, 'nurse');
  const task = workspace.tasks[1]!;
  await expect(page.getByRole('heading', { name: 'My Shift', exact: true })).toBeVisible();
  const exception = page.getByRole('listitem').filter({ hasText: 'SIM-SPEC-102' });
  await expect(exception.getByText('Overdue', { exact: true })).toBeVisible();
  await exception.getByRole('button', { name: 'Soft acknowledge' }).click();
  const dialog = page.getByRole('dialog', { name: 'Soft acknowledge' });
  await dialog.getByLabel('Progress note').fill('Checking with specimen collection.');
  await dialog.getByRole('button', { name: 'Record acknowledgement' }).click();
  await expect(exception.getByText('Checking with specimen collection.', { exact: false })).toBeVisible();
  await expect(exception.getByText('Overdue', { exact: true })).toBeVisible();
  expect(commands).toEqual([{ type: 'soft_acknowledge_task', taskId: task.id, note: 'Checking with specimen collection.' }]);
  const saved = (await read()).tasks.find(item => item.id === task.id);
  expect(saved?.status).toBe('monitoring');
  expect(saved?.completionEventId).toBeNull();
});

test('lab separates expected and validated specimens from missing processing evidence', async ({ page }) => {
  const { workspace, post } = await openRoleView(page, 'lab');
  await expect(page.getByRole('heading', { name: 'Lab queue', exact: true })).toBeVisible();
  const expected = page.getByRole('listitem').filter({ hasText: 'SIM-SPEC-102' });
  await expect(expected.getByText('Expected', { exact: true })).toBeVisible();
  await expect(expected.getByText('Processing', { exact: true }).locator('..').getByText('Unverified', { exact: true })).toBeVisible();
  const validated = page.getByRole('listitem').filter({ hasText: 'SIM-SPEC-103' });
  await expect(validated.getByText('Validated', { exact: true })).toBeVisible();
  await expect(validated.getByText('Unverified', { exact: true })).toBeVisible();
  const order = workspace.orders[1]!;
  const collection = workspace.events.find(event => event.orderId === order.id && event.kind === 'specimen_collected')!;
  await post({ type: 'source_event', source: 'LIS', kind: 'specimen_received', encounterId: order.encounterId, orderId: order.id,
    occurredAt: new Date(Date.parse(collection.occurredAt) - 60_000).toISOString(), sourceRef: 'LIS-RECEIPT-BEFORE-COLLECTION' });
  await page.reload();
  await expect(expected.getByText('Receipt timestamp predates collection.', { exact: true })).toBeVisible();
  await expect(expected.getByText('Expected', { exact: true })).toBeVisible();
});

test('reviewed handover export and named receipt keep the exact saved version', async ({ page }) => {
  const { workspace, commands, read } = await openRoleView(page, 'doctor', 'teams');
  const nurses = workspace.coordination!.staff.filter(staff => staff.role === 'nurse');
  const handover = page.getByRole('region', { name: 'Shift handover', exact: true });
  await handover.getByRole('button', { name: 'Prepare handover' }).click();
  const composer = page.getByRole('dialog', { name: 'Prepare shift handover' });
  await composer.getByRole('checkbox', { name: /Dev Mehta/ }).check();
  await composer.getByRole('combobox', { name: 'Named recipient' }).click();
  await page.getByRole('option', { name: new RegExp(nurses[0]!.name) }).click();
  await composer.getByRole('button', { name: 'Create draft' }).click();
  await handover.getByRole('button', { name: 'Review v1' }).click();
  const dialog = page.getByRole('dialog', { name: /^(Review|Edit) handover v/ });
  await dialog.getByRole('button', { name: 'Edit draft' }).click();
  await dialog.getByLabel('Handover text').fill('Reviewed note for the evening shift.');
  await dialog.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('dialog', { name: 'Review handover v2' })).toBeVisible();
  await dialog.getByRole('button', { name: /HIS · Specimen collected/ }).click();
  const source = page.getByRole('dialog', { name: 'Source event', exact: true });
  await expect(source.getByText('HIS-SIM-2-specimen_collected', { exact: true })).toBeVisible();
  await source.getByRole('button', { name: 'Close', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export version JSON' }).click();
  const exported = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'));
  expect(exported.version).toMatchObject({ version: 2, body: 'Reviewed note for the evening shift.', recipientStaffId: nurses[0]!.id });
  expect(exported.version.items).toEqual(expect.arrayContaining([expect.objectContaining({
    encounterId: workspace.encounters[1]!.id, sourceRef: 'HIS-SIM-2-specimen_collected',
  })]));
  await dialog.getByRole('button', { name: 'Share in workspace' }).click();
  await expect(dialog.getByText('Shared', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit draft' }).click();
  await dialog.getByLabel('Handover text').fill('Unshared update.');
  await dialog.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('dialog', { name: 'Review handover v3' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();

  const switchPerson = async (id: string) => {
    await page.getByRole('button', { name: 'Switch demo person' }).click();
    await page.getByRole('combobox', { name: 'Demo person and role' }).selectOption(id);
    await expect(page.getByRole('dialog', { name: 'Try another perspective' })).toHaveCount(0);
  };
  await switchPerson(nurses[1]!.id);
  await expect(handover.getByRole('button', { name: 'Review v2' })).toHaveCount(0);
  await page.goto('/clinic/care');
  const incoming = page.getByRole('button', { name: /Review shift handover v2/ });
  await expect(incoming).toHaveCount(0);
  await switchPerson(nurses[0]!.id);
  await incoming.click();
  await expect(page.getByRole('dialog', { name: 'Review handover v2' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.goto('/clinic/care?view=worklist');
  await expect(page.getByRole('heading', { name: 'Handover receipts' })).toBeVisible();
  await page.getByRole('button', { name: 'Review v2' }).click();
  await expect(page.getByRole('dialog', { name: 'Review handover v2' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Acknowledge receipt of v2' }).click();
  await expect(dialog.getByText('Receipt recorded', { exact: true })).toBeVisible();
  expect(commands.at(-1)).toMatchObject({ type: 'handover_document', action: 'receive', expectedVersion: 2 });
  const saved = await read();
  expect(saved.handoverDocuments?.[0]?.versions[1]?.receivedBy?.id).toBe(nurses[0]!.id);
  expect(saved.handoverDocuments?.[0]?.versions[2]?.receivedAt).toBeUndefined();
  expect(saved.encounters[1]!.assignedTo).toBe('Dr Mira Rao');
  await page.goto('/clinic/care?view=worklist');
  await expect(page.getByRole('heading', { name: 'My Shift' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Handover receipts' })).toHaveCount(0);
});

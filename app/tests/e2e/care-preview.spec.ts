import { expect, test, type Page } from '@playwright/test';
import type { CareRole } from '@glucoflow/contracts';
import { seedCareWorkspace } from '../../apps/api/src/care/seed';

const actorId = 'e920b402-b68d-47dd-8bbb-5ee3fa63fa3d';
const headers = { 'access-control-allow-origin': '*' };

async function openRoleView(page: Page, role: CareRole, view = 'worklist') {
  const workspace = seedCareWorkspace(new Date());
  workspace.role = role;
  workspace.demoStaffId = workspace.coordination?.staff.find(staff => staff.role === role)?.id;
  await page.addInitScript(({ actorId, workspaceId }) => {
    localStorage.setItem('sutra.access-token', 'fixture-token');
    sessionStorage.setItem(`glucoflow.care.workspace.${actorId}`, workspaceId);
  }, { actorId, workspaceId: workspace.id });
  await page.route('**/api/v1/config', route => route.fulfill({
    headers, json: { appEnv: 'local', authMode: 'local', demoLabel: 'Synthetic data' },
  }));
  await page.route('**/api/v1/me', route => route.fulfill({
    headers, json: {
      actor: { userId: actorId, displayName: 'Fixture user', email: 'fixture@example.invalid', demoMode: true },
      contexts: [{ kind: 'clinic', clinicId: 'fixture', clinicName: 'Fixture Clinic' }],
      capabilities: { canReview: false },
      extraction: { mode: 'fixture', label: 'Fixture extraction' }, storage: { mode: 'local' },
    },
  }));
  await page.route('**/api/v1/hospitals', route => route.fulfill({ headers, json: { hospitals: [] } }));
  await page.route('**/api/v1/care/runtime', route => route.fulfill({
    headers, json: { available: false, engine: 'hermes', version: 'fixture', configured: false, model: null },
  }));
  await page.route(`**/api/v1/care/workspaces/${workspace.id}`, route => route.fulfill({ headers, json: workspace }));
  await page.route(`**/api/v1/care/workspaces/${workspace.id}/team`, route => route.fulfill({
    headers, json: { access: { ownerId: actorId, role: null, shared: false }, members: [] },
  }));
  await page.route('**/api/v1/speech/capabilities', route => route.fulfill({headers,json:{enabled:false}}));
  await page.goto(`/clinic/care?view=${view}`);
  return workspace;
}

test('appointment approval resets after every detail change and unit preview stays illustrative', async ({ page }) => {
  const workspace = await openRoleView(page, 'doctor', 'ask');
  await page.locator('summary[aria-label="Workspace menu"]').click();
  await page.getByRole('button', { name: 'Appointment preview', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Appointment message', exact: true });
  await dialog.getByLabel('Appointment date and time').fill('2026-11-08T10:30');
  await dialog.getByLabel('Clinic location').fill('Synthetic clinic desk');
  const approve = dialog.getByRole('button', { name: 'Approve demo preview' });
  const approved = dialog.getByRole('status');
  await approve.click();
  await expect(approved).toContainText('No message sent');
  await dialog.getByLabel('Clinic location').fill('Synthetic clinic desk B');
  await expect(approved).toHaveCount(0);
  await approve.click();
  await dialog.getByLabel('Appointment date and time').fill('2026-11-08T11:30');
  await expect(approved).toHaveCount(0);
  await approve.click();
  await dialog.getByLabel('Synthetic recipient').click();
  await page.getByRole('option', { name: `${workspace.encounters[1]!.patientName} · ${workspace.encounters[1]!.patientCode}`, exact: true }).click();
  await expect(approved).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('summary[aria-label="Workspace menu"]').click();
  await page.getByRole('button', { name: 'Unit workload preview', exact: true }).click();
  const unit = page.getByRole('dialog', { name: 'Unit workload preview', exact: true });
  await expect(unit.getByText('Static synthetic example', { exact: true })).toBeVisible();
  await expect(unit.getByText('Emergency', { exact: true })).toBeVisible();
  await expect(unit.getByText('Diabetes ward', { exact: true })).toBeVisible();
  await expect(unit.getByText('ICU', { exact: true })).toBeVisible();
  await expect(unit).toBeVisible();
  await page.screenshot({path: `reports/completion-evidence/unit-preview-${test.info().project.name}.png`, fullPage: true});
});

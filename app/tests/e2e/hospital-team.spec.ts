import { expect, test, type Page } from '@playwright/test';

const clinicId = 'e5b22437-9e04-402d-a6b0-e2c065697f7e';
const adminId = 'f53bcf43-49b4-48be-a7db-f85c8ed4e4eb';
const nurseId = '56fc423a-b864-4ff0-93f6-ac84b13a23ea';

async function mockHospitalSession(page: Page, administrator: boolean) {
  await page.addInitScript(() => localStorage.setItem('sutra.access-token', 'fixture-token'));
  const headers = { 'access-control-allow-origin': '*' };
  await page.route('**/api/v1/config', route => route.fulfill({
    headers, json: { appEnv: 'local', authMode: 'local', demoLabel: 'Synthetic data' },
  }));
  await page.route('**/api/v1/me', route => route.fulfill({
    headers,
    json: {
      actor: { userId: administrator ? adminId : nurseId, displayName: 'Fixture user', email: 'viewer@example.invalid', demoMode: false },
      contexts: [],
      capabilities: { canReview: false },
      extraction: { mode: 'fixture', label: 'Fixture extraction' },
      storage: { mode: 'local' },
    },
  }));
  await page.route('**/api/v1/hospitals', route => route.fulfill({
    headers,
    json: { hospitals: [{ clinicId, displayName: 'Fixture Hospital', administrator, careRole: administrator ? null : 'nurse' }] },
  }));
  const member = {
    userId: nurseId, displayName: 'Sam Fixture', email: administrator ? 'sam@example.invalid' : null,
    administrator: false, careRole: administrator ? null : 'nurse', clinician: false, active: !administrator,
  };
  await page.route(`**/api/v1/hospitals/${clinicId}/staff`, route => route.fulfill({
    headers, json: { members: [member], nextCursor: null },
  }));
  const events: object[] = [];
  await page.route(`**/api/v1/hospitals/${clinicId}/audit`, route => route.fulfill({
    headers, json: { events, nextCursor: null },
  }));
  await page.route(`**/api/v1/hospitals/${clinicId}/staff/${nurseId}`, route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({
      status: 204, headers: {
        ...headers, 'access-control-allow-methods': 'PATCH', 'access-control-allow-headers': 'authorization, content-type',
      },
    });
    const current = route.request().postDataJSON();
    events.unshift({
      id: String(events.length + 1), actorId: adminId, targetUserId: nurseId, at: '2026-11-07T12:00:00Z',
      previous: { administrator: member.administrator, careRole: member.careRole, active: member.active }, current,
    });
    Object.assign(member, current);
    return route.fulfill({ headers, json: member });
  });
}

test('an administrator activates a provisioned account and confirms revocation', async ({ page }) => {
  await mockHospitalSession(page, true);
  await page.goto('/account');
  await page.getByRole('link', { name: 'Hospital team' }).click();
  await expect(page.getByRole('heading', { name: 'Hospital team' })).toBeVisible();
  await expect(page.getByText('sam@example.invalid')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shared workspaces' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Manage Sam Fixture' }).click();
  const role = page.getByRole('combobox', { name: 'Care role' });
  await expect(role.getByRole('option', { name: 'Doctor', exact: true })).toBeDisabled();
  await role.selectOption('nurse');
  const activate = page.waitForRequest(request => request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Activate access' }).click();
  expect((await activate).postDataJSON()).toEqual({ administrator: false, careRole: 'nurse', active: true, expectedAssignment: { administrator: false, careRole: null, active: false } });
  await expect(page.getByRole('status')).toHaveText('Hospital access activated.');
  await page.getByRole('button', { name: 'Manage Sam Fixture' }).click();
  await page.getByRole('button', { name: 'Revoke access' }).click();
  await expect(page.getByRole('heading', { name: 'Revoke access for Sam Fixture?' })).toBeVisible();
  const revoke = page.waitForRequest(request => request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Confirm revocation' }).click();
  expect((await revoke).postDataJSON()).toEqual({ administrator: false, careRole: 'nurse', active: false, expectedAssignment: { administrator: false, careRole: 'nurse', active: true } });
  await expect(page.getByRole('status')).toHaveText('Hospital access revoked.');
  await page.getByText('Access history', { exact: true }).click();
  await expect(page.getByText('Saved · Inactive · Nurse')).toBeVisible();
});

test('staff see assigned roles and the shared workspace entry without admin controls', async ({ page }) => {
  await mockHospitalSession(page, false);
  await page.goto('/account');
  await page.getByRole('link', { name: 'Hospital team' }).click();
  const staff = page.getByRole('listitem').filter({ hasText: 'Sam Fixture' });
  await expect(staff.getByText('Nurse', { exact: true })).toBeVisible();
  await expect(staff.getByRole('button', { name: /Manage/ })).toHaveCount(0);
  await expect(staff.getByText(/@example/)).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Records', exact: true })).toHaveCount(0);
  await page.route('**/api/v1/care/runtime', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    json: { available: false, engine: 'hermes', version: 'fixture', model: null, configured: false },
  }));
  await page.route('**/api/v1/care/workspaces', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    json: { workspaces: [], nextCursor: null },
  }));
  await page.getByRole('link', { name: 'Shared workspaces' }).click();
  await expect(page).toHaveURL(/\/clinic\/care\?workspaces=shared/);
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Saved workspaces', exact: true }).first()).toBeVisible();
});

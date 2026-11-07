import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { CareCommand, CareRole, CareWorkspace } from '@glucoflow/contracts';
import { createAppContext } from '../../apps/api/src/context';
import { signLocalToken } from '../../apps/api/src/auth';
import { createTestContext } from '../integration/harness';

const api = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787';
const roles = ['coordinator', 'doctor', 'nurse', 'lab'] as const;
type Role = typeof roles[number];

test('separate authenticated staff progress source work and receive a named handover', async ({ browser }) => {
  test.setTimeout(90_000);
  const db = await createTestContext();
  const app = await createAppContext();
  const clinicId = randomUUID();
  const ids = Object.fromEntries(roles.map(role => [role, randomUUID()])) as Record<Role, string>;
  const contexts: BrowserContext[] = [];
  const pages = {} as Record<Role, Page>;
  const tokens = {} as Record<Role, string>;
  let workspace!: CareWorkspace;
  try {
    await db.owner(async client => {
      await client.query('insert into sutra.clinics(id,display_name,hospital_managed) values($1,$2,true)', [clinicId, 'Synthetic browser hospital']);
      for (const role of roles) {
        const email = `${ids[role]}@example.invalid`;
        await client.query('insert into sutra.app_users(id,email,display_name) values($1,$2,$3)', [ids[role], email, `Synthetic ${role}`]);
        await client.query('insert into sutra.memberships(clinic_id,user_id,care_role,clinician,active) values($1,$2,$3,$4,true)', [clinicId, ids[role], role, role === 'doctor']);
        tokens[role] = (await signLocalToken(app.config, { userId: ids[role], email })).accessToken;
      }
    });
    for (const role of roles) {
      const context = await browser.newContext({ viewport: test.info().project.use.viewport || { width: 1440, height: 900 } }); contexts.push(context);
      const page = await context.newPage(); pages[role] = page;
    }
    const headers = (role: Role) => ({ authorization: `Bearer ${tokens[role]}`, 'idempotency-key': randomUUID() });
    const created = await pages.coordinator.request.post(`${api}/api/v1/care/workspaces`, { headers: headers('coordinator'), data: { clinicId } });
    expect(created.status(), await created.text()).toBe(201);
    workspace = await created.json();
    const base = `${api}/api/v1/care/workspaces/${workspace.id}`;
    for (const role of ['doctor', 'nurse', 'lab'] as const) {
      const enrolled = await pages.coordinator.request.post(`${base}/team`, { headers: headers('coordinator'), data: { userId: ids[role], role, active: true } });
      expect(enrolled.status(), await enrolled.text()).toBe(200);
    }
    const apply = async (role: Role, command: CareCommand, expected = 200) => {
      const response = await pages[role].request.post(`${base}/commands`, { headers: headers(role), data: { expectedRevision: workspace.revision, command } });
      expect(response.status(), await response.text()).toBe(expected);
      if (expected === 200) workspace = await response.json();
      return response;
    };
    for (const role of ['doctor', 'nurse', 'lab'] as const) {
      await apply('coordinator', { type: 'coordination', action: 'register_staff', userId: ids[role], name: `Synthetic ${role}`, team: `Synthetic ${role} team`, role: role as CareRole,
        capabilities: role === 'doctor' ? ['handover','result_followup'] : ['specimen_followup'], shiftEnd: new Date(Date.now() + 3_600_000).toISOString() });
    }
    for (const role of roles) {
      await pages[role].addInitScript(({ token, actorId, workspaceId }) => {
        localStorage.setItem('sutra.access-token', token);
        sessionStorage.setItem(`glucoflow.care.workspace.${actorId}`, workspaceId);
      }, { token: tokens[role], actorId: ids[role], workspaceId: workspace.id });
      await pages[role].goto('/clinic/care?view=ask');
      await expect(pages[role].getByRole('heading', { name: `${role === 'lab' ? 'Lab staff' : `${role[0]!.toUpperCase()}${role.slice(1)}`} care desk` })).toBeVisible();
    }
    const order = workspace.orders[0]!;
    const baseEvent = { type: 'source_event', encounterId: order.encounterId, orderId: order.id } as const;
    await apply('lab', { ...baseEvent, kind: 'specimen_collected', source: 'HIS', sourceRef: 'SYNTHETIC-WRONG-ROLE' }, 403);
    const emit = async (role: Role, kind: string, ref: string) => {
      const page = pages[role];
      await page.goto('/clinic/care?view=ask');
      await page.locator('summary[aria-label="Workspace menu"]').click();
      await page.getByRole('button', { name: 'Demo controls', exact: true }).click();
      const simulator = page.locator('#care-simulator');
      await expect(simulator).toBeVisible();
      if (!(await simulator.evaluate(el => el.hasAttribute('open')))) await simulator.locator('summary').click();
      await expect(page.getByLabel('Assigned team role')).toBeDisabled();
      await page.getByLabel('Encounter', { exact: true }).click();
      await page.getByRole('option', { name: new RegExp(workspace.encounters[0]!.patientName) }).click();
      const labels: Record<string, string> = { specimen_collected: 'Specimen collected', specimen_received: 'Specimen received', result_validated: 'Result validated', result_acknowledged: 'Result acknowledged' };
      await page.getByLabel('Event type').click();
      await page.getByRole('option', { name: new RegExp(labels[kind]!) }).click();
      await page.getByLabel('Order', { exact: true }).click();
      await page.getByRole('option', { name: new RegExp(order.specimenId) }).click();
      await page.getByLabel('Source reference (optional)').fill(ref);
      await page.getByRole('button', { name: 'Emit synthetic event' }).click();
      await expect(simulator.getByRole('status')).toContainText('recorded');
      const latest = await page.request.get(base, { headers: headers(role) });
      workspace = await latest.json();
    };
    await emit('nurse', 'specimen_collected', 'SYNTHETIC-COLLECTION');
    await emit('lab', 'specimen_received', 'SYNTHETIC-RECEIPT');
    await emit('lab', 'result_validated', 'SYNTHETIC-VALIDATION');
    await apply('lab', { ...baseEvent, kind: 'result_acknowledged', source: 'HIS', sourceRef: 'SYNTHETIC-WRONG-ACK' }, 403);
    await emit('doctor', 'result_acknowledged', 'SYNTHETIC-ACK');
    expect(workspace.events.filter(event => event.orderId === order.id).map(event => event.sourceRef)).toEqual(expect.arrayContaining([
      'SYNTHETIC-COLLECTION', 'SYNTHETIC-RECEIPT', 'SYNTHETIC-VALIDATION', 'SYNTHETIC-ACK',
    ]));
    await apply('lab', { type: 'set_role', role: 'doctor' }, 403);
    const recipient = workspace.coordination!.staff.find(person => person.userId === ids.nurse)!;
    const assignedTo = workspace.encounters[1]!.assignedTo;
    await pages.doctor.goto('/clinic/care?view=teams');
    const doctorHandover = pages.doctor.getByRole('region', { name: 'Shift handover' });
    await doctorHandover.getByRole('button', { name: 'Prepare handover' }).click();
    const composer = pages.doctor.getByRole('dialog', { name: 'Prepare shift handover' });
    await composer.getByRole('checkbox', { name: /Dev Mehta/ }).check();
    await composer.getByLabel('Named recipient').click();
    await pages.doctor.getByRole('option', { name: /Synthetic nurse/ }).click();
    await composer.getByRole('button', { name: 'Create draft' }).click();
    await doctorHandover.getByRole('button', { name: 'Review v1' }).click();
    const review = pages.doctor.getByRole('dialog', { name: 'Review handover v1' });
    await review.getByRole('button', { name: 'Share in workspace' }).click();
    await expect(review.getByText('Shared', { exact: true })).toBeVisible();
    await review.getByRole('button', { name: 'Close', exact: true }).click();
    workspace = await (await pages.doctor.request.get(base, { headers: headers('doctor') })).json();
    const document = workspace.handoverDocuments!.at(-1)!;
    expect(document.versions[0]!.recipientStaffId).toBe(recipient.id);
    await apply('lab', { type: 'handover_document', action: 'receive', documentId: document.id, expectedVersion: 1 }, 403);
    await pages.doctor.goto('/clinic/care?view=ask');
    const doctorSource = pages.doctor.getByRole('region', { name: 'Recent source events' }).getByRole('button', { name: /Clinician acknowledged the result/ });
    await doctorSource.click();
    const sourceDialog = pages.doctor.getByRole('dialog', { name: 'Source event' });
    await expect(sourceDialog.getByText('SYNTHETIC-ACK', { exact: true })).toBeVisible();
    await sourceDialog.getByRole('button', { name: 'Close' }).click();
    await pages.lab.goto('/clinic/care?view=worklist');
    await expect(pages.lab.getByRole('heading', { name: 'Lab queue', exact: true })).toBeVisible();
    const specimen = pages.lab.getByRole('listitem').filter({ hasText: order.specimenId });
    await expect(specimen.getByText('Validated', { exact: true })).toBeVisible();
    await expect(specimen.getByText('Unverified', { exact: true })).toBeVisible();
    await pages.coordinator.goto('/clinic/care?view=worklist');
    await expect(pages.coordinator.getByRole('heading', { name: 'Worklist', exact: true })).toBeVisible();
    await pages.nurse.goto('/clinic/care?view=ask');
    const nurse = pages.nurse;
    await expect(nurse.getByRole('button', { name: /Review shift handover v1/ })).toBeVisible();
    await expect(pages.lab.getByRole('button', { name: /Review shift handover v1/ })).toHaveCount(0);
    await nurse.getByRole('button', { name: /Review shift handover v1/ }).click();
    const dialog = nurse.getByRole('dialog', { name: 'Review handover v1' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Acknowledge receipt of v1' }).click();
    await expect(dialog.getByText('Receipt recorded', { exact: true })).toBeVisible();
    const reread = await pages.doctor.request.get(base, { headers: headers('doctor') });
    expect(reread.status()).toBe(200);
    const saved = await reread.json() as CareWorkspace;
    expect(saved.handoverDocuments!.at(-1)!.versions[0]!.receivedBy).toMatchObject({ id: ids.nurse, simulated: false });
    expect(saved.encounters[1]!.assignedTo).toBe(assignedTo);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await db.owner(async client => {
      await client.query('delete from sutra.clinics where id=$1', [clinicId]);
      await client.query('delete from sutra.app_users where id=any($1::uuid[])', [Object.values(ids)]);
    });
    await app.pool.end(); await db.close();
  }
});

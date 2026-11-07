import { expect, it } from 'vitest';
import type { CareEvent, CareStaff, CareTask, CareWorkspace } from '@glucoflow/contracts';
import { homeWork } from '../../apps/client/src/features/care/home-work';

const now = '2026-11-07T10:00:00.000Z';
const later = '2026-11-07T11:00:00.000Z';
const staff = (id: string, userId: string | null = null): CareStaff => ({
  id, userId, name: id, role: 'nurse', team: 'Nursing', capabilities: ['specimen_followup'], shiftEnd: later, capacity: null,
});
const task: CareTask = {
  id: 'task', encounterId: 'episode', orderId: 'order', kind: 'specimen_receipt', title: 'Check receipt', owner: 'Lab team',
  status: 'monitoring', createdAt: now, expiresAt: later, lastCheckedAt: null, completionEventId: null, playbookVersion: 1,
};
const placed: CareEvent = {
  id: 'placed', encounterId: 'episode', orderId: 'order', kind: 'order_placed', source: 'HIS', sourceRef: 'HIS-1',
  label: 'Order placed', occurredAt: now, receivedAt: now,
};

function workspace(): CareWorkspace {
  return {
    id: 'workspace', synthetic: true, revision: 1, role: 'nurse', name: 'Demo', createdAt: now, updatedAt: now,
    demoStaffId: 'Ravi', encounters: [{ id: 'episode', patientName: 'Synthetic patient', patientCode: 'D01', bed: 'Ward',
      documentedContext: [], admittedAt: now, assignedTo: 'Dr Rao' }],
    orders: [{ id: 'order', encounterId: 'episode', testName: 'Lab panel', specimenId: 'S01', createdAt: now, targetMinutes: 60 }],
    tasks: [task], events: [placed], activity: [], messages: [], playbooks: [],
    feeds: { HIS: { connected: true, lastSyncAt: now }, LIS: { connected: true, lastSyncAt: now } },
    coordination: { staff: [staff('Ravi'), staff('Anita'), staff('Anjali', 'authenticated-user')], handovers: [], records: [], assignments: [
      { id: 'live', taskId: task.id, staffId: 'Anita', status: 'offered', capability: 'specimen_followup', offeredAt: now, expiresAt: later, sourceRef: 'OFFER-1' },
      { id: 'expired', taskId: task.id, staffId: 'Ravi', status: 'offered', capability: 'specimen_followup', offeredAt: now, expiresAt: now, sourceRef: 'OFFER-2' },
      { id: 'shared', taskId: task.id, staffId: 'Anjali', status: 'offered', capability: 'specimen_followup', offeredAt: now, expiresAt: later, sourceRef: 'OFFER-3' },
    ] },
  };
}

it('prioritizes live offers for the selected demo person before role evidence', () => {
  const state = workspace();
  expect(homeWork(state, { shared: false }, now).items.map(item => item.id)).toEqual(['collection-order']);
  state.demoStaffId = 'Anita';
  expect(homeWork(state, { shared: false }, now).items.map(item => item.id)).toEqual(['live', 'collection-order']);
});

it('matches shared offers to the authenticated person and waits for resolved access', () => {
  const state = { ...workspace(), demoStaffId: 'Anita' };
  expect(homeWork(state, { actorId: 'authenticated-user' }, now).items.map(item => item.id)).toEqual(['collection-order']);
  expect(homeWork(state, { shared: true, actorId: 'authenticated-user' }, now).items.map(item => item.id)).toEqual(['shared', 'collection-order']);
});

it('selects role evidence from prerequisites and excludes cancelled orders', () => {
  const state = { ...workspace(), role: 'lab' as const };
  expect(homeWork(state, { shared: false }, now).items).toEqual([]);
  state.events.push({ ...placed, id: 'collected', kind: 'specimen_collected' });
  expect(homeWork(state, { shared: false }, now).items.map(item => item.id)).toEqual(['receipt-order']);
  state.events.push({ ...placed, id: 'cancelled', kind: 'order_cancelled' });
  expect(homeWork(state, { shared: false }, now).items).toEqual([]);
});

it('offers the exact pending shared handover version only to its named account', () => {
  const state = workspace();
  const author = { id: 'author', name: 'Dr Rao', role: 'doctor', simulated: false } as const;
  const version = {
    version: 1, body: 'Synthetic shift handover', recipientName: 'Anjali', recipientRole: 'nurse',
    recipientStaffId: 'Anjali', recipientUserId: 'authenticated-user', preparedBy: author, preparedAt: now, items: [],
  } as const;
  state.handoverDocuments = [{
    id: 'document', encounterIds: ['episode'], createdBy: author, createdAt: now,
    versions: [
      { ...version, items: [], sharedAt: now, receivedAt: now },
      { ...version, items: [], version: 2, sharedAt: now },
      { ...version, items: [], version: 3 },
    ],
  }];
  const named = homeWork(state, { shared: true, actorId: 'authenticated-user' }, now);
  expect(named.items.filter(item => item.target.kind === 'handover').map(item => item.target)).toEqual([
    { kind: 'handover', id: 'document', version: 2 },
  ]);
  for (const access of [{ shared: false }, { shared: true, actorId: 'another-nurse' }]) {
    expect(homeWork(state, access, now).items.some(item => item.target.kind === 'handover')).toBe(false);
  }
});

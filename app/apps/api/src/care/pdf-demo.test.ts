import { expect, it } from 'vitest';
import type { CareShiftScope, CareStaff } from '@glucoflow/contracts';
import { executeCareCommand } from './commands';
import { reconcileCareWorkspace } from './monitor';
import { seedCareWorkspace } from './seed';

const at = '2026-11-07T12:00:00.000Z';
const minute = (n: number) => new Date(Date.parse(at) + n * 60_000).toISOString();

function monitoringFixture() {
  const state = seedCareWorkspace(new Date(at));
  const order = state.orders[2]!;
  const staff = state.coordination!.staff;
  const scope: CareShiftScope = {
    encounterIds: [order.encounterId], rule: 'validated_result_acknowledgement', sources: ['HIS', 'LIS'],
    recipientStaffIds: [staff.find((person) => person.role === 'lab')!.id], expiresAt: minute(10),
  };
  executeCareCommand(state, { type: 'shift_monitoring', action: 'create', scope }, at);
  const monitor = state.shiftMonitoring![0]!;
  const approve = (time = at) => executeCareCommand(state,
    { type: 'shift_monitoring', action: 'approve', monitorId: monitor.id, expectedVersion: monitor.version }, time);
  return { state, order, scope, monitor, approve };
}

it('starts fixed source monitoring only after approval, preserves individual task identity, and reopens for corrected results', () => {
  const { state, order, monitor, approve } = monitoringFixture();
  const oldTaskIds = state.tasks.map((task) => task.id);
  reconcileCareWorkspace(state, at);
  expect(monitor.items).toEqual([]);
  approve();
  reconcileCareWorkspace(state, at);
  const task = state.tasks.find((item) => item.orderId === order.id)!;
  expect(monitor.items).toEqual([{
    encounterId: order.encounterId, orderId: order.id, status: 'pending', lastCheckedAt: at,
    sourceEventId: state.events.at(-1)!.id, existingTaskId: task.id,
  }]);
  executeCareCommand(state, { type: 'source_event', kind: 'result_acknowledged', ...{ encounterId: order.encounterId, orderId: order.id }, source: 'HIS', sourceRef: 'SIM-SHIFT-ACK' }, minute(1));
  reconcileCareWorkspace(state, minute(1));
  expect(monitor.items[0]).toMatchObject({ status: 'source_confirmed', sourceEventId: state.events.at(-1)!.id });
  executeCareCommand(state, { type: 'set_role', role: 'lab' }, minute(2));
  executeCareCommand(state, { type: 'source_event', kind: 'result_corrected', encounterId: order.encounterId, orderId: order.id, source: 'LIS', sourceRef: 'SIM-SHIFT-CORRECTED' }, minute(2));
  reconcileCareWorkspace(state, minute(2));
  expect(monitor.items[0]).toMatchObject({ status: 'pending', sourceEventId: state.events.at(-1)!.id });
  executeCareCommand(state, { type: 'set_feed', source: 'HIS', connected: false }, minute(3));
  reconcileCareWorkspace(state, minute(3));
  expect(monitor.items[0]).toMatchObject({ status: 'source_unknown', lastCheckedAt: minute(3) });
  expect(state.tasks.map((item) => item.id)).toEqual(oldTaskIds);
});

it('pauses checks, makes scope edits require fresh approval, and refuses overlapping active groups', () => {
  const { state, monitor, scope, approve } = monitoringFixture();
  approve();
  reconcileCareWorkspace(state, at);
  const otherDoctor = state.coordination!.staff.filter((person) => person.role === 'doctor')[1]!;
  executeCareCommand(state, { type: 'set_demo_staff', staffId: otherDoctor.id }, minute(1));
  expect(() => executeCareCommand(state,
    { type: 'shift_monitoring', action: 'pause', monitorId: monitor.id, expectedVersion: 1 }, minute(1))).toThrow('Only the named creator');
  executeCareCommand(state, { type: 'shift_monitoring', action: 'create', scope }, minute(1));
  const overlap = state.shiftMonitoring![1]!;
  expect(() => executeCareCommand(state,
    { type: 'shift_monitoring', action: 'approve', monitorId: overlap.id, expectedVersion: 1 }, minute(1))).toThrow('already monitored');
  executeCareCommand(state, { type: 'set_demo_staff', staffId: monitor.createdBy.id }, minute(1));
  executeCareCommand(state, { type: 'shift_monitoring', action: 'pause', monitorId: monitor.id, expectedVersion: 1 }, minute(1));
  reconcileCareWorkspace(state, minute(2));
  expect(monitor.items[0]?.lastCheckedAt).toBe(at);
  executeCareCommand(state, { type: 'shift_monitoring', action: 'edit', monitorId: monitor.id, expectedVersion: 1,
    scope: { ...scope, encounterIds: [state.encounters[1]!.id] } }, minute(2));
  expect(monitor).toMatchObject({ status: 'awaiting_approval', version: 2, items: [] });
  expect(monitor.approvedAt).toBeUndefined();
  expect(() => executeCareCommand(state,
    { type: 'shift_monitoring', action: 'approve', monitorId: monitor.id, expectedVersion: 1 }, minute(2))).toThrow('scope changed');
  approve(minute(2));
  expect(monitor).toMatchObject({ status: 'monitoring', approvedBy: monitor.createdBy, approvedAt: minute(2) });
  executeCareCommand(state, { type: 'shift_monitoring', action: 'stop', monitorId: monitor.id, expectedVersion: 2 }, minute(3));
  expect(monitor.status).toBe('stopped');
});

it('expires once and does not credit evidence received after the absolute deadline', () => {
  const { state, order, monitor, approve } = monitoringFixture();
  approve();
  reconcileCareWorkspace(state, at);
  executeCareCommand(state, { type: 'source_event', kind: 'result_acknowledged', encounterId: order.encounterId, orderId: order.id,
    source: 'HIS', sourceRef: 'SIM-POST-SHIFT-ACK' }, minute(11));
  reconcileCareWorkspace(state, minute(11));
  expect(monitor.status).toBe('expired');
  expect(monitor.items[0]?.status).not.toBe('source_confirmed');
  expect(monitor.items[0]?.sourceEventId).not.toBe(state.events.at(-1)!.id);
  reconcileCareWorkspace(state, minute(12));
  expect(state.activity.filter((entry) => entry.kind === 'shift_monitor_expired')).toHaveLength(1);
});

it('records soft acknowledgement by a nurse without a task, owner, order or source transition', () => {
  const state = seedCareWorkspace(new Date(at));
  const task = state.tasks[1]!;
  const { status, owner, completionEventId } = task;
  const eventIds = state.events.map((event) => event.id);
  const command = { type: 'soft_acknowledge_task', taskId: task.id, note: 'Following up with the lab.' } as const;
  expect(() => executeCareCommand(state, command, at)).toThrow();
  executeCareCommand(state, { type: 'set_role', role: 'nurse' }, at);
  expect(executeCareCommand(state, command, at)).toBe(true);
  expect(executeCareCommand(state, command, at)).toBe(false);
  expect(task).toMatchObject({ status, owner, completionEventId,
    softAcknowledgements: [{ actor: { id: state.demoStaffId, role: 'nurse' }, at, note: command.note }],
  });
  expect(state.events.map((event) => event.id)).toEqual(eventIds);
  expect(() => executeCareCommand(state, { ...command, taskId: state.tasks[2]!.id }, at)).toThrow('work offered to you');
});

it('preserves the editable handover versions and binds an earlier shared version receipt to the named account', () => {
  const state = seedCareWorkspace(new Date(at));
  const doctor = { shared: true, actorId: 'doctor-account', displayName: 'Author' };
  const first: CareStaff = { ...state.coordination!.staff.find((person) => person.role === 'nurse')!, id: 'first-nurse', userId: 'first-account' };
  const second: CareStaff = { ...first, id: 'second-nurse', userId: 'second-account' };
  state.coordination!.staff.push(first, second);
  const owner = state.encounters[1]!.assignedTo;
  executeCareCommand(state, { type: 'handover_document', action: 'create',
    encounterIds: [state.encounters[1]!.id], recipientStaffId: first.id }, at, doctor);
  const document = state.handoverDocuments![0]!;
  const version1 = document.versions[0]!;
  expect(version1.items).toContainEqual(expect.objectContaining({ owner: 'Lab team', sourceRef: expect.stringContaining('specimen_collected') }));
  executeCareCommand(state, { type: 'handover_document', action: 'share', documentId: document.id, expectedVersion: 1 }, minute(1), doctor);
  executeCareCommand(state, { type: 'handover_document', action: 'edit', documentId: document.id, expectedVersion: 1,
    body: 'Reviewed operational notes for the second shift.', recipientStaffId: second.id }, minute(2), doctor);
  expect(document.versions[0]).toMatchObject({ version: 1, sharedAt: minute(1) });
  expect(document.versions[1]).toMatchObject({ version: 2, recipientStaffId: second.id, items: version1.items });
  expect(document.versions[1]?.sharedAt).toBeUndefined();
  expect(() => executeCareCommand(state, { type: 'handover_document', action: 'share', documentId: document.id, expectedVersion: 1 },
    minute(3), doctor)).toThrow('draft changed');
  state.role = 'nurse';
  const receive = { type: 'handover_document', action: 'receive', documentId: document.id, expectedVersion: 1 } as const;
  expect(() => executeCareCommand(state, receive, minute(3),
    { shared: true, actorId: second.userId!, displayName: second.name })).toThrow('Only the named recipient');
  const recipient = { shared: true, actorId: first.userId!, displayName: first.name };
  expect(executeCareCommand(state, receive, minute(3), recipient)).toBe(true);
  expect(executeCareCommand(state, receive, minute(3), recipient)).toBe(false);
  expect(version1).toMatchObject({ receivedAt: minute(3), receivedBy: { id: first.userId, role: 'nurse' } });
  expect(document.versions[1]?.receivedAt).toBeUndefined();
  expect(state.encounters[1]!.assignedTo).toBe(owner);
  expect(state.tasks[1]!.owner).toBe('Lab team');
});

it('retains a receipt before collection without confirming either kind of monitoring', () => {
  const state = seedCareWorkspace(new Date(at));
  const order = state.orders[1]!;
  const task = state.tasks.find((item) => item.orderId === order.id)!;
  const lab = state.coordination!.staff.find((person) => person.role === 'lab')!;
  const scope: CareShiftScope = {
    encounterIds: [order.encounterId], rule: 'specimen_receipt', sources: ['HIS', 'LIS'],
    recipientStaffIds: [lab.id], expiresAt: minute(10),
  };
  executeCareCommand(state, { type: 'shift_monitoring', action: 'create', scope }, at);
  const monitor = state.shiftMonitoring![0]!;
  executeCareCommand(state, { type: 'shift_monitoring', action: 'approve', monitorId: monitor.id, expectedVersion: 1 }, at);
  reconcileCareWorkspace(state, at);
  executeCareCommand(state, { type: 'set_demo_staff', staffId: lab.id }, minute(1));
  const receipt = { type: 'source_event', kind: 'specimen_received', encounterId: order.encounterId, orderId: order.id,
    source: 'LIS', sourceRef: 'SIM-PREMATURE-RECEIPT', occurredAt: minute(-72) } as const;
  executeCareCommand(state, receipt, minute(1));
  reconcileCareWorkspace(state, minute(1));
  const raw = state.events.at(-1)!;
  expect(raw.sourceRef).toBe(receipt.sourceRef);
  expect(state.activity.some((entry) => entry.kind === 'source_sequence_gap')).toBe(true);
  expect(monitor.items[0]).toMatchObject({ status: 'source_unknown', sourceEventId: raw.id });
  expect(task).toMatchObject({ status: 'awaiting_evidence', completionEventId: null });
});

it('confirms delayed collection evidence when occurrence precedes the already recorded receipt', () => {
  const state = seedCareWorkspace(new Date(at));
  const order = state.orders[0]!;
  const task = state.tasks.find((item) => item.orderId === order.id)!;
  const lab = state.coordination!.staff.find((person) => person.role === 'lab')!;
  const scope: CareShiftScope = {
    encounterIds: [order.encounterId], rule: 'specimen_receipt', sources: ['HIS', 'LIS'],
    recipientStaffIds: [lab.id], expiresAt: minute(10),
  };
  executeCareCommand(state, { type: 'task_action', taskId: task.id, action: 'approve' }, at);
  executeCareCommand(state, { type: 'shift_monitoring', action: 'create', scope }, at);
  const monitor = state.shiftMonitoring![0]!;
  executeCareCommand(state, { type: 'shift_monitoring', action: 'approve', monitorId: monitor.id, expectedVersion: 1 }, at);
  executeCareCommand(state, { type: 'set_demo_staff', staffId: lab.id }, minute(1));
  executeCareCommand(state, { type: 'source_event', kind: 'specimen_received', encounterId: order.encounterId, orderId: order.id,
    source: 'LIS', sourceRef: 'SIM-RECEIPT-BEFORE-ARRIVAL', occurredAt: at }, minute(1));
  const raw = state.events.at(-1)!;
  reconcileCareWorkspace(state, minute(1));
  expect(task).toMatchObject({ status: 'awaiting_evidence', completionEventId: null });
  expect(monitor.items[0]).toMatchObject({ status: 'source_unknown', sourceEventId: raw.id });
  executeCareCommand(state, { type: 'set_role', role: 'nurse' }, minute(2));
  executeCareCommand(state, { type: 'source_event', kind: 'specimen_collected', encounterId: order.encounterId, orderId: order.id,
    source: 'HIS', sourceRef: 'SIM-DELAYED-COLLECTION', occurredAt: minute(-1) }, minute(2));
  reconcileCareWorkspace(state, minute(2));
  expect(task).toMatchObject({ status: 'source_confirmed', completionEventId: raw.id });
  expect(monitor.items[0]).toMatchObject({ status: 'source_confirmed', sourceEventId: raw.id });
});

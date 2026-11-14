import { expect, it } from 'vitest';
import { executeCareCommand } from './commands';
import { reconcileCareWorkspace } from './monitor';
import { scenarioLibrary, seedCareWorkspace } from './seed';

const at = '2026-11-14T12:00:00.000Z';
const later = (n: number) => new Date(Date.parse(at) + n * 60_000).toISOString();

it('keeps the classic three-encounter seed unchanged by default', () => {
  const state = seedCareWorkspace(new Date(at));
  expect(state.encounters.map((item) => item.patientCode)).toEqual(['DEMO-101', 'DEMO-102', 'DEMO-103']);
  expect(state.tasks).toHaveLength(3);
});

it('seeds the showcase scenarios with unique identities and valid source chronology', () => {
  const state = seedCareWorkspace(new Date(at), 'showcase');
  expect(state.encounters).toHaveLength(3 + scenarioLibrary.length);
  expect(new Set(state.encounters.map((item) => item.patientCode)).size).toBe(state.encounters.length);
  expect(new Set(state.events.map((item) => `${item.source}:${item.sourceRef}`)).size).toBe(state.events.length);
  for (const order of state.orders) {
    const encounter = state.encounters.find((item) => item.id === order.encounterId)!;
    expect(order.createdAt >= encounter.admittedAt).toBe(true);
    const events = state.events.filter((item) => item.orderId === order.id);
    expect(events[0]?.kind).toBe('order_placed');
    for (const [index, event] of events.entries()) {
      expect(event.occurredAt >= order.createdAt && event.occurredAt <= at).toBe(true);
      if (index) expect(event.occurredAt >= events[index - 1]!.occurredAt).toBe(true);
    }
  }
  for (const task of state.tasks.filter((item) => item.status === 'source_confirmed')) {
    const event = state.events.find((item) => item.id === task.completionEventId);
    expect(event?.kind).toBe('result_acknowledged');
    expect(event!.occurredAt >= task.createdAt).toBe(true);
  }
});

it('does not silently settle showcase work at seed time', () => {
  const state = seedCareWorkspace(new Date(at), 'showcase');
  const before = state.tasks.map((task) => task.status);
  reconcileCareWorkspace(state, later(1));
  expect(state.tasks.map((task) => task.status)).toEqual(before);
});

it('closes work only when the matching source event arrives from the correct role', () => {
  const state = seedCareWorkspace(new Date(at), 'showcase');
  const corrected = state.encounters.find((item) => item.patientName === 'Vikram Singh')!;
  const order = state.orders.find((item) => item.encounterId === corrected.id)!;
  const task = state.tasks.find((item) => item.orderId === order.id)!;
  // The doctor acknowledges the corrected result version; the earlier acknowledgement did not count.
  executeCareCommand(state, {
    type: 'source_event', encounterId: corrected.id, orderId: order.id, kind: 'result_acknowledged', source: 'HIS',
    sourceRef: 'HIS-TEST-corrected-ack',
  }, later(2));
  reconcileCareWorkspace(state, later(2));
  expect(task.status).toBe('source_confirmed');

  const pending = state.encounters.find((item) => item.patientName === 'Ramesh Iyer')!;
  const receiptOrder = state.orders.find((item) => item.encounterId === pending.id)!;
  const receipt = { type: 'source_event', encounterId: pending.id, orderId: receiptOrder.id, kind: 'specimen_received', source: 'LIS', sourceRef: 'LIS-TEST-receipt' } as const;
  expect(() => executeCareCommand(state, receipt, later(3))).toThrow();
  const lab = state.coordination!.staff.find((person) => person.role === 'lab')!;
  executeCareCommand(state, { type: 'set_demo_staff', staffId: lab.id }, later(3));
  executeCareCommand(state, receipt, later(3));
  reconcileCareWorkspace(state, later(3));
  expect(state.tasks.find((item) => item.orderId === receiptOrder.id)!.status).toBe('source_confirmed');
});

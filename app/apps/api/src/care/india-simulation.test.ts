import { expect, it } from 'vitest';
import { runIndiaSimulation, indiaStrata } from '../../../../scripts/simulate-india-care';

it('replays a seeded multi-encounter cohort with identical non-UUID outcomes', () => {
  const a = runIndiaSimulation(104729, indiaStrata[0]!, 3);
  const b = runIndiaSimulation(104729, indiaStrata[0]!, 3);
  expect(a).toEqual(b);
  expect(a.arrivals).toBeGreaterThan(10);
  expect(a.failures).toEqual([]);
  expect(a.checks).toBeGreaterThan(100);
});
it.each(indiaStrata)('preserves source/approval boundaries under $name assumptions', (stratum) => {
  const result = runIndiaSimulation(130363, stratum, 7);
  expect(result.failures).toEqual([]);
  expect(result.duplicateNoops).toBeGreaterThan(0);
  expect(result.wrongRoleRejected).toBe(result.arrivals);
  expect(result.wrongEncounterRejected).toBe(result.arrivals);
  expect(Object.values(result.finalStatuses).reduce((a, b) => a + b, 0)).toBe(result.arrivals * 2);
});

import { seedCareWorkspace } from './seed';
import { executeCareCommand } from './commands';
import { reconcileCareWorkspace } from './monitor';
const at = '2026-11-07T12:00:00.000Z';

it('does not partially append an order when HIS is disconnected', () => {
  const state = seedCareWorkspace(new Date(at));
  executeCareCommand(state, { type: 'set_feed', source: 'HIS', connected: false }, at);
  const before = structuredClone(state);
  expect(() => executeCareCommand(state, { type: 'add_order', encounterId: state.encounters[0]!.id, testName: 'Synthetic panel', targetMinutes: 60 }, at)).toThrow();
  expect(state).toEqual(before);
});

it('rejects a real other encounter/order combination without mutation', () => {
  const state = seedCareWorkspace(new Date(at));
  executeCareCommand(state, { type: 'set_role', role: 'lab' }, at);
  const before = structuredClone(state);
  expect(() => executeCareCommand(state, { type: 'source_event', encounterId: state.encounters[0]!.id, orderId: state.orders[1]!.id, source: 'LIS', kind: 'specimen_received', sourceRef: 'SIM-WRONG-ENCOUNTER' }, at)).toThrow();
  expect(state).toEqual(before);
});

it('keeps stale feeds unknown and source absence separate from attestation', () => {
  const state = seedCareWorkspace(new Date(at));
  const task = state.tasks[1]!;
  reconcileCareWorkspace(state, '2026-11-07T12:16:00.000Z');
  expect(task.status).toBe('awaiting_evidence');
  expect(task.completionEventId).toBeNull();
  executeCareCommand(state, { type: 'task_action', taskId: task.id, action: 'attest', reason: 'Synthetic staff report only' }, '2026-11-07T12:17:00.000Z');
  reconcileCareWorkspace(state, '2026-11-07T12:18:00.000Z');
  expect(task.status).toBe('human_attested');
  expect(task.completionEventId).toBeNull();
});

it('rejects capacity-exhausted order creation without leaving an orphan order', () => {
  const state = seedCareWorkspace(new Date(at));
  while (state.events.length < 140) state.events.push({ ...state.events[0]!, id: `synthetic-capacity-${state.events.length}`, sourceRef: `SIM-CAPACITY-${state.events.length}` });
  const before = structuredClone(state);
  expect(() => executeCareCommand(state, { type: 'add_order', encounterId: state.encounters[0]!.id, testName: 'Synthetic capacity panel', targetMinutes: 60 }, at)).toThrow();
  expect(state).toEqual(before);
});

it('a single unrotated workspace reaches its documented cap during a 90-day attempt', () => {
  const state = seedCareWorkspace(new Date(at));
  let accepted = 0;
  let refused = 0;
  for (let day = 0; day < 90; day++) {
    const stamp = new Date(Date.parse(at) + day * 86_400_000).toISOString();
    const before = structuredClone(state);
    try {
      executeCareCommand(state, { type: 'add_encounter', patientName: `Synthetic day ${day}`, bed: `SIM-${day}`, documentedContext: ['Synthetic capacity exercise'] }, stamp);
      accepted++;
    } catch {
      refused++;
      expect(state).toEqual(before);
    }
  }
  expect(accepted).toBe(27);
  expect(refused).toBe(63);
  expect(state.encounters).toHaveLength(30);
});

import { expect, it } from 'vitest';
import { seedCareWorkspace } from './seed';
import { createCareTask, executeCareCommand } from './commands';
const at = '2026-11-07T12:00:00.000Z';
it('reuses seeded monitoring without changing approval, owner, expiry, revision or activity', () => {
  const state = seedCareWorkspace(new Date(at));
  const task = state.tasks[1]!;
  const before = JSON.stringify(state);
  const command = {type:'create_task', encounterId:task.encounterId, orderId:task.orderId, kind:task.kind, title:'Repeated request', durationMinutes:10} as const;
  expect(createCareTask(state, command, at)).toBe(task);
  expect(executeCareCommand(state, command, at)).toBe(false);
  expect(JSON.stringify(state)).toBe(before);
});
it('still creates a fresh approval request after cancellation', () => {
  const state = seedCareWorkspace(new Date(at)); const task = state.tasks[1]!;
  task.status = 'cancelled';
  const result = createCareTask(state, {type:'create_task',encounterId:task.encounterId,orderId:task.orderId,kind:task.kind,title:'Restart follow-up',durationMinutes:10}, at);
  expect(result.id).not.toBe(task.id); expect(result.status).toBe('awaiting_approval');
});

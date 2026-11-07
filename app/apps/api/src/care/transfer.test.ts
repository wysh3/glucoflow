import { expect, it } from 'vitest';
import { seedCareWorkspace } from './seed';
import { executeCareCommand } from './commands';
const at = '2026-11-07T12:00:00.000Z';
it('retains responsibility until receiving role accepts and never marks the task complete', () => {
  const state = seedCareWorkspace(new Date(at));
  const task = state.tasks[1]!;
  const owner = task.owner;
  executeCareCommand(state, { type: 'request_transfer', taskId: task.id, owner: 'Evening lab team', role: 'lab', reason: 'Shift change' }, at);
  expect(task.owner).toBe(owner);
  expect(task.transfer?.status).toBe('pending');
  expect(() => executeCareCommand(state, {type:'resolve_transfer',taskId:task.id,decision:'accept'},at)).toThrow();
  state.role = 'lab';
  executeCareCommand(state, {type:'resolve_transfer',taskId:task.id,decision:'accept'},at);
  expect(task.owner).toBe('Evening lab team');
  expect(task.status).toBe('monitoring');
  expect(task.completionEventId).toBeNull();
  expect(state.activity.at(-1)?.kind).toBe('responsibility_accepted');
  expect(() => executeCareCommand(state, {type:'resolve_transfer',taskId:task.id,decision:'accept'},at)).toThrow();
});
it('rejects competing transfers and preserves ownership after rejection', () => {
  const state = seedCareWorkspace(new Date(at));
  const task = state.tasks[1]!;
  const owner = task.owner;
  const request = {type:'request_transfer',taskId:task.id,owner:'Next team',role:'nurse',reason:'Shift change'} as const;
  executeCareCommand(state,request,at);
  expect(() => executeCareCommand(state,request,at)).toThrow();
  state.role='nurse';
  executeCareCommand(state,{type:'resolve_transfer',taskId:task.id,decision:'reject'},at);
  expect(task.owner).toBe(owner);
  expect(task.transfer?.status).toBe('rejected');
});
it('rejects transfers for closed tasks and requests from an unauthorized simulation role', () => {
  const state=seedCareWorkspace(new Date(at)); const task=state.tasks[1]!;
  const request={type:'request_transfer',taskId:task.id,owner:'Next team',role:'nurse',reason:'Shift change'} as const;
  state.role='lab'; expect(()=>executeCareCommand(state,request,at)).toThrow();
  state.role='doctor'; task.status='cancelled'; expect(()=>executeCareCommand(state,request,at)).toThrow();
});

it('withdraws pending responsibility requests when evidence closes the task', async () => {
  const {reconcileCareWorkspace} = await import('./monitor');
  const state=seedCareWorkspace(new Date(at)); const task=state.tasks[1]!;
  const oldOwner=task.owner;
  executeCareCommand(state,{type:'request_transfer',taskId:task.id,owner:'Next lab',role:'lab',reason:'Shift change'},at);
  state.role='lab';
  executeCareCommand(state,{type:'source_event',encounterId:task.encounterId,orderId:task.orderId,source:'LIS',kind:'specimen_received',sourceRef:'TEST-RECEIPT'},at);
  reconcileCareWorkspace(state,at);
  expect(task.status).toBe('source_confirmed');
  expect(task.transfer?.status).toBe('withdrawn');
  expect(task.owner).toBe(oldOwner);
  expect(state.activity.filter(e=>e.kind==='responsibility_withdrawn')).toHaveLength(1);
  reconcileCareWorkspace(state,at);
  expect(state.activity.filter(e=>e.kind==='responsibility_withdrawn')).toHaveLength(1);
});

it.each(['cancel','attest'] as const)('withdraws pending handover after %s without granting the recipient ownership', async(action) => {
  const {reconcileCareWorkspace} = await import('./monitor');
  const state=seedCareWorkspace(new Date(at)); const task=state.tasks[1]!;
  const oldOwner=task.owner;
  executeCareCommand(state,{type:'request_transfer',taskId:task.id,owner:'Next lab',role:'lab',reason:'Shift change'},at);
  executeCareCommand(state,{type:'task_action',taskId:task.id,action,reason:'Recorded by staff'},at);
  reconcileCareWorkspace(state,at);
  expect(task.transfer?.status).toBe('withdrawn');
  expect(task.owner).toBe(oldOwner);
});

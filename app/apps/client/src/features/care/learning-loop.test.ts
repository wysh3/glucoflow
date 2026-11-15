import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CareSkill, CareWorkspace } from '@glucoflow/contracts';
import { loopState } from './learning-loop-state';

const workspace = (tasks: Partial<CareWorkspace['tasks'][number]>[] = []) =>
  ({ tasks, events: [], encounters: [] }) as unknown as CareWorkspace;
const skill = (status: CareSkill['status'], tests: CareSkill['tests'] = []) =>
  ({ id: status, status, tests, title: 'Routine', version: 1, canTest: true }) as unknown as CareSkill;

describe('learning loop state', () => {
  it('starts at observe when nothing has closed by evidence', () => {
    assert.equal(loopState(workspace(), []).stage, 'observe');
  });
  it('counts source-confirmed tasks but needs matching evidence to offer capture', () => {
    const state = loopState(workspace([{ status: 'source_confirmed', kind: 'specimen_receipt', orderId: 'o', completionEventId: 'missing' }]), []);
    assert.equal(state.confirmed, 1);
    assert.equal(state.stage, 'observe');
  });
  it('moves a draft from test to approve only when every sandbox case passed', () => {
    assert.equal(loopState(workspace(), [skill('draft')]).stage, 'test');
    assert.equal(loopState(workspace(), [skill('draft', [{ name: 'a', passed: true, detail: '' }, { name: 'b', passed: false, detail: '' }])]).stage, 'test');
    assert.equal(loopState(workspace(), [skill('draft', [{ name: 'a', passed: true, detail: '' }])]).stage, 'approve');
  });
  it('offers reuse for an approved version and ignores retired ones', () => {
    assert.equal(loopState(workspace(), [skill('retired'), skill('approved')]).stage, 'reuse');
    assert.equal(loopState(workspace(), [skill('retired')]).stage, 'observe');
  });
});

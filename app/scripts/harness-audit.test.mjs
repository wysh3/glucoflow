import test from 'node:test';
import assert from 'node:assert/strict';
import { auditTrajectory } from './harness-audit.mjs';

test('tight context elides before summarization', () => {
  const result = auditTrajectory({ contextBudgetTokens: 32000, contextUsedTokens: 20000 });
  assert.equal(result.context.recommendation, 'elide');
});

test('hard context elides then summarizes', () => {
  const result = auditTrajectory({ contextBudgetTokens: 100000, contextUsedTokens: 90000 });
  assert.equal(result.context.recommendation, 'elide_then_summarize');
});

test('weak model needs a plan and predefined tools', () => {
  const result = auditTrajectory({ modelCapability: 0.3, bashProficiency: 0.2 });
  assert.equal(result.planning, 'required');
  assert.equal(result.actionSpace, 'predefined-tools');
});

test('strong bash-capable model gets a short plan and bash-only', () => {
  const result = auditTrajectory({ modelCapability: 0.9, bashProficiency: 0.9, planPresent: true });
  assert.equal(result.planning, 'short');
  assert.equal(result.actionSpace, 'bash-only');
});

test('identical failing streak stops the run', () => {
  const result = auditTrajectory({ identicalFailingStreak: 8 });
  assert.equal(result.stuck, 'stop');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CareEvent, CareTask } from '@glucoflow/contracts';
import { captureEvidence, previewEvidence } from './skill-evidence';

const at = '2026-11-07T10:00:00.000Z';
const completion = {
  id: 'origin-result', encounterId: 'origin', orderId: 'order-a', source: 'LIS',
  kind: 'specimen_received', sourceRef: 'LIS-SIM-RECEIVED', label: 'Receipt', occurredAt: at, receivedAt: at,
} satisfies CareEvent;
const task = {
  id: 'task', encounterId: 'origin', orderId: 'order-a', kind: 'specimen_receipt',
  title: 'Receipt', owner: 'Lab', status: 'source_confirmed', createdAt: at, expiresAt: at,
  lastCheckedAt: at, completionEventId: completion.id, playbookVersion: 1,
} satisfies CareTask;

test('capture requires an independently confirmed event on the same encounter and order', () => {
  assert.equal(captureEvidence(task, [completion]), completion);
  assert.equal(captureEvidence({ ...task, status: 'human_attested' }, [completion]), undefined);
  assert.equal(captureEvidence({ ...task, orderId: 'wrong-order' }, [completion]), undefined);
  assert.equal(captureEvidence({ ...task, kind: 'handover' }, [completion]), undefined);
  assert.equal(captureEvidence(task, [{ ...completion, source: 'HIS' }]), undefined);
});

test('application evidence resolves only inside the target encounter and order', () => {
  const source = { ...completion, id: 'target-specimen', encounterId: 'target', orderId: 'order-b' };
  assert.equal(previewEvidence([completion, source], source.id, 'target', 'order-b'), source);
  assert.equal(previewEvidence([completion, source], completion.id, 'target', 'order-b'), undefined);
  assert.equal(previewEvidence([completion, source], source.id, 'target', 'wrong-order'), undefined);
  assert.equal(previewEvidence([completion, source], null, 'target', 'order-b'), undefined);
});

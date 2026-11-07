import type { CareEvent, CareTask, CareWorkspace } from '@glucoflow/contracts';
import { feedIsFresh, latestAcknowledgement, latestEvent, logActivity, orderEvents } from './events';

const taskStatuses: Record<CareTask['status'], string> = {
  awaiting_approval: 'Awaiting approval', monitoring: 'Monitoring resumed', paused: 'Monitoring paused',
  awaiting_evidence: 'Source status unknown', source_confirmed: 'Source confirmed completion',
  human_attested: 'Human attestation recorded', expired: 'Monitoring expired', cancelled: 'Monitoring cancelled',
};

function evidenceFor(state: CareWorkspace, task: CareTask, events: CareEvent[]): CareEvent | undefined {
  switch (task.kind) {
    case 'specimen_receipt':
      return latestEvent(events, 'specimen_received');
    case 'result_acknowledgement':
      return latestAcknowledgement(events);
    case 'handover':
      for (let index = state.events.length - 1; index >= 0; index -= 1) {
        const event = state.events[index];
        if (event?.encounterId === task.encounterId && event.orderId === null &&
            event.kind === 'handover_received' && event.source === 'HIS' && event.occurredAt >= task.createdAt &&
            !state.tasks.some((other) => other.id !== task.id && other.completionEventId === event.id)) {
          return event;
        }
      }
      return undefined;
  }
}

function updateTask(
  state: CareWorkspace, task: CareTask, at: string, status: CareTask['status'], detail: string, evidence?: CareEvent,
): boolean {
  const evidenceId = evidence?.id ?? null;
  if (task.status === status && task.completionEventId === evidenceId) return false;
  task.status = status;
  task.completionEventId = evidenceId;
  task.lastCheckedAt = at;
  logActivity(state, at, `task_${status}`, taskStatuses[status], detail, task.id);
  return true;
}

/** Reconcile with a single server clock. Unchanged reads do not advance revisions. */
export function reconcileCareWorkspace(state: CareWorkspace, at: string): boolean {
  const now = Date.parse(at);
  let changed = false;
  for (const task of state.tasks) {
    if (task.status === 'cancelled' || task.status === 'expired') continue;
    const events = task.orderId ? orderEvents(state, task.encounterId, task.orderId) : [];
    const cancellation = latestEvent(events, 'order_cancelled');
    if (cancellation) {
      changed = updateTask(state, task, at, 'cancelled', `Order cancelled in HIS · ${cancellation.sourceRef}`) || changed;
      continue;
    }
    if (task.status === 'human_attested') continue;
    if (task.kind === 'handover' && task.status === 'source_confirmed') continue;

    const evidence = evidenceFor(state, task, events);
    // Recorded evidence remains visible during a later outage. A correction or
    // cancellation can invalidate it, but an unavailable feed cannot erase it.
    if (task.status === 'source_confirmed' && evidence?.id === task.completionEventId) continue;
    if (at >= task.expiresAt) {
      changed = updateTask(state, task, at, 'expired', 'The configured monitoring window ended.') || changed;
      continue;
    }
    if (task.status === 'awaiting_approval' || task.status === 'paused') continue;
    const dependencies = task.kind === 'handover' ? ['HIS'] as const : ['HIS', 'LIS'] as const;
    const unavailable = dependencies.filter((source) => !feedIsFresh(state, source, now));
    if (unavailable.length > 0) {
      changed = updateTask(state, task, at, 'awaiting_evidence', `${unavailable.join(' and ')} feed disconnected or stale.`) || changed;
      continue;
    }
    if (evidence && evidence.receivedAt < task.expiresAt) {
      changed = updateTask(state, task, at, 'source_confirmed', `${evidence.source} · ${evidence.sourceRef}`, evidence) || changed;
      continue;
    }
    const correction = latestEvent(events, 'result_corrected');
    const detail = correction && task.kind === 'result_acknowledgement'
      ? `Awaiting acknowledgement of the corrected result · ${correction.sourceRef}`
      : 'Awaiting the matching source event.';
    changed = updateTask(state, task, at, 'monitoring', detail) || changed;
  }
  // Closure can race with a shift handover. Retain the last accountable owner,
  // but retire a request that can no longer be accepted on a closed task.
  for (const task of state.tasks) {
    if (task.transfer?.status === 'pending' &&
        ['source_confirmed', 'human_attested', 'expired', 'cancelled'].includes(task.status)) {
      task.transfer.status = 'withdrawn';
      task.transfer.resolvedAt = at;
      logActivity(state, at, 'responsibility_withdrawn', 'Pending handover withdrawn',
        `Task is ${task.status}; ${task.owner} remains the recorded owner.`, task.id);
      changed = true;
    }
  }
  return changed;
}

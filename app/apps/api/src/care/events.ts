import { randomUUID } from 'node:crypto';
import { specimenReceiptMatchesCollection } from '@glucoflow/contracts';
import type { CareCommand, CareEvent, CareEventKind, CareRole, CareWorkspace } from '@glucoflow/contracts';
import { ApiError } from '../errors';

export const feedStaleAfterMs = 15 * 60_000;
export const limits = {
  encounters: 30, orders: 50, events: 140, tasks: 60, playbooks: 15,
  messages: 60, commandReceipts: 800, activity: 1200, stateBytes: 440_000,
};

export function assertRoom(collection: readonly unknown[], limit: number, name: string): void {
  if (collection.length >= limit) {
    throw ApiError.conflict(`This workspace has reached its ${name} limit. Start a new simulation to continue.`, 'workspace_limit');
  }
}

export function assertRole(state: CareWorkspace, ...roles: CareRole[]): void {
  if (!roles.includes(state.role)) {
    throw ApiError.forbidden(`This simulation action is available to: ${roles.join(', ')}.`);
  }
}

export function encounterFor(state: CareWorkspace, id: string) {
  const encounter = state.encounters.find((item) => item.id === id);
  if (!encounter) throw ApiError.validation('That encounter is not in this simulation.');
  return encounter;
}

export function orderFor(state: CareWorkspace, encounterId: string, orderId: string | null) {
  const order = state.orders.find((item) => item.id === orderId && item.encounterId === encounterId);
  if (!order) throw ApiError.validation('Choose an order that belongs to this encounter.');
  return order;
}

export function logActivity(
  state: CareWorkspace, at: string, kind: string, title: string, detail: string, taskId?: string,
): void {
  state.activity.push({ id: randomUUID(), at, kind, title, detail, ...(taskId ? { taskId } : {}) });
}

const eventRules: Record<CareEventKind, { source: CareEvent['source']; roles: CareRole[]; label: string }> = {
  order_placed: { source: 'HIS', roles: ['doctor'], label: 'Order placed in the synthetic HIS' },
  specimen_collected: { source: 'HIS', roles: ['nurse'], label: 'Nurse recorded specimen collection' },
  specimen_received: { source: 'LIS', roles: ['lab'], label: 'Lab recorded specimen receipt' },
  result_validated: { source: 'LIS', roles: ['lab'], label: 'Lab validated result for review' },
  result_acknowledged: { source: 'HIS', roles: ['doctor'], label: 'Clinician acknowledged the result' },
  order_cancelled: { source: 'HIS', roles: ['doctor'], label: 'Clinician cancelled the order' },
  result_corrected: { source: 'LIS', roles: ['lab'], label: 'Lab issued a corrected result' },
  handover_received: { source: 'HIS', roles: ['nurse', 'coordinator'], label: 'Receiving team confirmed handover' },
};

export function feedIsFresh(state: CareWorkspace, source: CareEvent['source'], now: number): boolean {
  const feed = state.feeds[source];
  return feed.connected && now - Date.parse(feed.lastSyncAt) < feedStaleAfterMs;
}

export function latestEvent(events: readonly CareEvent[], ...kinds: CareEventKind[]): CareEvent | undefined {
  let latest: CareEvent | undefined;
  for (const event of events) {
    if (!kinds.includes(event.kind) || event.source !== eventRules[event.kind].source) continue;
    if (!latest || event.occurredAt > latest.occurredAt ||
        (event.occurredAt === latest.occurredAt &&
          (event.kind === 'result_corrected' || latest.kind !== 'result_corrected') && event.receivedAt >= latest.receivedAt)) latest = event;
  }
  return latest;
}

export function orderEvents(state: CareWorkspace, encounterId: string, orderId: string): CareEvent[] {
  return state.events.filter((event) => event.orderId === orderId && event.encounterId === encounterId);
}

export function latestMatchingSpecimenReceipt(events: readonly CareEvent[]): CareEvent | undefined {
  const collection = latestEvent(events, 'specimen_collected');
  return latestEvent(events.filter((event) => specimenReceiptMatchesCollection(collection, event)), 'specimen_received');
}

export function latestAcknowledgement(events: readonly CareEvent[]): CareEvent | undefined {
  const result = latestEvent(events, 'result_validated', 'result_corrected');
  if (!result) return undefined;
  return latestEvent(events.filter((event, index) => event.occurredAt > result.occurredAt ||
    (event.occurredAt === result.occurredAt && index > events.indexOf(result))), 'result_acknowledged');
}

/** Apply an independent event from the selected synthetic source system. */
export function recordSourceEvent(
  state: CareWorkspace, command: Extract<CareCommand, { type: 'source_event' }>, at: string,
): boolean {
  const rule = eventRules[command.kind];
  if (command.source !== rule.source) {
    throw ApiError.validation(`This event must come from the simulated ${rule.source} feed.`);
  }
  assertRole(state, ...rule.roles);
  const encounter = encounterFor(state, command.encounterId);
  const isHandover = command.kind === 'handover_received';
  if (isHandover && command.orderId !== null) {
    throw ApiError.validation('A handover receipt belongs to an encounter and has no order.');
  }
  const order = isHandover ? null : orderFor(state, encounter.id, command.orderId);

  const occurredAt = command.occurredAt ? new Date(command.occurredAt).toISOString() : at;
  const duplicate = state.events.find((event) => event.source === command.source && event.sourceRef === command.sourceRef);
  if (duplicate) {
    if (duplicate.kind !== command.kind || duplicate.encounterId !== encounter.id || duplicate.orderId !== command.orderId ||
        (command.occurredAt && duplicate.occurredAt !== occurredAt)) {
      throw ApiError.conflict('That source reference is already attached to a different event.', 'source_ref_conflict');
    }
    return false;
  }
  if (!state.feeds[command.source].connected) {
    throw ApiError.conflict(`Reconnect the simulated ${command.source} feed before emitting events.`, 'feed_disconnected');
  }
  if (occurredAt > at || occurredAt < (order?.createdAt ?? encounter.admittedAt)) {
    throw ApiError.validation('The event time must fall within this encounter or order and cannot be in the future.');
  }

  const events = order ? orderEvents(state, encounter.id, order.id) : [];
  if (latestEvent(events, 'order_cancelled') && command.source !== 'LIS') {
    throw ApiError.conflict('This simulated order is cancelled.', 'order_cancelled');
  }
  const previous = latestEvent(events, command.kind);
  if (previous && command.kind !== 'result_corrected' && command.kind !== 'result_acknowledged') {
    throw ApiError.conflict('This step is already recorded for the order.', 'duplicate_source_event');
  }
  if (command.kind === 'result_acknowledged' && latestAcknowledgement(events)) {
    throw ApiError.conflict('This version of the result is already acknowledged.', 'duplicate_source_event');
  }

  let prerequisite: CareEvent | undefined;
  switch (command.kind) {
    case 'order_placed':
    case 'handover_received':
      break;
    case 'order_cancelled':
    case 'specimen_collected':
      prerequisite = latestEvent(events, 'order_placed');
      break;
    case 'specimen_received':
      prerequisite = latestEvent(events, 'specimen_collected');
      break;
    case 'result_validated':
      prerequisite = latestEvent(events, 'specimen_received');
      break;
    case 'result_corrected':
    case 'result_acknowledged':
      prerequisite = latestEvent(events, 'result_validated', 'result_corrected');
      break;
  }
  const sequenceGap = command.kind !== 'order_placed' && !isHandover && (!prerequisite || occurredAt < prerequisite.occurredAt);
  if (sequenceGap && command.source !== 'LIS') {
    throw ApiError.conflict('The prerequisite source event must be recorded before this step.', 'source_sequence_conflict');
  }
  assertRoom(state.events, limits.events, 'source event');
  state.events.push({
    id: randomUUID(), encounterId: encounter.id, orderId: order?.id ?? null,
    kind: command.kind, source: command.source, sourceRef: command.sourceRef,
    label: rule.label, occurredAt, receivedAt: at,
  });
  if (sequenceGap) logActivity(state, at, 'source_sequence_gap', 'Source evidence arrived with a missing or inconsistent earlier step', `${command.source} · ${command.sourceRef}. Earlier events remain unverified; none were inferred.`);
  if (command.source === 'LIS' && latestEvent(events, 'order_cancelled')) logActivity(state, at, 'source_after_cancellation', 'Lab evidence retained after cancellation', `${command.sourceRef}. The order remains cancelled.`);
  state.feeds[command.source].lastSyncAt = at;
  logActivity(state, at, 'source_event', rule.label, `${command.source} · ${command.sourceRef}`);
  return true;
}

import { randomUUID } from 'node:crypto';
import type {
  CareActor, CarePdfDemoCommand, CareShiftMonitor, CareShiftMonitorItem, CareShiftScope, CareStaff, CareWorkspace,
} from '@glucoflow/contracts';
import { ApiError } from '../errors';
import { assertRole, assertRoom, encounterFor, feedIsFresh, latestAcknowledgement, latestEvent, latestMatchingSpecimenReceipt, logActivity, orderEvents } from './events';

const maxShiftMs = 24 * 60 * 60_000;
const checkIntervalMs = 60_000;
type ShiftCommand = Extract<CarePdfDemoCommand, { type: 'shift_monitoring' }>;

export function namedRosterMember(state: CareWorkspace, id: string, actor: CareActor): CareStaff {
  const staff = state.coordination?.staff.find((item) => item.id === id);
  if (!staff || actor.simulated === Boolean(staff.userId)) {
    throw ApiError.validation('Choose a named person from the eligible workspace roster.');
  }
  return staff;
}

export function sameCareActor(a: CareActor, b: CareActor): boolean {
  return a.id === b.id && a.simulated === b.simulated;
}

function validateScope(state: CareWorkspace, scope: CareShiftScope, actor: CareActor, at: string) {
  const duration = Date.parse(scope.expiresAt) - Date.parse(at);
  if (!Number.isFinite(duration) || duration <= 0 || duration > maxShiftMs) {
    throw ApiError.validation('Choose an absolute end time within the next 24 hours.');
  }
  if (new Set(scope.sources).size !== 2 || !scope.sources.includes('HIS') || !scope.sources.includes('LIS')) {
    throw ApiError.validation('This monitoring rule requires the synthetic HIS and LIS sources.');
  }
  if (new Set(scope.encounterIds).size !== scope.encounterIds.length || new Set(scope.recipientStaffIds).size !== scope.recipientStaffIds.length) {
    throw ApiError.validation('Each encounter and recipient can be selected once.');
  }
  for (const id of scope.encounterIds) encounterFor(state, id);
  for (const id of scope.recipientStaffIds) namedRosterMember(state, id, actor);
}

function activity(state: CareWorkspace, monitor: CareShiftMonitor, at: string, status: string, detail: string) {
  logActivity(state, at, `shift_monitor_${status}`, `Shift monitoring ${status.replaceAll('_', ' ')}`,
    `Version ${monitor.version} · ${monitor.scope.encounterIds.length} selected encounter(s) · ${detail}`);
}

export function executeShiftCommand(state: CareWorkspace, command: ShiftCommand, actor: CareActor, at: string): boolean {
  assertRole(state, 'doctor', 'coordinator');
  if (command.action === 'create') {
    validateScope(state, command.scope, actor, at);
    const monitors = state.shiftMonitoring ?? [];
    assertRoom(monitors, 12, 'shift monitor');
    const monitor: CareShiftMonitor = {
      id: randomUUID(), version: 1, status: 'awaiting_approval', scope: command.scope,
      createdAt: at, updatedAt: at, createdBy: actor, items: [],
    };
    state.shiftMonitoring = [...monitors, monitor];
    activity(state, monitor, at, 'prepared', 'Waiting for named human approval.');
    return true;
  }

  const monitor = state.shiftMonitoring?.find((item) => item.id === command.monitorId);
  if (!monitor) throw ApiError.notFound('That shift monitor is unavailable.');
  if (!sameCareActor(monitor.createdBy, actor)) throw ApiError.forbidden('Only the named creator can control this shift monitor.');
  if (monitor.version !== command.expectedVersion) throw ApiError.conflict('The shift scope changed. Review the current version.', 'stale_shift_version');
  if (monitor.status === 'stopped' || monitor.status === 'expired' || Date.parse(monitor.scope.expiresAt) <= Date.parse(at)) {
    throw ApiError.conflict('This shift monitor ended. Prepare a new scope.', 'shift_monitor_ended');
  }

  switch (command.action) {
    case 'edit':
      validateScope(state, command.scope, actor, at);
      if (monitor.version >= 1000) throw ApiError.conflict('Prepare a new shift monitor to continue.', 'workspace_limit');
      monitor.scope = command.scope;
      monitor.version += 1;
      monitor.status = 'awaiting_approval';
      monitor.items = [];
      delete monitor.approvedAt;
      delete monitor.approvedBy;
      activity(state, monitor, at, 'edited', 'The new scope requires approval.');
      break;
    case 'approve':
      if (monitor.status !== 'awaiting_approval' && monitor.status !== 'paused') {
        throw ApiError.conflict('Only a prepared or paused shift monitor can be approved.', 'shift_monitor_state');
      }
      validateScope(state, monitor.scope, actor, at);
      if (state.shiftMonitoring?.some((other) => other.id !== monitor.id && other.status === 'monitoring' &&
        other.scope.rule === monitor.scope.rule && other.scope.encounterIds.some((id) => monitor.scope.encounterIds.includes(id)))) {
        throw ApiError.conflict('One of these encounters is already monitored under this rule. Review the existing group.', 'shift_scope_overlap');
      }
      monitor.status = 'monitoring';
      monitor.approvedAt = at;
      monitor.approvedBy = actor;
      activity(state, monitor, at, 'approved', 'Only source checks and in-app status are enabled.');
      break;
    case 'pause':
      if (monitor.status !== 'monitoring') throw ApiError.conflict('Only active shift monitoring can be paused.', 'shift_monitor_state');
      monitor.status = 'paused';
      activity(state, monitor, at, 'paused', 'The last source checks remain visible.');
      break;
    case 'stop':
      monitor.status = 'stopped';
      activity(state, monitor, at, 'stopped', 'Existing work and source evidence remain unchanged.');
      break;
  }
  monitor.updatedAt = at;
  return true;
}

function checksFor(state: CareWorkspace, monitor: CareShiftMonitor, at: string): CareShiftMonitorItem[] {
  const checkTime = Date.parse(at);
  const validFeeds = monitor.scope.sources.every((source) =>
    Date.parse(state.feeds[source].lastSyncAt) <= checkTime && feedIsFresh(state, source, checkTime));
  const awaitingResult = monitor.scope.rule === 'validated_result_acknowledgement';
  const kind = awaitingResult ? 'result_acknowledgement' : 'specimen_receipt';
  return state.orders.flatMap((order) => {
    if (!monitor.scope.encounterIds.includes(order.encounterId)) return [];
    const events = orderEvents(state, order.encounterId, order.id)
      .filter((event) => Date.parse(event.receivedAt) <= checkTime && Date.parse(event.receivedAt) < Date.parse(monitor.scope.expiresAt));
    const rawReceipt = awaitingResult ? undefined : latestEvent(events, 'specimen_received');
    const basis = awaitingResult ? latestEvent(events, 'result_validated', 'result_corrected') : latestEvent(events, 'specimen_collected');
    const initialEvidence = basis ?? rawReceipt;
    if (!initialEvidence) return [];
    const old = monitor.items.find((item) => item.orderId === order.id);
    const completion = awaitingResult ? latestAcknowledgement(events) : latestMatchingSpecimenReceipt(events);
    const cancelled = latestEvent(events, 'order_cancelled');
    const hasNewInScopeWork = !completion || Date.parse(completion.receivedAt) >= Date.parse(monitor.approvedAt ?? at);
    if (!old && (!hasNewInScopeWork ||
      (cancelled && Date.parse(cancelled.receivedAt) < Date.parse(monitor.approvedAt ?? at)))) return [];
    const inconsistentReceipt = completion ? undefined : rawReceipt;
    const evidence = cancelled ?? (completion && (validFeeds || old?.status === 'source_confirmed' && old.sourceEventId === completion.id)
      ? completion : undefined) ?? inconsistentReceipt ?? initialEvidence;
    const status = cancelled ? 'cancelled' : evidence === completion ? 'source_confirmed'
      : validFeeds && !inconsistentReceipt ? 'pending' : 'source_unknown';
    const existingTask = state.tasks.find((task) => task.orderId === order.id && task.kind === kind &&
      !['cancelled', 'expired'].includes(task.status));
    const sourceEventId = evidence.id;
    const existingTaskId = existingTask?.id ?? null;
    if (old && old.encounterId === order.encounterId && old.status === status && old.sourceEventId === sourceEventId
      && old.existingTaskId === existingTaskId && checkTime - Date.parse(old.lastCheckedAt) < checkIntervalMs) return [old];
    return [{ encounterId: order.encounterId, orderId: order.id, status, lastCheckedAt: at, sourceEventId, existingTaskId }];
  });
}

export function reconcileShiftMonitoring(state: CareWorkspace, at: string): boolean {
  let changed = false;
  for (const monitor of state.shiftMonitoring ?? []) {
    if (monitor.status === 'stopped' || monitor.status === 'expired') continue;
    const ending = Date.parse(at) >= Date.parse(monitor.scope.expiresAt);
    if (monitor.status === 'monitoring') {
      const items = checksFor(state, monitor, ending ? monitor.scope.expiresAt : at);
      if (items.length !== monitor.items.length || items.some((item, index) => item !== monitor.items[index])) {
        monitor.items = items;
        monitor.updatedAt = at;
        changed = true;
      }
    }
    if (ending) {
      monitor.status = 'expired';
      monitor.updatedAt = at;
      activity(state, monitor, at, 'expired', 'The configured absolute end time passed.');
      changed = true;
    }
  }
  return changed;
}

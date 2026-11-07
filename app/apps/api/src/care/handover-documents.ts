import { randomUUID } from 'node:crypto';
import type {
  CareActor, CareEvent, CareHandoverItem, CareHandoverVersion, CarePdfDemoCommand, CareTask, CareWorkspace,
} from '@glucoflow/contracts';
import { ApiError } from '../errors';
import { assertRole, assertRoom, encounterFor, latestAcknowledgement, latestEvent, latestMatchingSpecimenReceipt, logActivity, orderEvents } from './events';
import { namedRosterMember, sameCareActor } from './shift-monitoring';

type HandoverCommand = Extract<CarePdfDemoCommand, { type: 'handover_document' }>;
type SoftAcknowledgementCommand = Extract<CarePdfDemoCommand, { type: 'soft_acknowledge_task' }>;
const openTask = (task: CareTask) => ['awaiting_approval', 'monitoring', 'awaiting_evidence', 'paused'].includes(task.status);

export function executeSoftAcknowledgement(
  state: CareWorkspace, command: SoftAcknowledgementCommand, actor: CareActor, at: string,
): boolean {
  assertRole(state, 'nurse');
  const task = state.tasks.find((item) => item.id === command.taskId);
  if (!task) throw ApiError.notFound('That task is unavailable.');
  if (!openTask(task)) throw ApiError.conflict('Soft acknowledgement is available only for open work.', 'task_state_conflict');
  const store = state.coordination;
  const namedAssignment = store?.assignments.some((assignment) => assignment.taskId === task.id &&
    (assignment.status === 'accepted' || (assignment.status === 'offered' && assignment.expiresAt > at)) &&
    store.staff.some((staff) => staff.id === assignment.staffId && staff.role === actor.role &&
      (actor.simulated ? !staff.userId && staff.id === actor.id : staff.userId === actor.id)));
  if (task.kind !== 'specimen_receipt' && !namedAssignment) {
    throw ApiError.forbidden('Acknowledge a specimen exception or work offered to you.');
  }
  const acknowledgements = task.softAcknowledgements ?? [];
  const previous = acknowledgements.findLast((entry) => sameCareActor(entry.actor, actor));
  if (previous?.note === command.note) return false;
  assertRoom(acknowledgements, 12, 'soft acknowledgement');
  task.softAcknowledgements = [...acknowledgements, { actor, at, note: command.note }];
  logActivity(state, at, 'task_soft_acknowledged', 'Soft acknowledgement recorded',
    `${command.note} · Source completion is still checked independently.`, task.id);
  return true;
}

function evidenceFields(event?: CareEvent) {
  return { sourceEventId: event?.id ?? null, sourceRef: event?.sourceRef ?? null, sourceAt: event?.occurredAt ?? null };
}

function handoverItems(state: CareWorkspace, ids: string[]): CareHandoverItem[] {
  return ids.flatMap((id) => {
    const encounter = encounterFor(state, id);
    const tasks = state.tasks.filter((task) => task.encounterId === id && openTask(task));
    const context = { encounterId: id, patientName: encounter.patientName, bed: encounter.bed };
    const items: CareHandoverItem[] = tasks.map((task) => {
      const events = orderEvents(state, id, task.orderId ?? '');
      const event = task.kind === 'result_acknowledgement'
        ? latestEvent(events, 'result_corrected', 'result_validated')
        : task.kind === 'specimen_receipt' ? latestEvent(events, 'specimen_received', 'specimen_collected', 'order_placed') : undefined;
      return { ...context, taskId: task.id, owner: task.owner, title: task.title, status: task.status, ...evidenceFields(event) };
    });
    for (const order of state.orders.filter((item) => item.encounterId === id)) {
      const events = orderEvents(state, id, order.id);
      if (latestEvent(events, 'order_cancelled')) continue;
      const validated = latestEvent(events, 'result_validated', 'result_corrected');
      const received = latestEvent(events, 'specimen_received');
      const collected = latestEvent(events, 'specimen_collected');
      const placed = latestEvent(events, 'order_placed');
      const kind = validated ? 'result_acknowledgement' : 'specimen_receipt';
      if (tasks.some((task) => task.orderId === order.id && task.kind === kind)) continue;
      const event = validated ?? received ?? collected ?? placed;
      if (!event || (validated && latestAcknowledgement(events))) continue;
      const pending = validated ? 'Result acknowledgement awaiting source'
        : received && !latestMatchingSpecimenReceipt(events) ? 'Specimen receipt chronology unverified'
        : received ? 'Result validation awaiting source'
        : collected ? 'Specimen receipt awaiting source' : 'Specimen collection awaiting source';
      items.push({ ...context, taskId: null, owner: validated ? encounter.assignedTo : received || collected ? 'Lab team' : 'Nursing team',
        title: `${order.testName} · ${pending}`, status: 'awaiting_source', ...evidenceFields(event) });
    }
    return items;
  });
}

function prepareVersion(
  state: CareWorkspace, recipientStaffId: string, body: string, items: CareHandoverItem[], version: number, actor: CareActor, at: string,
): CareHandoverVersion {
  const recipient = namedRosterMember(state, recipientStaffId, actor);
  if ((actor.simulated ? recipient.id : recipient.userId) === actor.id) {
    throw ApiError.validation('Choose a different receiving person.');
  }
  return {
    version, body, recipientStaffId,
    ...(recipient.userId ? { recipientUserId: recipient.userId } : {}),
    recipientName: recipient.name, recipientRole: recipient.role, preparedAt: at, preparedBy: actor, items,
  };
}

export function executeHandoverCommand(state: CareWorkspace, command: HandoverCommand, actor: CareActor, at: string): boolean {
  if (command.action === 'create') {
    assertRole(state, 'doctor', 'nurse');
    const documents = state.handoverDocuments ?? [];
    assertRoom(documents, 8, 'handover draft');
    if (new Set(command.encounterIds).size !== command.encounterIds.length) {
      throw ApiError.validation('Each encounter can be selected once.');
    }
    const items = handoverItems(state, command.encounterIds);
    if (items.length > 30) throw ApiError.validation('Select fewer encounters to keep the handover within 30 entries.');
    const body = 'Review the source-linked work below and add any operational notes before export.';
    const version = prepareVersion(state, command.recipientStaffId, body, items, 1, actor, at);
    state.handoverDocuments = [...documents, {
      id: randomUUID(), encounterIds: command.encounterIds, createdBy: actor, createdAt: at, versions: [version],
    }];
    logActivity(state, at, 'handover_document_prepared', 'Handover draft prepared', `Version 1 · ${items.length} source-linked work item(s) · ${version.recipientName}`);
    return true;
  }

  const document = state.handoverDocuments?.find((item) => item.id === command.documentId);
  if (!document) throw ApiError.notFound('That handover draft is unavailable.');
  if (command.action === 'receive') {
    const version = document.versions.find((item) => item.version === command.expectedVersion);
    if (!version?.sharedAt) throw ApiError.conflict('This handover version has not been shared in the workspace.', 'handover_version_unshared');
    const recipient = namedRosterMember(state, version.recipientStaffId, actor);
    const matches = actor.role === version.recipientRole && recipient.role === version.recipientRole && (actor.simulated
      ? recipient.id === actor.id && !version.recipientUserId
      : recipient.userId === actor.id && version.recipientUserId === actor.id);
    if (!matches) throw ApiError.forbidden('Only the named recipient can record receipt of this handover version.');
    if (version.receivedAt) return false;
    version.receivedAt = at;
    version.receivedBy = actor;
    logActivity(state, at, 'handover_document_received', 'Handover draft receipt recorded',
      `Version ${version.version} · ${version.recipientName} · Clinical responsibility is unchanged.`);
    return true;
  }

  assertRole(state, 'doctor', 'nurse');
  if (!sameCareActor(document.createdBy, actor)) throw ApiError.forbidden('Only the named author can edit or share this handover draft.');
  const current = document.versions.at(-1)!;
  if (current.version !== command.expectedVersion) throw ApiError.conflict('The handover draft changed. Review the current version.', 'stale_handover_version');
  if (command.action === 'edit') {
    if (current.body === command.body && current.recipientStaffId === command.recipientStaffId) return false;
    assertRoom(document.versions, 8, 'handover version');
    const version = prepareVersion(state, command.recipientStaffId, command.body, current.items, current.version + 1, actor, at);
    document.versions.push(version);
    logActivity(state, at, 'handover_document_edited', 'Handover draft version prepared', `Version ${version.version} · ${version.recipientName}`);
    return true;
  }

  if (current.sharedAt) return false;
  const recipient = namedRosterMember(state, current.recipientStaffId, actor);
  if (recipient.role !== current.recipientRole || (recipient.userId ?? undefined) !== current.recipientUserId) {
    throw ApiError.conflict('The recipient changed. Edit this draft before sharing.', 'handover_recipient_changed');
  }
  current.sharedAt = at;
  current.sharedBy = actor;
  logActivity(state, at, 'handover_document_shared', 'Handover draft shared in workspace', `Version ${current.version} · ${current.recipientName} · No external message was sent.`);
  return true;
}

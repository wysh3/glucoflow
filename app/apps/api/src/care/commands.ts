import { randomUUID } from 'node:crypto';
import type { CareCommand, CareTask, CareWorkspace } from '@glucoflow/contracts';
import { ApiError } from '../errors';
import { assertRole, assertRoom, encounterFor, latestEvent, limits, logActivity, orderEvents, orderFor, recordSourceEvent } from './events';
import { activePlaybook, draftHandover, proposePlaybook, reviewPlaybook, rollbackPlaybook, testPlaybook } from './playbooks';

const openStatuses: CareTask['status'][] = ['awaiting_approval', 'monitoring', 'awaiting_evidence', 'paused'];
const runningStatuses: CareTask['status'][] = ['monitoring', 'awaiting_evidence'];
const allowedActions: Record<Extract<CareCommand, { type: 'task_action' }>['action'], CareTask['status'][]> = {
  approve: ['awaiting_approval'],
  pause: runningStatuses,
  resume: ['paused'],
  cancel: openStatuses,
  attest: ['monitoring', 'awaiting_evidence', 'paused'],
};

export function hasCoveredTask(state: CareWorkspace, encounterId: string, orderId: string | null, kind: CareTask['kind']): boolean {
  return state.tasks.some((task) => task.encounterId === encounterId && task.orderId === orderId &&
    task.kind === kind && (openStatuses.includes(task.status) || (orderId !== null && task.status === 'source_confirmed')));
}

export function createCareTask(state: CareWorkspace, command: Extract<CareCommand, { type: 'create_task' }>, at: string): CareTask {
  assertRoom(state.tasks, limits.tasks, 'task');
  const encounter = encounterFor(state, command.encounterId);
  if (command.kind === 'handover' && command.orderId !== null) {
    throw ApiError.validation('Choose an encounter without an order for a handover task.');
  }
  const order = command.kind === 'handover' ? null : orderFor(state, encounter.id, command.orderId);
  if (order && latestEvent(orderEvents(state, encounter.id, order.id), 'order_cancelled')) {
    throw ApiError.conflict('This simulated order is cancelled.', 'order_cancelled');
  }
  if (hasCoveredTask(state, encounter.id, command.orderId, command.kind)) {
    throw ApiError.conflict('A monitoring task already covers this evidence.', 'duplicate_task');
  }

  const task: CareTask = {
    id: randomUUID(), encounterId: encounter.id, orderId: order?.id ?? null,
    kind: command.kind, title: command.title,
    owner: command.kind === 'specimen_receipt' ? 'Lab team' : encounter.assignedTo,
    status: 'awaiting_approval', createdAt: at, expiresAt: new Date(Date.parse(at) + command.durationMinutes * 60_000).toISOString(),
    lastCheckedAt: null, completionEventId: null, playbookVersion: activePlaybook(state).version,
  };
  state.tasks.push(task);
  logActivity(state, at, 'task_proposed', 'Monitoring proposed', `${task.title} · Approval required`, task.id);
  return task;
}

function actOnTask(state: CareWorkspace, command: Extract<CareCommand, { type: 'task_action' }>, at: string): void {
  assertRole(state, 'doctor', 'coordinator');
  const task = state.tasks.find((item) => item.id === command.taskId);
  if (!task) throw ApiError.notFound('That monitoring task is not available.');
  if (!allowedActions[command.action].includes(task.status)) {
    throw ApiError.conflict('This action is not available in the current task status.', 'task_state_conflict');
  }
  if (command.action === 'attest' && !command.reason) {
    throw ApiError.validation('Enter the basis for the human attestation.');
  }
  const transitions = {
    approve: { status: 'monitoring', title: 'Monitoring approved' },
    pause: { status: 'paused', title: 'Monitoring paused' },
    resume: { status: 'monitoring', title: 'Monitoring resumed' },
    cancel: { status: 'cancelled', title: 'Monitoring cancelled' },
    attest: { status: 'human_attested', title: 'Human attestation recorded' },
  } as const;
  const transition = transitions[command.action];
  task.status = transition.status;
  task.lastCheckedAt = at;
  task.completionEventId = null;
  const detail = command.reason ? `${state.role} · ${command.reason}` : `Simulation role · ${state.role}`;
  logActivity(state, at, `task_${command.action}`, transition.title, detail, task.id);
}

/** Command schema checks shape, while this function enforces workspace and lifecycle rules. */
export function executeCareCommand(state: CareWorkspace, command: Exclude<CareCommand, { type: 'apply_skill' }>, at: string): boolean {
  switch (command.type) {
    case 'set_role':
      if (state.role === command.role) return false;
      state.role = command.role;
      logActivity(state, at, 'role_changed', 'Simulation role changed', `Active simulation role · ${command.role}`);
      return true;
    case 'add_encounter':
      assertRole(state, 'doctor', 'coordinator');
      assertRoom(state.encounters, limits.encounters, 'encounter');
      state.encounters.push({
        id: randomUUID(), patientName: command.patientName, bed: command.bed,
        patientCode: `DEMO-${1001 + state.encounters.length}`, documentedContext: command.documentedContext,
        assignedTo: 'Dr Mira Rao', admittedAt: at,
      });
      logActivity(state, at, 'encounter_added', 'Synthetic encounter added', command.patientName);
      return true;
    case 'add_order': {
      assertRole(state, 'doctor');
      assertRoom(state.orders, limits.orders, 'order');
      const encounter = encounterFor(state, command.encounterId);
      const id = randomUUID();
      state.orders.push({
        id, encounterId: encounter.id, testName: command.testName, specimenId: `SIM-SPEC-${1001 + state.orders.length}`,
        createdAt: at, targetMinutes: command.targetMinutes,
      });
      try {
        recordSourceEvent(state, {
          type: 'source_event', encounterId: encounter.id, orderId: id, kind: 'order_placed', source: 'HIS', sourceRef: `HIS-ORDER-${id}`,
        }, at);
      } catch (error) {
        // The event validator needs the provisional order to resolve its scope.
        // Rejected commands must leave no orphan order in in-memory callers either.
        state.orders.pop();
        throw error;
      }
      return true;
    }
    case 'source_event':
      if (command.kind === 'order_placed') throw ApiError.validation('Add an order to emit a simulated HIS order event.');
      return recordSourceEvent(state, command, at);
    case 'set_feed': {
      const feed = state.feeds[command.source];
      if (!command.connected && !feed.connected) return false;
      feed.connected = command.connected;
      if (command.connected) feed.lastSyncAt = at;
      logActivity(state, at, 'feed_changed', `${command.source} feed ${command.connected ? 'synchronized' : 'disconnected'}`, 'Synthetic feed control.');
      return true;
    }
    case 'create_task':
      createCareTask(state, command, at);
      return true;
    case 'task_action':
      actOnTask(state, command, at);
      return true;
    case 'bed_transfer': {
      const encounter = encounterFor(state, command.encounterId);
      const transfer = encounter.bedTransfer;
      if (command.stage === 'requested') {
        assertRole(state, 'doctor');
        if (transfer) throw ApiError.conflict('A transfer is already recorded for this encounter.', 'transfer_state_conflict');
        encounter.bedTransfer = {stage: 'requested', destination: command.destination, requestedAt: at, history: []};
      } else {
        assertRole(state, ...(command.stage === 'allocated' ? ['coordinator'] as const : ['nurse', 'coordinator'] as const));
        if (!transfer || transfer.stage !== (command.stage === 'allocated' ? 'requested' : 'allocated')) {
          throw ApiError.conflict('Record the previous transfer stage first.', 'transfer_state_conflict');
        }
        if (command.stage === 'arrived' && command.destination !== transfer.destination) {
          throw ApiError.validation('Arrival must match the recorded allocated bed.');
        }
        transfer.stage = command.stage;
        transfer.destination = command.destination;
        if (command.stage === 'arrived') encounter.bed = command.destination;
      }
      encounter.bedTransfer!.history.push({stage: command.stage, destination: command.destination, sourceRef: command.sourceRef, at, role: state.role});
      logActivity(state, at, `bed_${command.stage}`, `Transfer ${command.stage}`,
        `${encounter.patientCode} · ${command.destination} · Staff-recorded synthetic reference ${command.sourceRef}`);
      return true;
    }
    case 'request_transfer': {
      assertRole(state, 'doctor', 'coordinator');
      const task = state.tasks.find((item) => item.id === command.taskId);
      if (!task || !openStatuses.includes(task.status)) throw ApiError.conflict('Only open tasks can be handed over.', 'task_state_conflict');
      if (task.transfer?.status === 'pending') throw ApiError.conflict('This task already has a pending handover.', 'transfer_pending');
      if (task.owner === command.owner) throw ApiError.validation('Choose a different receiving team.');
      task.transfer = {owner: command.owner, role: command.role, reason: command.reason, requestedAt: at, status: 'pending'};
      logActivity(state, at, 'responsibility_requested', 'Responsibility transfer requested',
        `${task.owner} → ${command.owner} · ${command.reason}. Current owner remains responsible until acceptance.`, task.id);
      return true;
    }
    case 'resolve_transfer': {
      const task = state.tasks.find((item) => item.id === command.taskId);
      if (!task || !openStatuses.includes(task.status) || task.transfer?.status !== 'pending') {
        throw ApiError.conflict('There is no pending handover for this open task.', 'transfer_state_conflict');
      }
      assertRole(state, task.transfer.role);
      const previous = task.owner;
      task.transfer.status = command.decision === 'accept' ? 'accepted' : 'rejected';
      task.transfer.resolvedAt = at;
      if (command.decision === 'accept') task.owner = task.transfer.owner;
      logActivity(state, at, `responsibility_${task.transfer.status}`, `Responsibility ${task.transfer.status}`,
        `${previous} → ${task.transfer.owner} · Receiving simulation role: ${state.role}. ${command.decision === 'accept' ? 'Task remains open; source evidence is still required.' : 'Original owner retains responsibility.'}`, task.id);
      return true;
    }
    case 'draft_handover': {
      if (command.encounterId) encounterFor(state, command.encounterId);
      assertRoom(state.messages, limits.messages, 'message');
      const draft = draftHandover(state, command.encounterId);
      state.messages.push({ id: randomUUID(), role: 'assistant', at, engine: 'offline', ...draft });
      logActivity(state, at, 'handover_drafted', 'Handover drafted', `Playbook v${activePlaybook(state).version} · ${draft.sources.length} source citations`);
      return true;
    }
    case 'propose_playbook':
      proposePlaybook(state, command.title, command.body, at);
      return true;
    case 'test_playbook':
      testPlaybook(state, command.playbookId, at);
      return true;
    case 'review_playbook':
      reviewPlaybook(state, command.playbookId, command.decision, at);
      return true;
    case 'rollback_playbook':
      rollbackPlaybook(state, command.playbookId, at);
      return true;
  }
}

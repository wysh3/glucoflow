import { specimenReceiptMatchesCollection, type CareEvent, type CareTaskStatus, type CareWorkspace } from '@glucoflow/contracts';
import { latestPipelineEvent, pipelineEvidence } from './pipeline-evidence';
import { pendingHandoverReceipts } from './handover-inbox';

type Target = { kind: 'coordination' | 'task'; id: string } | { kind: 'source'; event: CareEvent }
  | { kind: 'handover'; id: string; version: number };
type DeskItem = { id: string; encounterId: string; title: string; detail: string; target: Target; due?: string };
const openStatuses = new Set<CareTaskStatus>(['awaiting_approval', 'monitoring', 'paused', 'awaiting_evidence']);

/** Pick named work by stable identity. Role-wide evidence remains separate from personal offers. */
export function homeWork(workspace: CareWorkspace, access: { shared?: boolean; actorId?: string }, now: string) {
  const coordination = workspace.coordination;
  const person = coordination?.staff.find(staff => staff.role === workspace.role && (
    access.shared === true ? !!access.actorId && staff.userId === access.actorId
      : access.shared === false && !staff.userId && staff.id === workspace.demoStaffId
  ));
  const open = workspace.tasks.filter(task => openStatuses.has(task.status) && task.expiresAt > now);
  const incoming: DeskItem[] = [];
  const assigned: DeskItem[] = [];
  const roleWork: DeskItem[] = [];

  for (const { document, version } of pendingHandoverReceipts(workspace, access)) {
    incoming.push({
      id: `handover-${document.id}-${version.version}`, encounterId: document.encounterIds[0] ?? '',
      title: `Review shift handover v${version.version}`, detail: `From ${document.createdBy.name}`,
      target: { kind: 'handover', id: document.id, version: version.version },
    });
  }

  if (person && coordination) {
    for (const offer of coordination.assignments) {
      if (offer.staffId !== person.id || !['offered', 'accepted'].includes(offer.status)) continue;
      const task = open.find(item => item.id === offer.taskId && item.status !== 'awaiting_approval');
      if (!task || (offer.status === 'offered' && offer.expiresAt <= now)) continue;
      const item = { id: offer.id, encounterId: task.encounterId, title: task.title, detail: `Source ${offer.sourceRef}`,
        target: { kind: 'coordination' as const, id: task.encounterId } };
      if (offer.status === 'offered') incoming.push({ ...item, detail: `Work offer · ${item.detail}`, due: offer.expiresAt });
      else assigned.push({ ...item, detail: `Accepted assignment · ${item.detail}` });
    }
    for (const request of coordination.handovers) {
      if (request.toStaffId !== person.id || person.role !== 'doctor' || request.status !== 'pending' || request.expiresAt <= now) continue;
      incoming.push({ id: request.id, encounterId: request.encounterId, title: 'Review receiving responsibility',
        detail: `${request.destination} · Source ${request.sourceRef}`, due: request.expiresAt,
        target: { kind: 'coordination', id: request.encounterId } });
    }
  }

  for (const task of open) {
    const transfer = task.transfer;
    if (person && transfer?.status === 'pending' && transfer.recipientStaffId === person.id && transfer.role === person.role
      && (access.shared ? transfer.recipientUserId === access.actorId : !transfer.recipientUserId)) {
      incoming.push({ id: `transfer-${task.id}`, encounterId: task.encounterId, title: task.title,
        detail: 'Task handover request', due: task.expiresAt, target: { kind: 'task', id: task.id } });
    }
    if (['doctor', 'coordinator'].includes(workspace.role) && task.status === 'awaiting_approval') roleWork.push({ id: task.id,
      encounterId: task.encounterId, title: task.title, detail: 'Task awaiting approval', target: { kind: 'task', id: task.id } });
  }

  for (const encounter of workspace.encounters) {
    const bed = encounter.bedTransfer;
    const needsAllocation = workspace.role === 'coordinator' && bed?.stage === 'requested';
    const needsArrival = ['coordinator', 'nurse'].includes(workspace.role) && bed?.stage === 'allocated';
    if (bed && (needsAllocation || needsArrival)) roleWork.push({ id: `bed-${encounter.id}`, encounterId: encounter.id,
      title: needsAllocation ? 'Review bed allocation' : 'Check arrival record', detail: bed.destination,
      target: { kind: 'coordination', id: encounter.id } });
  }

  if (workspace.role !== 'coordinator') {
    for (const order of workspace.orders) {
      const events = workspace.events.filter(event => event.encounterId === order.encounterId && event.orderId === order.id);
      if (latestPipelineEvent(events, 'order_cancelled')) continue;
      const placed = latestPipelineEvent(events, 'order_placed');
      const collected = latestPipelineEvent(events, 'specimen_collected');
      const rawReceipt = latestPipelineEvent(events, 'specimen_received');
      const receipt = specimenReceiptMatchesCollection(collected, rawReceipt) ? rawReceipt : undefined;
      const ack = pipelineEvidence(events, 'result_acknowledged');
      const add = (step: string, title: string, source: CareEvent) => roleWork.push({ id: `${step}-${order.id}`,
        encounterId: order.encounterId, title, detail: order.testName, target: { kind: 'source', event: source } });
      if (workspace.role === 'nurse' && placed && !collected && !receipt && !ack.result) add('collection', 'Check collection evidence', placed);
      if (workspace.role === 'lab' && collected && !receipt && !ack.result) add('receipt', 'Check lab receipt evidence', collected);
      if (workspace.role === 'lab' && receipt && !ack.result) add('result', 'Check result evidence', receipt);
      if (workspace.role === 'doctor' && ack.result && (!ack.event || ack.superseded)) add('acknowledgement', 'Review result evidence', ack.result);
    }
  }

  incoming.sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  return { person, items: [...incoming, ...assigned, ...roleWork], incomingCount: incoming.length, open };
}

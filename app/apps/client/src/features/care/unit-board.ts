import type { CareEncounter, CareEvent, CareEventKind, CareOrder, CareRole, CareTask, CareWorkspace } from '@glucoflow/contracts';
import { pipelineEvidence, pipelineStages } from './pipeline-evidence';

export type BoardTone = 'danger' | 'review' | 'primary' | 'done' | 'muted';
export interface BoardRow {
  encounter: CareEncounter;
  order: CareOrder | undefined;
  /** Completed pipeline stages, in pipeline order, derived only from recorded source events. */
  done: boolean[];
  next: (typeof pipelineStages)[number] | undefined;
  status: string;
  tone: BoardTone;
  elapsedMinutes: number | null;
  corrected: boolean;
  cancelled: boolean;
  task: CareTask | undefined;
  /** The next source event a simulated hospital system would send for this order. */
  feed: FeedStep | null;
}
export interface FeedStep {
  encounterId: string; orderId: string; kind: CareEventKind; source: CareEvent['source'];
  role: CareRole; label: string;
}

const responsibleRole: Partial<Record<CareEventKind, CareRole>> = {
  specimen_collected: 'nurse', specimen_received: 'lab', result_validated: 'lab', result_acknowledged: 'doctor',
};
const feedLabels: Partial<Record<CareEventKind, string>> = {
  specimen_collected: 'Specimen collection', specimen_received: 'Lab receipt', result_validated: 'Result validated',
  result_acknowledged: 'Clinician acknowledgement',
};
const sourceFor = (kind: CareEventKind): CareEvent['source'] =>
  kind === 'specimen_received' || kind === 'result_validated' || kind === 'result_corrected' ? 'LIS' : 'HIS';
const openStatuses = new Set<CareTask['status']>(['awaiting_approval', 'monitoring', 'paused', 'awaiting_evidence']);

export function boardRow(workspace: CareWorkspace, encounter: CareEncounter, now: number): BoardRow {
  const order = workspace.orders.filter((item) => item.encounterId === encounter.id).at(-1);
  const events = order ? workspace.events.filter((item) => item.encounterId === encounter.id && item.orderId === order.id) : [];
  const done = pipelineStages.map((stage) => {
    const evidence = pipelineEvidence(events, stage.kind);
    return !!evidence.event && !(stage.kind === 'result_acknowledged' && evidence.superseded);
  });
  const cancelled = events.some((item) => item.kind === 'order_cancelled');
  const result = pipelineEvidence(events, 'result_validated').event;
  const corrected = result?.kind === 'result_corrected';
  const nextIndex = done.findIndex((value) => !value);
  const next = nextIndex < 0 ? undefined : pipelineStages[nextIndex];
  const tasks = workspace.tasks.filter((item) => item.encounterId === encounter.id && (!order || item.orderId === order.id));
  const task = tasks.find((item) => openStatuses.has(item.status)) ?? tasks.at(-1);
  const elapsedMinutes = order ? Math.max(0, Math.round((now - Date.parse(order.createdAt)) / 60_000)) : null;
  const preResult = next?.kind === 'specimen_collected' || next?.kind === 'specimen_received';
  const overdue = !!order && preResult && elapsedMinutes !== null && elapsedMinutes > order.targetMinutes;

  let status: string; let tone: BoardTone;
  if (!order) { status = 'No order recorded'; tone = 'muted'; }
  else if (cancelled) { status = 'Order cancelled'; tone = 'muted'; }
  else if (!next) { status = 'Acknowledged · confirmed'; tone = 'done'; }
  else if (next.kind === 'result_acknowledged' && corrected) { status = 'Corrected · re-acknowledge'; tone = 'danger'; }
  else if (next.kind === 'result_acknowledged') { status = 'Awaiting acknowledgement'; tone = 'review'; }
  else if (overdue) { status = next.kind === 'specimen_received' ? 'Overdue for lab receipt' : 'Overdue for collection'; tone = 'danger'; }
  else if (next.kind === 'result_validated') { status = 'In the lab'; tone = 'primary'; }
  else { status = next.kind === 'specimen_received' ? 'Awaiting lab receipt' : 'Awaiting collection'; tone = 'primary'; }

  const kind = next?.kind;
  const role = kind ? responsibleRole[kind] : undefined;
  const feed = order && !cancelled && kind && role ? {
    encounterId: encounter.id, orderId: order.id, kind, source: sourceFor(kind), role, label: feedLabels[kind] ?? kind,
  } : null;
  return { encounter, order, done, next, status, tone, elapsedMinutes, corrected, cancelled, task, feed };
}

const urgency: Record<BoardTone, number> = { danger: 0, review: 1, primary: 2, muted: 3, done: 4 };
export function unitBoard(workspace: CareWorkspace, now = Date.now()): BoardRow[] {
  return workspace.encounters.map((encounter) => boardRow(workspace, encounter, now))
    .sort((a, b) => urgency[a.tone] - urgency[b.tone] || (b.elapsedMinutes ?? 0) - (a.elapsedMinutes ?? 0));
}

export function shiftGlance(rows: readonly BoardRow[], workspace: CareWorkspace) {
  return {
    overdue: rows.filter((row) => row.tone === 'danger').length,
    acknowledgement: rows.filter((row) => row.next?.kind === 'result_acknowledged' && !row.cancelled).length,
    approval: workspace.tasks.filter((task) => task.status === 'awaiting_approval').length,
    confirmed: workspace.tasks.filter((task) => task.status === 'source_confirmed').length,
  };
}

export function formatElapsed(minutes: number | null) {
  if (minutes === null) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  return hours % 24 ? `${Math.floor(hours / 24)} d ${hours % 24} h` : `${Math.floor(hours / 24)} d`;
}

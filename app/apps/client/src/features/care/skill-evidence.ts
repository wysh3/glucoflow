import type { CareEvent, CareTask } from '@glucoflow/contracts';

export function previewEvidence(events: CareEvent[], eventId: string | null, encounterId: string, orderId: string) {
  return events.find((event) => event.id === eventId && event.encounterId === encounterId && event.orderId === orderId);
}

export function captureEvidence(task: CareTask, events: CareEvent[]) {
  if (task.status !== 'source_confirmed' || !task.orderId || task.kind === 'handover') return undefined;
  const evidence = previewEvidence(events, task.completionEventId, task.encounterId, task.orderId);
  const [source, kind] = task.kind === 'specimen_receipt' ? ['LIS', 'specimen_received'] : ['HIS', 'result_acknowledged'];
  return evidence && evidence.source === source && evidence.kind === kind ? evidence : undefined;
}

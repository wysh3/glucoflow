import type { DeltaAction, DeltaItem, DeltaSummary } from '@glucoflow/contracts';
import { formatDateOnly } from '@glucoflow/ui';

export const KIND_LABEL: Record<DeltaItem['kind'], string> = {
  observation: 'Result',
  prescription: 'Prescription',
  examination: 'Examination',
  note: 'Patient note',
  document: 'Document',
  referral: 'Referral',
  result: 'Result',
  test: 'Test',
  question: 'Question',
};

export const STATUS_LABEL: Record<DeltaAction, string> = {
  accepted: 'Accepted',
  flagged: 'Flagged',
  asked_patient: 'Asked patient',
};

export const STATUS_TONE: Record<DeltaAction, 'success' | 'review' | 'primary'> = {
  accepted: 'success',
  flagged: 'review',
  asked_patient: 'primary',
};

export function effectiveStatus(
  item: DeltaItem,
  statuses: Record<string, DeltaAction>,
): DeltaItem['status'] {
  return statuses[item.id] ?? item.status;
}

/**
 * A draft note built only from the doctor's decisions. Context changes are
 * listed separately and marked as not accepted, so the note never implies a
 * review that did not happen.
 */
export function buildDeltaNote(
  summary: DeltaSummary,
  statuses: Record<string, DeltaAction>,
): string {
  const all = [
    ...summary.blocks.changed,
    ...summary.blocks.unresolved,
    ...summary.blocks.conflict,
    ...summary.blocks.unknown,
  ];
  const statusOf = (item: DeltaItem): DeltaItem['status'] => effectiveStatus(item, statuses);
  const accepted = summary.blocks.changed.filter((item) => statusOf(item) === 'accepted');
  const context = summary.blocks.changed.filter((item) => statusOf(item) === 'open');
  const flaggedOpen = summary.blocks.unresolved.filter((item) => statusOf(item) === 'flagged');
  const flaggedDecision = all.filter(
    (item) =>
      statusOf(item) === 'flagged' &&
      (item.block === 'conflict' || item.block === 'unknown' || item.block === 'changed'),
  );
  const asked = all.filter((item) => statusOf(item) === 'asked_patient');

  const lines = [
    'Draft visit note · 60-second delta',
    `Patient: ${summary.patient.displayName} (${summary.patient.clinicIdentifier})`,
    `Reference: ${summary.lastVisitDate ? formatDateOnly(summary.lastVisitDate) : 'first read'} · Generated ${summary.asOf}`,
    '',
    'What changed and was accepted:',
    ...(accepted.length
      ? accepted.map((item) => `- ${item.title}: ${item.detail}`)
      : ['- Nothing accepted yet.']),
    '',
    'Context for the visit (not individually accepted):',
    ...(context.length
      ? context.map((item) => `- ${item.title}`)
      : ['- None.']),
    '',
    'Open items to follow up:',
    ...(flaggedOpen.length
      ? flaggedOpen.map((item) => `- ${item.title}`)
      : ['- Nothing flagged.']),
    '',
    'Flagged for a decision:',
    ...(flaggedDecision.length
      ? flaggedDecision.map((item) => `- ${item.title}`)
      : ['- Nothing flagged.']),
    '',
    'Questions for the patient:',
    ...(asked.length ? asked.map((item) => `- ${item.title}`) : ['- Nothing recorded.']),
    '',
    'Conflicts and gaps stay visible. This draft does not resolve them and does not interpret any result.',
    'Nothing has been written to the record. The doctor edits and signs.',
  ];
  return lines.join('\n');
}

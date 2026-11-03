import type {
  DeltaBlock,
  DeltaCounts,
  DeltaEvidence,
  DeltaInput,
  DeltaItem,
  DeltaObservationInput,
  DeltaSummary,
} from '@glucoflow/contracts';
import { ISSUE_LABELS, type IssueCode } from '@glucoflow/contracts';

/**
 * Builds the doctor's delta from approved facts, patient notes and document
 * state. The function is pure and deterministic so the same input produces the
 * same brief on the server, in the demo, and in a test.
 *
 * It never interprets a value, never calculates a clinical risk and never
 * decides treatment. It reports changes, open items, disagreements and gaps.
 */

const DAY_MS = 86_400_000;
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDate(value: string | null): string {
  if (!value) return 'an earlier date';
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(parsed) ? value : DATE_FORMAT.format(parsed);
}

function toDay(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function dayValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

export function daysBetween(from: string | null, to: string): number | null {
  const a = dayValue(from);
  const b = dayValue(to);
  if (a === null || b === null) return null;
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

function isAfter(value: string | null, reference: string | null): boolean {
  if (!reference) return true;
  const a = dayValue(value);
  const b = dayValue(reference);
  if (a === null) return false;
  if (b === null) return true;
  return a > b;
}

function formatNumber(value: number | null): string {
  if (value === null) return '';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function signed(value: number, unit: string | null): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)}${unit ? ` ${unit}` : ''}`;
}

function itemId(block: DeltaBlock, key: string): string {
  return `${block}:${key}`;
}

function evidenceLabel(evidence: DeltaEvidence[]): string {
  const first = evidence[0];
  if (!first) return 'No source attached';
  return `${first.documentName}, page ${first.page}`;
}

function applyDisposition(item: DeltaItem, input: DeltaInput): DeltaItem {
  const disposition = input.dispositions?.[item.id];
  if (!disposition) return item;
  return {
    ...item,
    status: disposition.action,
    dispositionNote: disposition.note,
  };
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    medication: 'Medication taking',
    symptoms: 'Symptoms',
    diet_activity: 'Diet and activity',
    other: 'Other',
  };
  return labels[category] ?? category.replaceAll('_', ' ');
}

function sortByDateDesc<T extends { date: string | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''));
}

function conflictQuote(body: string, label: string): string {
  const sentences = body.split(/(?<=[.!?])\s+/);
  const relevant =
    sentences.find((sentence) => sentence.toLowerCase().includes(label.toLowerCase())) ??
    sentences.find((sentence) => /stop|discontinu|not taking|missed/i.test(sentence)) ??
    sentences[0] ??
    body;
  return relevant.length > 160 ? `${relevant.slice(0, 157)}...` : relevant;
}

export function buildDelta(input: DeltaInput): DeltaSummary {
  const reference = toDay(input.lastVisitDate);
  const asOf = toDay(input.asOf) ?? input.asOf;
  const changed: DeltaItem[] = [];
  const unresolved: DeltaItem[] = [];
  const conflicts: DeltaItem[] = [];
  const unknown: DeltaItem[] = [];
  const unknownTitles = new Set<string>();
  const unresolvedTitles = new Set<string>();

  const observations = [...input.observations].sort((left, right) =>
    (left.date ?? '').localeCompare(right.date ?? ''),
  );
  const byTest = new Map<string, DeltaObservationInput[]>();
  for (const observation of observations) {
    const list = byTest.get(observation.testCode) ?? [];
    list.push(observation);
    byTest.set(observation.testCode, list);
  }

  const conflictKeys = new Set<string>();
  for (const group of byTest.values()) {
    const byDate = new Map<string, number[]>();
    for (const observation of group) {
      if (observation.numericValue === null || !observation.date) continue;
      const values = byDate.get(observation.date) ?? [];
      values.push(observation.numericValue);
      byDate.set(observation.date, values);
    }
    for (const [date, values] of byDate) {
      if (values.length > 1 && new Set(values.map((value) => value.toFixed(3))).size > 1) {
        conflictKeys.add(`${group[0]!.testCode}|${date}`);
      }
    }
  }

  for (const group of byTest.values()) {
    const latest = group.at(-1);
    if (!latest || !isAfter(latest.date, reference)) continue;
    if (latest.date && conflictKeys.has(`${latest.testCode}|${latest.date}`)) continue;
    const previous = group
      .slice(0, -1)
      .reverse()
      .find((candidate) => candidate.date !== latest.date && candidate.numericValue !== null);
    if (latest.numericValue !== null && previous?.numericValue !== null && previous) {
      const delta = latest.numericValue - previous.numericValue;
      if (Math.abs(delta) < 0.0001 && latest.unit === previous.unit) continue;
      changed.push({
        id: itemId('changed', latest.factId),
        block: 'changed',
        kind: 'observation',
        title: `${latest.displayName} ${signed(delta, latest.unit)}`,
        detail: `${formatNumber(previous.numericValue)}${previous.unit ? ` ${previous.unit}` : ''} on ${formatDate(previous.date)} to ${formatNumber(latest.numericValue)}${latest.unit ? ` ${latest.unit}` : ''} on ${formatDate(latest.date)}.`,
        why: reference
          ? `Changed since the previous record on ${formatDate(reference)}.`
          : 'Changed from the previous recorded result.',
        date: latest.date,
        ageDays: daysBetween(latest.date, asOf),
        magnitude: Math.abs(delta),
        testCode: latest.testCode,
        sourceLabel: evidenceLabel(latest.evidence),
        actionHint: 'Accept into the visit note',
        evidence: latest.evidence.slice(0, 2),
        status: 'open',
        dispositionNote: null,
      });
      continue;
    }
    changed.push({
      id: itemId('changed', latest.factId),
      block: 'changed',
      kind: 'observation',
      title: `New result: ${latest.displayName}`,
      detail: `${formatNumber(latest.numericValue)}${latest.unit ? ` ${latest.unit}` : ''} recorded on ${formatDate(latest.date)}.`,
      why: reference ? `Recorded after the previous record on ${formatDate(reference)}.` : 'Latest recorded result.',
      date: latest.date,
      ageDays: daysBetween(latest.date, asOf),
      magnitude: null,
      testCode: latest.testCode,
      sourceLabel: evidenceLabel(latest.evidence),
      actionHint: 'Accept into the visit note',
      evidence: latest.evidence.slice(0, 2),
      status: 'open',
      dispositionNote: null,
    });
  }

  const events = [...input.events].sort((left, right) =>
    (left.date ?? '').localeCompare(right.date ?? ''),
  );
  const previousEvents = new Map<string, (typeof events)[number]>();
  for (const event of events) {
    if (event.kind === 'observation_source_only') continue;
    const key = event.label.trim().toLowerCase();
    const previous = previousEvents.get(key);
    if (isAfter(event.date, reference)) {
      const changedDetail =
        previous && previous.detail && event.detail && previous.detail !== event.detail
          ? `${previous.detail} to ${event.detail}`
          : event.detail;
      changed.push({
        id: itemId('changed', event.factId),
        block: 'changed',
        kind: event.kind,
        title:
          event.kind === 'prescription'
            ? previous
              ? `Prescription changed: ${event.label}`
              : `New prescription: ${event.label}`
            : `New examination: ${event.label}`,
        detail: changedDetail ?? event.label,
        why: reference ? `Recorded after the previous record on ${formatDate(reference)}.` : 'Latest recorded event.',
        date: event.date,
        ageDays: daysBetween(event.date, asOf),
        sourceLabel: evidenceLabel(event.evidence),
        actionHint: 'Check against the current plan',
        evidence: event.evidence.slice(0, 2),
        status: 'open',
        dispositionNote: null,
      });
    }
    previousEvents.set(key, event);
  }

  for (const note of input.notes) {
    const noteDate = toDay(note.eventDate) ?? toDay(note.submittedAt);
    if (!isAfter(noteDate, reference)) continue;
    changed.push({
      id: itemId('changed', note.noteId),
      block: 'changed',
      kind: 'note',
      title: `Patient reported: ${categoryLabel(note.category)}`,
      detail: note.body.length > 240 ? `${note.body.slice(0, 237)}...` : note.body,
      why: 'Patient-reported. It is not a measured result and not a clinical finding.',
      date: noteDate,
      ageDays: daysBetween(noteDate, asOf),
      sourceLabel: 'Patient note',
      actionHint: 'Read and acknowledge',
      evidence: [],
      status: 'open',
      dispositionNote: null,
    });
  }

  const duplicateGroups = new Map<string, DeltaObservationInput[]>();
  for (const observation of observations) {
    if (observation.numericValue === null || !observation.date) continue;
    const key = `${observation.testCode}|${observation.date}`;
    const list = duplicateGroups.get(key) ?? [];
    list.push(observation);
    duplicateGroups.set(key, list);
  }
  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue;
    const first = group[0]!;
    const second = group[1]!;
    if (
      first.numericValue === null ||
      second.numericValue === null ||
      Math.abs(first.numericValue - second.numericValue) < 0.0001
    ) {
      continue;
    }
    conflicts.push({
      id: itemId('conflict', `${first.testCode}:${first.date}`),
      block: 'conflict',
      kind: 'observation',
      title: `Two ${first.displayName} values on ${formatDate(first.date)}`,
      detail: `${formatNumber(first.numericValue)}${first.unit ? ` ${first.unit}` : ''} and ${formatNumber(second.numericValue)}${second.unit ? ` ${second.unit}` : ''}. Both are kept. The product does not choose or average.`,
      why: 'Two sources disagree. A person has to decide which value applies.',
      date: first.date,
      ageDays: daysBetween(first.date, asOf),
      testCode: first.testCode,
      sourceLabel: `${evidenceLabel(first.evidence)} and ${evidenceLabel(second.evidence)}`,
      actionHint: 'Flag for the doctor',
      evidence: [...first.evidence.slice(0, 1), ...second.evidence.slice(0, 1)],
      status: 'open',
      dispositionNote: null,
    });
  }

  const latestPrescriptions = new Map<string, (typeof events)[number]>();
  for (const event of events) {
    if (event.kind !== 'prescription') continue;
    latestPrescriptions.set(event.label.trim().toLowerCase(), event);
  }
  const stopWords = /(stopped|stop|discontinued|left off|band|chhod|chhod diya|nahi le rahi|nahi le raha)/i;
  for (const note of input.notes) {
    if (!stopWords.test(note.body)) continue;
    const body = note.body.toLowerCase();
    for (const [label, prescription] of latestPrescriptions) {
      if (!body.includes(label)) continue;
      conflicts.push({
        id: itemId('conflict', `note:${note.noteId}:${label}`),
        block: 'conflict',
        kind: 'prescription',
        title: `Patient says ${prescription.label} was stopped`,
        detail: `Patient note: "${conflictQuote(note.body, prescription.label)}". The latest prescription on ${formatDate(prescription.date)} says ${prescription.detail ?? prescription.label}. The product does not decide which is current.`,
        why: 'The patient report and the prescription disagree.',
        date: prescription.date,
        ageDays: daysBetween(prescription.date, asOf),
        sourceLabel: evidenceLabel(prescription.evidence),
        actionHint: 'Ask the patient, then update the plan',
        evidence: prescription.evidence.slice(0, 1),
        status: 'open',
        dispositionNote: null,
      });
      break;
    }
  }

  for (const open of input.openItems) {
    const title = open.title.trim();
    if (unresolvedTitles.has(title)) continue;
    unresolvedTitles.add(title);
    unresolved.push({
      id: itemId('unresolved', open.id),
      block: 'unresolved',
      kind: open.kind,
      title,
      detail: open.detail,
      why: open.owner
        ? `Open item owned by ${open.owner}.`
        : 'No owner recorded. The clinic has to assign one.',
      date: open.date,
      ageDays: open.ageDays ?? daysBetween(open.date, asOf),
      sourceLabel: evidenceLabel(open.evidence),
      actionHint: open.actionHint,
      evidence: open.evidence,
      status: 'open',
      dispositionNote: null,
    });
  }

  for (const document of input.documents) {
    if (document.state === 'awaiting_review' || document.state === 'review_in_progress') {
      const title = `Report awaiting review: ${document.filename}`;
      if (!unresolvedTitles.has(title)) {
        unresolvedTitles.add(title);
        unresolved.push({
          id: itemId('unresolved', `document:${document.documentId}`),
          block: 'unresolved',
          kind: 'document',
          title,
          detail: 'The report is uploaded but not approved, so it is not in the chart yet.',
          why: 'An unapproved report cannot be used in the visit note.',
          date: toDay(document.uploadedAt),
          ageDays: daysBetween(document.uploadedAt, asOf),
          sourceLabel: document.filename,
          actionHint: 'Review the document',
          evidence: [],
          status: 'open',
          dispositionNote: null,
        });
      }
    }
    for (const event of input.events) {
      if (event.kind !== 'observation_source_only') continue;
      const title = `Result not charted: ${event.label}`;
      if (unresolvedTitles.has(title)) continue;
      unresolvedTitles.add(title);
      unresolved.push({
        id: itemId('unresolved', event.factId),
        block: 'unresolved',
        kind: 'result',
        title,
        detail: event.detail ?? 'The source contains a result that was not turned into a charted fact.',
        why: 'The result is visible only in the source, not in the approved record.',
        date: event.date,
        ageDays: daysBetween(event.date, asOf),
        sourceLabel: evidenceLabel(event.evidence),
        actionHint: 'Open the source and decide',
        evidence: event.evidence.slice(0, 1),
        status: 'open',
        dispositionNote: null,
      });
    }
  }

  for (const item of input.unknownItems) {
    if (unknownTitles.has(item.title)) continue;
    unknownTitles.add(item.title);
    unknown.push({
      id: itemId('unknown', item.id),
      block: 'unknown',
      kind: 'document',
      title: item.title,
      detail: item.detail,
      why: 'The record cannot support a complete answer here. The product does not fill the gap.',
      date: item.date,
      ageDays: daysBetween(item.date, asOf),
      sourceLabel: evidenceLabel(item.evidence),
      actionHint: 'Ask the patient or request the missing record',
      evidence: item.evidence,
      status: 'open',
      dispositionNote: null,
    });
  }

  for (const observation of observations) {
    if (!observation.date || observation.datePrecision !== 'day') {
      const title = `Date is not exact: ${observation.displayName}`;
      if (!unknownTitles.has(title)) {
        unknownTitles.add(title);
        unknown.push({
          id: itemId('unknown', `${observation.factId}:date`),
          block: 'unknown',
          kind: 'observation',
          title,
          detail: `Recorded as "${observation.date ?? 'no date'}" with ${observation.datePrecision.replaceAll('_', ' ')} precision. It is shown, not plotted as a day.`,
          why: 'An exact date is not available in the source.',
          date: observation.date,
          ageDays: daysBetween(observation.date, asOf),
          sourceLabel: evidenceLabel(observation.evidence),
          actionHint: 'Confirm the date',
          evidence: observation.evidence.slice(0, 1),
          status: 'open',
          dispositionNote: null,
        });
      }
    }
    if (observation.numericValue !== null && !observation.unit) {
      const title = `Unit is missing: ${observation.displayName}`;
      if (!unknownTitles.has(title)) {
        unknownTitles.add(title);
        unknown.push({
          id: itemId('unknown', `${observation.factId}:unit`),
          block: 'unknown',
          kind: 'observation',
          title,
          detail: 'A numeric value is recorded without a unit, so it is not comparable with the other results.',
          why: 'No unit was read from the source.',
          date: observation.date,
          ageDays: daysBetween(observation.date, asOf),
          sourceLabel: evidenceLabel(observation.evidence),
          actionHint: 'Check the source unit',
          evidence: observation.evidence.slice(0, 1),
          status: 'open',
          dispositionNote: null,
        });
      }
    }
  }

  for (const document of input.documents) {
    for (const issue of document.issues) {
      const label = ISSUE_LABELS[issue as IssueCode];
      if (!label) continue;
      const title = `${label}: ${document.filename}`;
      if (unknownTitles.has(title)) continue;
      unknownTitles.add(title);
      unknown.push({
        id: itemId('unknown', `document:${document.documentId}:${issue}`),
        block: 'unknown',
        kind: 'document',
        title,
        detail: 'The source has a known limitation. It is recorded so the doctor can see what the chart cannot show.',
        why: 'The document carries an issue code.',
        date: toDay(document.uploadedAt),
        ageDays: daysBetween(document.uploadedAt, asOf),
        sourceLabel: document.filename,
        actionHint: 'Open the source',
        evidence: [],
        status: 'open',
        dispositionNote: null,
      });
    }
    if (document.coverageNote) {
      const title = `Partial source: ${document.filename}`;
      if (!unknownTitles.has(title)) {
        unknownTitles.add(title);
        unknown.push({
          id: itemId('unknown', `document:${document.documentId}:coverage`),
          block: 'unknown',
          kind: 'document',
          title,
          detail: document.coverageNote,
          why: 'The source is only partially represented.',
          date: toDay(document.uploadedAt),
          ageDays: daysBetween(document.uploadedAt, asOf),
          sourceLabel: document.filename,
          actionHint: 'Open the source',
          evidence: [],
          status: 'open',
          dispositionNote: null,
        });
      }
    }
  }

  const changedWithStatus = sortByDateDesc(changed).map((item) => applyDisposition(item, input));
  const unresolvedWithStatus = [...unresolved]
    .sort((left, right) => (right.ageDays ?? -1) - (left.ageDays ?? -1))
    .map((item) => applyDisposition(item, input));
  const conflictsWithStatus = sortByDateDesc(conflicts).map((item) => applyDisposition(item, input));
  const unknownWithStatus = sortByDateDesc(unknown).map((item) => applyDisposition(item, input));

  const counts: DeltaCounts = {
    changed: changedWithStatus.length,
    unresolved: unresolvedWithStatus.length,
    conflict: conflictsWithStatus.length,
    unknown: unknownWithStatus.length,
  };
  const total = counts.changed + counts.unresolved + counts.conflict + counts.unknown;
  const readSeconds = input.estimatedReadSeconds
    ? input.estimatedReadSeconds
    : Math.min(90, Math.max(20, 14 + total * 6));

  const narrative = [
    `${counts.changed} ${counts.changed === 1 ? 'change' : 'changes'}`,
    `${counts.unresolved} unresolved`,
    `${counts.conflict} ${counts.conflict === 1 ? 'conflict' : 'conflicts'}`,
    `${counts.unknown} ${counts.unknown === 1 ? 'gap' : 'gaps'}`,
  ].join(' · ');

  return {
    patient: input.patient,
    asOf,
    lastVisitDate: reference,
    counts,
    blocks: {
      changed: changedWithStatus,
      unresolved: unresolvedWithStatus,
      conflict: conflictsWithStatus,
      unknown: unknownWithStatus,
    },
    narrative,
    readSeconds,
    truncated: input.truncated ?? false,
    scopeNote:
      'Built from approved records and labelled patient notes. Drafts, unapproved documents and excluded facts are not used. Every line opens its source.',
  };
}

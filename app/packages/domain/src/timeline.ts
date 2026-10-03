import {
  TIMELINE_DISPLAY_BOUND,
  testDisplayName,
  type TimelineDisplayRow,
  type TimelineEvent,
  type TimelineNote,
  type TimelineObservation,
  type TimelineQuery,
  type TimelineResult,
} from '@sutra/contracts';
import { compareDates } from './dates';

/**
 * Progression view model. Pure functions: the same code builds the clinic chart,
 * the patient chart and the accessible table, so the table always exposes exactly
 * the plotted values.
 * Source: docs/mvp/02-screens-and-design.md "Progression details".
 */

export type TimelineRecords = {
  observations: TimelineObservation[];
  events: TimelineEvent[];
  notes: TimelineNote[];
};

export type TimelineTotals = {
  observationCount: number;
  eventCount: number;
  noteCount: number;
  latestReportDate: string | null;
  awaitingReviewCount: number;
  sourceOnlyCount: number;
};

export function isWithinRange(date: string | null, from?: string, to?: string): boolean {
  if (date === null) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function filterObservations(
  observations: TimelineObservation[],
  query: TimelineQuery,
): TimelineObservation[] {
  const codes = new Set(query.testCodes);
  return observations.filter((observation) => {
    if (codes.size > 0 && !codes.has(observation.testCode)) return false;
    if (observation.date === null) return query.from === undefined && query.to === undefined;
    return isWithinRange(observation.date, query.from, query.to);
  });
}

export type TimelineSeriesPoint = {
  factId: string;
  date: string;
  value: number;
  rawValue: string | null;
  unit: string | null;
  dateKind: string;
  referenceRangeText: string | null;
  groupId: string | null;
};

export type TimelineSeries = {
  key: string;
  testCode: string;
  label: string;
  unit: string | null;
  points: TimelineSeriesPoint[];
};

/**
 * Groups plotted observations into series keyed by test code and unit.
 * Incompatible units are never combined on one axis and no conversion happens.
 */
export function buildSeries(observations: TimelineObservation[]): TimelineSeries[] {
  const seriesMap = new Map<string, TimelineSeries>();
  for (const observation of observations) {
    if (!observation.plotEligible) continue;
    if (observation.numericValue === null) continue;
    if (observation.date === null) continue;
    const key = `${observation.testCode}|${observation.unit ?? ''}`;
    let series = seriesMap.get(key);
    if (!series) {
      series = {
        key,
        testCode: observation.testCode,
        label: testDisplayName(observation.testCode),
        unit: observation.unit,
        points: [],
      };
      seriesMap.set(key, series);
    }
    series.points.push({
      factId: observation.factId,
      date: observation.date,
      value: observation.numericValue,
      rawValue: observation.rawValue,
      unit: observation.unit,
      dateKind: observation.dateKind,
      referenceRangeText: observation.referenceRangeText,
      groupId: observation.groupId,
    });
  }
  const series = [...seriesMap.values()];
  for (const item of series) {
    item.points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  // Stable panel order: by test code then unit.
  series.sort((a, b) => (a.testCode === b.testCode ? (a.unit ?? '').localeCompare(b.unit ?? '') : a.testCode.localeCompare(b.testCode)));
  return series;
}

export function buildTableRows(
  observations: TimelineObservation[],
  events: TimelineEvent[],
  notes: TimelineNote[],
): TimelineDisplayRow[] {
  const rows: TimelineDisplayRow[] = [];
  for (const observation of observations) {
    if (!observation.plotEligible) continue;
    rows.push({
      key: `obs-${observation.factId}`,
      date: observation.date,
      label: testDisplayName(observation.testCode),
      value: observation.numericValue === null ? (observation.rawValue ?? '') : String(observation.numericValue),
      unit: observation.unit,
      testCode: observation.testCode,
      seriesKey: `${observation.testCode}|${observation.unit ?? ''}`,
    });
  }
  for (const observation of observations) {
    if (observation.plotEligible) continue;
    rows.push({
      key: `src-${observation.factId}`,
      date: observation.date,
      label: testDisplayName(observation.testCode),
      value: observation.rawValue ?? '',
      unit: observation.rawUnit,
      testCode: observation.testCode,
      seriesKey: `${observation.testCode}|source-only`,
    });
  }
  for (const event of events) {
    rows.push({
      key: `evt-${event.factId}`,
      date: event.date,
      label: event.label,
      value: event.detail ?? '',
      unit: null,
      testCode: null,
      seriesKey: 'event',
    });
  }
  for (const note of notes) {
    rows.push({
      key: `note-${note.noteId}`,
      date: note.eventDate,
      label: 'Patient-reported note',
      value: note.body,
      unit: null,
      testCode: null,
      seriesKey: 'note',
    });
  }
  rows.sort((a, b) => compareDates(b.date, a.date));
  return rows;
}

export function buildTimeline(
  records: TimelineRecords,
  query: TimelineQuery,
  totals: TimelineTotals,
): TimelineResult {
  const observations = filterObservations(records.observations, query);
  const bounded = observations.slice(0, TIMELINE_DISPLAY_BOUND);
  const truncated = totals.observationCount > TIMELINE_DISPLAY_BOUND;
  const loadedAll = records.observations.length >= totals.observationCount;

  const unitsInUse = new Map<string, { testCode: string; unit: string | null; count: number }>();
  for (const observation of bounded) {
    const key = `${observation.testCode}|${observation.unit ?? ''}`;
    const entry = unitsInUse.get(key) ?? {
      testCode: observation.testCode,
      unit: observation.unit,
      count: 0,
    };
    entry.count += 1;
    unitsInUse.set(key, entry);
  }

  return {
    observations: bounded,
    events: records.events,
    notes: records.notes,
    coverage: {
      from: query.from ?? null,
      to: query.to ?? null,
      testCodes: query.testCodes,
      observationCount: totals.observationCount,
      displayBound: TIMELINE_DISPLAY_BOUND,
      truncated,
    },
    observationsComplete: loadedAll && !truncated,
    nextCursor: null,
    eventsNextCursor: null,
    notesNextCursor: null,
    latestReportDate: totals.latestReportDate,
    awaitingReviewCount: totals.awaitingReviewCount,
    sourceOnlyCount: totals.sourceOnlyCount,
    unitsInUse: [...unitsInUse.values()].sort((a, b) => a.testCode.localeCompare(b.testCode)),
    issueSummary: [],
  };
}

/**
 * Availability wording. An empty result or a missing record never becomes a
 * clinical statement about whether a test was performed.
 */
export function recordAvailabilityLabel(input: {
  latestReportDate: string | null;
  awaitingReviewCount: number;
}): string {
  if (input.awaitingReviewCount > 0) return 'Awaiting review';
  if (input.latestReportDate) return `Latest report: ${input.latestReportDate}`;
  return 'No matching report in uploaded records';
}

export function describeCoverageScope(result: TimelineResult): string {
  const parts: string[] = [];
  parts.push(
    result.coverage.from || result.coverage.to
      ? `Dates ${result.coverage.from ?? 'earliest'} to ${result.coverage.to ?? 'latest'}`
      : 'All recorded dates',
  );
  parts.push(
    result.coverage.testCodes.length > 0
      ? `Tests: ${result.coverage.testCodes.map((code) => testDisplayName(code)).join(', ')}`
      : 'All supported tests',
  );
  return `${parts.join(' · ')} · ${result.coverage.observationCount} recorded result${
    result.coverage.observationCount === 1 ? '' : 's'
  } in approved records`;
}

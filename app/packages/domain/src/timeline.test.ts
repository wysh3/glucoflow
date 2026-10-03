import { describe, expect, it } from 'vitest';
import {
  buildSeries,
  buildTableRows,
  buildTimeline,
  describeCoverageScope,
  filterObservations,
  recordAvailabilityLabel,
} from './timeline';
import type { TimelineEvent, TimelineNote, TimelineObservation } from '@glucoflow/contracts';

/** Timeline rules: date spacing, unit separation, table equivalence, availability wording. */

function observation(overrides: Partial<TimelineObservation>): TimelineObservation {
  return {
    factId: overrides.factId ?? 'f1',
    testCode: overrides.testCode ?? 'hba1c',
    displayName: overrides.displayName ?? 'HbA1c',
    numericValue: overrides.numericValue === undefined ? 8.2 : overrides.numericValue,
    unit: overrides.unit === undefined ? '%' : overrides.unit,
    rawValue: overrides.rawValue ?? '8.2',
    rawUnit: overrides.rawUnit ?? '%',
    date: overrides.date === undefined ? '2026-01-12' : overrides.date,
    dateKind: overrides.dateKind ?? 'collection',
    datePrecision: overrides.datePrecision ?? 'day',
    referenceRangeText: overrides.referenceRangeText ?? null,
    plotEligible: overrides.plotEligible === undefined ? true : overrides.plotEligible,
    groupId: overrides.groupId ?? null,
    documentId: overrides.documentId ?? 'doc-1',
    documentVersionId: overrides.documentVersionId ?? 'ver-1',
    approvalRevision: overrides.approvalRevision ?? 1,
    status: overrides.status ?? 'retained',
    evidence: overrides.evidence ?? [],
  };
}

const resetHistory: TimelineObservation[] = [
  observation({ factId: 'jan', numericValue: 8.2, date: '2026-01-12' }),
  observation({ factId: 'apr', numericValue: 7.9, date: '2026-04-10' }),
  observation({ factId: 'jul', numericValue: 7.5, date: '2026-07-09' }),
];

const emptyEvents: TimelineEvent[] = [];
const emptyNotes: TimelineNote[] = [];

const totals = {
  observationCount: 3,
  eventCount: 0,
  noteCount: 0,
  latestReportDate: '2026-07-09',
  awaitingReviewCount: 0,
  sourceOnlyCount: 0,
};

describe('progression timeline', () => {
  it('plots the three approved reset points in date order', () => {
    const series = buildSeries(resetHistory);
    expect(series).toHaveLength(1);
    expect(series[0]!.points.map((point) => point.date)).toEqual([
      '2026-01-12',
      '2026-04-10',
      '2026-07-09',
    ]);
    expect(series[0]!.points.map((point) => point.value)).toEqual([8.2, 7.9, 7.5]);
  });

  it('keeps incompatible units in separate series and never converts', () => {
    const mixed = [
      observation({ factId: 'a', testCode: 'glucose_fasting', displayName: 'Fasting glucose', unit: 'mg/dl', numericValue: 142 }),
      observation({ factId: 'b', testCode: 'glucose_fasting', displayName: 'Fasting glucose', unit: 'mmol/l', numericValue: 7.9 }),
    ];
    const series = buildSeries(mixed);
    expect(series).toHaveLength(2);
    expect(series.map((item) => item.unit).sort()).toEqual(['mg/dl', 'mmol/l']);
  });

  it('never plots a partial date or an ambiguous date', () => {
    const partial = [
      observation({ factId: 'p1', date: null, datePrecision: 'unknown', plotEligible: false }),
    ];
    expect(buildSeries(partial)).toHaveLength(0);
    const table = buildTableRows(partial, emptyEvents, emptyNotes);
    expect(table).toHaveLength(1);
    expect(table[0]!.date).toBeNull();
  });

  it('keeps a report-date fact labelled and plottable', () => {
    const reportDated = [observation({ factId: 'r1', dateKind: 'report' })];
    const series = buildSeries(reportDated);
    expect(series[0]!.points[0]!.dateKind).toBe('report');
  });

  it('filters by date range and by test code', () => {
    const filtered = filterObservations(resetHistory, {
      testCodes: ['hba1c'],
      from: '2026-02-01',
      to: '2026-06-01',
    });
    expect(filtered.map((item) => item.factId)).toEqual(['apr']);
    expect(filterObservations(resetHistory, { testCodes: ['egfr'] })).toHaveLength(0);
  });

  it('exposes exactly the plotted values in the table equivalent', () => {
    const series = buildSeries(resetHistory);
    const table = buildTableRows(resetHistory, emptyEvents, emptyNotes);
    const plotted = series.flatMap((item) => item.points.map((point) => `${point.date}|${point.value}`));
    const tabulated = table
      .filter((row) => row.testCode === 'hba1c')
      .map((row) => `${row.date}|${row.value}`);
    expect(new Set(tabulated)).toEqual(new Set(plotted));
    expect(table.every((row) => row.seriesKey.length > 0)).toBe(true);
  });

  it('reports an incomplete chart instead of silently truncating past the display bound', () => {
    const many = Array.from({ length: 2500 }, (_, index) =>
      observation({
        factId: `f${index}`,
        date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
      }),
    );
    const result = buildTimeline(
      { observations: many, events: [], notes: [] },
      { testCodes: ['hba1c'] },
      { ...totals, observationCount: many.length },
    );
    expect(result.coverage.truncated).toBe(true);
    expect(result.observationsComplete).toBe(false);
    expect(result.observations).toHaveLength(2000);
  });

  it('states the collection scope and never infers a missing test', () => {
    const result = buildTimeline(
      { observations: resetHistory, events: [], notes: [] },
      { testCodes: ['hba1c'], from: '2026-01-01', to: '2026-07-31' },
      totals,
    );
    expect(describeCoverageScope(result)).toContain('2026-01-01');
    expect(recordAvailabilityLabel({ latestReportDate: '2026-07-09', awaitingReviewCount: 0 })).toBe(
      'Latest report: 2026-07-09',
    );
    expect(recordAvailabilityLabel({ latestReportDate: null, awaitingReviewCount: 0 })).toBe(
      'No matching report in uploaded records',
    );
    expect(recordAvailabilityLabel({ latestReportDate: '2026-07-09', awaitingReviewCount: 2 })).toBe(
      'Awaiting review',
    );
    const text = JSON.stringify(result);
    for (const forbidden of ['overdue', 'risk', 'normal', 'safe']) {
      expect(text.toLowerCase()).not.toContain(forbidden);
    }
  });
});

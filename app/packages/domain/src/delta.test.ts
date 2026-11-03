import { describe, expect, it } from 'vitest';
import type { DeltaEvidence, DeltaInput } from '@glucoflow/contracts';
import { buildDelta } from './delta';

const evidence = (name: string, quote: string): DeltaEvidence => ({
  documentId: `doc-${name}`,
  documentVersionId: `ver-${name}`,
  documentName: name,
  page: 1,
  quote,
  bbox: null,
});

function input(overrides: Partial<DeltaInput> = {}): DeltaInput {
  return {
    patient: {
      patientId: 'p1',
      displayName: 'Asha Rao',
      clinicIdentifier: 'P0482',
      birthDate: '1968-03-14',
    },
    asOf: '2026-11-03',
    lastVisitDate: '2026-04-10',
    observations: [
      {
        factId: 'egfr-apr',
        testCode: 'egfr',
        displayName: 'eGFR',
        numericValue: 70,
        unit: 'mL/min/1.73m2',
        date: '2026-04-10',
        datePrecision: 'day',
        status: 'retained',
        evidence: [evidence('apr.pdf', 'eGFR 70')],
      },
      {
        factId: 'egfr-jul',
        testCode: 'egfr',
        displayName: 'eGFR',
        numericValue: 55,
        unit: 'mL/min/1.73m2',
        date: '2026-07-09',
        datePrecision: 'day',
        status: 'retained',
        evidence: [evidence('jul.pdf', 'eGFR 55')],
      },
      {
        factId: 'hba1c-apr',
        testCode: 'hba1c',
        displayName: 'HbA1c',
        numericValue: 7.2,
        unit: '%',
        date: '2026-04-10',
        datePrecision: 'day',
        status: 'retained',
        evidence: [evidence('apr.pdf', 'HbA1c 7.2')],
      },
      {
        factId: 'hba1c-jul-a',
        testCode: 'hba1c',
        displayName: 'HbA1c',
        numericValue: 7.5,
        unit: '%',
        date: '2026-07-09',
        datePrecision: 'day',
        status: 'retained',
        evidence: [evidence('jul.pdf', 'HbA1c 7.5')],
      },
      {
        factId: 'hba1c-jul-b',
        testCode: 'hba1c',
        displayName: 'HbA1c',
        numericValue: 8.1,
        unit: '%',
        date: '2026-07-09',
        datePrecision: 'day',
        status: 'retained',
        evidence: [evidence('second.pdf', 'HbA1c 8.1')],
      },
      {
        factId: 'creatinine-2022',
        testCode: 'creatinine',
        displayName: 'Creatinine',
        numericValue: 1.1,
        unit: null,
        date: '2022-01-01',
        datePrecision: 'year',
        status: 'retained',
        evidence: [evidence('2022.pdf', 'Creatinine 1.1')],
      },
    ],
    events: [
      {
        factId: 'rx-atorva',
        kind: 'prescription',
        label: 'Atorvastatin',
        detail: '10 mg once daily',
        date: '2026-03-02',
        status: 'retained',
        evidence: [evidence('rx.pdf', 'Atorvastatin 10 mg')],
      },
    ],
    notes: [
      {
        noteId: 'note-1',
        category: 'symptoms',
        body: 'I stopped atorvastatin because my muscles hurt.',
        eventDate: '2026-09-10',
        submittedAt: '2026-09-10T18:00:00.000Z',
      },
    ],
    documents: [
      {
        documentId: 'doc-vitd',
        filename: 'vitamin_d.pdf',
        kind: 'lab_report',
        state: 'awaiting_review',
        pageCount: 1,
        uploadedAt: '2026-08-30T10:00:00.000Z',
        issues: [],
        coverageNote: null,
      },
      {
        documentId: 'doc-discharge',
        filename: 'discharge.pdf',
        kind: 'discharge_summary',
        state: 'approved',
        pageCount: 3,
        uploadedAt: '2023-11-02T10:00:00.000Z',
        issues: [],
        coverageNote: 'Page 2 was excluded during review.',
      },
    ],
    openItems: [
      {
        id: 'eye',
        kind: 'referral',
        title: 'Eye review has no later record',
        detail: 'The 2025 report asks for a review in 12 months.',
        date: '2025-05-20',
        ageDays: null,
        owner: 'Dr Meera Nair',
        actionHint: 'Book the review or document why not',
        evidence: [evidence('eye.pdf', 'Review in 12 months')],
      },
    ],
    unknownItems: [],
    dispositions: {},
    ...overrides,
  };
}

describe('buildDelta', () => {
  it('separates changes, open items, conflicts and gaps', () => {
    const delta = buildDelta(input());
    expect(delta.counts.changed).toBe(2);
    expect(delta.counts.unresolved).toBe(2);
    expect(delta.counts.conflict).toBe(2);
    expect(delta.counts.unknown).toBe(3);
    expect(delta.blocks.changed.map((item) => item.title)).toContain('eGFR -15 mL/min/1.73m2');
    expect(delta.blocks.changed.map((item) => item.title)).not.toContain('HbA1c +0.9 %');
    expect(delta.blocks.conflict.map((item) => item.title)).toContain(
      'Two HbA1c values on 09 Jul 2026',
    );
    expect(delta.blocks.conflict.map((item) => item.title)).toContain(
      'Patient says Atorvastatin was stopped',
    );
    expect(delta.blocks.unresolved.map((item) => item.title)).toContain(
      'Report awaiting review: vitamin_d.pdf',
    );
    expect(delta.blocks.unknown.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        'Partial source: discharge.pdf',
        'Date is not exact: Creatinine',
        'Unit is missing: Creatinine',
      ]),
    );
  });

  it('applies the latest disposition to the item', () => {
    const delta = buildDelta(
      input({
        dispositions: {
          'changed:egfr-jul': {
            action: 'accepted',
            note: null,
            actorName: 'Dr Meera Nair',
            createdAt: '2026-11-03T10:00:00.000Z',
          },
        },
      }),
    );
    const egfr = delta.blocks.changed.find((item) => item.id === 'changed:egfr-jul');
    expect(egfr?.status).toBe('accepted');
  });

  it('does not invent a change for a test with the same value on both dates', () => {
    const delta = buildDelta(
      input({
        observations: input().observations.map((item) =>
          item.testCode === 'hba1c' ? { ...item, numericValue: 7.2 } : item,
        ),
      }),
    );
    expect(delta.blocks.changed.map((item) => item.title)).not.toContain('HbA1c 0 %');
    expect(delta.counts.conflict).toBe(1);
  });

  it('is deterministic', () => {
    expect(buildDelta(input())).toEqual(buildDelta(input()));
  });
});

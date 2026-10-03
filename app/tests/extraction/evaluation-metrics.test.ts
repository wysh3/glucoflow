/**
 * The complete-field metric is the headline number in the extraction reports, so its
 * rules are tested directly: a wrong date, a wrong test or a wrong identity must each stop
 * a fact from counting as complete.
 */
import { describe, expect, it } from 'vitest';
import {
  computeMetrics,
  identityMatches,
  matchFacts,
  type ExpectedFact,
  type Observation,
} from '../../scripts/lib/evaluation-metrics';

const expected: ExpectedFact[] = [
  { kind: 'observation', testCode: 'hba1c', value: '7.6', unit: '%', date: '2026-08-12' },
  { kind: 'observation', testCode: 'glucose_fasting', value: '132', unit: 'mg/dl', date: '2026-08-12' },
];

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    rawLabel: 'HbA1c',
    testCode: 'hba1c',
    value: '7.6',
    unit: '%',
    eventDate: '2026-08-12',
    ...overrides,
  };
}

describe('complete-field accuracy', () => {
  it('counts a fact complete only when the date is right as well', () => {
    const metrics = computeMetrics({
      documents: [
        {
          expectedFacts: expected,
          observations: [observation()],
          expectedIdentity: 'matched',
          identityState: 'matched',
          issues: [],
        },
      ],
    });
    expect(metrics.matchedFacts).toBe(1);
    expect(metrics.completeFieldAccuracy).toBe(0.5);
    expect(metrics.completeFieldAccuracyNoDate).toBe(0.5);
    expect(metrics.dateExactRate).toBe(1);
  });

  it('refuses to count a wrong date as a complete field', () => {
    const metrics = computeMetrics({
      documents: [
        {
          expectedFacts: expected,
          observations: [observation({ eventDate: '2026-08-13' })],
          expectedIdentity: 'matched',
          identityState: 'matched',
          issues: [],
        },
      ],
    });
    expect(metrics.matchedFacts).toBe(1);
    // The value, unit and test match, but the date does not, so the field is not complete.
    expect(metrics.completeFieldAccuracy).toBe(0);
    expect(metrics.completeFieldAccuracyNoDate).toBe(0.5);
    expect(metrics.dateExactRate).toBe(0);
  });

  it('refuses to count a wrong unit as a complete field', () => {
    const metrics = computeMetrics({
      documents: [
        {
          expectedFacts: expected,
          observations: [observation({ unit: 'mmol/mol' })],
          expectedIdentity: 'matched',
          identityState: 'matched',
          issues: [],
        },
      ],
    });
    expect(metrics.completeFieldAccuracy).toBe(0);
    expect(metrics.unitExactRate).toBe(0);
  });

  it('refuses to count a fact filed under the wrong patient', () => {
    const metrics = computeMetrics({
      documents: [
        {
          expectedFacts: expected,
          observations: [observation()],
          expectedIdentity: 'matched',
          identityState: 'unchecked',
          issues: ['identity_missing'],
        },
      ],
    });
    expect(metrics.matchedFacts).toBe(1);
    expect(metrics.completeFieldAccuracy).toBe(0);
    expect(metrics.identityStateAccuracy).toBe(0);
  });

  it('does not let an unmapped label claim a mapped test with the same value', () => {
    const matches = matchFacts(expected, [observation({ testCode: null, rawLabel: 'Result' })]);
    expect(matches).toHaveLength(0);
  });

  it('still matches an unmapped reference fact, such as a prescription', () => {
    const prescriptions: ExpectedFact[] = [
      { kind: 'prescription', testCode: null, value: 'Metformin', unit: '1000 mg', date: '2026-09-02' },
    ];
    const matches = matchFacts(prescriptions, [
      { rawLabel: 'Metformin', testCode: null, value: 'Metformin', unit: '1000 mg', eventDate: '2026-09-02' },
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.complete).toBe(true);
  });
});

describe('identity scoring', () => {
  it('requires the exact expected state', () => {
    expect(identityMatches('matched', 'matched', [])).toBe(true);
    expect(identityMatches('matched', 'unchecked', ['identity_missing'])).toBe(false);
    expect(identityMatches('mismatch', 'mismatch', ['identity_mismatch'])).toBe(true);
    // A document with no identifier must be unchecked *and* flagged, not merely "not matched".
    expect(identityMatches('missing', 'unchecked', ['identity_missing'])).toBe(true);
    expect(identityMatches('missing', 'unchecked', [])).toBe(false);
    expect(identityMatches('missing', 'mismatch', ['identity_mismatch'])).toBe(false);
  });
});

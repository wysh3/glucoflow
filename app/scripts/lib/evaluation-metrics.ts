/**
 * Evaluation metrics.
 *
 * These live in their own module because the first version of the metric was wrong in a
 * way the reports did not show: "complete fields" counted the unit but not the date, so a
 * wrong date still scored as complete. The rules below are explicit and unit-tested
 * against wrong-date, wrong-test and wrong-identity examples.
 */

export type ExpectedFact = {
  kind: string;
  testCode: string | null;
  value: string | null;
  unit: string | null;
  date: string | null;
};

export type Observation = {
  rawLabel: string;
  testCode: string | null;
  value: string;
  unit: string;
  eventDate: string | null;
};

export type IdentityExpectation = 'matched' | 'missing' | 'mismatch';

/**
 * The identity states the pipeline can report. `missing_confirmed` is a reviewer decision
 * recorded on the batch, not something extraction produces, so a document under test must
 * never be in that state.
 */
export type IdentityState = 'matched' | 'unchecked' | 'mismatch' | 'missing_confirmed';

export type FactMatch = {
  observation: Observation;
  expectedIndex: number;
  testOk: boolean;
  valueOk: boolean;
  unitOk: boolean;
  dateOk: boolean;
  /** Every field together: what a reviewer would accept without editing. */
  complete: boolean;
};

export function normalizeValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const trimmed = String(value).trim();
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? String(numeric) : trimmed.toLowerCase();
}

/**
 * A label the extractor could not map has no test code. It may only be matched against a
 * reference fact that also has no code (a prescription or an examination), never against
 * any reference fact that happens to share its value.
 */
function testMatches(expected: ExpectedFact, observation: Observation): boolean {
  if (expected.testCode === null) return observation.testCode === null;
  return observation.testCode === expected.testCode;
}

/**
 * Pairs observations with reference facts, in order, one reference fact per observation.
 * The pairing is greedy on an exact test-and-value match first, then on value alone, so a
 * document that lists the same test twice still pairs both.
 */
export function matchFacts(expected: ExpectedFact[], observations: Observation[]): FactMatch[] {
  const used = new Set<number>();
  const matches: FactMatch[] = [];

  const claim = (observation: Observation, exactOnly: boolean): void => {
    const index = expected.findIndex((fact, position) => {
      if (used.has(position)) return false;
      if (!testMatches(fact, observation)) return false;
      if (normalizeValue(fact.value) !== normalizeValue(observation.value)) return false;
      if (exactOnly) return true;
      return true;
    });
    if (index < 0) return;
    used.add(index);
    const fact = expected[index]!;
    const unitOk = (fact.unit ?? '').toLowerCase() === (observation.unit ?? '').toLowerCase();
    const dateOk = fact.date !== null && fact.date === observation.eventDate;
    matches.push({
      observation,
      expectedIndex: index,
      testOk: true,
      valueOk: true,
      unitOk,
      dateOk,
      complete: unitOk && dateOk,
    });
  };

  // A mapped label is paired first so an unmapped observation cannot take its slot.
  for (const observation of observations) {
    if (observation.testCode !== null) claim(observation, true);
  }
  for (const observation of observations) {
    if (observation.testCode === null) claim(observation, true);
  }
  return matches;
}

/**
 * Identity is scored as an exact state, not as "anything that is not matched". A document
 * expected to have no identifier must come back unchecked *and* flagged; a document
 * expected to belong to another patient must come back as a mismatch.
 */
export function identityMatches(
  expected: IdentityExpectation,
  actual: IdentityState,
  issues: string[],
): boolean {
  if (expected === 'matched') return actual === 'matched';
  if (expected === 'mismatch') return actual === 'mismatch';
  return (
    (actual === 'unchecked' || actual === 'missing_confirmed') && issues.includes('identity_missing')
  );
}

export type MetricsInput = {
  documents: {
    expectedFacts: ExpectedFact[];
    observations: Observation[];
    expectedIdentity: IdentityExpectation;
    identityState: IdentityState;
    issues: string[];
  }[];
};

export type Metrics = {
  factPrecision: number;
  factRecall: number;
  matchedFacts: number;
  missingFacts: number;
  extraFacts: number;
  /** Patient, test, value, unit and date all correct together. */
  completeFieldAccuracy: number;
  /** The same, with the date not required; reported only to show what the date costs. */
  completeFieldAccuracyNoDate: number;
  dateExactRate: number;
  unitExactRate: number;
  identityStateAccuracy: number;
  totals: { expectedFacts: number; observations: number; completeFields: number };
};

export function computeMetrics(input: MetricsInput): Metrics {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let complete = 0;
  let completeNoDate = 0;
  let expectedTotal = 0;
  let dateExact = 0;
  let dateTotal = 0;
  let unitExact = 0;
  let unitTotal = 0;
  let identityCorrect = 0;

  for (const document of input.documents) {
    const matches = matchFacts(document.expectedFacts, document.observations);
    truePositive += matches.length;
    falsePositive += document.observations.length - matches.length;
    falseNegative += document.expectedFacts.length - matches.length;
    expectedTotal += document.expectedFacts.length;

    const identityOk = identityMatches(
      document.expectedIdentity,
      document.identityState,
      document.issues,
    );
    if (identityOk) identityCorrect += 1;

    for (const match of matches) {
      dateTotal += 1;
      unitTotal += 1;
      if (match.dateOk) dateExact += 1;
      if (match.unitOk) unitExact += 1;
      // A correct value filed under the wrong patient is not a complete field.
      if (identityOk && match.unitOk) completeNoDate += 1;
      if (identityOk && match.complete) complete += 1;
    }
  }

  const precision = truePositive + falsePositive > 0 ? truePositive / (truePositive + falsePositive) : 0;
  const recall = expectedTotal > 0 ? truePositive / expectedTotal : 0;
  const round = (value: number): number => Number(value.toFixed(4));

  return {
    factPrecision: round(precision),
    factRecall: round(recall),
    matchedFacts: truePositive,
    missingFacts: falseNegative,
    extraFacts: falsePositive,
    completeFieldAccuracy: expectedTotal > 0 ? round(complete / expectedTotal) : 0,
    completeFieldAccuracyNoDate: expectedTotal > 0 ? round(completeNoDate / expectedTotal) : 0,
    dateExactRate: dateTotal > 0 ? round(dateExact / dateTotal) : 0,
    unitExactRate: unitTotal > 0 ? round(unitExact / unitTotal) : 0,
    identityStateAccuracy:
      input.documents.length > 0 ? round(identityCorrect / input.documents.length) : 0,
    totals: { expectedFacts: expectedTotal, observations: 0, completeFields: complete },
  };
}

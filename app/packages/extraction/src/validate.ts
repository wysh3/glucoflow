import type {
  DraftFactInput,
  EvidenceOrigin,
  ExtractionResult,
  IdentityState,
  IssueCode,
} from '@sutra/contracts';
import {
  checkUnit,
  identityStateFromInput,
  matchTestAlias,
  parseNumeric,
  type IdentityInput,
} from '@sutra/domain';

/**
 * Deterministic validation of a provider proposal. Unsupported or inconsistent
 * values never silently enter a chart.
 * Source: docs/mvp/04-extraction-engine.md "Validation rules".
 */

export type EvidenceCandidate = {
  temporaryId: string;
  page: number;
  quote: string;
  bbox: [number, number, number, number] | null;
  origin: EvidenceOrigin;
};

export type ValidatedFact = {
  input: DraftFactInput;
  issues: IssueCode[];
  plotEligible: boolean;
  sourceOnly: boolean;
};

export type ValidationContext = {
  documentVersionId: string;
  pageText: Map<number, string>;
  evidenceByPage: Map<number, Set<string>>;
  /** Evidence id to origin, so OCR-only tolerance never applies to extracted text. */
  evidenceOrigin?: Map<string, string>;
  /** Approved values already present for this patient, for duplicate hints. */
  existingObservations: {
    testCode: string | null;
    eventDate: string | null;
    numericValue: number | null;
    unit: string | null;
  }[];
  identity: Omit<IdentityInput, 'documentIdentifier' | 'documentName'> & {
    documentIdentifier: string | null;
    documentName: string | null;
  };
};

export type ValidationOutcome = {
  facts: ValidatedFact[];
  evidence: EvidenceCandidate[];
  documentIssues: IssueCode[];
  identityState: IdentityState;
  identityDetail: string;
  unhandledPages: number[];
};

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9./%<>≤≥+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A quote supports a value when the literal characters appear in the page text. */
export function quoteSupportsValue(quote: string, rawValue: string | null, pageText: string): boolean {
  if (!rawValue) return true;
  const page = normalizeForMatch(pageText);
  const value = normalizeForMatch(rawValue);
  if (value.length === 0) return true;
  if (page.includes(value)) return true;
  // Numeric equivalence with a different decimal separator is accepted.
  const numeric = parseNumeric(rawValue);
  if (numeric.value === null) return false;
  const candidates = [String(numeric.value), String(numeric.value).replace('.', ',')];
  return candidates.some((candidate) => page.includes(normalizeForMatch(candidate)));
}

export function validateDraft(
  result: ExtractionResult,
  context: ValidationContext,
): ValidationOutcome {
  const evidence: EvidenceCandidate[] = [];
  // Which evidence came from character recognition, so unit variants read from an
  // image-only page can be recognised without loosening the machine-readable path.
  const evidenceOrigin = context.evidenceOrigin ?? new Map<string, string>();
  const factIssues = new Map<number, IssueCode[]>();
  const documentIssues = new Set<IssueCode>();

  // Visual proposals must name a page and quote that really exist.
  const visualIds = new Set<string>();
  for (const item of result.newEvidence) {
    if (!context.pageText.has(item.page)) continue;
    const pageText = context.pageText.get(item.page) ?? '';
    if (!quoteSupportsValue(item.quote, item.quote, pageText)) continue;
    evidence.push({
      temporaryId: item.temporaryId,
      page: item.page,
      quote: item.quote,
      bbox: null,
      origin: 'visual_transcription',
    });
    visualIds.add(item.temporaryId);
  }

  const identity = identityStateFromInput({
    documentIdentifier: context.identity.documentIdentifier,
    assignedIdentifier: context.identity.assignedIdentifier,
    documentName: context.identity.documentName,
    assignedName: context.identity.assignedName,
  });

  const validated: ValidatedFact[] = [];
  result.facts.forEach((fact, index) => {
    const issues = new Set<IssueCode>();
    const normalized = { ...(fact.normalized as Record<string, unknown>) };
    const resolvedEvidence: string[] = [];

    for (const evidenceId of fact.evidenceIds) {
      const page = findEvidencePage(evidenceId, context, visualIds);
      if (page === null) {
        issues.add('evidence_unmatched');
        continue;
      }
      resolvedEvidence.push(evidenceId);
    }
    if (resolvedEvidence.length === 0) issues.add('evidence_unmatched');

    const pageText = context.pageText.get(
      evidencePageOf(resolvedEvidence[0] ?? '', context) ?? 1,
    );
    if (
      pageText !== undefined &&
      fact.rawValue !== null &&
      !quoteSupportsValue(fact.rawValue, fact.rawValue, pageText)
    ) {
      issues.add('evidence_unmatched');
    }

    if (fact.kind === 'observation') {
      const alias = matchTestAlias(fact.rawLabel);
      const providerCode = typeof normalized.testCode === 'string' ? normalized.testCode : null;
      const testCode = alias.code ?? providerCode ?? null;
      const numeric = parseNumeric(fact.rawValue);
      const unitCheck = checkUnit(testCode, fact.rawUnit, {
        // A unit read from an image-only page may be a known OCR variant of an accepted
        // unit; the literal reading is still stored and shown to the reviewer.
        ocrTolerant: fact.evidenceIds.some((id) => evidenceOrigin.get(id) === 'ocr'),
      });
      if (unitCheck.issue) issues.add(unitCheck.issue);
      if (numeric.ambiguous) {
        // An ambiguous decimal separator is never guessed.
        normalized.numericValue = null;
      } else {
        normalized.numericValue = numeric.value ?? normalized.numericValue ?? null;
      }
      normalized.testCode = testCode;
      normalized.unitCode = unitCheck.normalizedUnit;
      normalized.rawNumericText = numeric.rawNumericText;
      normalized.plotEligible = false;
      normalized.groupId = fact.groupId ?? null;

      const dateMissing = !fact.eventDate || fact.datePrecision !== 'day';
      if (dateMissing) {
        normalized.plotEligible = false;
      } else if (
        testCode !== null &&
        numeric.value !== null &&
        unitCheck.accepted &&
        !numeric.ambiguous
      ) {
        normalized.plotEligible = true;
      }
      if (fact.datePrecision === 'unknown' || fact.datePrecision === 'month' || fact.datePrecision === 'year') {
        issues.add('date_ambiguous');
      }
      if (
        numeric.value !== null &&
        testCode !== null &&
        context.existingObservations.some(
          (existing) =>
            existing.testCode === testCode &&
            existing.eventDate === fact.eventDate &&
            existing.numericValue === numeric.value &&
            (existing.unit ?? null) === (unitCheck.normalizedUnit ?? null),
        )
      ) {
        issues.add('possible_duplicate');
      }
    }

    if (fact.kind === 'prescription') {
      normalized.name = (normalized.name as string | null) ?? fact.rawLabel;
    }
    if (fact.kind === 'examination') {
      normalized.category = (normalized.category as string | null) ?? fact.rawLabel;
    }

    const sourceOnly =
      fact.kind === 'observation' &&
      (normalized.testCode === null ||
        normalized.numericValue === null ||
        !coerceBoolean(normalized.plotEligible));

    factIssues.set(index, [...issues]);
    validated.push({
      input: {
        ...fact,
        normalized: normalized as DraftFactInput['normalized'],
        evidenceIds: resolvedEvidence,
      },
      issues: [...issues],
      plotEligible: coerceBoolean(normalized.plotEligible),
      sourceOnly,
    });
  });

  return {
    facts: validated,
    evidence,
    documentIssues: [...documentIssues],
    identityState: identity.state,
    identityDetail: identity.detail,
    unhandledPages: result.unhandledPages,
  };
}

function coerceBoolean(value: unknown): boolean {
  return value === true;
}

function findEvidencePage(
  evidenceId: string,
  context: ValidationContext,
  visualIds: Set<string>,
): number | null {
  for (const [page, ids] of context.evidenceByPage) {
    if (ids.has(evidenceId)) return page;
  }
  if (visualIds.has(evidenceId)) return -1;
  return null;
}

function evidencePageOf(evidenceId: string, context: ValidationContext): number | null {
  for (const [page, ids] of context.evidenceByPage) {
    if (ids.has(evidenceId)) return page;
  }
  return null;
}

export function summariseIssues(facts: ValidatedFact[]): IssueCode[] {
  return [...new Set(facts.flatMap((fact) => fact.issues))];
}

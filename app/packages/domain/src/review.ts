import type { DraftFactDto, IdentityState, IssueCode, ReviewDto } from '@glucoflow/contracts';

/**
 * Review rules shared by the API, the worker and the tests.
 * Source: docs/mvp/09-fixed-contracts.md "Review and publication".
 */

export type IdentityInput = {
  /** Identifier printed on the source document, when one was read. */
  documentIdentifier: string | null;
  /** Identifier on the assigned clinic record. */
  assignedIdentifier: string;
  documentName: string | null;
  assignedName: string;
};

function normalizeIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized === '' ? null : normalized;
}

function normalizeName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized === '' ? null : normalized;
}

/**
 * A matching name alone never clears identity, and a differing explicit
 * identifier is always a mismatch. Missing identity stays unchecked until a
 * reviewer confirms it with a reason.
 */
export function identityStateFromInput(input: IdentityInput): {
  state: IdentityState;
  issue: IssueCode | null;
  detail: string;
} {
  const documentIdentifier = normalizeIdentifier(input.documentIdentifier);
  if (!documentIdentifier) {
    return {
      state: 'unchecked',
      issue: 'identity_missing',
      detail: 'No patient identifier was read from this source.',
    };
  }
  const assigned = normalizeIdentifier(input.assignedIdentifier);
  if (assigned && documentIdentifier === assigned) {
    return { state: 'matched', issue: null, detail: 'Source identifier matches this record.' };
  }
  return {
    state: 'mismatch',
    issue: 'identity_mismatch',
    detail: 'The source identifier differs from the assigned patient record.',
  };
}

/** A generic override is never accepted for a different explicit identifier. */
export function canConfirmMissingIdentity(state: IdentityState): boolean {
  return state === 'unchecked';
}

export function publishBlockersForBatch(input: {
  facts: Pick<DraftFactDto, 'reviewState'>[];
  identityState: IdentityState;
  unreadablePages: number[];
  excludedPages: number[];
  alreadyPublished: boolean;
}): string[] {
  const blockers: string[] = [];
  if (input.identityState === 'unchecked' || input.identityState === 'mismatch') {
    blockers.push('identity_unresolved');
  }
  if (input.facts.some((fact) => fact.reviewState === 'unreviewed')) {
    blockers.push('entries_unreviewed');
  }
  if (input.unreadablePages.some((page) => !input.excludedPages.includes(page))) {
    blockers.push('unreadable_page_not_excluded');
  }
  if (input.alreadyPublished) blockers.push('already_published');
  return blockers;
}

export const PUBLISH_BLOCKER_LABELS: Record<string, string> = {
  identity_unresolved: 'Patient details need checking before this can be published.',
  entries_unreviewed: 'Every entry must be reviewed or excluded.',
  unreadable_page_not_excluded: 'An unreadable page needs an explicit exclusion reason.',
  already_published: 'This review was already published.',
  batch_not_found: 'There is no open review draft for this document.',
  dispositions_required:
    'Every earlier record affected by this change needs a retain, supersede or withdraw decision.',
};

export function describeBlockers(blockers: string[]): string {
  return blockers
    .map((blocker) => PUBLISH_BLOCKER_LABELS[blocker] ?? 'This review is not ready to publish.')
    .join(' ');
}

/** The final approval action names the actual reviewed count. */
export function approvalActionLabel(facts: Pick<DraftFactDto, 'reviewState'>[]): string {
  const count = facts.filter((fact) => fact.reviewState === 'reviewed').length;
  return `Approve ${count} reviewed ${count === 1 ? 'entry' : 'entries'}`;
}

export function reviewProgress(facts: Pick<DraftFactDto, 'reviewState'>[]): {
  total: number;
  reviewed: number;
  excluded: number;
  unreviewed: number;
} {
  return {
    total: facts.length,
    reviewed: facts.filter((fact) => fact.reviewState === 'reviewed').length,
    excluded: facts.filter((fact) => fact.reviewState === 'excluded').length,
    unreviewed: facts.filter((fact) => fact.reviewState === 'unreviewed').length,
  };
}

/** A correction marks the affected entry unreviewed again. */
export function reviewStateAfterCorrection(): 'unreviewed' {
  return 'unreviewed';
}

export function reviewCanPublish(review: Pick<ReviewDto, 'canPublish'>): boolean {
  return review.canPublish;
}

import type { DeltaAction, DeltaItem, DeltaSummary } from '@glucoflow/contracts';

export type BriefSelection = {
  decisions: DeltaItem[];
  contextChanged: DeltaItem[];
  moreOpen: number;
  reviewed: number;
  focusLabel: string;
};

function effectiveStatus(item: DeltaItem, statuses: Record<string, DeltaAction>): DeltaItem['status'] {
  return statuses[item.id] ?? item.status;
}

/**
 * The brief shows three decisions, not every item. The selection is explainable:
 * the largest numeric change, the oldest open item, and the first disagreement.
 * Everything else stays as context in the ledger.
 */
export function selectBrief(
  summary: DeltaSummary,
  statuses: Record<string, DeltaAction> = {},
): BriefSelection {
  const changed = summary.blocks.changed;
  const unresolved = summary.blocks.unresolved;
  const conflicts = summary.blocks.conflict;
  const decisions: DeltaItem[] = [];
  const chosen = new Set<string>();

  // The clinic's watchlist decides what gets the first slot. It is a display
  // order set by the clinic, not a clinical risk score.
  const watchlist = ['egfr', 'hba1c', 'urine_acr', 'glucose_fasting', 'ldl'];
  const watched = watchlist
    .map((code) => changed.find((item) => item.testCode === code))
    .find(Boolean);
  const largest = [...changed].sort((left, right) => {
    const byMagnitude = (right.magnitude ?? 0) - (left.magnitude ?? 0);
    if (byMagnitude !== 0) return byMagnitude;
    return (right.date ?? '').localeCompare(left.date ?? '');
  })[0];
  const firstChange = watched ?? largest;
  if (firstChange) {
    decisions.push(firstChange);
    chosen.add(firstChange.id);
  }

  const oldest = [...unresolved].sort(
    (left, right) => (right.ageDays ?? -1) - (left.ageDays ?? -1),
  )[0];
  if (oldest) {
    decisions.push(oldest);
    chosen.add(oldest.id);
  }

  const preferredConflict =
    conflicts.find((item) => item.kind === 'prescription') ??
    [...conflicts].sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''))[0];
  if (preferredConflict && !chosen.has(preferredConflict.id)) {
    decisions.push(preferredConflict);
    chosen.add(preferredConflict.id);
  }

  for (const item of [...unresolved, ...conflicts]) {
    if (decisions.length >= 3) break;
    if (chosen.has(item.id)) continue;
    decisions.push(item);
    chosen.add(item.id);
  }

  const contextChanged = changed.filter((item) => !chosen.has(item.id));
  const openItems = [...unresolved, ...conflicts, ...summary.blocks.unknown];
  const moreOpen = openItems.filter((item) => !chosen.has(item.id)).length;
  const reviewed = decisions.filter((item) => effectiveStatus(item, statuses) !== 'open').length;

  const focus = [
    firstChange ? 'Clinic watchlist' : null,
    oldest ? 'oldest open item' : null,
    preferredConflict ? 'first disagreement' : null,
  ].filter(Boolean);

  return {
    decisions,
    contextChanged,
    moreOpen,
    reviewed,
    focusLabel: focus.join(' · '),
  };
}

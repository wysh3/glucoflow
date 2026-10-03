import type { DraftFactInput } from '@sutra/contracts';
import type { Observation } from './evaluation-metrics';

/** The headline evaluates observations only; context needs separate text labels. */
export function evaluationObservations(facts: DraftFactInput[]): Observation[] {
  return facts.filter(f => f.kind === 'observation').map(f => {
    const n = f.normalized as {numericValue?: number | null; testCode?: string | null; unitCode?: string | null};
    return {rawLabel: f.rawLabel, testCode: n.testCode ?? null,
      value: n.numericValue === undefined || n.numericValue === null ? f.rawValue ?? '' : String(n.numericValue),
      unit: n.unitCode ?? f.rawUnit ?? '', eventDate: f.eventDate};
  });
}

export function evaluationAssignment(entry: {identifier: string; name: string; expectedIdentity: string; assignedIdentifier?: string; assignedName?: string}): {identifier: string; name: string} {
  if (entry.expectedIdentity === 'mismatch' && !entry.assignedIdentifier) {
    throw new Error('A mismatch reference requires an explicit assignedIdentifier distinct from the printed identity');
  }
  return {identifier: entry.assignedIdentifier ?? entry.identifier, name: entry.assignedName ?? entry.name};
}

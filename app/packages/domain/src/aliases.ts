import { TEST_DEFINITIONS, type SupportedTestCode } from '@glucoflow/contracts';

/**
 * Versioned alias mapping. Only harmless spelling and spacing differences are
 * normalized. An unspecified glucose test is never mapped to fasting, and an
 * ambiguous label such as "cholesterol" alone stays unmapped.
 * Source: docs/mvp/09-fixed-contracts.md "Supported observation mappings".
 */

export type AliasMatch = {
  code: SupportedTestCode | null;
  matchedAlias: string | null;
  /** Raw label retained for display and search regardless of the match. */
  rawLabel: string;
};

const ALIAS_INDEX: Map<string, SupportedTestCode> = new Map(
  TEST_DEFINITIONS.flatMap((definition) =>
    definition.aliases.map((alias) => [alias, definition.code] as const),
  ),
);

/** Labels that must never be auto-mapped because they are ambiguous. */
const AMBIGUOUS_LABELS = new Set([
  'glucose',
  'blood sugar',
  'sugar',
  'cholesterol',
  'lipid',
  'lipids',
  'lipid profile',
  'gfr',
  'albumin',
  'creatinine',
  'blood pressure',
  'bp',
  'weight (kg) (see chart)',
]);

export function normalizeLabel(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[()[\]{}:;]/g, ' ')
    .replace(/[.,](?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes a trailing unit or method note: "HbA1c (%)" and "HbA1c - HPLC" both
 * normalize to "hba1c".
 */
function stripDecorations(normalized: string): string[] {
  const candidates = new Set<string>([normalized]);
  const withoutParens = normalized.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  candidates.add(withoutParens);
  const withoutTrailing = withoutParens.split(/\s+-\s+/)[0]?.trim() ?? withoutParens;
  candidates.add(withoutTrailing);
  const withoutLeading = withoutTrailing.replace(/^(serum|plasma|blood|random|fasting)\s+/, (match) =>
    match.trim() === 'fasting' || match.trim() === 'random' ? match.trim() + ' ' : '',
  );
  candidates.add(withoutLeading.trim());
  return [...candidates].filter(Boolean);
}

export function matchTestAlias(rawLabel: string): AliasMatch {
  const normalized = normalizeLabel(rawLabel);
  if (!normalized) return { code: null, matchedAlias: null, rawLabel };
  if (AMBIGUOUS_LABELS.has(normalized)) {
    return { code: null, matchedAlias: null, rawLabel };
  }
  for (const candidate of stripDecorations(normalized)) {
    const direct = ALIAS_INDEX.get(candidate);
    if (direct) return { code: direct, matchedAlias: candidate, rawLabel };
  }
  return { code: null, matchedAlias: null, rawLabel };
}

/**
 * OCR-tolerant alias match.
 *
 * Image-only pages go through character recognition, which systematically confuses a
 * small set of glyphs (b/o, 1/l/I, 5/s, 6/G, 8/B, rn/m). This variant is used only for
 * lines that came from OCR: it folds those confusions, then allows a single-character
 * edit for aliases of five characters or more. It never maps an ambiguous label, and it
 * never changes the raw label that is stored with the proposal, so a reviewer still sees
 * exactly what the page said.
 *
 * The machine-readable path keeps using matchTestAlias, so its behaviour is unchanged.
 */
export function matchTestAliasOcrTolerant(rawLabel: string): AliasMatch {
  const exact = matchTestAlias(rawLabel);
  if (exact.code) return exact;

  const normalized = normalizeLabel(rawLabel);
  if (!normalized) return { code: null, matchedAlias: null, rawLabel };
  if (AMBIGUOUS_LABELS.has(normalized)) return { code: null, matchedAlias: null, rawLabel };

  const folded = foldOcrConfusions(normalized);
  for (const candidate of stripDecorations(folded)) {
    const direct = ALIAS_INDEX.get(candidate);
    if (direct) return { code: direct, matchedAlias: candidate, rawLabel };
    if (candidate.length >= 5) {
      for (const [alias, code] of ALIAS_INDEX) {
        if (alias.length < 5) continue;
        if (editDistanceAtMostOne(candidate, foldOcrConfusions(alias))) {
          return { code, matchedAlias: alias, rawLabel };
        }
      }
    }
  }
  return { code: null, matchedAlias: null, rawLabel };
}

/** Folds the glyph confusions that character recognition produces most often. */
function foldOcrConfusions(value: string): string {
  return value
    .replace(/\brn/g, 'm')
    .replace(/[0]/g, 'o')
    .replace(/[1|]/g, 'l')
    .replace(/[5]/g, 's')
    .replace(/[6]/g, 'g')
    .replace(/[8]/g, 'b')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the two strings differ by at most one insertion, deletion or substitution. */
function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let indexA = 0;
  let indexB = 0;
  let edits = 0;
  while (indexA < a.length && indexB < b.length) {
    if (a[indexA] === b[indexB]) {
      indexA += 1;
      indexB += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) indexA += 1;
    else if (b.length > a.length) indexB += 1;
    else {
      indexA += 1;
      indexB += 1;
    }
  }
  if (indexA < a.length || indexB < b.length) edits += 1;
  return edits <= 1;
}

/** Deterministic alias expansion used by patient-scoped search. */
export function expandSearchTerms(rawQuery: string): string[] {
  const normalized = normalizeLabel(rawQuery);
  if (!normalized) return [];
  const terms = new Set<string>([normalized]);
  const direct = ALIAS_INDEX.get(normalized);
  if (direct) {
    for (const alias of TEST_DEFINITIONS.find((definition) => definition.code === direct)?.aliases ??
      []) {
      terms.add(alias);
    }
  } else {
    for (const definition of TEST_DEFINITIONS) {
      for (const alias of definition.aliases) {
        if (alias.includes(normalized) || normalized.includes(alias)) {
          terms.add(definition.display.toLowerCase());
          terms.add(definition.aliases[0] ?? definition.display.toLowerCase());
        }
      }
    }
  }
  return [...terms];
}

export function aliasMapSize(): number {
  return ALIAS_INDEX.size;
}

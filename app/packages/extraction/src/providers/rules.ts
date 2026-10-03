import { createHash } from 'node:crypto';
import {
  TEST_DEFINITIONS,
  type DateKind,
  type DraftFactInput,
  type ExtractionResult,
} from '@sutra/contracts';
import {
  checkUnit,
  matchTestAlias,
  normalizeUnit,
  normalizeUnitOcrTolerant,
  parseDate,
  parseNumeric,
} from '@sutra/domain';
import type { EvidenceSpan, ExtractionInput, ExtractionProvider, ProviderExtraction } from '../types';

/**
 * Deterministic rules provider. This is the FIXTURE adapter: it is a rule engine
 * reading prepared page text, not an AI model, and it reports mode = 'fixture' so
 * the interface always says so. It must never silently replace a failed live call.
 *
 * It handles common laboratory report line layouts:
 *   "HbA1c 8.2 %"
 *   "Fasting glucose: 126 mg/dL   70-100"
 *   "Blood pressure 138/86 mmHg"
 *   "Tab. Metformin 500 mg - twice daily after meals"
 *   "Eye examination: dilated fundus examination performed"
 */

const LINE_SEPARATOR = /[:\-–—=]/;

const IDENTIFIER_PATTERNS = [
  /(?:patient\s*(?:id|identifier|no|number|code)|mrn|uhid|hospital\s*(?:no|number)|reg(?:istration)?\s*(?:no|number))\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{1,30})/i,
];
const NAME_PATTERNS = [/patient\s*name\s*[:\-]?\s*([A-Za-z][A-Za-z.\s]{1,60})/i];

const DATE_LABELS: { pattern: RegExp; kind: DateKind }[] = [
  { pattern: /(collected|collection|sample|specimen|drawn|phlebotomy)/i, kind: 'collection' },
  { pattern: /(reported|report\s*date|printed|result\s*date)/i, kind: 'report' },
  { pattern: /(prescription|prescribed|rx\s*date)/i, kind: 'prescription' },
  { pattern: /(examination|exam\s*date|screening\s*date)/i, kind: 'examination' },
];

const EXAMINATION_MARKERS = [
  'eye examination',
  'dilated fundus',
  'fundus examination',
  'fundoscopy',
  'retinal examination',
  'foot examination',
  'diabetic foot',
  'monofilament',
  'vibration perception',
  'nerve examination',
  'neuropathy screening',
  'podiatry',
  'ecg',
  'electrocardiogram',
  'chest x-ray',
  'dental examination',
];

const PRESCRIPTION_MARKERS = [
  'tab.',
  'tab ',
  'tablet',
  'cap.',
  'capsule',
  'syr.',
  'syrup',
  'inj.',
  'injection',
  'rx',
  'prescription',
  'insulin',
  'metformin',
  'glimepiride',
  'atorvastatin',
  'amlodipine',
  'telmisartan',
  'losartan',
  'empagliflozin',
  'dapagliflozin',
  'sitagliptin',
  'vildagliptin',
  'pioglitazone',
  'ramipril',
  'enalapril',
  'hydrochlorothiazide',
  'aspirin',
  'clopidogrel',
  'thyroxine',
  'levothyroxine',
];

const FREQUENCY_MARKERS = [
  'once daily',
  'twice daily',
  'thrice daily',
  'three times',
  'two times',
  'at bedtime',
  'after meals',
  'before meals',
  'before breakfast',
  'after breakfast',
  'after dinner',
  'in the morning',
  'at night',
  'weekly',
  'sos',
  'bd',
  'tds',
  'od',
  'hs',
  'qid',
  'prn',
];

const STRENGTH_PATTERN = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|g|ml|iu|units?|%)\b/i;
const NUMBER_PATTERN = /(<=|>=|<|>|≤|≥)?\s*([-+]?\d+(?:[.,]\d+)?)/;
const REFERENCE_PATTERN =
  /\(?\s*(\d+(?:[.,]\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:[.,]\d+)?)\s*\)?/i;

function unitRegexFor(code: string): RegExp | null {
  const definition = TEST_DEFINITIONS.find((item) => item.code === code);
  if (!definition) return null;
  const alternatives = definition.units
    .map((unit) => unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return new RegExp(`(${alternatives})`, 'i');
}

/** A generic unit-ish token, used to report an unsupported unit rather than a missing one. */
const GENERIC_UNIT_PATTERN =
  /(?<![A-Za-z0-9])((?:mg|mcg|µg|ug|g|kg|lb|ml|dl|l|iu|units?|mmol|mol|meq|mmhg|%)(?:\s*%(?![A-Za-z0-9])|\s*\/\s*(?:dl|l|ml|mmol|mol|g|min|day))?(?:\s*\/\s*1\.73\s*m2)?)/i;

function findUnit(text: string, code: string, ocrTolerant = false): string | null {
  const pattern = unitRegexFor(code);
  if (pattern) {
    const match = pattern.exec(text);
    if (match) return match[1]!;
  }
  if (ocrTolerant) {
    // Character recognition mangles short unit tokens ("mg/g" as "mgfg"). Only a token
    // that is a known variant of an accepted unit counts, it must look like a unit
    // (short, optionally with a slash), and the literal reading is kept as the raw unit.
    for (const token of text.split(/[\s,;]+/)) {
      const cleaned = token.replace(/[^a-z0-9/.]/gi, '').toLowerCase();
      if (!cleaned || cleaned.length > 12) continue;
      if (!/^[a-z0-9]+(?:\/[a-z0-9.]+)*$/.test(cleaned)) continue;
      const mapped = normalizeUnitOcrTolerant(cleaned);
      if (mapped && mapped !== cleaned) return token.trim();
    }
  }
  const generic = GENERIC_UNIT_PATTERN.exec(text);
  return generic ? generic[1]!.trim() : null;
}

export type LineFactMatch = {
  code: string;
  rawLabel: string;
  rawValue: string;
  rawUnit: string | null;
  numericValue: number | null;
  rawNumericText: string;
  referenceRangeText: string | null;
  groupId: string | null;
  /** True when the match came from an image-only page and used the tolerant pass. */
  ocrTolerant?: boolean;
};

/** Parses one prepared line into at most one observation match. */
/**
 * Length-preserving fold of the glyph confusions that character recognition produces.
 * Every character maps to exactly one character, so an index found in the folded text is
 * the same index in the original line and the value beside a label is never taken from
 * the wrong place.
 */
function foldForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/[1|]/g, 'l')
    .replace(/5/g, 's')
    .replace(/6/g, 'g')
    .replace(/8/g, 'b');
}

/** Edit distance, used only to tolerate one or two misread characters in a label. */
function editDistance(a: string, b: string): number {
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let index = 0; index <= b.length; index += 1) previous[index] = index;
  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      current[column] = Math.min(
        (previous[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (previous[column - 1] ?? 0) + cost,
      );
    }
    for (let index = 0; index <= b.length; index += 1) previous[index] = current[index] ?? 0;
  }
  return previous[b.length] ?? 0;
}

export function matchObservationLine(
  line: string,
  options: { ocrTolerant?: boolean } = {},
): LineFactMatch | null {
  const text = line.replace(/\s+/g, ' ').trim();
  if (text.length === 0 || text.length > 220) return null;

  // Blood pressure pair: "Blood pressure 138/86 mmHg".
  const bpMatch =
    /(blood\s*pressure|bp)\s*[:\-]?\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*(mmhg)?/i.exec(text);
  if (bpMatch && !/pulse|heart\s*rate/i.test(text)) {
    return {
      code: 'bp_systolic',
      rawLabel: 'Blood pressure',
      rawValue: bpMatch[2]!,
      rawUnit: bpMatch[4] ?? 'mmHg',
      numericValue: Number(bpMatch[2]),
      rawNumericText: bpMatch[2]!,
      referenceRangeText: null,
      groupId: `bp:${bpMatch[2]}/${bpMatch[3]}`,
    };
  }

  // Longest alias first so "hdl cholesterol" is not matched as "hdl".
  const aliases = TEST_DEFINITIONS.flatMap((definition) =>
    definition.aliases.map((alias) => ({ alias, code: definition.code as string })),
  ).sort((a, b) => b.alias.length - a.alias.length);

  // Exact label matches first. The longest alias wins, so "fasting glucose" is not
  // matched as "glucose".
  const searchText = options.ocrTolerant ? foldForMatch(text) : text;
  const found: { index: number; length: number; code: string }[] = [];
  for (const { alias, code } of aliases) {
    const boundary = new RegExp(
      `(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`,
      'i',
    );
    const match = boundary.exec(searchText);
    if (match) found.push({ index: match.index + match[1]!.length, length: alias.length, code });
  }

  // OCR lines get a second pass that tolerates misread characters in the label. The
  // folded text is the same length as the original, so the value is still read from the
  // exact position in the original line.
  if (options.ocrTolerant && found.length === 0) {
    const foldedAliases = aliases
      .map(({ alias, code }) => ({ folded: foldForMatch(alias), code }))
      .filter(({ folded }) => folded.length >= 5)
      .sort((a, b) => b.folded.length - a.folded.length);
    for (const { folded, code } of foldedAliases) {
      const tolerance = folded.length >= 6 ? 2 : 1;
      // Labels lead their value in these reports, so a fuzzy match is only accepted near
      // the start of the line and only at a word boundary. That keeps the tolerant pass
      // from matching stray words later in a sentence.
      const limit = Math.min(searchText.length, folded.length + tolerance + 12);
      for (let start = 0; start < limit; start += 1) {
        if (start > 0 && /[a-z0-9]/.test(searchText[start - 1] ?? '')) continue;
        const candidate = searchText.slice(start, start + folded.length);
        if (candidate.length < folded.length) break;
        if (editDistance(candidate, folded) <= tolerance) {
          const after = searchText[start + folded.length] ?? ' ';
          if (/[a-z0-9]/.test(after)) continue;
          found.push({ index: start, length: folded.length, code });
          break;
        }
      }
      if (found.length > 0) break;
    }
  }

  found.sort((a, b) => b.length - a.length);
  for (const candidate of found) {
    const startIndex = candidate.index;
    const remainderRaw = text.slice(startIndex + candidate.length);
    const remainder = remainderRaw.replace(LINE_SEPARATOR, ' ').trim();
    if (remainder.length === 0 || remainder.length > 120) continue;

    const valueMatch = NUMBER_PATTERN.exec(remainder);
    if (!valueMatch) continue;
    const parsed = parseNumeric(`${valueMatch[1] ?? ''}${valueMatch[2]}`);
    const unit = findUnit(remainder, candidate.code, options.ocrTolerant === true);
    if (!parsed.rawNumericText) continue;
    // Guard against reading a reference range as the value: a value must not be
    // immediately followed by a range separator and a second number.
    const afterValue = remainder.slice((valueMatch.index ?? 0) + valueMatch[0].length);
    if (/^\s*(?:-|–|—|to)\s*\d/i.test(afterValue)) continue;

    const refMatch = REFERENCE_PATTERN.exec(remainder);
    return {
      code: candidate.code,
      rawLabel: text.slice(startIndex, startIndex + candidate.length),
      rawValue: `${valueMatch[1] ?? ''}${valueMatch[2]}`.trim(),
      rawUnit: unit,
      numericValue: parsed.value,
      rawNumericText: parsed.rawNumericText,
      referenceRangeText: refMatch ? refMatch[0] : null,
      groupId: null,
      ocrTolerant: options.ocrTolerant === true,
    };
  }
  return null;
}

export function matchBpDiastolic(line: string): LineFactMatch | null {
  const bpMatch =
    /(blood\s*pressure|bp)\s*[:\-]?\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*(mmhg)?/i.exec(line);
  if (!bpMatch) return null;
  return {
    code: 'bp_diastolic',
    rawLabel: 'Blood pressure',
    rawValue: bpMatch[3]!,
    rawUnit: bpMatch[4] ?? 'mmHg',
    numericValue: Number(bpMatch[3]),
    rawNumericText: bpMatch[3]!,
    referenceRangeText: null,
    groupId: `bp:${bpMatch[2]}/${bpMatch[3]}`,
  };
}

export function matchExaminationLine(line: string): { category: string; sourceText: string } | null {
  const text = line.replace(/\s+/g, ' ').trim();
  if (text.length === 0 || text.length > 300) return null;
  const lower = text.toLowerCase();
  const marker = EXAMINATION_MARKERS.find((candidate) => lower.includes(candidate));
  if (!marker) return null;
  // A line that also carries a measured value is treated as an observation first.
  if (matchObservationLine(text)) return null;
  return { category: marker.replace(/\b\w/g, (character) => character.toUpperCase()), sourceText: text };
}

export function matchPrescriptionLine(line: string): {
  name: string;
  strength: string | null;
  instructions: string | null;
} | null {
  const text = line.replace(/\s+/g, ' ').trim();
  if (text.length === 0 || text.length > 300) return null;
  const lower = text.toLowerCase();
  const hasFrequency = FREQUENCY_MARKERS.some((marker) => lower.includes(marker));
  const hasDosageForm = /^(tab|cap|syr|inj)\.?\s/i.test(text) || /^\d+\s*[.)]?\s*(tab|cap|syr|inj)\.?\s/i.test(text);
  const hasStrength = STRENGTH_PATTERN.test(text);
  // A line is a prescription entry only when it carries a dose, a frequency or an
  // explicit dosage form. This keeps report headers and date lines out.
  if (!hasStrength && !hasFrequency && !hasDosageForm) return null;
  if (!PRESCRIPTION_MARKERS.some((marker) => lower.includes(marker)) && !hasFrequency && !hasDosageForm) {
    return null;
  }
  if (matchObservationLine(text)) return null;

  const cleaned = text
    .replace(/^\s*\d+\s*[.)]?\s*/, '')
    .replace(/^(tab\.?|tablet|cap\.?|capsule|syr\.?|syrup|inj\.?|injection|rx)\s*/i, '')
    .trim();
  if (cleaned.length === 0) return null;

  const strengthMatch = STRENGTH_PATTERN.exec(cleaned);
  const namePart = strengthMatch ? cleaned.slice(0, strengthMatch.index) : cleaned;
  const name = namePart.replace(/[:\-–—]+$/, '').trim();
  if (name.length < 3) return null;

  const rest = strengthMatch
    ? cleaned.slice(strengthMatch.index + strengthMatch[0].length)
    : '';
  const instructions = rest
    .replace(/^[\s\-–—:,.]+/, '')
    .replace(/[.\s]+$/, '')
    .trim();

  return {
    name: name.length > 80 ? name.slice(0, 80) : name,
    strength: strengthMatch ? `${strengthMatch[1]} ${strengthMatch[2]}` : null,
    instructions: instructions.length > 0 ? instructions : null,
  };
}

const IDENTIFIER_PLACEHOLDERS = new Set([
  'not',
  'notprinted',
  'na',
  'nil',
  'none',
  'unknown',
  'noprinted',
  'missing',
  'notavailable',
  '-',
  '--',
]);

export function findIdentity(
  lines: string[],
): { nameRaw: string | null; identifierRaw: string | null } {
  let nameRaw: string | null = null;
  let identifierRaw: string | null = null;
  for (const line of lines.slice(0, 40)) {
    for (const pattern of IDENTIFIER_PATTERNS) {
      const match = pattern.exec(line);
      if (match && !identifierRaw) {
        const candidate = match[1]!.trim();
        const key = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (IDENTIFIER_PLACEHOLDERS.has(key)) continue;
        // A real record identifier contains a digit. This avoids reading an
        // English word ("is", "not") from a sentence as a patient identifier.
        if (!/\d/.test(candidate)) continue;
        identifierRaw = candidate;
      }
    }
    for (const pattern of NAME_PATTERNS) {
      const match = pattern.exec(line);
      if (match && !nameRaw) {
        const candidate = match[1]!.trim();
        if (!/^not\b/i.test(candidate)) nameRaw = candidate;
      }
    }
  }
  return { nameRaw, identifierRaw };
}

/**
 * Finds every explicit patient identifier mentioned in the source pages. More than
 * one distinct value means the upload mixes patients and is quarantined whole.
 */
export function scanIdentityMentions(
  pages: { page: number; text: string }[],
): { page: number; value: string }[] {
  const mentions: { page: number; value: string }[] = [];
  for (const page of pages) {
    for (const pattern of IDENTIFIER_PATTERNS) {
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
      const global = new RegExp(pattern.source, flags);
      let match = global.exec(page.text);
      while (match) {
        if (match[1]) mentions.push({ page: page.page, value: match[1].trim() });
        match = global.exec(page.text);
        if (mentions.length > 50) return mentions;
      }
    }
  }
  return mentions;
}

export function findDates(
  lines: string[],
): { eventDate: string | null; dateRaw: string | null; dateKind: DateKind; ambiguous: boolean } {
  // Labelled dates first, then the first parseable date in the header.
  for (const line of lines) {
    for (const { pattern, kind } of DATE_LABELS) {
      if (!pattern.test(line)) continue;
      const parsed = parseDate(line);
      if (parsed.eventDate) {
        return {
          eventDate: parsed.eventDate,
          dateRaw: parsed.dateRaw,
          dateKind: kind,
          ambiguous: parsed.ambiguous,
        };
      }
    }
  }
  for (const line of lines.slice(0, 8)) {
    const parsed = parseDate(line);
    if (parsed.eventDate) {
      return {
        eventDate: parsed.eventDate,
        dateRaw: parsed.dateRaw,
        dateKind: 'report',
        ambiguous: parsed.ambiguous,
      };
    }
    if (parsed.ambiguous) {
      return {
        eventDate: null,
        dateRaw: parsed.dateRaw,
        dateKind: 'report',
        ambiguous: true,
      };
    }
  }
  return { eventDate: null, dateRaw: null, dateKind: 'report', ambiguous: false };
}

export class RulesFixtureProvider implements ExtractionProvider {
  readonly name = 'rules-fixture';
  readonly model = 'deterministic-rules-v1';
  readonly mode = 'fixture' as const;
  readonly promptHash = createHash('sha256').update('rules-fixture-v1').digest('hex').slice(0, 32);

  /**
   * The OCR-tolerant pass is on by default. It can be turned off so its contribution can
   * be measured against a frozen corpus; the machine-readable path is unaffected either
   * way.
   */
  constructor(private readonly ocrTolerance = true) {}

  async extract(input: ExtractionInput, _signal: AbortSignal): Promise<ProviderExtraction> {
    const started = Date.now();
    const allLines: string[] = [];
    for (const page of input.pages) {
      for (const evidence of page.evidence) allLines.push(evidence.quote);
    }

    const identity = findIdentity(allLines);
    const facts: DraftFactInput[] = [];
    const usedEvidence = new Set<string>();

    for (const page of input.pages) {
      const dates = findDates(page.evidence.map((evidence) => evidence.quote));
      for (const evidence of page.evidence) {
        const quote = evidence.quote;
        const observation = matchObservationLine(quote, {
          ocrTolerant: this.ocrTolerance && evidence.origin === 'ocr',
        });
        if (observation) {
          facts.push(
            observationToFact(observation, evidence, dates.eventDate, dates.dateRaw, dates.dateKind),
          );
          usedEvidence.add(evidence.id);
          if (observation.code === 'bp_systolic') {
            const diastolic = matchBpDiastolic(quote);
            if (diastolic) {
              facts.push(
                observationToFact(diastolic, evidence, dates.eventDate, dates.dateRaw, dates.dateKind),
              );
            }
          }
          continue;
        }
        const examination = matchExaminationLine(quote);
        if (examination) {
          facts.push({
            kind: 'examination',
            rawLabel: examination.category,
            rawValue: null,
            rawUnit: null,
            eventDate: dates.eventDate,
            dateRaw: dates.dateRaw,
            dateKind: dates.eventDate ? 'examination' : dates.dateKind,
            datePrecision: dates.eventDate ? 'day' : 'unknown',
            normalized: {
              category: examination.category,
              sourceText: examination.sourceText,
            },
            evidenceIds: [evidence.id],
            groupId: null,
          });
          usedEvidence.add(evidence.id);
          continue;
        }
        const prescription = matchPrescriptionLine(quote);
        if (prescription) {
          facts.push({
            kind: 'prescription',
            rawLabel: prescription.name,
            rawValue: prescription.strength,
            rawUnit: null,
            eventDate: dates.eventDate,
            dateRaw: dates.dateRaw,
            dateKind: 'prescription',
            datePrecision: dates.eventDate ? 'day' : 'unknown',
            normalized: {
              name: prescription.name,
              strength: prescription.strength,
              instructions: prescription.instructions,
            },
            evidenceIds: [evidence.id],
            groupId: null,
          });
          usedEvidence.add(evidence.id);
        }
      }
    }

    const unhandledPages = input.pages
      .filter((page) =>
        page.evidence.every((evidence) => !usedEvidence.has(evidence.id)) &&
        page.text.replace(/\s+/g, '').length > 0,
      )
      .map((page) => page.page);

    const result: ExtractionResult = {
      documentIdentity: identity,
      facts,
      // The rules adapter only references worker-supplied evidence, so it never
      // proposes new evidence and cannot invent evidence identifiers.
      newEvidence: [],
      unhandledPages,
      usage: { inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started },
    };
    return {
      ...result,
      usage: {
        ...result.usage,
        calls: 0, // deterministic local rules: no provider call is dispatched
      },
    };
  }
}

function observationToFact(
  match: LineFactMatch,
  evidence: EvidenceSpan,
  eventDate: string | null,
  dateRaw: string | null,
  dateKind: DateKind,
): DraftFactInput {
  const unitCheck = checkUnit(match.code, match.rawUnit, { ocrTolerant: match.ocrTolerant === true });
  return {
    kind: 'observation',
    rawLabel: match.rawLabel,
    rawValue: match.rawValue,
    rawUnit: match.rawUnit,
    eventDate,
    dateRaw,
    dateKind,
    datePrecision: eventDate ? 'day' : 'unknown',
    normalized: {
      testCode: match.code,
      numericValue: match.numericValue,
      unitCode: unitCheck.normalizedUnit,
      rawNumericText: match.rawNumericText,
      referenceRangeText: match.referenceRangeText,
      plotEligible: false, // set by validation, never by the provider
      groupId: match.groupId,
    },
    evidenceIds: [evidence.id],
    groupId: match.groupId,
  };
}

export const fixtureAliasUsed = matchTestAlias;

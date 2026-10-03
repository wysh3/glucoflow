import {
  SUPPORTED_TEST_CODES,
  TEST_DEFINITIONS,
  isSupportedTestCode,
  testDefinition,
  type SupportedTestCode,
} from '@sutra/contracts';

/**
 * Unit handling. No conversion happens in the first MVP: an unaccepted unit is
 * retained as literal source text and excluded from charting.
 * Source: docs/mvp/04-extraction-engine.md "Validation rules".
 */

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.normalize('NFKC');
  value = value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (character) => SUPERSCRIPTS[character] ?? character);
  value = value.replace(/\^/g, '');
  value = value.replace(/\s+/g, ' ').trim().toLowerCase();
  // A trailing period is common in printed reports: "mg/dL."
  value = value.replace(/\.+$/, '');
  if (value === '') return null;
  return value;
}

/**
 * OCR variants of accepted units.
 *
 * Character recognition mangles the short unit tokens printed beside a value. Each entry
 * maps an observed literal reading to the unit the page intended; the literal reading is
 * still stored as the raw unit on the proposal, so the reviewer sees both.
 */
const OCR_UNIT_VARIANTS: Record<string, string> = {
  // mg/g
  mgfg: 'mg/g',
  'mg|g': 'mg/g',
  mgg: 'mg/g',
  // mg/mmol
  moimmol: 'mg/mmol',
  mgimmel: 'mg/mmol',
  moly: 'mg/mmol',
  mgmmol: 'mg/mmol',
  mgimol: 'mg/mmol',
  // mmol/l
  molt: 'mmol/l',
  mmoll: 'mmol/l',
  moli: 'mmol/l',
  mmol1: 'mmol/l',
  // mg/dl
  'mgidl': 'mg/dl',
  'mgidi': 'mg/dl',
  'mgldl': 'mg/dl',
  // kg
  ky: 'kg',
  kgs: 'kg',
  'kq': 'kg',
  // mmhg
  mig: 'mmhg',
  mmhg1: 'mmhg',
  mmho: 'mmhg',
  // ml/min/1.73 m2
  'ml/min/1.78 m2': 'ml/min/1.73 m2',
  'mlimin/1.73 m2': 'ml/min/1.73 m2',
  'mu/min/1.73 m2': 'ml/min/1.73 m2',
  'ml/min/1.73m2': 'ml/min/1.73 m2',
  'ml/min/1.73 m²': 'ml/min/1.73 m2',
};

/**
 * Unit normalization that also understands the OCR variants above. Used only for lines
 * that came from character recognition; the machine-readable path keeps using
 * normalizeUnit.
 */
export function normalizeUnitOcrTolerant(raw: string | null | undefined): string | null {
  const normalized = normalizeUnit(raw);
  if (!normalized) return null;
  return OCR_UNIT_VARIANTS[normalized] ?? normalized;
}

export function isAcceptedUnit(code: SupportedTestCode, unit: string | null): boolean {
  const normalized = normalizeUnit(unit);
  if (!normalized) return false;
  return testDefinition(code).units.includes(normalized);
}

export function acceptedUnits(code: SupportedTestCode): readonly string[] {
  return testDefinition(code).units;
}

export type UnitCheck = {
  normalizedUnit: string | null;
  accepted: boolean;
  issue: 'unit_missing' | 'unit_unsupported' | null;
};

export function checkUnit(
  code: string | null,
  rawUnit: string | null,
  options: { ocrTolerant?: boolean } = {},
): UnitCheck {
  const normalizedUnit = options.ocrTolerant
    ? normalizeUnitOcrTolerant(rawUnit)
    : normalizeUnit(rawUnit);
  if (!code || !isSupportedTestCode(code)) {
    return { normalizedUnit, accepted: false, issue: null };
  }
  if (!normalizedUnit) {
    return { normalizedUnit: null, accepted: false, issue: 'unit_missing' };
  }
  if (!isAcceptedUnit(code, normalizedUnit)) {
    return { normalizedUnit, accepted: false, issue: 'unit_unsupported' };
  }
  return { normalizedUnit, accepted: true, issue: null };
}

/**
 * Parses a numeric value from raw report text without guessing ambiguous decimal
 * separators. Returns null when the interpretation is not unambiguous.
 */
export type NumericParse = {
  value: number | null;
  rawNumericText: string;
  inequality: '<' | '>' | null;
  ambiguous: boolean;
};

export function parseNumeric(raw: string | null | undefined): NumericParse {
  const text = (raw ?? '').trim();
  const empty: NumericParse = { value: null, rawNumericText: text, inequality: null, ambiguous: false };
  if (!text) return empty;

  const inequalityMatch = /^(<=|>=|<|>|≤|≥)\s*(.+)$/.exec(text);
  const inequality = inequalityMatch
    ? inequalityMatch[1] === '<' || inequalityMatch[1] === '≤'
      ? '<'
      : '>'
    : null;
  const body = (inequalityMatch ? inequalityMatch[2]! : text).replace(/\s+/g, '');

  const match = /^[-+]?\d+(?:[.,]\d+)?$/.exec(body);
  if (!match) {
    return { value: null, rawNumericText: text, inequality, ambiguous: false };
  }

  const hasComma = body.includes(',');
  const hasDot = body.includes('.');
  if (hasComma && hasDot) {
    // A single separator style must be unambiguous: 1,234.5 or 1.234,5 both parse,
    // but "1,234" or "1.234" alone stays ambiguous.
    const lastComma = body.lastIndexOf(',');
    const lastDot = body.lastIndexOf('.');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    const digitsAfterDecimal = body.length - (decimalSeparator === ',' ? lastComma : lastDot) - 1;
    const parts = body.split(decimalSeparator);
    if (parts.length !== 2 || digitsAfterDecimal === 3) {
      return { value: null, rawNumericText: text, inequality, ambiguous: true };
    }
    const normalized = body.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
    const value = Number(normalized);
    return Number.isFinite(value)
      ? { value, rawNumericText: text, inequality, ambiguous: false }
      : { value: null, rawNumericText: text, inequality, ambiguous: true };
  }

  if (hasComma || hasDot) {
    const separator = hasComma ? ',' : '.';
    const index = body.indexOf(separator);
    const digitsAfter = body.length - index - 1;
    const integerPart = body.slice(0, index);
    const occurrences = body.split(separator).length - 1;
    if (occurrences > 1) {
      // 1,234,567 style grouping is unambiguous.
      if (digitsAfter === 3 && /^\d{1,3}(?:[.,]\d{3})+$/.test(body)) {
        const value = Number(body.split(separator).join(''));
        return { value, rawNumericText: text, inequality, ambiguous: false };
      }
      return { value: null, rawNumericText: text, inequality, ambiguous: true };
    }
    if (digitsAfter === 3) {
      // "1,234" or "1.234" could be a thousands separator or a decimal value.
      return { value: null, rawNumericText: text, inequality, ambiguous: true };
    }
    if (integerPart === '' || /^\d+$/.test(integerPart)) {
      const value = Number(`${integerPart}.${body.slice(index + 1)}`);
      return Number.isFinite(value)
        ? { value, rawNumericText: text, inequality, ambiguous: false }
        : { value: null, rawNumericText: text, inequality, ambiguous: true };
    }
    return { value: null, rawNumericText: text, inequality, ambiguous: true };
  }

  const value = Number(body);
  return Number.isFinite(value)
    ? { value, rawNumericText: text, inequality, ambiguous: false }
    : { value: null, rawNumericText: text, inequality, ambiguous: true };
}

export function supportedCodes(): readonly SupportedTestCode[] {
  return SUPPORTED_TEST_CODES;
}

export { TEST_DEFINITIONS };

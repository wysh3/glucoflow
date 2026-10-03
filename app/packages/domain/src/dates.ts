import type { DateKind, DatePrecision } from '@sutra/contracts';

/**
 * Clinical date handling. Dates are date-only strings and are never timezone
 * converted. Ambiguous numeric dates stay unresolved and are reported as an issue
 * rather than being guessed.
 * Source: docs/mvp/04-extraction-engine.md "Validation rules".
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export type ParsedDate = {
  eventDate: string | null;
  datePrecision: DatePrecision;
  dateRaw: string;
  ambiguous: boolean;
  reason: 'ok' | 'unparsed' | 'ambiguous_order' | 'partial' | 'invalid';
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  if (year < 1900 || year > 2200) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return isoDate(year, month, day) === value;
}

/**
 * Parses the first clinically meaningful date in a source text fragment.
 * A three-part numeric date with both parts <= 12 stays ambiguous.
 */
export function parseDate(raw: string | null | undefined): ParsedDate {
  const text = (raw ?? '').trim();
  const empty: ParsedDate = {
    eventDate: null,
    datePrecision: 'unknown',
    dateRaw: text,
    ambiguous: false,
    reason: 'unparsed',
  };
  if (!text) return empty;

  // ISO first: 2026-09-14
  const isoMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (isoMatch) {
    const value = isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    if (value) {
      return { eventDate: value, datePrecision: 'day', dateRaw: text, ambiguous: false, reason: 'ok' };
    }
    return { ...empty, reason: 'invalid' };
  }

  // 14 September 2026 / 14 Sep 2026 / September 14, 2026
  const dayMonthName = /(\d{1,2})[\s-]*([A-Za-z]{3,9})[\s,-]*(\d{4})/.exec(text);
  if (dayMonthName) {
    const month = MONTHS[dayMonthName[2]!.toLowerCase()];
    if (month) {
      const value = isoDate(Number(dayMonthName[3]), month, Number(dayMonthName[1]));
      if (value) {
        return { eventDate: value, datePrecision: 'day', dateRaw: text, ambiguous: false, reason: 'ok' };
      }
    }
  }
  const monthNameDay = /([A-Za-z]{3,9})[\s-]*(\d{1,2})[\s,-]*(\d{4})/.exec(text);
  if (monthNameDay) {
    const month = MONTHS[monthNameDay[1]!.toLowerCase()];
    if (month) {
      const value = isoDate(Number(monthNameDay[3]), month, Number(monthNameDay[2]));
      if (value) {
        return { eventDate: value, datePrecision: 'day', dateRaw: text, ambiguous: false, reason: 'ok' };
      }
    }
  }
  const dayMonthNameShort = /(\d{1,2})[\s-]*([A-Za-z]{3})[\s-]*(\d{2})\b/.exec(text);
  if (dayMonthNameShort) {
    const month = MONTHS[dayMonthNameShort[2]!.toLowerCase()];
    const year = 2000 + Number(dayMonthNameShort[3]);
    if (month) {
      const value = isoDate(year, month, Number(dayMonthNameShort[1]));
      if (value) {
        return { eventDate: value, datePrecision: 'day', dateRaw: text, ambiguous: false, reason: 'ok' };
      }
    }
  }

  // Numeric three-part date: 14/09/2026, 09-14-2026, 14.09.2026
  const numeric = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(text);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]);
    if (first > 12 && second <= 12) {
      const value = isoDate(year, second, first);
      if (value) {
        return { eventDate: value, datePrecision: 'day', dateRaw: text, ambiguous: false, reason: 'ok' };
      }
    }
    if (second > 12 && first <= 12) {
      const value = isoDate(year, first, second);
      if (value) {
        return { eventDate: value, datePrecision: 'day', dateRaw: text, ambiguous: false, reason: 'ok' };
      }
    }
    if (first <= 12 && second <= 12) {
      return {
        eventDate: null,
        datePrecision: 'unknown',
        dateRaw: text,
        ambiguous: true,
        reason: 'ambiguous_order',
      };
    }
    return { ...empty, reason: 'invalid' };
  }

  // Month and year only: September 2026 / Sep-2026
  const monthYear = /([A-Za-z]{3,9})[\s,-]*(\d{4})/.exec(text);
  if (monthYear) {
    const month = MONTHS[monthYear[1]!.toLowerCase()];
    if (month) {
      return {
        eventDate: null,
        datePrecision: 'month',
        dateRaw: text,
        ambiguous: false,
        reason: 'partial',
      };
    }
  }

  const yearOnly = /\b(19|20)\d{2}\b/.exec(text);
  if (yearOnly) {
    return { eventDate: null, datePrecision: 'year', dateRaw: text, ambiguous: false, reason: 'partial' };
  }

  return empty;
}

export const DATE_KIND_LABELS: Record<DateKind, string> = {
  collection: 'Collected',
  report: 'Reported',
  prescription: 'Prescribed',
  examination: 'Examined',
  reported: 'Reported by patient',
};

/** Display helper. A month/year only value is never shown as a full date. */
export function formatClinicalDate(
  date: string | null,
  precision: DatePrecision,
  kind: DateKind | null,
  raw: string | null,
): string {
  if (date && precision === 'day') {
    const label = kind ? `${DATE_KIND_LABELS[kind]} ` : '';
    return `${label}${date}`;
  }
  if (raw) {
    const label = kind ? `${DATE_KIND_LABELS[kind]} ` : '';
    return `${label}${raw}`;
  }
  return 'Date not recorded';
}

export function compareDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

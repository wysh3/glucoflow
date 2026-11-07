import { expect, it } from 'vitest';
import { english, hindi } from '../../apps/client/src/i18n/messages';
import { formatUiDate, getLocale, localeCatalog, message, selectableLocales } from '../../apps/client/src/i18n/catalog';

it('lists the 22 scheduled languages plus English, with valid language tags', () => {
  expect(localeCatalog).toHaveLength(23);
  expect(new Set(localeCatalog.map((item) => item.tag)).size).toBe(23);
  for (const item of localeCatalog) expect(Intl.getCanonicalLocales(item.tag)).toHaveLength(1);
});

it('falls back to English for unknown or catalog-only stored preferences', () => {
  expect(getLocale('unknown-language').tag).toBe('en-IN');
  expect(getLocale('sat-Olck-IN').tag).toBe('en-IN');
  expect(selectableLocales.some((item) => item.tag === 'sat-Olck-IN')).toBe(false);
  expect(getLocale('ur-IN').direction).toBe('rtl');
});

it('covers the same keys in Hindi and preserves every interpolation token', () => {
  expect(Object.keys(hindi).sort()).toEqual(Object.keys(english).sort());
  const tokens = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const key of Object.keys(english) as (keyof typeof english)[]) {
    expect(hindi[key].trim()).not.toBe('');
    expect(tokens(hindi[key])).toEqual(tokens(english[key]));
  }
  expect(message('hi-IN', 'notes.characters', { count: 5, max: 1000 })).toContain('1000 में से 5');
});

it('translates preview controls and uses English for missing messages', () => {
  expect(message('ta-IN', 'records.title')).toBe('எனது பதிவுகள்');
  expect(message('ta-IN', 'records.displayLimit')).toBe(english['records.displayLimit']);
  expect(message('en-IN', 'notes.submittedVersion', { date: 'today', version: 2 })).toBe('submitted today · version 2');
});

it('formats date-only values and preserves year and month precision', () => {
  expect(formatUiDate('2026-10-03', 'en-IN')).toBe('03 October 2026');
  expect(formatUiDate('2026-10-03', 'hi-IN')).toContain('अक्टूबर');
  expect(formatUiDate('2026-10-01', 'en-IN', 'month')).toBe('October 2026');
  expect(formatUiDate('2026-01-01', 'en-IN', 'year')).toBe('2026');
  expect(formatUiDate('2026-02-30', 'en-IN')).toBe('');
  expect(formatUiDate('not a date', 'en-IN')).toBe('');
});

import { describe, expect, it } from 'vitest';
import { formatDateOnly } from './utils';
describe('calendar date formatting', () => {
  it('keeps source date-only values unchanged', () => {
    expect(formatDateOnly('2026-10-03')).toBe('03 October 2026');
  });
  it('uses the local calendar day for submitted timestamps', () => {
    const timestamp = '2026-10-03T18:37:00Z';
    const date = new Date(timestamp);
    const expected = `${String(date.getDate()).padStart(2, '0')} ${date.toLocaleString('en', { month: 'long' })} ${date.getFullYear()}`;
    expect(formatDateOnly(timestamp)).toBe(expected);
  });
});

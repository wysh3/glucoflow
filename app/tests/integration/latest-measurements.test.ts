import { expect, it } from 'vitest';
import { latestMeasurements } from '../../apps/client/src/lib/latest-measurements';
const row = (id: string, unit: string | null, date: string | null, datePrecision = 'day') => ({ factId: id, testCode: 'glucose', unit, rawUnit: unit, date, datePrecision });
it('preserves tied dates, incompatible units, and undated evidence without choosing a winner', () => {
  const rows = [row('old', 'mg/dL', '2026-10-01'), row('a', 'mg/dL', '2026-11-01'), row('b', 'mg/dL', '2026-11-01'), row('c', 'mmol/L', '2026-09-01'), row('unknown', null, null), row('month', 'mg/dL', '2026-11-01', 'month')];
  expect(latestMeasurements(rows).map(x => x.factId)).toEqual(['a', 'b', 'c', 'unknown', 'month']);
  expect(rows[0]?.factId).toBe('old');
});
it('does not invent a latest date for approximate or undated entries', () => {
  expect(latestMeasurements([row('x', '%', null), row('y', '%', null)]).map(x => x.factId)).toEqual(['x', 'y']);
});

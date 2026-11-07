import { expect, it } from 'vitest';
import type { CareEpisodeRecord } from '@glucoflow/contracts';
import { episodeMeasurements } from '../../apps/client/src/features/care/episode-measurements';

const record = (id: string, at: string, value: string, overrides: Partial<CareEpisodeRecord> = {}): CareEpisodeRecord => ({
  id, encounterId: 'encounter', kind: 'observation', label: 'Glucose', unit: 'mg/dL', value,
  occurredAt: at, recordedAt: at, sourceRef: `OBS-${id}`, recordedBy: 'Synthetic nurse', ...overrides,
});
const at = '2026-11-07T10:00:00.000Z';
const later = '2026-11-07T11:30:00.000Z';

it('plots only compatible numeric observations and keeps source references in timestamp order', () => {
  const first = record('first', at, '200.0');
  const last = record('last', later, '185');
  expect(episodeMeasurements([
    last, record('missing', later, 'Not recorded'), first,
    record('other-unit', later, '10', { unit: 'mmol/L' }),
    record('other-label', later, '123', { label: 'Random glucose' }),
    record('followup', later, '120', { kind: 'followup' }),
    record('bad-time', '2026-11-07', '230'),
  ])).toEqual([{
    label: 'Glucose', unit: 'mg/dL', points: [
      { record: first, time: Date.parse(at), value: 200 }, { record: last, time: Date.parse(later), value: 185 },
    ],
  }]);
});

it('keeps same-instant repeats and unitless values in the source list only', () => {
  expect(episodeMeasurements([
    record('a', at, '100'), record('b', '2026-11-07T15:30:00+05:30', '101'),
    record('c', at, '10', { unit: '' }), record('d', later, '11', { unit: '' }),
  ])).toEqual([]);
});

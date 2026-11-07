import type { CareEpisodeRecord } from '@glucoflow/contracts';

type Measurement = { record: CareEpisodeRecord; time: number; value: number };
export type EpisodeMeasurementSeries = { label: string; unit: string; points: Measurement[] };

/** A transcription is plottable only with a numeric value, matching unit and explicit observation time. */
export function episodeMeasurements(records: readonly CareEpisodeRecord[]): EpisodeMeasurementSeries[] {
  const series = new Map<string, EpisodeMeasurementSeries>();
  for (const record of currentEpisodeRecords(records)) {
    const { label, unit, occurredAt } = record;
    const valueText = record.value.trim();
    if (record.kind !== 'observation' || !label.trim() || (!unit.trim() && !record.dimensionless) || !record.sourceRef.trim()
      || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(valueText)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(occurredAt)) continue;
    const time = Date.parse(occurredAt);
    const value = Number(valueText);
    if (!Number.isFinite(time) || !Number.isFinite(value)) continue;

    const key = JSON.stringify([label, unit]);
    const group = series.get(key) ?? { label, unit, points: [] };
    group.points.push({ record, time, value });
    series.set(key, group);
  }
  return [...series.values()].filter(group => {
    group.points.sort((a, b) => a.time - b.time);
    return group.points[0]?.time !== group.points.at(-1)?.time;
  });
}

/** Append-only revisions retain history; only undisputed latest versions enter plots. */
export function currentEpisodeRecords(records: readonly CareEpisodeRecord[]): CareEpisodeRecord[] {
 const superseded = new Set(records.flatMap(record => record.supersedesId ? [record.supersedesId] : []));
 return records.filter(record => !superseded.has(record.id) && record.disposition !== 'disputed');
}
export function episodeRecordStatus(record: CareEpisodeRecord, records: readonly CareEpisodeRecord[]): string {
 return records.some(item => item.supersedesId === record.id) ? 'Superseded · retained for audit' : record.disposition === 'disputed' ? 'Disputed · excluded from plots' : 'Unverified transcription';
}

import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { numeric } from '@sutra/ui';
import { formatDateOnly } from '@sutra/ui';

/**
 * Progression chart.
 *
 * Measured points are connected with straight segments on a date-proportional axis.
 * Incompatible units are never combined: each series (test code plus unit) gets its
 * own panel and its own y axis. No slope, prognosis or global verdict is computed.
 */

export type SeriesPoint = {
  factId: string;
  date: string;
  value: number;
  rawValue: string | null;
  unit: string | null;
  dateKind: string;
  groupId: string | null;
};

export type Series = {
  key: string;
  testCode: string;
  label: string;
  unit: string | null;
  points: SeriesPoint[];
};

function toTimestamp(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

const DATE_KIND_LABELS: Record<string, string> = {
  collection: 'Collected',
  report: 'Reported',
  prescription: 'Prescribed',
  examination: 'Examined',
  reported: 'Patient reported',
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: SeriesPoint }[];
  label?: number;
}): React.ReactElement | null {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]!.payload;
  return (
    <div className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] shadow-sm">
      <p className="font-medium text-ink">
        {point.rawValue ?? point.value} {point.unit ?? ''}
      </p>
      <p className="text-ink-soft">
        {DATE_KIND_LABELS[point.dateKind] ?? 'Date'} {formatDateOnly(point.date)}
      </p>
      {label !== undefined ? null : null}
    </div>
  );
}

export function ProgressionPanel({
  series,
  height = 260,
}: {
  series: Series;
  height?: number;
}): React.ReactElement {
  const data = React.useMemo(
    () =>
      series.points.map((point) => ({
        ...point,
        ts: toTimestamp(point.date),
      })),
    [series.points],
  );

  const values = series.points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, max === min ? Math.max(Math.abs(max) * 0.05, 1) : 0);

  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">
          {series.label}
          {series.unit ? <span className="text-ink-soft"> · {series.unit}</span> : null}
        </p>
        <p className="text-[12px] text-ink-soft">
          {series.points.length} recorded {series.points.length === 1 ? 'result' : 'results'}
        </p>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#DCE3E8" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value: number) =>
                new Date(value).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
              }
              stroke="#52636C"
              fontSize={12}
              tickMargin={8}
            />
            <YAxis
              domain={[min - padding, max + padding]}
              stroke="#52636C"
              fontSize={12}
              width={52}
              tickFormatter={(value: number) => String(Number(value.toFixed(2)))}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="linear"
              dataKey="value"
              stroke="#12606F"
              strokeWidth={2}
              dot={{ r: 4, fill: '#12606F' }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ChartLegend(): React.ReactElement {
  return <p className="text-[12px] text-ink-soft">Lines connect recorded results.</p>;
}

export { numeric };

import * as React from 'react';
import { Badge, Card, cn } from '@glucoflow/ui';
import { SystemPageHeader } from '../../../components/system-page-header';
import replay from './replay-data.json';

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ReplayPage(): React.ReactElement {
  const synthetic = replay.source === 'synthetic';
  const delta = replay.intervention.closedWithinSlaShare - replay.baseline.closedWithinSlaShare;

  return (
    <div className="space-y-5">
      <SystemPageHeader
        index="05"
        label="Evidence"
        title="The replay"
        meta="A retrospective baseline and a deterministic queue simulation on the same cohort. It is not a controlled trial."
        actions={
          <Badge tone={synthetic ? 'review' : 'success'}>
            {synthetic ? 'Synthetic cohort, not a measurement' : 'Audit cohort'}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Closed within SLA"
          value={percent(replay.intervention.closedWithinSlaShare)}
          previous={percent(replay.baseline.closedWithinSlaShare)}
          note={`+${(delta * 100).toFixed(1)} points from the baseline`}
          tone="success"
        />
        <Metric
          label="Median handoff"
          value={`${replay.intervention.medianHandoffMinutes ?? 0} min`}
          previous={`${replay.baseline.medianHandoffMinutes ?? 0} min`}
          note="Modeled: 4 min desk + 6 min review"
          tone="primary"
        />
        <Metric
          label="Critical unacknowledged"
          value={percent(replay.baseline.criticalUnacknowledgedShare)}
          note="Baseline: no documented clinician acknowledgement"
          tone="review"
        />
      </div>

      <Card className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Baseline against the closure loop</p>
        <div className="mt-4 space-y-4">
          <Bar label="Baseline: closed within SLA" value={replay.baseline.closedWithinSlaShare} tone="review" />
          <Bar label="With the loop: closed within SLA" value={replay.intervention.closedWithinSlaShare} tone="success" />
          <Bar label="With the loop: exception, not informed" value={replay.intervention.exceptionShare} tone="neutral" />
        </div>
        <p className="mt-4 text-[12px] leading-5 text-ink-soft">
          The closed share tracks the 86% reachability assumption. It is not an independent measurement.
        </p>
        <p className="mt-2 text-[12px] leading-5 text-ink-soft">
          Cohort {replay.cohort} reports over {replay.windowDays} days. Baseline unacknowledged{' '}
          {percent(replay.baseline.unacknowledgedShare)}, uninformed {percent(replay.baseline.uninformedShare)},
          outpatient unacknowledged {percent(replay.baseline.outpatientUnacknowledgedShare)}, critical unacknowledged{' '}
          {percent(replay.baseline.criticalUnacknowledgedShare)}.
        </p>
      </Card>

      <Card className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Method and assumptions</p>
        <ul className="mt-3 space-y-2 text-[13px] leading-5 text-ink-soft">
          {replay.assumptions.map((assumption) => (
            <li key={assumption} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-soft" aria-hidden />
              <span>{assumption}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] leading-5 text-ink-soft">
          {synthetic
            ? 'This cohort is synthetic. The baseline is an assumption, not a measurement. Replace it with 100 to 300 consecutive reports from one clinic before quoting any number.'
            : 'This cohort comes from the audit. The baseline is measured; the intervention is still simulated.'}
        </p>
      </Card>

      <p className="text-[12px] text-ink-soft">
        Regenerate with <code className="rounded bg-canvas px-1 py-0.5">pnpm exec tsx scripts/replay.ts</code> or pass{' '}
        <code className="rounded bg-canvas px-1 py-0.5">--input cohort.csv</code> for a real audit.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  previous,
  note,
  tone,
}: {
  label: string;
  value: string;
  previous?: string;
  note: string;
  tone: 'success' | 'primary' | 'review';
}): React.ReactElement {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className={cn('mt-1 text-[28px] font-semibold tabular-nums', tone === 'success' ? 'text-success' : tone === 'review' ? 'text-review' : 'text-primary')}>
        {value}
      </p>
      {previous ? <p className="text-[12px] text-ink-soft">Baseline {previous}</p> : null}
      <p className="mt-1 text-[12px] text-ink-soft">{note}</p>
    </Card>
  );
}

function Bar({ label, value, tone }: { label: string; value: number; tone: 'success' | 'review' | 'neutral' }): React.ReactElement {
  const width = Math.max(2, Math.min(100, value * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-ink">{label}</span>
        <span className="tabular-nums text-ink-soft">{percent(value)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-canvas">
        <div
          className={cn('h-2 rounded-full', tone === 'success' ? 'bg-success' : tone === 'review' ? 'bg-review' : 'bg-ink-soft/40')}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

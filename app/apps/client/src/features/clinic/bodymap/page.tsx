import * as React from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowRight, FileText, ScanLine, ShieldCheck, Sparkles } from 'lucide-react';
import type { PatientSummaryDto } from '@glucoflow/contracts';
import { Badge, Button, Spinner } from '@glucoflow/ui';
import { QueryState } from '../../../components/state-views';
import { useSourcePane } from '../../../components/source-pane';
import { useDelta, useTimeline } from '../../../lib/queries';
import {
  buildBodySystems,
  formatRecordedDate,
  systemStatusColor,
  systemStatusLabel,
  type BodyItem,
  type BodyStatus,
  type BodySystem,
  type BodySystemKey,
} from './body-data';
const BodyModel3D = React.lazy(() =>
  import('./body-model').then((module) => ({ default: module.BodyModel3D })),
);

const STATUS_TONE: Record<BodyStatus, 'success' | 'review' | 'error' | 'neutral'> = {
  recorded: 'success',
  open: 'review',
  conflict: 'error',
  missing: 'neutral',
};

function SystemCard({
  system,
  active,
  onSelect,
}: {
  system: BodySystem;
  active: boolean;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
        active
          ? 'border-primary/40 bg-primary/5'
          : 'border-line bg-surface hover:border-primary/30 hover:bg-canvas'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-ink">{system.label}</span>
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: systemStatusColor(system.status) }}
          aria-hidden
        />
      </span>
      <span className="mt-1 block text-[12px] leading-5 text-ink-soft">
        {systemStatusLabel(system.status)}
        {system.latestDate ? ` · ${formatRecordedDate(system.latestDate)}` : ''}
      </span>
    </button>
  );
}

function ItemRow({
  item,
  onOpen,
}: {
  item: BodyItem;
  onOpen: (item: BodyItem) => void;
}): React.ReactElement {
  return (
    <li className="border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{item.title}</p>
          <p className="mt-1 text-[14px] leading-5 text-ink-soft">{item.detail}</p>
          <p className="mt-1 text-[11px] text-ink-soft">
            {formatRecordedDate(item.date)} · {item.kind === 'observation' ? 'Approved observation' : 'Approved document'}
          </p>
        </div>
        {item.source ? (
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-primary hover:bg-primary/5"
          >
            <FileText size={12} aria-hidden /> Source
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function BodyMapPage(): React.ReactElement {
  const patient = useOutletContext<PatientSummaryDto>();
  const timeline = useTimeline(patient.patientId, { testCodes: [] });
  const delta = useDelta(patient.patientId);
  const source = useSourcePane();
  const systems = React.useMemo(
    () => buildBodySystems(timeline.data, delta.data),
    [timeline.data, delta.data],
  );
  const [active, setActive] = React.useState<BodySystemKey>('glucose');
  const selected = systems.find((system) => system.key === active) ?? systems[0]!;
  const recorded = systems.filter((system) => system.status === 'recorded').length;
  const open = systems.filter((system) => system.status === 'open' || system.status === 'conflict').length;

  const openItem = async (item: BodyItem): Promise<void> => {
    if (!item.source) return;
    await source.openSource({
      documentId: item.source.documentId,
      versionId: item.source.versionId,
      page: item.source.page,
      quote: item.source.quote,
      bbox: item.source.bbox,
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-line bg-surface px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              <ScanLine size={15} aria-hidden /> Body map
            </p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-ink">
              What the record holds, by follow-up area
            </h1>
            <p className="mt-1 max-w-[78ch] text-[14px] leading-6 text-ink-soft">
              Five areas that diabetes follow-up commonly revisits. This is a coverage map of
              recorded entries, not a diagnosis and not a risk score.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{recorded} recorded</Badge>
            <Badge tone="review">{open} open</Badge>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('gluco:open'))}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/20 bg-surface px-3 text-[12px] font-semibold text-primary hover:bg-primary/5 lg:hidden"
            >
              <Sparkles size={13} aria-hidden /> Ask Gluco
            </button>
          </div>
        </div>
      </section>

      <QueryState
        isLoading={timeline.isLoading}
        error={timeline.error}
        onRetry={() => void timeline.refetch()}
      >
        {timeline.data ? (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-[20px] border border-line bg-surface p-3 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-[12px] font-semibold text-ink">Drag the body. Click an organ.</p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-soft">
                  {(['recorded', 'open', 'conflict', 'missing'] as BodyStatus[]).map((status) => (
                    <span key={status} className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: systemStatusColor(status) }} aria-hidden />
                      {systemStatusLabel(status)}
                    </span>
                  ))}
                </div>
              </div>
              <React.Suspense fallback={<div className="grid h-[520px] place-items-center rounded-[18px] border border-line bg-canvas sm:h-[650px]"><Spinner label="Loading 3D anatomy" /></div>}>
                <BodyModel3D active={active} onSelect={setActive} />
              </React.Suspense>
              <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-ink-soft">
                <ShieldCheck size={13} aria-hidden />
                An empty area does not mean normal. It means no matching approved entry is in this record.
              </p>
              <p className="mt-1 px-1 text-[11px] leading-5 text-ink-soft">
                Reference anatomy: Human Reference Atlas / Visible Human Female, CC BY 4.0.{' '}
                <a className="font-medium text-primary underline underline-offset-2" href="/models/ATTRIBUTION.md" target="_blank" rel="noreferrer">
                  Attribution
                </a>
                . Not a patient scan.
              </p>
            </section>

            <aside className="space-y-3">
              <section className="rounded-[20px] border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[20px] font-semibold tracking-tight text-ink">{selected.label}</h2>
                    <p className="mt-1 text-[12px] leading-5 text-ink-soft">{selected.caption}</p>
                  </div>
                  <Badge tone={STATUS_TONE[selected.status]}>{systemStatusLabel(selected.status)}</Badge>
                </div>
                <p className="mt-3 text-[11px] text-ink-soft">
                  {selected.latestDate
                    ? `Latest recorded entry: ${formatRecordedDate(selected.latestDate)}`
                    : 'No dated entry recorded for this area.'}
                </p>
                {selected.items.length ? (
                  <ul className="mt-2">
                    {selected.items.map((item) => (
                      <ItemRow key={item.id} item={item} onOpen={(entry) => void openItem(entry)} />
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-line bg-canvas px-3 py-4 text-[12px] leading-5 text-ink-soft">
                    No matching approved entry is in this record. That does not mean the test was
                    never done. It means this record does not show it.
                  </div>
                )}
                <p className="mt-3 text-[11px] leading-5 text-ink-soft">
                  Recorded facts only. The map does not interpret values, diagnose or recommend
                  treatment.
                </p>
              </section>

              <section className="rounded-[20px] border border-line bg-surface p-3">
                <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                  All areas
                </p>
                <div className="space-y-2">
                  {systems.map((system) => (
                    <SystemCard
                      key={system.key}
                      system={system}
                      active={active === system.key}
                      onSelect={() => {
                        setActive(system.key);
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActive('glucose')}
                  className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-line text-[12px] font-medium text-ink-soft hover:bg-canvas"
                >
                  Reset to glucose <ArrowRight size={13} aria-hidden />
                </button>
              </section>
            </aside>
          </div>
        ) : null}
      </QueryState>
      {source.pane}
    </div>
  );
}

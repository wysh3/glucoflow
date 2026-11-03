import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  FileText,
  HelpCircle,
  ListChecks,
  NotebookPen,
  Timer,
} from 'lucide-react';
import type { DeltaAction, DeltaBlock, DeltaItem, DeltaSummary } from '@glucoflow/contracts';
import { Badge, Button, cn, formatDateOnly } from '@glucoflow/ui';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, effectiveStatus } from './delta-copy';
import { selectBrief } from './brief-select';

const DOT: Record<DeltaBlock, string> = {
  changed: 'bg-emerald-500',
  unresolved: 'bg-amber-500',
  conflict: 'bg-rose-500',
  unknown: 'bg-ink-soft/40',
};

const BLOCK_LABEL: Record<DeltaBlock, string> = {
  changed: 'Change',
  unresolved: 'Open item',
  conflict: 'Conflict',
  unknown: 'Gap',
};

const BLOCK_TONE: Record<DeltaBlock, 'success' | 'review' | 'error' | 'neutral'> = {
  changed: 'success',
  unresolved: 'review',
  conflict: 'error',
  unknown: 'neutral',
};

function primaryAction(block: DeltaBlock): DeltaAction {
  if (block === 'changed') return 'accepted';
  if (block === 'unknown') return 'asked_patient';
  return 'flagged';
}

function primaryLabel(item: DeltaItem): string {
  if (item.block === 'changed') return item.kind === 'note' ? 'Acknowledge' : 'Accept';
  if (item.block === 'unresolved') return 'Flag';
  if (item.block === 'conflict') return 'Flag';
  return 'Ask patient';
}

function CountPill({
  block,
  label,
  singularLabel,
  value,
}: {
  block: DeltaBlock;
  label: string;
  singularLabel?: string;
  value: number;
}): React.ReactElement {
  const text = value === 1 ? (singularLabel ?? label) : label;
  return (
    <span
      data-count={block}
      data-value={value}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink-soft sm:px-3 sm:text-[12px]"
    >
      <span className={cn('size-1.5 rounded-full', DOT[block])} aria-hidden />
      <span className="text-ink">{value}</span>
      {text}
    </span>
  );
}

function DecisionCard({
  item,
  index,
  status,
  pending,
  onAction,
  onOpenSource,
}: {
  item: DeltaItem;
  index: number;
  status: DeltaItem['status'];
  pending: boolean;
  onAction: (itemId: string, action: DeltaAction) => void | Promise<void>;
  onOpenSource: (item: DeltaItem) => void;
}): React.ReactElement {
  const action = primaryAction(item.block);
  const done = status !== 'open';
  return (
    <article
      data-tour={`decision-${index}`}
      className={cn(
        'relative flex min-w-[86%] snap-center flex-col rounded-[18px] border bg-surface p-3.5 shadow-[0_4px_18px_rgba(32,59,56,0.04)] transition-shadow sm:min-w-[70%] sm:p-4 lg:min-w-0',
        item.block === 'conflict' ? 'border-rose-200/80' : 'border-line',
        done && 'ring-1 ring-success/25',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
          <span className={cn('size-1.5 rounded-full', DOT[item.block])} aria-hidden />
          {BLOCK_LABEL[item.block]}
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-ink-soft/60">
          {String(index).padStart(2, '0')}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={BLOCK_TONE[item.block]}>{KIND_LABEL[item.kind]}</Badge>
        {item.date ? (
          <span className="text-[11px] text-ink-soft">{formatDateOnly(item.date)}</span>
        ) : null}
        {item.ageDays !== null ? (
          <span className="text-[11px] text-ink-soft">· {item.ageDays} days</span>
        ) : (
          <span className="text-[11px] text-ink-soft">· no date</span>
        )}
        {done ? (
          <Badge tone={STATUS_TONE[status as DeltaAction]} className="ml-auto">
            {STATUS_LABEL[status as DeltaAction]}
          </Badge>
        ) : null}
      </div>

      <h3 className="mt-2.5 text-[18px] font-semibold leading-tight tracking-tight text-ink sm:mt-3 sm:text-[20px]">
        {item.title}
      </h3>
      <p className="mt-2 line-clamp-4 text-[12px] leading-5 text-ink-soft sm:text-[13px] sm:leading-6">{item.detail}</p>
      <p className="mt-2 hidden line-clamp-2 text-[11px] leading-5 text-ink-soft/80 sm:block">{item.why}</p>

      <div className="mt-auto flex items-end justify-between gap-2 pt-3 sm:pt-4">
        {item.evidence.length > 0 ? (
          <button
            type="button"
            onClick={() => onOpenSource(item)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium text-ink-soft hover:bg-canvas hover:text-ink"
          >
            <FileText size={14} aria-hidden />
            Source
          </button>
        ) : (
          <span className="text-[11px] text-ink-soft">
            {item.kind === 'note' ? 'Patient-submitted' : 'No source attached'}
          </span>
        )}
        <Button
          size="sm"
          variant={
            done
              ? 'secondary'
              : item.block === 'unresolved' || item.block === 'conflict'
                ? 'review'
                : item.block === 'unknown'
                  ? 'secondary'
                  : 'primary'
          }
          disabled={pending || done}
          onClick={() => void onAction(item.id, action)}
        >
          {done ? <Check size={14} aria-hidden /> : null}
          {done ? STATUS_LABEL[status as DeltaAction] : primaryLabel(item)}
        </Button>
      </div>
    </article>
  );
}

export function DeltaBrief({
  summary,
  mode,
  statuses,
  pendingItem,
  onAction,
  onOpenSource,
  onReview,
  onOpenNote,
  onOpenLedger,
  compact = false,
  tourActive = false,
}: {
  summary: DeltaSummary;
  mode: 'live' | 'demo';
  statuses: Record<string, DeltaAction>;
  pendingItem?: string | null;
  onAction: (itemId: string, action: DeltaAction) => void | Promise<void>;
  onOpenSource: (item: DeltaItem) => void;
  onReview: (index: number) => void;
  onOpenNote: () => void;
  onOpenLedger: () => void;
  compact?: boolean;
  tourActive?: boolean;
}): React.ReactElement {
  const selection = selectBrief(summary, statuses);
  const reviewed = selection.reviewed;
  const remaining = selection.decisions.length - reviewed;
  const decisionHeading =
    selection.decisions.length === 0
      ? 'Nothing needs your decision'
      : remaining === 0
        ? 'All decisions reviewed'
        : remaining === 1
          ? '1 needs your decision'
          : `${remaining} need your decision`;
  const age = summary.patient.birthDate
    ? Math.max(
        0,
        Math.floor(
          (Date.parse(`${summary.asOf}T00:00:00Z`) -
            Date.parse(`${summary.patient.birthDate}T00:00:00Z`)) /
            31_557_600_000,
        ),
      )
    : null;

  return (
    <div className={cn('space-y-4', !tourActive && 'pb-24')}>
      <header
        data-tour="brief"
        className="rounded-[20px] border border-line bg-surface px-4 py-4 shadow-[0_4px_20px_rgba(32,59,56,0.04)] sm:px-6 sm:py-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              Pre-visit delta
              {mode === 'demo' ? ' · synthetic' : ' · approved records'}
            </p>
            {compact ? (
              <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-[26px]">
                {summary.lastVisitDate
                  ? `What changed since ${formatDateOnly(summary.lastVisitDate)}`
                  : 'What changed since the last record'}
              </h1>
            ) : (
              <>
                <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink sm:text-[30px]">
                  {summary.patient.displayName}
                </h1>
                <p className="mt-1 text-[12px] text-ink-soft sm:hidden">
                  {summary.patient.clinicIdentifier}
                  {age !== null ? ` · ${age}y` : ''}
                  {summary.lastVisitDate
                    ? ` · since ${formatDateOnly(summary.lastVisitDate)}`
                    : ''}
                  {` · ${summary.readSeconds}s read`}
                </p>
                <p className="mt-1 hidden text-[13px] text-ink-soft sm:block">
                  {summary.patient.clinicIdentifier}
                  {age !== null ? ` · ${age} years` : ''}
                  {summary.lastVisitDate
                    ? ` · since ${formatDateOnly(summary.lastVisitDate)}`
                    : ''}
                </p>
              </>
            )}
          </div>
          <div className="hidden flex-col items-start gap-2 sm:flex sm:items-end">
            <span
              data-tour="brief-proof"
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[13px] font-semibold text-primary"
            >
              <Timer size={15} aria-hidden />
              {summary.readSeconds}-second read
            </span>
            <span className="text-[11px] text-ink-soft">Every line opens its source.</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          <CountPill block="changed" label="changes" singularLabel="change" value={summary.counts.changed} />
          <CountPill block="unresolved" label="unresolved" value={summary.counts.unresolved} />
          <CountPill block="conflict" label="conflicts" singularLabel="conflict" value={summary.counts.conflict} />
          <CountPill block="unknown" label="gaps" singularLabel="gap" value={summary.counts.unknown} />
        </div>
      </header>

      <section aria-labelledby="decisions-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="decisions-heading"
              className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-ink"
            >
              <ListChecks size={19} className="text-primary" aria-hidden />
              {decisionHeading}
            </h2>
            <p className="mt-0.5 text-[12px] leading-5 text-ink-soft">
              {selection.focusLabel}
              {reviewed > 0 && remaining > 0 ? ` · ${reviewed} reviewed` : ''}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            data-tour="review"
            className={tourActive ? 'inline-flex' : 'hidden sm:inline-flex'}
            onClick={() => onReview(0)}
          >
            Review {remaining > 0 ? remaining : selection.decisions.length}
            {remaining > 0
              ? ' remaining'
              : selection.decisions.length === 1
                ? ' decision'
                : ' decisions'}
            <ArrowRight size={14} aria-hidden />
          </Button>
        </div>

        <div
          className={cn(
            '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0',
            selection.decisions.length === 1
              ? 'lg:max-w-[520px] lg:grid-cols-1'
              : selection.decisions.length === 2
                ? 'lg:grid-cols-2'
                : 'lg:grid-cols-3',
          )}
        >
          {selection.decisions.map((item, index) => (
            <DecisionCard
              key={item.id}
              item={item}
              index={index + 1}
              status={effectiveStatus(item, statuses)}
              pending={pendingItem === item.id}
              onAction={onAction}
              onOpenSource={onOpenSource}
            />
          ))}
        </div>
        <p className="text-[11px] text-ink-soft lg:hidden">Swipe for the next decision.</p>
      </section>

      <section
        data-tour="brief-context"
        className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]"
      >
        <div className="rounded-[16px] border border-line bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-ink">For the note</h3>
            <Badge tone="neutral">
              {selection.contextChanged.length} context change
              {selection.contextChanged.length === 1 ? '' : 's'}
            </Badge>
          </div>
          {selection.contextChanged.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selection.contextChanged.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.evidence.length ? onOpenSource(item) : onOpenLedger())}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:border-primary/30 hover:text-ink"
                >
                  <span className={cn('size-1.5 rounded-full', DOT[item.block])} aria-hidden />
                  {item.title}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-ink-soft">No further changes in this read.</p>
          )}
          <p className="mt-2 text-[11px] leading-5 text-ink-soft">
            Context is not accepted automatically. It appears in the note as reference, not as a
            reviewed decision.
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-[16px] border border-dashed border-line bg-canvas/60 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <HelpCircle size={16} className="text-ink-soft" aria-hidden />
              <h3 className="text-[14px] font-semibold text-ink">Still open</h3>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-ink-soft">
              {selection.moreOpen} more open items, conflicts or gaps sit in the ledger. They do not
              block the decisions above.
            </p>
          </div>
          <Button size="sm" variant="quiet" className="mt-2 self-start px-2" onClick={onOpenLedger}>
            Open the full ledger
            <ArrowRight size={14} aria-hidden />
          </Button>
        </div>
      </section>

      {!tourActive ? (
        <div
          data-tour="brief-actions"
          className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-ink">
                {reviewed} of {selection.decisions.length} reviewed
              </p>
              <p className="hidden text-[11px] text-ink-soft sm:block">
                Every line opens its source. Nothing is written until you sign.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="quiet" onClick={onOpenNote}>
                <NotebookPen size={14} aria-hidden />
                Draft note
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onReview(0)}
              >
                {reviewed === selection.decisions.length ? 'Revisit' : 'Review'}
                <ArrowRight size={14} aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

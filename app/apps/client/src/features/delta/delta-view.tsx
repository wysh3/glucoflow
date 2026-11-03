import * as React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  FileText,
  Flag,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import type {
  DeltaAction,
  DeltaBlock,
  DeltaItem,
  DeltaSummary,
} from '@glucoflow/contracts';
import { Badge, Button, cn, formatDateOnly } from '@glucoflow/ui';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, buildDeltaNote } from './delta-copy';
import { AiNote } from './ai-note';

type Tone = {
  text: string;
  soft: string;
  border: string;
  dot: string;
  badge: 'success' | 'review' | 'error' | 'neutral';
};

const TONES: Record<DeltaBlock, Tone> = {
  changed: {
    text: 'text-emerald-800',
    soft: 'bg-emerald-50',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    badge: 'success',
  },
  unresolved: {
    text: 'text-amber-800',
    soft: 'bg-amber-50',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    badge: 'review',
  },
  conflict: {
    text: 'text-rose-800',
    soft: 'bg-rose-50',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
    badge: 'error',
  },
  unknown: {
    text: 'text-ink-soft',
    soft: 'bg-canvas',
    border: 'border-dashed border-line',
    dot: 'bg-ink-soft/40',
    badge: 'neutral',
  },
};

function Stat({
  block,
  label,
  value,
}: {
  block: DeltaBlock;
  label: string;
  value: number;
}): React.ReactElement {
  const tone = TONES[block];
  return (
    <a
      href={`#${block}`}
      className="group rounded-[12px] border border-line bg-canvas/50 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-surface"
    >
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
        <span className={cn('size-1.5 rounded-full', tone.dot)} aria-hidden />
        {label}
      </span>
      <span className="mt-1 block text-[22px] font-semibold leading-none tracking-tight text-ink">
        {value}
      </span>
    </a>
  );
}

function ItemActions({
  item,
  status,
  pending,
  onAction,
  onOpenSource,
}: {
  item: DeltaItem;
  status: DeltaItem['status'];
  pending: boolean;
  onAction: (itemId: string, action: DeltaAction) => void;
  onOpenSource: () => void;
}): React.ReactElement {
  const primary: DeltaAction =
    item.block === 'changed'
      ? 'accepted'
      : item.block === 'unresolved'
        ? 'flagged'
        : item.block === 'conflict'
          ? 'flagged'
          : 'asked_patient';
  const primaryLabel =
    item.block === 'changed'
      ? item.kind === 'note'
        ? 'Acknowledge'
        : 'Accept'
      : item.block === 'unresolved'
        ? 'Flag for follow-up'
        : item.block === 'conflict'
          ? 'Flag for decision'
          : 'Ask the patient';
  const secondary: DeltaAction = primary === 'asked_patient' ? 'flagged' : 'asked_patient';
  const secondaryLabel = secondary === 'asked_patient' ? 'Ask patient' : 'Flag';

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {item.evidence.length > 0 ? (
        <Button
          size="sm"
          variant="quiet"
          className="min-h-9 px-2"
          onClick={onOpenSource}
        >
          <FileText size={14} aria-hidden />
          Open source
        </Button>
      ) : (
        <span className="text-[11px] text-ink-soft">
          {item.kind === 'note' ? 'Patient-submitted' : 'No source attached'}
        </span>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={status === primary ? 'primary' : 'secondary'}
          disabled={pending}
          aria-pressed={status === primary}
          onClick={() => onAction(item.id, primary)}
        >
          {status === primary ? <Check size={14} aria-hidden /> : null}
          {status === primary ? STATUS_LABEL[primary] : primaryLabel}
        </Button>
        <Button
          size="sm"
          variant={status === secondary ? 'review' : 'quiet'}
          disabled={pending}
          aria-pressed={status === secondary}
          onClick={() => onAction(item.id, secondary)}
        >
          {secondaryLabel}
        </Button>
      </div>
    </div>
  );
}

function DeltaCard({
  item,
  status,
  pending,
  onAction,
  onOpenSource,
  tourFocus,
}: {
  item: DeltaItem;
  status: DeltaItem['status'];
  pending: boolean;
  onAction: (itemId: string, action: DeltaAction) => void;
  onOpenSource: (item: DeltaItem) => void;
  tourFocus: boolean;
}): React.ReactElement {
  const tone = TONES[item.block];
  const activeAction = status === 'open' ? null : status;
  return (
    <article
      data-delta-id={item.id}
      data-tour-focus={tourFocus ? 'true' : undefined}
      className={cn(
        'relative flex h-full flex-col rounded-[16px] border bg-surface p-4 transition-[box-shadow,transform] duration-200',
        tone.border,
        'data-[tour-focus=true]:ring-2 data-[tour-focus=true]:ring-primary data-[tour-focus=true]:ring-offset-2 data-[tour-focus=true]:ring-offset-canvas',
        status === 'accepted' && 'ring-1 ring-success/25',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone.badge}>{KIND_LABEL[item.kind]}</Badge>
        {item.date ? (
          <span className="text-[11px] font-medium text-ink-soft">{formatDateOnly(item.date)}</span>
        ) : null}
        {item.ageDays !== null ? (
          <span className="text-[11px] text-ink-soft">· {item.ageDays} days</span>
        ) : null}
        {activeAction ? (
          <Badge tone={STATUS_TONE[activeAction]} className="ml-auto">
            {STATUS_LABEL[activeAction]}
          </Badge>
        ) : null}
      </div>
      <h3 className="mt-2 text-[15px] font-semibold leading-snug text-ink">{item.title}</h3>
      <p className="mt-1 text-[13px] leading-6 text-ink-soft">{item.detail}</p>
      <p className="mt-2 text-[11px] leading-5 text-ink-soft/90">{item.why}</p>
      <div className="mt-auto pt-2">
        <p className="truncate text-[10px] font-medium tracking-[0.02em] text-ink-soft/70">
          {item.sourceLabel}
        </p>
        <ItemActions
          item={item}
          status={status}
          pending={pending}
          onAction={onAction}
          onOpenSource={() => onOpenSource(item)}
        />
      </div>
    </article>
  );
}

function Section({
  block,
  title,
  kicker,
  icon,
  items,
  statuses,
  pendingItem,
  onAction,
  onOpenSource,
  tourFocus,
}: {
  block: DeltaBlock;
  title: string;
  kicker: string;
  icon: React.ReactNode;
  items: DeltaItem[];
  statuses: Record<string, DeltaAction>;
  pendingItem: string | null;
  onAction: (itemId: string, action: DeltaAction) => void;
  onOpenSource: (item: DeltaItem) => void;
  tourFocus?: string | null;
}): React.ReactElement {
  const tone = TONES[block];
  const focused = tourFocus === block;
  return (
    <section
      id={block}
      className="scroll-mt-28 data-[tour-focus=true]:rounded-[18px] data-[tour-focus=true]:ring-2 data-[tour-focus=true]:ring-primary data-[tour-focus=true]:ring-offset-2 data-[tour-focus=true]:ring-offset-canvas"
      data-tour={block}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('grid size-8 place-items-center rounded-lg', tone.soft, tone.text)}>
              {icon}
            </span>
            <h2 className="text-[19px] font-semibold tracking-tight text-ink">{title}</h2>
            <Badge tone={tone.badge}>{items.length}</Badge>
          </div>
          <p className="mt-1 max-w-[74ch] text-sm leading-6 text-ink-soft">{kicker}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div
          data-tour-focus={focused ? 'true' : undefined}
          className="rounded-[16px] border border-dashed border-line bg-surface px-5 py-6 text-sm text-ink-soft data-[tour-focus=true]:ring-2 data-[tour-focus=true]:ring-primary"
        >
          Nothing in this block for the current record. The product does not invent an item to fill it.
        </div>
      ) : (
        <div className={cn('grid gap-3', block === 'changed' && 'lg:grid-cols-2')}>
          {items.map((item) => (
            <DeltaCard
              key={item.id}
              item={item}
              status={statuses[item.id] ?? item.status}
              pending={pendingItem === item.id}
              onAction={onAction}
              onOpenSource={onOpenSource}
              tourFocus={tourFocus === item.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function DeltaView({
  summary,
  mode,
  statuses,
  pendingItem,
  onAction,
  onOpenSource,
  tourStep,
}: {
  summary: DeltaSummary;
  mode: 'live' | 'demo';
  statuses: Record<string, DeltaAction>;
  pendingItem?: string | null;
  onAction: (itemId: string, action: DeltaAction) => void;
  onOpenSource: (item: DeltaItem) => void;
  tourStep?: number | null;
}): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const note = React.useMemo(() => buildDeltaNote(summary, statuses), [summary, statuses]);
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
  const tourFocus =
    tourStep === 2
      ? 'changed:obs-egfr-jul'
      : tourStep === 3
        ? 'unresolved:open-eye-review'
        : tourStep === 4
          ? 'conflict:hba1c:2026-07-09'
          : tourStep === 5
            ? 'unknown'
            : null;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn('space-y-7', tourStep ? 'pb-32' : 'pb-4')}>
      <header
        data-tour="summary"
        className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_8px_30px_rgba(32,59,56,0.05)] data-[tour-focus=true]:ring-2 data-[tour-focus=true]:ring-primary data-[tour-focus=true]:ring-offset-2 data-[tour-focus=true]:ring-offset-canvas"
      >
        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                Pre-visit delta
              </p>
              <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">
                {summary.patient.displayName}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                {summary.patient.clinicIdentifier}
                {age !== null ? ` · ${age} years` : ''}
                {' · '}
                {mode === 'demo' ? 'Synthetic patient' : 'Approved records only'}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-semibold text-primary">
                <Timer size={16} aria-hidden />
                {summary.readSeconds}-second read
              </span>
              <p className="mt-2 text-xs text-ink-soft">
                {summary.lastVisitDate
                  ? `Since the previous record on ${formatDateOnly(summary.lastVisitDate)}`
                  : 'First recorded read'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat block="changed" label="Changed" value={summary.counts.changed} />
            <Stat block="unresolved" label="Unresolved" value={summary.counts.unresolved} />
            <Stat block="conflict" label="Conflicts" value={summary.counts.conflict} />
            <Stat block="unknown" label="What we do not know" value={summary.counts.unknown} />
          </div>

          <p className="mt-4 max-w-[90ch] text-sm leading-6 text-ink-soft">
            {summary.narrative}. Start with what changed, then the open items. Every line opens its
            source. The product never fills a gap.
          </p>
          <AiNote summary={summary} />
        </div>
        <div className="border-t border-line bg-canvas/60 px-5 py-3 text-[12px] leading-5 text-ink-soft sm:px-7">
          <ShieldCheck size={14} className="mr-1 inline" aria-hidden />
          {summary.scopeNote}
          {summary.truncated ? ' This read is limited to the most recent 100 results.' : ''}
        </div>
      </header>

      <Section
        block="changed"
        title="Changed"
        kicker="What is different since the last visit. A change is a fact with a date and a source, not an interpretation."
        icon={<ArrowUpRight size={17} aria-hidden />}
        items={summary.blocks.changed}
        statuses={statuses}
        pendingItem={pendingItem ?? null}
        onAction={onAction}
        onOpenSource={onOpenSource}
        tourFocus={tourFocus}
      />

      <Section
        block="unresolved"
        title="Unresolved"
        kicker="Results, referrals and questions that still need a person. An open item without an owner is a risk, not a plan."
        icon={<Clock size={17} aria-hidden />}
        items={summary.blocks.unresolved}
        statuses={statuses}
        pendingItem={pendingItem ?? null}
        onAction={onAction}
        onOpenSource={onOpenSource}
        tourFocus={tourFocus}
      />

      <div className="grid gap-7 xl:grid-cols-2">
        <Section
          block="conflict"
          title="Conflicts"
          kicker="Two sources that disagree. The product shows both and does not choose or average."
          icon={<AlertTriangle size={17} aria-hidden />}
          items={summary.blocks.conflict}
          statuses={statuses}
          pendingItem={pendingItem ?? null}
          onAction={onAction}
          onOpenSource={onOpenSource}
          tourFocus={tourFocus}
        />
        <Section
          block="unknown"
          title="What we do not know"
          kicker="The record cannot support a complete answer here. The gap is shown, not hidden."
          icon={<HelpCircle size={17} aria-hidden />}
          items={summary.blocks.unknown}
          statuses={statuses}
          pendingItem={pendingItem ?? null}
          onAction={onAction}
          onOpenSource={onOpenSource}
          tourFocus={tourFocus === 'unknown' ? 'unknown' : null}
        />
      </div>

      <section
        id="note"
        data-tour="note"
        className="scroll-mt-28 data-[tour-focus=true]:rounded-[18px] data-[tour-focus=true]:ring-2 data-[tour-focus=true]:ring-primary data-[tour-focus=true]:ring-offset-2 data-[tour-focus=true]:ring-offset-canvas"
      >
        <div className="rounded-[18px] border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle size={17} className="text-primary" aria-hidden />
                <h2 className="text-[19px] font-semibold tracking-tight text-ink">Draft visit note</h2>
                <Badge tone="neutral">Draft</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                Built only from the items you accept. Nothing is written to the record.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void copy()}>
              <Copy size={14} aria-hidden />
              {copied ? 'Copied' : 'Copy note'}
            </Button>
          </div>
          <div className="p-4 sm:p-5">
            <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-[12px] bg-canvas p-4 font-sans text-[13px] leading-6 text-ink">
              {note}
            </pre>
          </div>
        </div>
      </section>

      <footer
        data-tour="proof"
        className="rounded-[18px] border border-primary/20 bg-primary/[0.04] px-5 py-4 text-sm leading-6 text-ink-soft data-[tour-focus=true]:ring-2 data-[tour-focus=true]:ring-primary data-[tour-focus=true]:ring-offset-2 data-[tour-focus=true]:ring-offset-canvas"
      >
        <p className="font-semibold text-ink">
          {summary.counts.changed} changes · {summary.counts.unresolved} unresolved ·{' '}
          {summary.counts.conflict} conflicts · {summary.counts.unknown} gaps. Every line opens its
          source.
        </p>
        <p className="mt-1">
          The product does not diagnose, recommend treatment, score risk or fill a missing value. It
          prepares the doctor&apos;s first sixty seconds and leaves the decision with the doctor.
        </p>
      </footer>
    </div>
  );
}

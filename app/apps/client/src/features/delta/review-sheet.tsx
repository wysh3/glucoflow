import * as React from 'react';
import { ArrowLeft, ArrowRight, Check, FileText } from 'lucide-react';
import type { DeltaAction, DeltaItem } from '@glucoflow/contracts';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  cn,
  formatDateOnly,
} from '@glucoflow/ui';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, effectiveStatus } from './delta-copy';

const BLOCK_LABEL: Record<DeltaItem['block'], string> = {
  changed: 'Change',
  unresolved: 'Open item',
  conflict: 'Conflict',
  unknown: 'Gap',
};

const BLOCK_TONE: Record<DeltaItem['block'], 'success' | 'review' | 'error' | 'neutral'> = {
  changed: 'success',
  unresolved: 'review',
  conflict: 'error',
  unknown: 'neutral',
};

function primaryFor(item: DeltaItem): { action: DeltaAction; label: string } {
  if (item.block === 'changed') return { action: 'accepted', label: 'Accept into the note' };
  if (item.block === 'unresolved') return { action: 'flagged', label: 'Flag for follow-up' };
  if (item.block === 'conflict') return { action: 'flagged', label: 'Flag for a decision' };
  return { action: 'asked_patient', label: 'Ask the patient' };
}

function secondaryFor(item: DeltaItem): { action: DeltaAction; label: string } {
  if (item.block === 'changed') return { action: 'flagged', label: 'Flag' };
  if (item.block === 'unknown') return { action: 'flagged', label: 'Flag' };
  return { action: 'asked_patient', label: 'Ask the patient' };
}

export function DeltaReviewSheet({
  items,
  index,
  statuses,
  onAction,
  onClose,
  onIndexChange,
}: {
  items: DeltaItem[];
  index: number | null;
  statuses: Record<string, DeltaAction>;
  onAction: (itemId: string, action: DeltaAction) => Promise<void> | void;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}): React.ReactElement | null {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (index === null || !items[index]) return null;
  const item = items[index];
  const status = effectiveStatus(item, statuses);
  const primary = primaryFor(item);
  const secondary = secondaryFor(item);
  const last = index === items.length - 1;

  const act = async (action: DeltaAction): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onAction(item.id, action);
      if (!last) onIndexChange(index + 1);
      else onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The decision could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent side="right" className="flex max-h-dvh flex-col">
        <DialogHeader
          title={`Decision ${index + 1} of ${items.length}`}
          description="One decision at a time. The source is shown; you decide."
          actions={
            <Button size="sm" variant="quiet" onClick={onClose}>
              Close
            </Button>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center gap-1.5" aria-hidden>
            {items.map((_, step) => (
              <span
                key={step}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  step === index ? 'w-8 bg-primary' : 'w-3 bg-line',
                )}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={BLOCK_TONE[item.block]}>{BLOCK_LABEL[item.block]}</Badge>
            <Badge tone="neutral">{KIND_LABEL[item.kind]}</Badge>
            {item.date ? (
              <span className="text-[12px] text-ink-soft">{formatDateOnly(item.date)}</span>
            ) : null}
            {item.ageDays !== null ? (
              <span className="text-[12px] text-ink-soft">· {item.ageDays} days</span>
            ) : null}
            {status !== 'open' ? (
              <Badge tone={STATUS_TONE[status as DeltaAction]} className="ml-auto">
                {STATUS_LABEL[status as DeltaAction]}
              </Badge>
            ) : null}
          </div>

          <h2 className="mt-4 text-[24px] font-semibold leading-tight tracking-tight text-ink">
            {item.title}
          </h2>
          <p className="mt-2 text-[14px] leading-7 text-ink-soft">{item.detail}</p>
          <p className="mt-2 text-[12px] leading-5 text-ink-soft/90">{item.why}</p>

          {item.evidence.length ? (
            <div className="mt-5 rounded-[12px] border border-line bg-canvas/60 p-4">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                <FileText size={13} aria-hidden />
                {item.evidence[0]!.documentName} · page {item.evidence[0]!.page}
              </p>
              <p className="mt-2 font-mono text-[12px] leading-6 text-ink">
                {item.evidence[0]!.quote}
              </p>
              {item.evidence.length > 1 ? (
                <p className="mt-2 text-[11px] text-ink-soft">
                  {item.evidence.length} sources are attached. Both are kept.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 rounded-[12px] border border-dashed border-line bg-canvas/60 p-4 text-[12px] text-ink-soft">
              {item.kind === 'note'
                ? 'This is the patient’s own submission. It is not a measured result.'
                : 'No source is attached. The product says so rather than inventing one.'}
            </p>
          )}

          {error ? (
            <Alert tone="error" title="The decision was not saved">
              {error}
            </Alert>
          ) : null}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              variant="primary"
              disabled={busy}
              onClick={() => void act(primary.action)}
            >
              {status === primary.action ? <Check size={16} aria-hidden /> : null}
              {status === primary.action ? STATUS_LABEL[primary.action] : primary.label}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={busy}
              onClick={() => void act(secondary.action)}
            >
              {secondary.label}
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="quiet"
              disabled={busy || index === 0}
              onClick={() => onIndexChange(index - 1)}
            >
              <ArrowLeft size={14} aria-hidden />
              Back
            </Button>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="quiet"
                disabled={busy}
                onClick={() => (last ? onClose() : onIndexChange(index + 1))}
              >
                Skip
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => (last ? onClose() : onIndexChange(index + 1))}
              >
                {last ? 'Done' : 'Next'}
                {last ? null : <ArrowRight size={14} aria-hidden />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

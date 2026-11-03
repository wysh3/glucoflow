import * as React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { DeltaSummary } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';

/**
 * Makes the AI layer visible without turning the delta into an AI opinion.
 * Extraction is machine-assisted, every item is evidence-bound, and the doctor
 * still makes every decision.
 */
export function AiNote({
  summary,
  compact = false,
}: {
  summary: DeltaSummary;
  compact?: boolean;
}): React.ReactElement {
  const { config, me } = useSession();
  const sources = new Set(
    Object.values(summary.blocks)
      .flat()
      .flatMap((item) => item.evidence.map((evidence) => evidence.documentId)),
  ).size;
  const model = config?.extraction?.model;
  const canChat = Boolean(
    me?.contexts.some(
      (context) =>
        context.kind === 'patient' || (context.kind === 'clinic' && context.clinician),
    ),
  );
  const live = config?.extraction?.mode === 'live';
  const openGuide = (): void => {
    window.dispatchEvent(new Event('gluco:open'));
  };
  return (
    <div
      data-tour="ai"
      className={
        compact
          ? 'mt-3 flex flex-col gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-x-3'
          : 'flex flex-col gap-2 rounded-[16px] border border-primary/15 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3'
      }
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles size={13} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-primary">
            AI-assisted extraction{live && model ? ` · ${model}` : ''}
          </p>
          <p className="text-[11px] leading-5 text-ink-soft">
            {sources > 0
              ? `Read ${sources} source${sources === 1 ? '' : 's'}.`
              : 'Read the source record.'}{' '}
            Each item is source-bound. Patient-reported items are labelled. Demo
            fixtures are marked on the review screen. No diagnosis. No decision made for you.
          </p>
        </div>
      </div>
      {canChat ? (
        <button
          type="button"
          onClick={openGuide}
          className="inline-flex min-h-8 shrink-0 items-center gap-1.5 self-start rounded-lg border border-primary/20 bg-surface px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/5 sm:self-auto"
        >
          Ask Gluco about this record
          <ArrowRight size={12} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

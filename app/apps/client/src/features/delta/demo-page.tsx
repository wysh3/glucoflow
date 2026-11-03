import * as React from 'react';
import type { DeltaAction, DeltaItem } from '@glucoflow/contracts';
import { buildDelta } from '@glucoflow/domain';
import { Badge, Button } from '@glucoflow/ui';
import { DeltaBrief } from './brief';
import { DeltaView } from './delta-view';
import { DeltaSourceDialog } from './source-dialog';
import { DeltaReviewSheet } from './review-sheet';
import { DeltaNoteSheet } from './note-sheet';
import { JudgeTour } from './judge-tour';
import { DELTA_DEMO_INPUT } from './demo-data';
import { selectBrief } from './brief-select';

/**
 * Public judge demo. It uses the same domain function and the same brief as the
 * clinic route; only the input is a synthetic fixture. No sign-in is required.
 */
export function DeltaDemoPage(): React.ReactElement {
  const summary = React.useMemo(() => buildDelta(DELTA_DEMO_INPUT), []);
  const [statuses, setStatuses] = React.useState<Record<string, DeltaAction>>({});
  const [source, setSource] = React.useState<DeltaItem | null>(null);
  const [tour, setTour] = React.useState<number | null>(null);
  const [reviewIndex, setReviewIndex] = React.useState<number | null>(null);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [view, setView] = React.useState<'brief' | 'ledger'>('brief');

  React.useEffect(() => {
    const previous = document.title;
    document.title = 'glucoflow';
    return () => {
      document.title = previous;
    };
  }, []);

  const selection = selectBrief(summary, statuses);
  const onAction = async (itemId: string, action: DeltaAction): Promise<void> => {
    setStatuses((current) => ({ ...current, [itemId]: action }));
  };

  const openLedger = (): void => {
    setView('ledger');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-semibold tracking-tight text-primary">Delta</span>
            <Badge tone="neutral">Synthetic demo</Badge>
            <span className="hidden text-[12px] text-ink-soft md:inline">
              The 60-second pre-visit brief
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="quiet"
              className="hidden sm:inline-flex"
              onClick={() => setView(view === 'brief' ? 'ledger' : 'brief')}
            >
              {view === 'brief' ? 'Full ledger' : 'Back to brief'}
            </Button>
            <a
              href="/"
              className="hidden min-h-9 rounded-[10px] px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-canvas hover:text-ink sm:inline-flex sm:items-center"
            >
              Clinic workspace
            </a>
            {view === 'brief' ? (
              <Button size="sm" onClick={() => setTour(1)}>
                <span className="sm:hidden">Tour</span>
                <span className="hidden sm:inline">Start the tour</span>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6 sm:pt-5">
        {view === 'brief' ? (
          <DeltaBrief
            summary={summary}
            mode="demo"
            statuses={statuses}
            onAction={onAction}
            onOpenSource={setSource}
            onReview={setReviewIndex}
            onOpenNote={() => setNoteOpen(true)}
            onOpenLedger={openLedger}
            tourActive={tour !== null}
          />
        ) : (
          <DeltaView
            summary={summary}
            mode="demo"
            statuses={statuses}
            onAction={onAction}
            onOpenSource={setSource}
          />
        )}
        <p className="mt-6 text-center text-[11px] leading-5 text-ink-soft">
          Synthetic patient and synthetic sources. No real patient data. The product is assistive
          and does not diagnose, recommend treatment or score risk.
        </p>
      </main>

      <DeltaSourceDialog item={source} onClose={() => setSource(null)} />
      <DeltaNoteSheet
        summary={summary}
        statuses={statuses}
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
      />
      <DeltaReviewSheet
        items={selection.decisions}
        index={reviewIndex}
        statuses={statuses}
        onAction={onAction}
        onClose={() => setReviewIndex(null)}
        onIndexChange={setReviewIndex}
      />
      <JudgeTour
        step={tour}
        onNext={() => setTour((current) => (current ? Math.min(current + 1, 7) : 1))}
        onClose={() => setTour(null)}
      />
    </div>
  );
}

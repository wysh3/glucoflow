import * as React from 'react';
import { ArrowRight, MousePointer2, X } from 'lucide-react';
import { Button, cn } from '@glucoflow/ui';

type TourStep = {
  selector: string;
  title: string;
  body: string;
};

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="brief"]',
    title: 'Three decisions, not forty pages',
    body: 'Seven changes, three open items, two conflicts and three gaps. The brief puts the three decisions above the fold.',
  },
  {
    selector: '[data-tour="decision-1"]',
    title: 'The largest change',
    body: 'eGFR fell 15 points since April. The card shows the previous value, the latest value and the date.',
  },
  {
    selector: '[data-tour="decision-2"]',
    title: 'The oldest open item',
    body: 'The eye review is 532 days old. The product shows the gap and asks for a decision. It does not call it overdue.',
  },
  {
    selector: '[data-tour="decision-3"]',
    title: 'The disagreement',
    body: 'The patient says she stopped atorvastatin. The prescription says continue. Both are shown.',
  },
  {
    selector: '[data-tour="review"]',
    title: 'Review three, not thirty',
    body: 'One decision at a time. Accept, flag or ask. The note drafts itself.',
  },
  {
    selector: '[data-tour="brief-context"]',
    title: 'The rest is context',
    body: 'Four more changes and three gaps stay in the ledger. They do not block the three decisions.',
  },
  {
    selector: '[data-tour="brief"]',
    title: '42 seconds, every line sourced',
    body: 'That is the product. The doctor decides. The AI is the clerk.',
  },
];

export function JudgeTour({
  step,
  onNext,
  onClose,
}: {
  step: number | null;
  onNext: () => void;
  onClose: () => void;
}): React.ReactElement | null {
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  React.useEffect(() => {
    document
      .querySelectorAll<HTMLElement>('[data-tour-focus]')
      .forEach((element) => element.removeAttribute('data-tour-focus'));
    setCursor(null);
    if (!step) return;
    const target = STEPS[step - 1];
    if (!target) return;
    let settle: number | undefined;
    const timer = window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(target.selector);
      if (!element) return;
      element.setAttribute('data-tour-focus', 'true');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      settle = window.setTimeout(() => {
        const box = element.getBoundingClientRect();
        setCursor({ x: box.left + box.width / 2, y: box.top + Math.min(box.height / 2, 150) });
      }, 420);
    }, 60);
    return () => {
      window.clearTimeout(timer);
      if (settle) window.clearTimeout(settle);
    };
  }, [step]);

  if (!step) return null;
  const current = STEPS[step - 1];
  if (!current) return null;
  const last = step === STEPS.length;

  return (
    <>
      {cursor ? (
        <div
          className="pointer-events-none fixed z-[60] -translate-x-1 -translate-y-1 transition-[left,top] duration-500 ease-out motion-reduce:transition-none"
          style={{ left: cursor.x, top: cursor.y }}
          aria-hidden
        >
          <span className="absolute -left-4 -top-4 size-11 rounded-full border border-primary/30 bg-primary/5" />
          <MousePointer2 size={30} className="relative -rotate-6 text-ink drop-shadow-[0_2px_4px_rgba(255,255,255,0.8)] [&_path]:fill-white" />
        </div>
      ) : null}
    <div
      className={cn(
        'fixed bottom-3 left-1/2 z-50 w-[min(720px,calc(100%-1.5rem))] -translate-x-1/2 rounded-[18px] border border-primary/30 bg-ink px-5 py-4 text-white shadow-[0_18px_50px_rgba(20,40,36,0.35)]',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-semibold">
          {step}/{STEPS.length}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">{current.title}</p>
          <p className="mt-1 text-[14px] leading-5 text-white/75">{current.body}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Close the tour"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] font-medium text-white/60 hover:text-white"
        >
          Skip the tour
        </button>
        <Button
          size="sm"
          variant="primary"
          className="min-h-9 bg-white text-ink hover:bg-white/90"
          onClick={last ? onClose : onNext}
        >
          {last ? 'Done' : 'Next'}
          {last ? null : <ArrowRight size={14} aria-hidden />}
        </Button>
      </div>
    </div>
    </>
  );
}

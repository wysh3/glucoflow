import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { Button } from '@glucoflow/ui';
import './tour.css';

export interface TourStep {
  id: string;
  /** `data-tour` anchor. Omit for a centred card. */
  target?: string;
  title: string;
  body: ReactNode;
  /** When this anchor appears, the step is complete and the tour advances by itself. */
  advanceOn?: string;
  /** Hint shown while waiting for the evaluator's own action. */
  actionHint?: string;
  actions?: { label: string; run: () => void; primary?: boolean }[];
  onEnter?: () => void;
}

interface Rect { top: number; left: number; width: number; height: number }
const pad = 8;

function findTarget(id?: string): HTMLElement | null {
  if (!id) return null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`));
  return all.find((node) => node.getClientRects().length > 0) ?? null;
}

/** Non-blocking spotlight tour: the evaluator can always click the highlighted control itself. */
export function GuidedTour({ steps, open, onClose, label }: { steps: TourStep[]; open: boolean; onClose: (finished: boolean) => void; label: string }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [covered, setCovered] = useState(false);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  const card = useRef<HTMLDivElement>(null);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const last = index === steps.length - 1;

  useEffect(() => { if (open) setIndex(0); }, [open]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) step.onEnter?.(); }, [open, step.id]);

  const measure = useCallback(() => {
    setNarrow(window.innerWidth < 700);
    // Step aside while another dialog (pipeline, source, task) is open; resume on the same step.
    setCovered(!!document.querySelector('[role="dialog"][data-state="open"]'));
    const node = findTarget(step.target);
    if (!node) { setRect(null); return; }
    const box = node.getBoundingClientRect();
    setRect({ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 });
  }, [step.target]);

  useLayoutEffect(() => {
    if (!open) return;
    const node = findTarget(step.target);
    // On phones the card is a bottom sheet, so keep the target in the upper half.
    node?.scrollIntoView({ block: window.innerWidth < 700 ? 'start' : 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    measure();
    const timer = window.setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.clearInterval(timer); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step.id, measure]);

  useEffect(() => {
    if (!open || !step.advanceOn) return;
    const timer = window.setInterval(() => { if (findTarget(step.advanceOn)) setIndex((value) => Math.min(value + 1, steps.length - 1)); }, 300);
    return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step.id, steps.length]);

  useEffect(() => { if (open) card.current?.focus({ preventScroll: true }); }, [open, index]);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"][data-state="open"]')) onClose(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);

  if (!open || covered) return null;
  const placement = (() => {
    if (narrow || !rect) return undefined;
    const width = 340;
    const below = rect.top + rect.height + 14;
    const fitsBelow = below + 230 < window.innerHeight;
    const top = fitsBelow ? below : Math.max(12, rect.top - 14 - 240);
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
    return { top, left, width };
  })();

  return createPortal(<div className="gf-tour" data-centred={!rect || undefined}>
    {rect ? <div className="gf-tour-spotlight" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden />
      : <div className="gf-tour-scrim" aria-hidden />}
    <div ref={card} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="gf-tour-title" aria-describedby="gf-tour-body"
      className="gf-tour-card" data-narrow={narrow || undefined} style={placement}>
      <div className="gf-tour-top">
        <span className="gf-tour-badge"><Sparkles size={12} aria-hidden /> {label} · {index + 1} of {steps.length}</span>
        <button type="button" className="gf-tour-close" aria-label="Close guided tour" onClick={() => onClose(false)}><X size={16} aria-hidden /></button>
      </div>
      <h2 id="gf-tour-title">{step.title}</h2>
      <div id="gf-tour-body" className="gf-tour-body">{step.body}</div>
      {step.actionHint && step.advanceOn ? <p className="gf-tour-hint" role="status"><span aria-hidden /> {step.actionHint}</p> : null}
      <div className="gf-tour-progress" aria-hidden>{steps.map((item, i) => <i key={item.id} data-on={i <= index || undefined} />)}</div>
      <div className="gf-tour-actions">
        {index > 0 ? <Button type="button" size="sm" variant="quiet" onClick={() => setIndex(index - 1)}><ArrowLeft size={14} aria-hidden /> Back</Button> : <span />}
        <div className="gf-tour-actions-right">
          {step.actions?.map((action) => <Button key={action.label} type="button" size="sm" variant={action.primary ? 'primary' : 'secondary'} onClick={action.run}>{action.label}</Button>)}
          {last ? <Button type="button" size="sm" variant="primary" onClick={() => onClose(true)}>Finish</Button>
            : <Button type="button" size="sm" variant={step.actions?.some((action) => action.primary) ? 'secondary' : 'primary'} onClick={() => setIndex(index + 1)}>
              {step.advanceOn ? 'Skip this step' : 'Next'} <ArrowRight size={14} aria-hidden />
            </Button>}
        </div>
      </div>
    </div>
  </div>, document.body);
}

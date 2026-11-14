import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { Button } from '@glucoflow/ui';
import type { TourContextValue } from './host';
import './tour.css';

export interface TourStepContext extends TourContextValue {
  navigate: (to: string) => void;
}
export interface TourStep {
  id: string;
  chapter?: string;
  /**
   * Target spec: a `data-tour` anchor, `dialog:<title>` for an open dialog,
   * `css:<selector>` for the first visible match or `css-last:<selector>` for the last.
   */
  target?: string;
  title: string;
  body: ReactNode | ((context: TourStepContext) => ReactNode);
  /** Path prefix this step lives on; the host navigates there first. */
  route?: string;
  /** Explicit path to open when the route does not match (defaults to `route`). */
  routeTo?: string | ((context: TourStepContext) => string | null);
  /** Runs once when the step opens (after navigation and, for care steps, the care bridge). */
  enter?: (context: TourStepContext) => void | Promise<void>;
  needsCare?: boolean;
  /** When this target spec appears the step completes and the tour advances by itself. */
  advanceOn?: string;
  actionHint?: string;
  actions?: { label: string; run: (context: TourStepContext) => void | Promise<void>; primary?: boolean }[];
}

interface Rect { top: number; left: number; width: number; height: number }
const pad = 8;
const visible = (node: Element) => node.getClientRects().length > 0;

export function findTarget(spec?: string): HTMLElement | null {
  if (!spec) return null;
  if (spec.startsWith('path:')) return new RegExp(spec.slice(5)).test(window.location.pathname) ? document.body : null;
  if (spec.startsWith('dialog:')) {
    const title = spec.slice(7).toLowerCase();
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]'));
    return dialogs.find((dialog) => {
      const label = dialog.getAttribute('aria-labelledby');
      const text = (label ? document.getElementById(label)?.textContent : dialog.getAttribute('aria-label')) ?? '';
      return text.toLowerCase().includes(title);
    }) ?? null;
  }
  if (spec.startsWith('css-last:')) {
    const all = Array.from(document.querySelectorAll<HTMLElement>(spec.slice(9))).filter(visible);
    return all.at(-1) ?? null;
  }
  const selector = spec.startsWith('css:') ? spec.slice(4) : `[data-tour="${spec}"]`;
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(visible) ?? null;
}

const openDialogs = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]'));

/**
 * Non-blocking spotlight tour. Outside dialogs the card floats beside a spotlight; for targets inside
 * a modal dialog the card is placed inside that dialog so it stays reachable within its focus trap.
 */
export function TourCard({ steps, index, setIndex, onClose, context, label }: {
  steps: TourStep[]; index: number; setIndex: (index: number) => void; onClose: (finished: boolean) => void;
  context: TourStepContext; label: string;
}) {
  const step = steps[Math.min(index, steps.length - 1)]!;
  const last = index === steps.length - 1;
  const [rect, setRect] = useState<Rect | null>(null);
  const [dialogHost, setDialogHost] = useState<HTMLElement | null>(null);
  const [covered, setCovered] = useState(false);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 700);
  const card = useRef<HTMLDivElement>(null);
  const highlighted = useRef<HTMLElement | null>(null);

  const measure = useCallback(() => {
    setNarrow(window.innerWidth < 700);
    const node = findTarget(step.target);
    const dialogs = openDialogs().filter((dialog) => !dialog.closest('.gf-tour'));
    const hostDialog = node ? (node.matches('[role="dialog"]') ? node : node.closest<HTMLElement>('[role="dialog"][data-state="open"]')) : null;
    setDialogHost(hostDialog);
    setCovered(!hostDialog && dialogs.length > 0);
    if (highlighted.current && highlighted.current !== node) highlighted.current.removeAttribute('data-tour-highlight');
    if (node && hostDialog && node !== hostDialog) { node.setAttribute('data-tour-highlight', ''); highlighted.current = node; }
    if (!node || hostDialog) { setRect(null); return; }
    const box = node.getBoundingClientRect();
    setRect({ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 });
  }, [step.target]);

  useLayoutEffect(() => {
    const timer = window.setTimeout(() => {
      const node = findTarget(step.target);
      if (node && !node.matches('[role="dialog"]')) node.scrollIntoView({
        block: window.innerWidth < 700 ? 'start' : 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }, 120);
    measure();
    const interval = window.setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(timer); window.clearInterval(interval);
      window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true);
      highlighted.current?.removeAttribute('data-tour-highlight');
    };
  }, [step.id, measure]);

  useEffect(() => {
    if (!step.advanceOn) return;
    const timer = window.setInterval(() => { if (findTarget(step.advanceOn)) setIndex(Math.min(index + 1, steps.length - 1)); }, 300);
    return () => window.clearInterval(timer);
  }, [step.id, step.advanceOn, index, steps.length, setIndex]);

  useEffect(() => { card.current?.focus({ preventScroll: true }); }, [step.id, dialogHost]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !openDialogs().length) onClose(false); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  // Card placed inside a modal dialog: keep a stable first-child container for the portal.
  const [inline, setInline] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!dialogHost) { setInline(null); return; }
    const container = document.createElement('div');
    container.className = 'gf-tour-inline';
    dialogHost.prepend(container);
    setInline(container);
    return () => container.remove();
  }, [dialogHost]);

  if (covered) return null;
  const body = typeof step.body === 'function' ? step.body(context) : step.body;
  const placement = (() => {
    if (narrow || !rect || dialogHost) return undefined;
    const width = 360;
    const below = rect.top + rect.height + 14;
    const top = below + 250 < window.innerHeight ? below : Math.max(12, rect.top - 14 - 260);
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
    return { top, left, width };
  })();

  const content = <div ref={card} tabIndex={-1} role="group" aria-roledescription="guided tour step" aria-labelledby="gf-tour-title" aria-describedby="gf-tour-body"
    className="gf-tour-card" data-narrow={narrow && !dialogHost ? '' : undefined} data-inline={dialogHost ? '' : undefined} style={placement}>
    <div className="gf-tour-top">
      <span className="gf-tour-badge"><Sparkles size={12} aria-hidden /> {step.chapter ?? label} · {index + 1} of {steps.length}</span>
      <button type="button" className="gf-tour-close" aria-label="Close guided tour" onClick={() => onClose(false)}><X size={16} aria-hidden /></button>
    </div>
    <h2 id="gf-tour-title">{step.title}</h2>
    <div id="gf-tour-body" className="gf-tour-body">{body}</div>
    {step.actionHint && step.advanceOn ? <p className="gf-tour-hint" role="status"><span aria-hidden /> {step.actionHint}</p> : null}
    <div className="gf-tour-progress" aria-hidden>{steps.map((item, i) => <i key={item.id} data-on={i <= index || undefined} />)}</div>
    <div className="gf-tour-actions">
      {index > 0 ? <Button type="button" size="sm" variant="quiet" onClick={() => setIndex(index - 1)}><ArrowLeft size={14} aria-hidden /> Back</Button> : <span />}
      <div className="gf-tour-actions-right">
        {step.actions?.map((action) => <Button key={action.label} type="button" size="sm" variant={action.primary ? 'primary' : 'secondary'}
          onClick={() => void action.run(context)}>{action.label}</Button>)}
        {last ? <Button type="button" size="sm" variant="primary" onClick={() => onClose(true)}>Finish</Button>
          : <Button type="button" size="sm" variant={step.actions?.some((action) => action.primary) ? 'secondary' : 'primary'} onClick={() => setIndex(index + 1)}>
            {step.advanceOn ? 'Skip' : 'Next'} <ArrowRight size={14} aria-hidden />
          </Button>}
      </div>
    </div>
  </div>;

  if (dialogHost) return inline ? createPortal(content, inline) : null;
  return createPortal(<div className="gf-tour" data-centred={!rect || undefined}>
    {rect ? <div className="gf-tour-spotlight" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden />
      : <div className="gf-tour-scrim" aria-hidden />}
    {content}
  </div>, document.body);
}

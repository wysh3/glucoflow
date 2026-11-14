import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { CareWorkspace } from '@glucoflow/contracts';
import { TourCard, type TourStepContext } from './engine';
import { tours, type TourId } from './tours';

/** Actions the care workspace exposes to the tour. Registered only while the care page is mounted. */
export interface CareBridge {
  workspace: () => CareWorkspace | null;
  openView: (view: 'ask' | 'worklist' | 'teams' | 'learning' | 'activity') => void;
  closeAll: () => void;
  openPipeline: () => void;
  openMonitoring: () => void;
  openHistory: () => void;
  openEpisode: (patientName: string) => void;
  openTask: (status: 'awaiting_approval' | 'monitoring') => void;
  askQuestion: (text: string, send: boolean) => void;
  switchPersona: (role: 'doctor' | 'nurse' | 'lab') => Promise<boolean>;
}

export interface TourContextValue {
  tourId: TourId | null;
  index: number;
  start: (id: TourId, stepId?: string) => void;
  goTo: (stepId: string) => void;
  stop: () => void;
  care: () => CareBridge | null;
  registerCare: (bridge: CareBridge | null) => void;
}

const TourContext = createContext<TourContextValue | null>(null);
const storageKey = 'glucoflow.tour.v2';

function readSaved(): { tourId: TourId; index: number } | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    const saved = raw ? JSON.parse(raw) as { tourId: TourId; index: number } : null;
    return saved && saved.tourId in tours ? saved : null;
  } catch { return null; }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ tourId: TourId | null; index: number }>(() => readSaved() ?? { tourId: null, index: 0 });
  const careRef = useRef<CareBridge | null>(null);
  useEffect(() => {
    try {
      if (state.tourId) sessionStorage.setItem(storageKey, JSON.stringify(state));
      else sessionStorage.removeItem(storageKey);
    } catch { /* The tour still works for this page without storage. */ }
  }, [state]);
  const start = useCallback((tourId: TourId, stepId?: string) => {
    const index = stepId ? Math.max(0, tours[tourId].findIndex((step) => step.id === stepId)) : 0;
    setState({ tourId, index });
  }, []);
  const goTo = useCallback((stepId: string) => setState((current) => {
    if (!current.tourId) return current;
    const index = tours[current.tourId].findIndex((step) => step.id === stepId);
    return index < 0 ? current : { ...current, index };
  }), []);
  const value = useMemo<TourContextValue>(() => ({
    ...state, start, goTo,
    stop: () => setState({ tourId: null, index: 0 }),
    care: () => careRef.current,
    registerCare: (bridge) => { careRef.current = bridge; },
  }), [state, start, goTo]);
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const value = useContext(TourContext);
  if (!value) throw new Error('useTour must be used inside TourProvider');
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Renders the active tour on any page, moving between routes and opening care views as steps require. */
export function TourHost() {
  const tour = useTour();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const steps = tour.tourId ? tours[tour.tourId] : null;
  const step = steps?.[Math.min(tour.index, steps.length - 1)];
  const context = useMemo<TourStepContext>(() => ({ ...tour, navigate }), [tour, navigate]);
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    setReady(false);
    void (async () => {
      const current = contextRef.current;
      if (step.route && !window.location.pathname.startsWith(step.route)) {
        const target = typeof step.routeTo === 'function' ? step.routeTo(current) : step.routeTo ?? step.route;
        if (target) navigate(target);
      }
      if (step.needsCare) for (let i = 0; i < 60 && !contextRef.current.care(); i++) await sleep(100);
      if (cancelled) return;
      try { await step.enter?.(contextRef.current); } catch { /* A step that cannot prepare still shows its explanation. */ }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  // Step identity is its id; re-entering on unrelated renders would reopen dialogs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.tourId, step?.id]);

  if (!steps || !step || !ready) return null;
  if (step.route && !pathname.startsWith(step.route)) return null;
  return <TourCard key={tour.tourId} steps={steps} index={tour.index} context={context}
    label={tour.tourId === 'full' ? 'Full tour' : 'Quick tour'}
    setIndex={(index) => tour.start(tour.tourId!, steps[index]?.id)}
    onClose={(finished) => {
      try { localStorage.setItem('glucoflow.tour.seen', finished ? 'finished' : 'closed'); } catch { /* optional */ }
      contextRef.current.care()?.closeAll();
      tour.stop();
    }} />;
}

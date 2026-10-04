import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Send, X, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  Button,
  Input,
} from '@glucoflow/ui';
import type {
  GuideAnswer,
  GuideActionId,
  GuideScreen,
} from '@glucoflow/contracts';
import { useSession, describeApiError } from '../../auth/session';

const intro: GuideAnswer = {
  message:
    'Hi, I’m Gluco. I can help you find your way around the app, try sample reports and understand the review steps. Please leave personal and health details out of chat.',
  actions: [],
  mode: 'local',
};
export function GlucoGuide(): React.ReactElement {
  const { me, status } = useSession();
  return <GuideSession key={`${status}:${me?.actor.userId ?? 'public'}`} />;
}
function GuideSession(): React.ReactElement {
  const { me, api } = useSession();
  const location = useLocation();
  const [open, setOpen] = React.useState(false),
    [draft, setDraft] = React.useState(''),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<
    { question?: string; answer: GuideAnswer }[]
  >([{ answer: intro }]);
  const eyes = React.useRef<HTMLSpanElement>(null),
    end = React.useRef<HTMLDivElement>(null),
    abort = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => abort.current?.abort(), []);
  React.useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, busy, open]);
  React.useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;
    const move = (e: PointerEvent) => {
      const box = eyes.current?.getBoundingClientRect();
      if (box)
        eyes.current?.style.setProperty(
          'transform',
          `translate(${Math.max(-3, Math.min(3, (e.clientX - box.x) / 120))}px,${Math.max(-3, Math.min(3, (e.clientY - box.y) / 120))}px)`,
        );
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);
  const patient = me?.contexts.find((c) => c.kind === 'patient');
  const clinic = me?.contexts.some((c) => c.kind === 'clinic');
  const patientId = location.pathname.match(/\/clinic\/patients\/([^/]+)/)?.[1];
  const screen: GuideScreen = location.pathname.includes('/sign-in')
    ? 'landing'
    : location.pathname.includes('/add-report')
      ? 'upload'
      : location.pathname.includes('/visit-notes')
        ? 'notes'
        : location.pathname.includes('/queue') ||
            location.pathname.includes('/review/')
          ? 'review'
          : location.pathname.endsWith('/master')
            ? 'home'
            : location.pathname.endsWith('/overview')
              ? 'overview'
              : location.pathname.endsWith('/progression')
                ? 'progression'
                : location.pathname.endsWith('/documents')
                  ? 'documents'
                  : location.pathname.endsWith('/history')
                    ? 'history'
                    : location.pathname.endsWith('/records')
                      ? 'records'
                      : location.pathname.endsWith('/account')
                        ? 'account'
                        : 'patients';
  const href = (id: GuideActionId): string | null => {
    if (!me) return '/sign-in';
    if (id === 'account') return '/account';
    if (!clinic && patient) {
      return (
        (
          {
            records: '/patient/records',
            upload: '/patient/add-report',
            notes: '/patient/visit-notes',
            home: '/patient/master',
          } as Partial<Record<GuideActionId, string>>
        )[id] ?? null
      );
    }
    if (id === 'patients' || id === 'samples') return '/clinic/patients';
    if (id === 'queue')
      return me.capabilities.canReview ? '/clinic/queue' : null;
    if (
      ['overview', 'progression', 'documents', 'home', 'history'].includes(id)
    )
      return patientId
        ? `/clinic/patients/${patientId}/${id === 'home' ? 'master' : id}`
        : '/clinic/patients';
    return null;
  };
  const send = async (question: string) => {
    if (!question.trim() || busy) return;
    setDraft('');
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const answer: GuideAnswer = me
        ? await api.request('/api/v1/guide', {
            method: 'POST',
            body: { screen, message: question.trim() },
            signal: controller.signal,
          })
        : {
            message:
              'Choose Doctor to explore approved records, Clinic team to try upload → review → publish, Reviewer to check extraction, or Patient to add reports and notes. Every account and sample is synthetic. I only explain the app; I cannot interpret results or recommend treatment.',
            actions: [],
            mode: 'local',
          };
      if (!controller.signal.aborted)
        setMessages((old) => [...old, { question, answer }].slice(-12));
    } catch (e) {
      if (!controller.signal.aborted) {
        setDraft(question);
        setError(describeApiError(e));
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <>
      <button
        aria-label="Open Gluco guide"
        title="Gluco · your app guide"
        onClick={() => setOpen(true)}
        style={
          screen === 'landing'
            ? { bottom: 'calc(20px + env(safe-area-inset-bottom))' }
            : undefined
        }
        className="gluco-launcher focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <span className="gluco-orb" aria-hidden>
          <span className="gluco-eyes" ref={eyes}>
            <i />
            <i />
          </span>
        </span>
        <span className="gluco-caption">Need a hand?</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          side="floating"
          className="gluco-panel flex flex-col overflow-hidden"
          aria-describedby="guide-description"
        >
          <DialogHeader
            title="Gluco guide"
            description={
              <span id="guide-description" className="block max-w-[220px]">
                A little help getting around. App guidance only.
              </span>
            }
            actions={
              <Button
                size="icon"
                variant="quiet"
                aria-label="Close guide"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </Button>
            }
          />
          <div
            className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                {m.question ? (
                  <p className="ml-8 rounded-2xl bg-primary px-4 py-3 text-sm text-white break-words">
                    {m.question}
                  </p>
                ) : null}
                <div className="mr-3 rounded-2xl border border-line bg-canvas px-4 py-3">
                  <p className="text-sm leading-6">{m.answer.message}</p>
                  {i > 0 ? (
                    <p className="mt-2 text-[11px] text-ink-soft">
                      {m.answer.mode === 'live'
                        ? 'GPT‑6 Luna · verified app guidance'
                        : 'Local app help'}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.answer.actions.map((a) => {
                      const to = href(a.id);
                      return to ? (
                        <Link
                          key={a.id}
                          aria-label={a.label}
                          to={to}
                          onClick={() => setOpen(false)}
                          className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-3 text-xs font-medium text-primary"
                        >
                          {a.label} →
                        </Link>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            ))}
            {busy ? (
              <p className="text-sm text-ink-soft" role="status">
                Finding your next step…
              </p>
            ) : null}
            <div ref={end} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              'How do I use this screen?',
              'Try a sample report',
              'How do I open a source?',
            ].map((q) => (
              <button
                key={q}
                disabled={busy}
                onClick={() => void send(q)}
                className="min-h-11 rounded-xl border border-line px-3 py-2 text-xs text-ink-soft disabled:opacity-50"
              >
                <Sparkles size={12} className="mr-1 inline" aria-hidden />
                {q}
              </button>
            ))}
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <Input
              aria-label="Ask about the app"
              placeholder="Ask about the app…"
              value={draft}
              maxLength={600}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
            />
            <Button
              aria-label="Send message"
              size="icon"
              variant="primary"
              disabled={busy || !draft.trim()}
              type="submit"
            >
              <Send size={18} />
            </Button>
          </form>
          <p className="mt-2 text-[11px] leading-4 text-ink-soft">
            No diagnosis or treatment advice. Chat is held in memory for this
            session; app records are never attached.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

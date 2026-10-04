import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Send,
  X,
  Sparkles,
  RotateCcw,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, Button } from '@glucoflow/ui';
import type {
  GuideAnswer,
  GuideChatAnswer,
  GuideActionId,
  GuideScreen,
} from '@glucoflow/contracts';
import { useSession, describeApiError } from '../../auth/session';
import { usePatient } from '../../lib/queries';
import { useSourcePane } from '../../components/source-pane';
import { GlucoOrb, type GlucoMood } from './gluco-orb';

const intro: GuideAnswer = {
  message:
    'Hi, I’m Gluco. Let’s make this a little easier. I can help you find your way around, try a sample and follow the review steps. Open a patient to chat about their recorded information.',
  actions: [],
  mode: 'local',
};
export function GlucoGuide(): React.ReactElement {
  const { me, status } = useSession();
  const location = useLocation();
  const clinic = me?.contexts.some((c) => c.kind === 'clinic');
  const id = clinic
    ? location.pathname.match(/\/clinic\/patients\/([^/]+)/)?.[1]
    : me?.contexts.find((c) => c.kind === 'patient')?.patientId;
  return (
    <GuideSession
      key={`${status}:${me?.actor.userId ?? 'public'}:${id ?? 'none'}:${JSON.stringify(me?.contexts ?? [])}`}
    />
  );
}
function GuideSession(): React.ReactElement {
  const { me, api } = useSession();
  const location = useLocation();
  const [open, setOpen] = React.useState(false),
    [draft, setDraft] = React.useState(''),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = React.useState<string | null>(
    null,
  );
  const [replying, setReplying] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const replyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messages, setMessages] = React.useState<
    { question?: string; answer: GuideAnswer | GuideChatAnswer }[]
  >([{ answer: intro }]);
  const log = React.useRef<HTMLDivElement>(null),
    abort = React.useRef<AbortController | null>(null);
  React.useEffect(
    () => () => {
      abort.current?.abort();
      if (replyTimer.current) clearTimeout(replyTimer.current);
    },
    [],
  );
  React.useEffect(() => {
    const container = log.current;
    if (!open || !container) return;
    if (busy) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    const lastTurn = container.querySelector('[data-chat-turn]:last-of-type');
    if (lastTurn)
      container.scrollTop +=
        lastTurn.getBoundingClientRect().top -
        container.getBoundingClientRect().top -
        12;
  }, [messages, busy, open]);
  const patient = me?.contexts.find((c) => c.kind === 'patient');
  const clinic = me?.contexts.some((c) => c.kind === 'clinic');
  const patientId = clinic
    ? location.pathname.match(/\/clinic\/patients\/([^/]+)/)?.[1]
    : patient?.patientId;
  const mayChat = Boolean(
    patientId &&
    (patient || me?.contexts.some((c) => c.kind === 'clinic' && c.clinician)),
  );
  const context = usePatient(mayChat ? patientId : undefined);
  const { openSource, pane } = useSourcePane();
  const last = messages.at(-1)?.answer;
  const suggestions =
    last && 'suggestions' in last
      ? last.suggestions
      : mayChat
        ? [
            'Summarize the records',
            'Show latest lab results',
            'What notes were reported?',
          ]
        : [
            'How do I use this screen?',
            'Try a sample report',
            'How do I open a source?',
          ];
  const mood: GlucoMood = error
    ? 'error'
    : busy
      ? 'thinking'
      : replying
        ? 'replying'
        : focused && draft
          ? 'listening'
          : 'idle';
  const clear = () => {
    abort.current?.abort();
    setBusy(false);
    setPendingQuestion(null);
    setDraft('');
    setError(null);
    setReplying(false);
    if (replyTimer.current) clearTimeout(replyTimer.current);
    setMessages([{ answer: intro }]);
  };
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
    setPendingQuestion(question.trim());
    const controller = new AbortController();
    abort.current = controller;
    try {
      const answer: GuideAnswer | GuideChatAnswer = me
        ? await api.request(mayChat ? '/api/v1/guide/chat' : '/api/v1/guide', {
            method: 'POST',
            body: {
              screen,
              message: question.trim(),
              ...(mayChat
                ? {
                    patientId,
                    history: messages
                      .flatMap((m) => (m.question ? [m.question] : []))
                      .slice(-6),
                  }
                : {}),
            },
            signal: controller.signal,
          })
        : {
            message:
              'Choose Doctor to explore approved records, Clinic team to try upload → review → publish, Reviewer to check extraction, or Patient to add reports and notes. Every account and sample is synthetic. I only explain the app; I cannot interpret results or recommend treatment.',
            actions: [],
            mode: 'local',
          };
      if (!controller.signal.aborted) {
        setMessages((old) => [...old, { question, answer }].slice(-12));
        setReplying(true);
        if (replyTimer.current) clearTimeout(replyTimer.current);
        replyTimer.current = setTimeout(() => setReplying(false), 2200);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setDraft(question);
        setError(describeApiError(e));
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        setPendingQuestion(null);
      }
    }
  };
  return (
    <>
      <button
        aria-label="Open Gluco guide"
        title="Gluco · your record companion"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        style={
          screen === 'landing'
            ? { bottom: 'calc(20px + env(safe-area-inset-bottom))' }
            : undefined
        }
        className="gluco-launcher focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <GlucoOrb mood={mood} />
        <span className="gluco-caption">Need a hand?</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          side="floating"
          className="gluco-panel flex flex-col overflow-hidden gap-0"
          aria-describedby="guide-description"
        >
          <div className="gluco-chat-header flex items-center gap-3 mb-3 shrink-0">
            <GlucoOrb mood={mood} small />
            <DialogHeader
              title="Gluco guide"
              description={
                <span id="guide-description" className="block text-xs">
                  {busy
                    ? 'Looking through the records…'
                    : replying
                      ? 'Here’s what I found.'
                      : 'Your little record companion.'}
                </span>
              }
              actions={
                <>
                  <Button
                    size="icon"
                    variant="quiet"
                    aria-label="Clear conversation"
                    title="Clear conversation"
                    onClick={clear}
                  >
                    <RotateCcw size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="quiet"
                    aria-label="Close guide"
                    onClick={() => setOpen(false)}
                  >
                    <X size={18} />
                  </Button>
                </>
              }
            />
          </div>
          {mayChat ? (
            <div data-testid="guide-patient" className="gluco-context shrink-0">
              <ShieldCheck size={16} aria-hidden />
              <div>
                <strong>
                  {clinic
                    ? (context.data?.displayName ?? 'Loading patient…')
                    : 'Your records'}
                </strong>
                <span>
                  {context.data?.clinicIdentifier ?? 'Selected patient'} ·
                  Approved + patient-reported
                </span>
              </div>
            </div>
          ) : (
            <p className="mb-3 text-xs text-ink-soft">
              {clinic
                ? 'Open a patient for record questions. I can help with the app here.'
                : 'App guidance · Sign in to explore your records'}
            </p>
          )}
          <div
            ref={log}
            className="gluco-transcript min-h-0 flex-1 overflow-y-auto space-y-4 pr-1 py-3"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((m, i) => (
              <div key={i} data-chat-turn className="space-y-2">
                {m.question ? (
                  <p className="ml-8 rounded-2xl bg-primary px-4 py-3 text-sm text-white break-words">
                    {m.question}
                  </p>
                ) : null}
                <div className="mr-3 rounded-2xl border border-line bg-canvas px-4 py-3">
                  <p className="text-sm leading-6 whitespace-pre-wrap">
                    {!m.question && mayChat
                      ? `Hi, I’m Gluco. I can help you find ${clinic ? 'this patient’s' : 'your'} recorded results, documented prescriptions, notes and home entries. Ask a question, then follow up naturally. I’ll bring the dates and sources with me.`
                      : m.answer.message}
                  </p>
                  {'cards' in m.answer && m.answer.cards.length ? (
                    <div className="mt-3 space-y-2">
                      {m.answer.cards.map((c) => (
                        <div key={c.id} className="gluco-record">
                          <div className="flex items-start justify-between gap-2">
                            <strong className="text-sm">{c.title}</strong>
                            <span className="text-[10px] shrink-0 text-ink-soft">
                              {c.kind === 'approved'
                                ? 'Approved'
                                : 'Patient-reported'}
                            </span>
                          </div>
                          <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                            {c.detail}
                          </p>
                          <p className="mt-1 text-[11px] text-ink-soft">
                            {c.dateLabel}
                          </p>
                          {c.source ? (
                            <button
                              className="mt-2 flex min-h-9 items-center gap-1.5 text-xs font-medium text-primary"
                              aria-label={`Open source for ${c.title}`}
                              onClick={() => void openSource(c.source!)}
                            >
                              <FileText size={14} aria-hidden />
                              Original source · p. {c.source.page}
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {m.question ? (
                    <p className="mt-2 text-[11px] text-ink-soft">
                      {m.answer.mode === 'live'
                        ? 'GPT‑6 Luna · grounded in app records'
                        : 'Local help · model unavailable or not needed'}
                    </p>
                  ) : null}
                  {'scopeNote' in m.answer ? (
                    <details className="mt-2 text-[11px] text-ink-soft">
                      <summary className="cursor-pointer py-1">
                        What’s included?
                      </summary>
                      <p className="leading-5">{m.answer.scopeNote}</p>
                    </details>
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
            {pendingQuestion ? (
              <p className="ml-8 rounded-2xl bg-primary px-4 py-3 text-sm text-white break-words">
                {pendingQuestion}
              </p>
            ) : null}
            {busy ? (
              <p className="text-sm text-ink-soft" role="status">
                <span className="gluco-typing" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>{' '}
                Looking through what’s available…
              </p>
            ) : null}
          </div>
          <div className="gluco-suggestions shrink-0 flex gap-2 overflow-x-auto pb-2 pt-3">
            {suggestions.map((q) => (
              <button
                key={q}
                disabled={busy}
                onClick={() => void send(q)}
                className="shrink-0 min-h-10 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink-soft disabled:opacity-50"
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
            <textarea
              aria-label="Ask Gluco"
              placeholder={
                mayChat
                  ? 'Ask about records, or follow up…'
                  : 'Ask about the app…'
              }
              value={draft}
              rows={2}
              maxLength={600}
              className="gluco-composer"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
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
            Recorded facts, not medical advice. Session-only chat. Questions go
            to the model; stored records aren’t attached.
          </p>
        </DialogContent>
      </Dialog>
      {pane}
    </>
  );
}

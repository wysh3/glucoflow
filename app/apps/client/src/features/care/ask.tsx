import { GlucoGreeting } from './greeting';
import { isCareGreeting } from './greeting-intent';
import './greeting.css';
import { CareHome } from './home';
import { shouldSendOnEnter } from './composer-keys';
import { chatProgressLabels } from '../../lib/chat-progress';
import { useI18n } from '../../i18n';
import { toDocumentLanguageTag } from '../../i18n/language-code';
import { SpeechDraftInput, ReadAloud } from '../speech';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, LayoutDashboard, ClipboardList, Database, FilePenLine, FlaskConical,
  MessageCircle, Radio, RefreshCw, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import { Badge, Button, Label, Select, Spinner, LoadingOrb, cn } from '@glucoflow/ui';
import type { CareEvent, CareMessage, CareProposal, CareRole, CareWorkspace } from '@glucoflow/contracts';
import { SourceChip, terminalStatuses, When } from './shared';
import type { CareWorkspaceState, ChatMode } from './use-care-workspace';
import type { TaskDraft } from './task-dialog';
import { IntelligentCareReply } from './intelligent-reply';
import { careSummaryPresentation, compileCareReply } from './intelligent-program';

const promptsByRole: Record<CareRole, { label: string; message: string; icon: LucideIcon }[]> = {
  doctor: [
    { label: 'What needs attention?', message: 'What is pending for the assigned encounters this shift? Include source references.', icon: ClipboardList },
    { label: 'Monitor acknowledgement', message: 'Propose monitoring for a validated result awaiting acknowledgement.', icon: Radio },
    { label: 'Draft handover', message: 'Draft a shift handover with unresolved items and their owners.', icon: FilePenLine },
  ],
  nurse: [
    { label: 'Check specimen handoffs', message: 'Which collected specimens are still awaiting lab receipt?', icon: FlaskConical },
    { label: 'Explain a delay', message: 'What handoff has passed its operational target, and what source events explain it?', icon: ClipboardList },
    { label: 'Draft handover', message: 'Draft a nursing handover with unresolved items, owners and source references.', icon: FilePenLine },
  ],
  lab: [
    { label: 'Check the lab queue', message: 'Which specimens are expected by the lab? Show their most recent source events.', icon: FlaskConical },
    { label: 'Review validated results', message: 'Which validated results are awaiting clinician acknowledgement?', icon: ClipboardList },
    { label: 'Monitor specimen receipt', message: 'Propose monitoring for a specimen still awaiting lab receipt.', icon: Radio },
  ],
  coordinator: [
    { label: 'Review unresolved work', message: 'Summarize unresolved handoffs by owner and source system.', icon: ClipboardList },
    { label: 'Draft handover', message: 'Draft a shift handover with unresolved items and the next responsible owner.', icon: FilePenLine },
    { label: 'Propose a workflow', message: 'Propose a source-first handover layout so the next team sees evidence near the top.', icon: FilePenLine },
  ],
};

type AskProps = {
  state: CareWorkspaceState;
  workspace: CareWorkspace;
  draft: string;
  onDraft: (value: string) => void;
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  visible: boolean;
  openSource: (event: CareEvent) => void;
  openTask: (draft: TaskDraft) => void;
  openExistingTask: (taskId: string) => void;
  openPlaybook: (proposal: CareProposal) => void;
  openView: (view: 'teams' | 'activity' | 'worklist') => void;
  openPipeline: () => void;
};

// React port of the published CodexUI ThreadConversation and ThreadComposer DOM.
const threadScope = { 'data-v-705e1c85': '' };
const conversationScope = { 'data-v-98932cdc': '' };
const composerScope = { 'data-v-755e7197': '' };

export function AskPanel({ state, workspace, draft, onDraft, mode, setMode, visible, openSource, openTask, openExistingTask, openPlaybook, openView, openPipeline }: AskProps) {
  const { locale } = useI18n();
  const input = useRef<HTMLTextAreaElement>(null);
  const messages = useRef<HTMLUListElement>(null);
  const scrollPending = useRef(true);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voiceError, setVoiceError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [overview, setOverview] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  useEffect(() => { setOverview(false); }, [workspace.id]);
  const runtimeReady = state.runtime?.available === true;
  const sending = state.busy === 'chat';
  useEffect(() => {
    setElapsed(0);
    if (!sending) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [sending]);
  const active = workspace.tasks.filter((task) => !terminalStatuses.has(task.status));
  const approvals = active.filter((task) => task.status === 'awaiting_approval').length;
  const handoffs = active.filter((task) => task.kind !== 'result_acknowledgement').length;
  const hasConversation = workspace.messages.length > 0 || sending;
  const showingConversation = hasConversation && !overview;
  const lastMessageId = workspace.messages.at(-1)?.id;

  useEffect(() => { scrollPending.current = true; }, [lastMessageId, sending]);
  useEffect(() => {
    const log = messages.current;
    if (!log || !visible || !scrollPending.current) return;
    const latest = log.lastElementChild?.previousElementSibling;
    log.scrollTop = !sending && latest instanceof HTMLElement
      ? log.scrollTop + latest.getBoundingClientRect().top - log.getBoundingClientRect().top
      : log.scrollHeight;
    scrollPending.current = false;
  }, [lastMessageId, sending, visible, showingConversation]);

  async function submit() {
    if (state.busy || submitting || !draft.trim() || (mode === 'hermes' && !runtimeReady)) return;
    setOverview(false);
    setSubmitting(true);
    const message = draft.trim();
    setPendingMessage(message);
    onDraft('');
    try {
      const accepted = await state.chat(message, mode);
      if (!accepted) onDraft(message);
    } finally { setPendingMessage(''); setSubmitting(false); }
  }

  const suggestions = promptsByRole[workspace.role].map(({ label, message, icon: Icon }) => (
    <Button key={label} type="button" variant="secondary" size="sm" disabled={sending}
      className="justify-start px-2.5 text-xs text-ink-soft" onClick={() => { onDraft(message); input.current?.focus(); }}>
      <Icon size={14} className="text-primary" aria-hidden /> {label}
    </Button>
  ));

  return (
    <section className={`content-thread care-thread ${showingConversation ? '' : 'care-thread-home'}`} aria-labelledby="care-ask-title" {...threadScope}>
      <section className="conversation-root" {...conversationScope}>
        {showingConversation ? (
          <>
            <h2 id="care-ask-title" className="sr-only">Ask Gluco</h2>
            <div className="min-h-0 flex-1" role="log" aria-label="Care conversation" aria-live="polite">
              <ul className="conversation-list" {...conversationScope} ref={messages} tabIndex={0}>
                {workspace.messages.map((message, index) => (
                  <Message key={message.id} message={message} workspace={workspace} busy={!!state.busy} visible={visible}
                    openSource={openSource} openTask={openTask} openPlaybook={openPlaybook}
                    greeting={message.role === 'assistant' && workspace.messages[index - 1]?.role === 'user' && isCareGreeting(workspace.messages[index - 1]!.content) && !message.proposals?.length}
                    openExistingTask={openExistingTask} openPipeline={openPipeline} openView={openView}
                    draftHandover={(proposal) => void state.command({ type: 'draft_handover', encounterId: proposal.encounterId })} />
                ))}
                {sending ? <>
                  <li className="conversation-item" data-role="user" {...conversationScope}>
                    <div className="message-row" data-role="user" {...conversationScope}><div className="message-stack" data-role="user" {...conversationScope}>
                      <div className="message-card" data-role="user" {...conversationScope}><p className="message-text" {...conversationScope}>{pendingMessage}</p></div>
                    </div></div>
                  </li>
                  <li className="conversation-item" data-role="assistant" {...conversationScope}>
                    <div className="message-row" data-role="assistant" {...conversationScope}><div className="message-stack" data-role="assistant" {...conversationScope}>
                      <Spinner label={state.chatProgress ? chatProgressLabels[state.chatProgress] : 'Connecting…'} />
                      {elapsed >= 10 ? <p className="mt-1 text-xs text-ink-soft">{elapsed}s · You can stop this reply at any time.</p> : null}
                      {elapsed >= 20 ? <p className="mt-2 text-xs text-ink-soft">This is taking longer than usual. You can open your worklist while the reply finishes.</p> : null}
                    </div></div>
                  </li>
                </> : null}
                <li className="conversation-bottom-anchor" aria-hidden="true" {...conversationScope} />
              </ul>
            </div>
          </>
        ) : (
          <div className="care-home-scroll">
            <CareHome workspace={workspace} openView={openView} openSource={openSource} openTask={openExistingTask} />
          </div>
        )}
      </section>

      <div className="composer-with-queue care-composer" {...threadScope}>
        <div className="care-composer-tools">
          {hasConversation ? <button type="button" className="care-overview-link" onClick={() => { setOverview(value => !value); scrollPending.current = true; }}>
            {showingConversation ? <LayoutDashboard size={14} aria-hidden /> : <MessageCircle size={14} aria-hidden />}
            {showingConversation ? 'Overview' : 'Back to chat'}
          </button> : null}
          {!showingConversation ? <div className="care-home-suggestions" aria-label="Suggested questions">{suggestions}</div> : null}
          {state.errorFor === 'chat' ? <p className="composer-runtime-error" {...threadScope} role="alert">{state.error}</p> : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
            <span role="status" className={runtimeReady || mode === 'offline' ? 'sr-only' : undefined}>
              {mode === 'offline' ? 'Deterministic helper uses the workspace records.'
                : runtimeReady ? 'Gluco is ready.'
                  : state.runtime || state.runtimeError ? 'Gluco is unavailable.' : 'Connecting to Gluco…'}
            </span>
            {!runtimeReady && (state.runtime || state.runtimeError) && mode === 'hermes' ? (
              <>
                <Button size="sm" variant="secondary" className="px-2 text-xs" type="button" onClick={() => setMode('offline')}>Use deterministic helper</Button>
                <Button size="sm" variant="quiet" className="px-2 text-xs" type="button" onClick={() => void state.checkRuntime()}>
                  <RefreshCw size={13} aria-hidden /> Check again
                </Button>
              </>
            ) : null}
          </div>
          {state.runtimeError && mode === 'hermes' ? <p className="text-xs text-ink-soft">{state.runtimeError}</p> : null}
          {voiceError ? <p role="alert" className="text-xs text-danger">{voiceError}</p> : null}
          {showingConversation ? (
            <div className="text-xs text-ink-soft">
              <button type="button" className="min-h-9 rounded px-2 hover:bg-canvas" aria-expanded={suggestionsOpen}
                aria-controls="care-suggested-questions" onClick={() => setSuggestionsOpen(value => !value)}>
                {suggestionsOpen ? 'Hide suggestions' : 'Suggested questions'}
              </button>
              {suggestionsOpen ? <div id="care-suggested-questions" className="flex flex-wrap gap-1.5">{suggestions}</div> : null}
            </div>
          ) : null}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="thread-composer" {...composerScope}>
          <div className="thread-composer-shell" {...composerScope}>
            <div className="thread-composer-input-wrap" {...composerScope}>
              <Label htmlFor="care-prompt" className="sr-only">Message Gluco</Label>
              <textarea id="care-prompt" ref={input} className="thread-composer-input" {...composerScope}
                value={draft} onChange={(event) => onDraft(event.target.value)} rows={2} maxLength={4000}
                placeholder="Ask about an encounter or pending handoff…" aria-describedby="care-composer-help" disabled={sending}
                onKeyDown={(event) => {
                  if (shouldSendOnEnter({ key: event.key, shiftKey: event.shiftKey, altKey: event.altKey, isComposing: event.nativeEvent.isComposing, keyCode: event.nativeEvent.keyCode })) {
                    event.preventDefault();
                    void submit();
                  }
                }} />
            </div>
            <div className="thread-composer-controls" {...composerScope}>
              <div className="thread-composer-control" {...composerScope}>
                <button type="button" className="min-h-11 rounded-lg px-2 text-xs text-ink-soft hover:bg-canvas" aria-expanded={optionsOpen}
                  aria-controls="care-chat-options" onClick={() => setOptionsOpen(value => !value)}>Chat options</button>
                {mode === 'offline' ? <span className="text-xs text-ink-soft">Workspace helper · no AI</span> : null}
                <span id="care-composer-help" className="sr-only">Enter to send. Shift and Enter for a new line.</span>
              </div>
              <div className="thread-composer-actions" {...composerScope}>
          <SpeechDraftInput disabled={sending || !visible} languageCode={locale.tag} onInsert={text => {
            const next = [draft.trimEnd(), text.trim()].filter(Boolean).join('\n');
            if (next.length > 4000) { setVoiceError('The combined message is too long. Shorten the draft before inserting voice text.'); return; }
            setVoiceError(''); onDraft(next); input.current?.focus();
          }} />

                {sending ? <button key="stop" type="button" className="thread-composer-submit" {...composerScope}
                  aria-label="Stop reply" title="Stop reply" onClick={() => state.stopChat()}>
                  <span className="size-3 rounded-sm bg-current" aria-hidden />
                </button> : <button key="send" type="submit" className="thread-composer-submit" {...composerScope} aria-label="Send" title="Send"
                  disabled={!!state.busy || submitting || !draft.trim() || (mode === 'hermes' && !runtimeReady)}>
                  <ArrowUp className="thread-composer-submit-icon" {...composerScope} aria-hidden />
                </button>}
              </div>
            </div>
          </div>
        </form>
        {optionsOpen ? <div id="care-chat-options" className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3">
          <Label htmlFor="care-chat-mode" className="text-xs">Response mode</Label>
          <Select id="care-chat-mode" value={mode} onChange={event => setMode(event.target.value as ChatMode)} disabled={sending} className="w-auto text-xs">
            <option value="hermes">Gluco assistant</option><option value="offline">Workspace helper · no AI</option>
          </Select>
          <p className="text-xs text-ink-soft">Enter to send · Shift+Enter for a new line</p>
        </div> : null}
      </div>
    </section>
  );
}

function Message({ message, workspace, busy, visible, openSource, openTask, openPlaybook, draftHandover, greeting, openExistingTask, openPipeline, openView }: {
  greeting: boolean;
  openExistingTask: (id: string) => void;
  openPipeline: () => void;
  openView: (view: 'teams' | 'worklist') => void;
  message: CareMessage;
  workspace: CareWorkspace;
  busy: boolean;
  visible: boolean;
  openSource: (event: CareEvent) => void;
  openTask: (draft: TaskDraft) => void;
  openPlaybook: (proposal: CareProposal) => void;
  draftHandover: (proposal: CareProposal) => void;
}) {
  const user = message.role === 'user';
  const replyLanguage = message.languageCode ?? 'en-IN';
  const presentation = compileCareReply(message, workspace) ? careSummaryPresentation(message) : null;
  const [showFullReply, setShowFullReply] = useState(false);
  const spokenReply = presentation ? [presentation.lead, presentation.warning, ...message.content.split('\n').slice(1).filter((line) => !/^(HIS|LIS) last synced/.test(line)).map((line) => line.replace(/Source event [^.]+\./g, '').replace(/The (?:HIS|LIS) feed is stale\./g, ''))].filter(Boolean).join('\n') : message.content;
  const sources = (message.sources ?? []).flatMap((source) => {
    const event = workspace.events.find((item) => item.id === source);
    return event ? [event] : [];
  });

  return (
    <li className="conversation-item" data-role={message.role} {...conversationScope}>
      <div className="message-row" data-role={message.role} {...conversationScope}>
        <div className="message-stack" data-role={message.role} {...conversationScope}>
          <article className={greeting ? "message-body has-visual-greeting" : "message-body"} data-role={message.role} {...conversationScope}>
      <div className={cn('mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft', user && 'justify-end')}>
        {user ? null : <LoadingOrb size={26} />}
        <span className="font-semibold text-ink">{user ? 'You' : 'Gluco'}</span>
        {message.engine === 'offline' ? <span>Workspace helper · no AI</span> : null}
        <When value={message.at} short />
      </div>
      <div className="message-card" data-role={message.role} {...conversationScope}>
        {!greeting ? <div className="message-text-flow" {...conversationScope}>
          <p lang={user ? undefined : toDocumentLanguageTag(replyLanguage)} dir="auto" className="message-text" {...conversationScope}>{presentation?.lead ?? message.content}</p>
        </div>
        : <GlucoGreeting workspace={workspace} openTask={openExistingTask} openPipeline={openPipeline} openView={openView} />}
        {!greeting && !user && visible ? <ReadAloud text={spokenReply} languageCode={replyLanguage} /> : null}
        {!greeting && presentation?.warning ? <p role="note" className="mt-2 text-sm text-ink-soft">{presentation.warning}</p> : null}
        {!greeting && !user ? <IntelligentCareReply message={message} workspace={workspace} openSource={openSource} /> : null}
        {!greeting && sources.length && !presentation ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Reply sources">
            <Database size={14} className="hidden text-primary sm:block" aria-hidden />
            {sources.map((event) => <SourceChip key={event.id} event={event} open={openSource} />)}
          </div>
        ) : null}
        {presentation ? <div className="mt-2">
          <button type="button" className="min-h-8 text-xs text-ink-soft hover:text-ink" aria-expanded={showFullReply} onClick={() => setShowFullReply(!showFullReply)}>{showFullReply ? 'Hide full reply' : 'Full reply and timestamps'}</button>
          {showFullReply ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{message.content}</p> : null}
        </div> : null}
        {message.proposals?.map((proposal, index) => {
          const encounter = workspace.encounters.find((item) => item.id === proposal.encounterId);
          const order = workspace.orders.find((item) => item.id === proposal.orderId);
          const title = proposal.skillId ? 'Preview care routine' : {
            monitor: 'Review monitoring', handover: 'Prepare handover draft', playbook: 'Review handover layout draft',
          }[proposal.kind];
          return (
            <div key={`${proposal.kind}-${index}`} className="mt-3 rounded-xl border border-[#c9ded6] bg-white p-3">
              <Badge tone="primary"><ShieldCheck size={12} aria-hidden /> {proposal.skillId ? 'Care routine' : 'Proposed action'}</Badge>
              <p className="mt-1.5 break-words text-sm font-semibold">{proposal.title}</p>
              {encounter || order ? <p className="mt-1 text-xs text-ink-soft">{[encounter?.patientName, order?.testName].filter(Boolean).join(' · ')}</p> : null}
              {proposal.body && proposal.kind !== 'playbook' && !(presentation && proposal.kind === 'handover') ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-soft">{proposal.body}</p> : null}
              <Button size="sm" type="button" disabled={busy} className="mt-2 justify-start text-left text-xs" onClick={() => {
                if (proposal.kind === 'monitor') openTask(proposal);
                else if (proposal.kind === 'playbook') openPlaybook(proposal);
                else draftHandover(proposal);
              }}>
                <ArrowDown size={14} aria-hidden /> {title}
              </Button>
            </div>
          );
        })}
      </div>
          </article>
        </div>
      </div>
    </li>
  );
}

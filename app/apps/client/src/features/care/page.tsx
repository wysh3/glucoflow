import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Activity, ArrowLeft, ArrowRight, ClipboardList, Download, GitPullRequest,
  History, Hospital, MessageCircle, Plus, RefreshCw, Users, X, type LucideIcon,
} from 'lucide-react';
import { Alert, Badge, Button, Card, Spinner } from '@glucoflow/ui';
import type { CareEvent, CareProposal } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';
import { ClinicNavigation } from '../../components/clinic-navigation';
import { AskPanel } from './ask';
import { ArchivedWorkspace } from './archived-workspace';
import { WorkspaceHistory } from './workspace-history';
import { WorkspaceTeamPanel } from './workspace-team';
import { CarePipeline } from './pipeline';
import { EpisodeDrawer } from './episode';
import { EpisodeCoordination } from './episode-coordination';
import { CareWorkspaceRecovery } from './workspace-recovery';
import { PlaybookDraft, PlaybooksPanel } from './playbooks';
import { SkillProposalApplication } from './skill-library';
import { CareDialog, EventInspector, IconBox } from './shared';
import { FeedStatus, Simulator } from './simulator';
import { TaskDialog, type TaskDraft } from './task-dialog';
import { TeamsPanel } from './teams';
import { useCareWorkspace, type ChatMode } from './use-care-workspace';
import { ActivityPanel, TaskDetails, WorklistPanel } from './worklist';
import '../../vendor/codexapp/conversation.css';
import './workspace-canvas.css';

const primary = [
  ['ask', 'Chat', MessageCircle],
  ['worklist', 'Worklist', ClipboardList],
  ['teams', 'Encounters', Users],
] as const;
type View = typeof primary[number][0] | 'learning' | 'activity';
const splitCanvasWidth = 900; // Matches the care-workspace container query.

function savedMode(key: string | null): ChatMode {
  try {
    return key && sessionStorage.getItem(key) === 'offline' ? 'offline' : 'hermes';
  } catch {
    return 'hermes';
  }
}

export function CarePage() {
  const { me } = useSession();
  // Actor changes unmount all clinical context, dialogs and draft text together.
  return me ? <CareWorkspacePage key={me.actor.userId} actorId={me.actor.userId} /> : null;
}

function CareWorkspacePage({ actorId }: { actorId: string }) {
  const [params, setParams] = useSearchParams();
  const [coordinationId, setCoordinationId] = useState<string | null>(null);
  const { hash } = useLocation();
  const route = params.get('view');
  const view = (primary.some(([key]) => key === route) || route === 'learning' || route === 'activity' ? route : 'ask') as View;
  const [simulatorVisible, setSimulatorVisible] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [wide, setWide] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const state = useCareWorkspace(actorId);
  const draftKey = `glucoflow.care.draft.${actorId}`;
  const [chatDraft, setChatDraft] = useState(() => { try { return sessionStorage.getItem(draftKey) ?? ''; } catch { return ''; } });
  useEffect(() => { try { if (chatDraft) sessionStorage.setItem(draftKey, chatDraft); else sessionStorage.removeItem(draftKey); } catch { /* Draft remains usable in memory. */ } }, [chatDraft, draftKey]);
  const [modeChoice, setModeChoice] = useState<{ workspaceId: string; mode: ChatMode } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [continueOpen, setContinueOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [playbookDraft, setPlaybookDraft] = useState<Pick<CareProposal, 'title' | 'body'> | null>(null);
  const workspace = state.workspace;
  const workspaceId = workspace?.id;
  const modeStorageKey = workspaceId ? `glucoflow.care.mode.${actorId}.${workspaceId}` : null;
  const mode = modeChoice && modeChoice.workspaceId === workspaceId ? modeChoice.mode : savedMode(modeStorageKey);
  const setMode = (next: ChatMode) => {
    if (!workspaceId || !modeStorageKey) return;
    setModeChoice({ workspaceId, mode: next });
    try {
      sessionStorage.setItem(modeStorageKey, next);
    } catch {
      // The current view still retains the user's choice when storage is unavailable.
    }
  };
  const busy = !!state.busy;
  const workOpen = view !== 'ask';
  const conversationVisible = !workOpen || (wide && showConversation);
  const event = workspace?.events.find((item) => item.id === eventId) ?? null;
  const task = workspace?.tasks.find((item) => item.id === taskId);
  const inlineError = continueOpen || resetOpen || savedOpen || taskDraft || task || playbookDraft ||
    state.errorFor === 'chat' || state.errorFor === 'set_role' || state.errorFor === 'set_feed' ||
    state.errorFor === 'source_event' || state.errorFor === 'apply_skill';

  const openView = (next: View) => {
    const updated = new URLSearchParams(params);
    if (next === 'ask') updated.delete('view');
    else updated.set('view', next);
    if (next !== view || hash) setParams(updated, { preventScrollReset: true });
    state.clearError();
  };
  function resetWorkspaceView() {
    setChatDraft('');
    setModeChoice(null);
    setResetOpen(false);
    setContinueOpen(false);
    setSavedOpen(false);
    setHistoryOpen(false);
    setTeamOpen(false);
    setPipelineOpen(false);
    setCoordinationId(null);
    setEventId(null);
    setTaskId(null);
    setTaskDraft(null);
    setPlaybookDraft(null);
    setParams(new URLSearchParams(), { replace: true, preventScrollReset: true });
  }

  const openSaved = () => {
    state.clearError();
    setSavedOpen(true);
  };

  const openSource = (source: CareEvent) => setEventId(source.id);
  const openDetails = (id: string) => { state.clearError(); setTaskId(id); };
  const openTask = (draft: TaskDraft) => { state.clearError(); setTaskDraft(draft); };
  const closeTaskDraft = () => { setTaskDraft(null); state.clearError(); };
  const openPlaybook = (proposal: Pick<CareProposal, 'title' | 'body'>) => { state.clearError(); setPlaybookDraft(proposal); };
  const openSimulator = () => {
    const simulator = document.getElementById('care-simulator') as HTMLDetailsElement | null;
    if (!simulator) return;
    simulator.open = true;
    simulator.querySelector('summary')?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    setWide(element.getBoundingClientRect().width >= splitCanvasWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWide(entry.contentRect.width >= splitCanvasWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (workspace?.id && hash === '#care-simulator') { setSimulatorVisible(true); openSimulator(); }
  }, [hash, workspace?.id]);

  useEffect(() => { if (simulatorVisible) openSimulator(); }, [simulatorVisible]);

  return (
    <div ref={canvas} className="content-root care-codexapp relative flex-1" data-v-705e1c85="" data-testid="care-workspace" data-app-ready={!state.loading ? true : undefined}>
      <h1 className="sr-only">Care workspace</h1>
      {!workspace ? <ClinicNavigation /> : null}
      {state.loading ? <Card className="p-6"><Spinner label="Opening your workspace" /></Card> : null}
      {state.loadError ? (
        <Alert tone="error" title="Workspace could not open">
          <p>{state.loadError}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void state.refresh()}>Try again</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => { state.clearError(); setResetOpen(true); }}>New workspace</Button>
            <Button type="button" size="sm" disabled={busy} onClick={openSaved}>Saved workspaces</Button>
          </div>
        </Alert>
      ) : null}
      {!workspace && !state.loading && !state.loadError ? (
        <Card className="mx-4 my-auto w-auto max-w-xl border-line bg-surface p-5 sm:mx-auto sm:p-6">
          <IconBox icon={Hospital} className="bg-white shadow-sm" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Explore the DKA handover demo</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-soft">
            Three fictional DKA encounters: a specimen awaiting receipt, a documented renal-team handover, and a result awaiting acknowledgement. Inspect the evidence, approve an operational task, then draft the handover. Shared demo accounts; fictional information only.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="primary" disabled={busy} onClick={() => void state.create()}>
              {state.busy === 'create' ? 'Creating workspace…' : 'Create workspace'} <ArrowRight size={16} aria-hidden />
            </Button>
            <Button type="button" disabled={busy} onClick={openSaved}><History size={16} aria-hidden /> Saved workspaces</Button>
          </div>
        </Card>
      ) : null}
      {!inlineError && state.error ? <div className="my-3"><Alert tone="error" title="Action could not complete">{state.error}</Alert></div> : null}
      {workspace ? (
        <>
          {state.readError ? (
            <div className="shrink-0 px-3 py-2">
              <Alert tone="review" title="Workspace refresh failed">
                <p>{state.readError} Showing the last loaded snapshot.</p>
                <Button type="button" size="sm" variant="quiet" onClick={() => void state.refresh()}>
                  <RefreshCw size={14} aria-hidden /> Refresh workspace
                </Button>
              </Alert>
            </div>
          ) : null}
          <div className="content-body care-tabs" data-v-705e1c85="">
            <ClinicNavigation>
              <Button type="button" variant="quiet" size="sm" onClick={() => setPipelineOpen(true)}>Pipeline</Button>
              <Button type="button" variant="quiet" size="sm" onClick={() => setTeamOpen(true)}><Users size={16} aria-hidden /> Team</Button>
              <Button type="button" variant="quiet" size="sm" aria-label="New chat" title="New chat with a fresh simulation; this workspace stays saved" disabled={busy} onClick={() => setResetOpen(true)} className="min-h-11 shrink-0 gap-1.5 px-2">
                <Plus size={17} aria-hidden /><span className="hidden sm:inline">New chat</span>
              </Button>
              <details className="relative shrink-0" onClick={(event) => {
                if ((event.target as HTMLElement).closest('button')) event.currentTarget.open = false;
              }}>
                <summary aria-label="Workspace menu" title="Workspace menu" className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg text-xl hover:bg-canvas">⋯</summary>
                <div className="absolute right-0 top-full z-40 grid w-56 gap-1 rounded-xl border border-line bg-surface p-2 shadow-lg">
                  <CanvasAction label="Saved workspaces" icon={History} disabled={busy} onClick={openSaved} />
                  {workspace.previousWorkspaceId ? <CanvasAction label="Previous simulation" icon={ArrowLeft} disabled={busy} onClick={() => {
                    const previousId = workspace.previousWorkspaceId;
                    if (previousId) void state.reopen(previousId).then(opened => { if (opened) resetWorkspaceView(); });
                  }} /> : null}
                  <CanvasAction label="Workspace history" icon={History} disabled={false} onClick={() => setHistoryOpen(true)} />
                  <CanvasAction label="Workspace team" icon={Users} disabled={false} onClick={() => setTeamOpen(true)} />

                  {!workspace.archivedAt ? <>
                  {state.team.data?.access.ownerId === actorId ? <CanvasAction label="Archive settled simulation" icon={ArrowRight} disabled={busy} onClick={() => { state.clearError(); setContinueOpen(true); }} /> : null}
                  <CanvasAction label="Activity" icon={Activity} disabled={false} onClick={() => openView('activity')} />
                  <CanvasAction label="Care routines" icon={GitPullRequest} disabled={false} onClick={() => openView('learning')} />
                  {wide && workOpen ? <CanvasAction label={showConversation ? 'Focus on work' : 'Show conversation'} icon={MessageCircle} disabled={false} onClick={() => setShowConversation(value => !value)} /> : null}
                  <CanvasAction label={simulatorVisible ? 'Hide demo controls' : 'Demo controls'} icon={Hospital} disabled={false} onClick={() => setSimulatorVisible(value => !value)} />
                  </> : null}
                  <CanvasAction label="Export JSON" icon={Download} disabled={busy} onClick={() => void state.exportSnapshot()} />
                </div>
              </details>
            </ClinicNavigation>
            {workspace.archivedAt ? <ArchivedWorkspace workspace={workspace} openSource={openSource} openHistory={() => setHistoryOpen(true)} /> : <div className="content-grid care-thread-layout" data-v-705e1c85="" data-work-open={workOpen} data-split={wide && showConversation}>
              <div className="care-conversation-pane min-h-0 min-w-0">
                <AskPanel key={workspace.id} state={state} workspace={workspace} draft={chatDraft} onDraft={setChatDraft} mode={mode} setMode={setMode}
                  visible={conversationVisible} openSource={openSource} openTask={openTask} openExistingTask={setTaskId} openPlaybook={openPlaybook}
                  openView={openView} openPipeline={() => setPipelineOpen(true)} />
              </div>
              {workOpen ? (
                <section className="care-working-pane" aria-label="Working panel">
                  <div key={view} className="care-working-scroll">
                    {view === 'worklist' ? <>
                      <WorklistPanel workspace={workspace} openSource={openSource} openDetails={openDetails} openTask={openTask} busy={busy} />
                    </> : null}
                    {view === 'activity' ? <>
                      <ActivityPanel workspace={workspace} openSource={openSource} openDetails={openDetails} />
                    </> : null}
                    {view === 'teams' ? <>
                      <TeamsPanel workspace={workspace} state={state} openSource={openSource} />
                    </> : null}
                    {view === 'learning' ? <>
                      <PlaybooksPanel workspace={workspace} state={state} openSource={openSource} openDraft={() => openPlaybook({ title: '' })} />
                    </> : null}
                  </div>
                </section>
              ) : null}
            </div>}
          </div>
          <div className="care-simulator-dock" style={{ display: simulatorVisible && !workspace.archivedAt ? undefined : 'none' }}>
            <div className="care-simulator-drawer" onKeyDown={(event) => {
              const simulator = event.currentTarget.querySelector('details');
              if (event.key === 'Escape' && simulator?.open) {
                event.stopPropagation();
                simulator.open = false;
                simulator.querySelector('summary')?.focus({ preventScroll: true });
              }
            }}>
              <Simulator key={workspace.id} workspace={workspace} state={state} openSource={openSource} openDetails={openDetails} />
            </div>
            <div className="care-simulator-feeds">
              {(['HIS', 'LIS'] as const).map((source) => <FeedStatus key={source} source={source} feed={workspace.feeds[source]} />)}
            </div>
          </div>
          {!workspace.archivedAt && taskDraft?.skillId ? (
            <SkillProposalApplication skillId={taskDraft.skillId} target={taskDraft} workspace={workspace} state={state} close={closeTaskDraft} />
          ) : !workspace.archivedAt && taskDraft ? (
            <TaskDialog draft={taskDraft} workspace={workspace} busy={busy} send={state.command} error={state.error} close={closeTaskDraft} openExisting={openDetails} />
          ) : null}
          {!workspace.archivedAt && task ? <TaskDetails key={task.id} task={task} workspace={workspace} state={state} close={() => { setTaskId(null); state.clearError(); }} openSource={openSource} /> : null}
          {!workspace.archivedAt && playbookDraft ? <PlaybookDraft proposal={playbookDraft} state={state} close={(saved) => {
            setPlaybookDraft(null); state.clearError(); if (saved) openView('learning');
          }} /> : null}
          {!workspace.archivedAt ? <EpisodeDrawer workspace={workspace} openSource={openSource} openDetails={openDetails} onCoordinate={setCoordinationId} /> : null}
          {!workspace.archivedAt && coordinationId ? <EpisodeCoordination workspace={workspace} encounterId={coordinationId} state={state} actorId={actorId} close={() => setCoordinationId(null)} /> : null}
          <EventInspector event={event} workspace={workspace} close={() => setEventId(null)} />
        </>
      ) : null}
      {pipelineOpen && workspace ? <CarePipeline workspace={workspace} close={() => setPipelineOpen(false)} openEpisode={setCoordinationId} /> : null}
      {teamOpen ? <WorkspaceTeamPanel state={state} close={() => setTeamOpen(false)} /> : null}
      {historyOpen && workspaceId ? <WorkspaceHistory workspaceId={workspaceId} close={() => setHistoryOpen(false)} /> : null}
      <CareDialog title="Open a saved workspace" description="Choose a simulation from this account."
        open={savedOpen} onOpenChange={(open) => { if (!busy) { setSavedOpen(open); state.clearError(); } }}>
        {state.errorFor === 'reopen' && state.error ? <p className="mb-3 text-sm text-danger" role="alert">{state.error}</p> : null}
        {savedOpen ? <CareWorkspaceRecovery activeId={workspaceId} disabled={busy} onReopen={async (id) => {
          if (await state.reopen(id)) resetWorkspaceView();
        }} /> : null}
      </CareDialog>
      <CareDialog title="Archive settled simulation and start a new one?"
        description="The current simulation becomes read-only, with its conversation and evidence preserved. A separate simulation starts with three new fictional records. This is not a hospital intake or a continuation of patient care."
        open={continueOpen} onOpenChange={open => { if (!busy) { setContinueOpen(open); state.clearError(); } }}>
        <p className="mb-4 text-sm text-ink-soft">Only the owner can continue. Every task and pending transfer must be settled first.</p>
        {state.errorFor === 'continue' && state.error ? <p className="mb-3 text-sm text-danger" role="alert">{state.error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="quiet" disabled={busy} onClick={() => { setContinueOpen(false); state.clearError(); }}>Cancel</Button>
          <Button type="button" variant="primary" disabled={busy} onClick={async () => {
            if (await state.continueWorkspace()) resetWorkspaceView();
          }}>{state.busy === 'continue' ? 'Archiving…' : 'Archive and start new simulation'}</Button>
        </div>
      </CareDialog>
      <CareDialog title="Start a new chat?" description="Your current chat, tasks and sources stay saved. Start a separate conversation with fresh demo encounters."
        open={resetOpen} onOpenChange={(open) => { if (!busy) { setResetOpen(open); state.clearError(); } }}>
        {state.errorFor === 'create' && state.error ? <p className="mb-3 text-sm text-danger" role="alert">{state.error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="quiet" disabled={busy} onClick={() => { setResetOpen(false); state.clearError(); }}>Cancel</Button>
          <Button type="button" variant="primary" disabled={busy} onClick={async () => {
            if (await state.create()) resetWorkspaceView();
          }}>{state.busy === 'create' ? 'Creating workspace…' : 'Start new chat'}</Button>
        </div>
      </CareDialog>
    </div>
  );
}

function CanvasAction({ label, icon: Icon, disabled, onClick }: {
  label: string; icon: LucideIcon; disabled: boolean; onClick: () => void;
}) {
  return (
    <Button type="button" variant="quiet" size="sm" disabled={disabled} onClick={onClick} title={label} aria-label={label}
      className="min-h-11 justify-start text-left text-xs">
      <Icon size={15} aria-hidden /> <span>{label}</span>
    </Button>
  );
}

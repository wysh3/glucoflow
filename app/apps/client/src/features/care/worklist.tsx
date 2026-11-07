import { ShiftMonitoringActivity } from './shift-monitoring';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity, ArrowRight, CheckCircle2, ClipboardList, Clock3, Database,
  Filter, ListChecks, Plus, Radio, Timer,
} from 'lucide-react';
import { Badge, Button, Card, Input, Label, Select, Textarea } from '@glucoflow/ui';
import type { CareCommand, CareEvent, CareEventKind, CareOrder, CareTask, CareWorkspace } from '@glucoflow/contracts';
import {
  ageLabel, canManage, CareDialog, EmptyPanel, eventLabels, IconBox, isFeedFresh,
  roleLabels, SectionHeading, SourceChip, StateBadge, taskKindLabels, taskStatusLabels, terminalStatuses, When,
} from './shared';
import { useSession } from '../../auth/session';
import type { TaskDraft } from './task-dialog';
import { SkillCapture } from './skill-capture';
import type { CareWorkspaceState } from './use-care-workspace';

type SourceActions = {
  workspace: CareWorkspace;
  openSource: (event: CareEvent) => void;
};

const nextByEvent: Partial<Record<CareEventKind, { title: string; source: 'HIS' | 'LIS'; owner: string }>> = {
  order_placed: { title: 'Awaiting specimen collection', source: 'HIS', owner: 'Nursing team' },
  specimen_collected: { title: 'Awaiting lab receipt', source: 'LIS', owner: 'Lab team' },
  specimen_received: { title: 'Awaiting result validation', source: 'LIS', owner: 'Lab team' },
  result_validated: { title: 'Awaiting result acknowledgement', source: 'HIS', owner: 'Treating clinician' },
  result_corrected: { title: 'Awaiting acknowledgement of the corrected result', source: 'HIS', owner: 'Treating clinician' },
};

function orderEvents(workspace: CareWorkspace, order: CareOrder) {
  return workspace.events.filter((event) => event.orderId === order.id && event.encounterId === order.encounterId)
    .reverse();
}

export function OperationalExceptions({ workspace, openSource, openWorklist }: SourceActions & { openWorklist?: () => void }) {
  const now = Date.now();
  const issues = workspace.orders.flatMap((order) => {
    const encounter = workspace.encounters.find((item) => item.id === order.encounterId);
    const events = orderEvents(workspace, order);
    if (events.some((event) => event.kind === 'order_cancelled')) return [];
    const latest = events[0];
    const next = latest && nextByEvent[latest.kind];
    if (!next || !encounter || !latest) return [];
    const feed = workspace.feeds[next.source];
    const unknown = !isFeedFresh(feed, now) || !isFeedFresh(workspace.feeds[latest.source], now);
    const elapsed = now - Date.parse(latest.occurredAt);
    if (!unknown && elapsed < order.targetMinutes * 60_000) return [];
    return [{
      order, encounter, latest, next, unknown, elapsed, feed,
      owner: next.owner === 'Treating clinician' ? encounter.assignedTo : next.owner,
    }];
  }).sort((a, b) => b.elapsed - a.elapsed);
  const displayed = openWorklist ? issues.slice(0, 2) : issues;

  return (
    <section className="min-w-0 border-b border-line pb-2">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-ink-soft">Needs attention</h2>
        {openWorklist ? <Button type="button" variant="quiet" size="sm" onClick={openWorklist} className="shrink-0 text-xs">
          Worklist <ArrowRight size={14} aria-hidden />
        </Button> : <Badge>{issues.length}</Badge>}
      </header>
      {displayed.length ? (
        <ul className="mt-1 divide-y divide-line">
          {displayed.map(({ order, encounter, latest, next, unknown, owner, feed }) => (
            <li key={order.id} className="py-2"><details><summary className="cursor-pointer text-sm font-medium">{encounter.patientName} · {next.title} <span className="text-xs font-normal text-ink-soft">· {unknown ? 'Status unknown' : ageLabel(latest.occurredAt, now)}</span></summary><div className="py-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold">{next.title}</p>
                <Badge tone="review">{unknown ? 'Status unknown' : 'Past demo target'}</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{encounter.patientName} · {order.testName}</p>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <div><dt className="inline text-ink-soft">Owner </dt><dd className="inline font-medium">{owner}</dd></div>
                <div><dt className="inline text-ink-soft">Elapsed </dt><dd className="inline font-medium">{ageLabel(latest.occurredAt, now)}</dd></div>
                <div><dt className="inline text-ink-soft">Demo target </dt><dd className="inline font-medium">{order.targetMinutes} min</dd></div>
              </dl>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                <SourceChip event={latest} open={openSource} />
                <span>{next.source} last sync <When value={feed.lastSyncAt} short /></span>
              </div>
            </div></details></li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-canvas p-3">
          <CheckCircle2 size={18} className="shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-ink-soft">No operational exceptions in the available source events.</p>
        </div>
      )}
    </section>
  );
}

type TaskAction = Extract<CareCommand, { type: 'task_action' }>['action'];

const actionLabels: Record<TaskAction, string> = {
  approve: 'Approve monitoring',
  pause: 'Pause monitoring',
  resume: 'Resume monitoring',
  cancel: 'Cancel task',
  attest: 'Record human attestation',
};

function actionsFor(task: CareTask): TaskAction[] {
  if (task.status === 'awaiting_approval') return ['approve', 'cancel'];
  if (task.status === 'paused') return ['resume', 'cancel', 'attest'];
  if (task.status === 'monitoring' || task.status === 'awaiting_evidence') return ['pause', 'cancel', 'attest'];
  return [];
}

function taskSource(task: CareTask) {
  if (task.kind === 'specimen_receipt') return { source: 'LIS', evidence: eventLabels.specimen_received } as const;
  if (task.kind === 'result_acknowledgement') return { source: 'HIS', evidence: eventLabels.result_acknowledged } as const;
  return { source: 'HIS', evidence: eventLabels.handover_received } as const;
}

function TaskCard({ task, workspace, openSource, openDetails }: SourceActions & { task: CareTask; openDetails: (id: string) => void }) {
  const encounter = workspace.encounters.find((item) => item.id === task.encounterId);
  const order = workspace.orders.find((item) => item.id === task.orderId);
  const evidence = workspace.events.find((item) => item.id === task.completionEventId);
  const expected = taskSource(task);
  const feed = workspace.feeds[expected.source];

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{encounter?.patientName} · {task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <StateBadge status={task.status} /><span>{task.owner}</span>{task.transfer?.status === 'pending' ? <span>Handover awaiting {task.transfer.owner}</span> : null}
          {!isFeedFresh(feed) ? <span>{expected.source} status unknown</span> : null}
          {evidence ? <SourceChip event={evidence} open={openSource} /> : null}
        </div>
      </div>
      <Button size="sm" type="button" variant="quiet" onClick={() => openDetails(task.id)}>
        {task.status === 'awaiting_approval' && canManage(workspace.role) ? 'Review task' : 'View task'} <ArrowRight size={14} aria-hidden />
      </Button>
    </div>
  );
}

export function WorklistPanel({ workspace, openSource, openDetails, openTask, busy }: SourceActions & {
  openDetails: (id: string) => void;
  openTask: (draft: TaskDraft) => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('open');
  const [order, setOrder] = useState('oldest');
  const visible = workspace.tasks.filter((task) => {
    const encounter = workspace.encounters.find((item) => item.id === task.encounterId);
    const labOrder = workspace.orders.find((item) => item.id === task.orderId);
    const terms = [task.title, task.owner, encounter?.patientName, encounter?.patientCode, labOrder?.testName].join(' ').toLowerCase();
    return terms.includes(query.trim().toLowerCase()) && (status === 'all' || (status === 'open' ? !terminalStatuses.has(task.status) : status === task.status));
  }).sort((a, b) => order === 'oldest' ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <>
      <SectionHeading title="Worklist" action={(
        <Button variant="quiet" type="button" disabled={busy || !workspace.encounters.length} onClick={() => openTask({ title: '' })}>
          <Plus size={16} aria-hidden /> New task
        </Button>
      )} />
      <OperationalExceptions workspace={workspace} openSource={openSource} />
      <details className="my-3"><summary className="w-fit cursor-pointer py-2 text-xs text-ink-soft">Filter tasks</summary><div className="grid gap-2.5 py-2 sm:grid-cols-3">
        <div className="grid gap-1">
          <Label htmlFor="care-task-search">Find a task</Label>
          <Input id="care-task-search" placeholder="Patient, task, test or owner" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="care-task-filter">Status</Label>
          <Select id="care-task-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="open">Open tasks</option>
            <option value="all">All tasks</option>
            {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="care-task-order">Sort by age</Label>
          <Select id="care-task-order" value={order} onChange={(event) => setOrder(event.target.value)}>
            <option value="oldest">Oldest first</option><option value="newest">Newest first</option>
          </Select>
        </div>
      </div>
      </details>
      <p className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-medium text-ink-soft"><Filter size={13} aria-hidden /> {visible.length} {visible.length === 1 ? 'task' : 'tasks'}</p>
      {visible.length ? (
        <div className="grid gap-3">
          {visible.map((task) => <TaskCard key={task.id} task={task} workspace={workspace} openSource={openSource} openDetails={openDetails} />)}
        </div>
      ) : <EmptyPanel icon={ClipboardList} title="No matching tasks">Change the filters or create a monitoring request for an encounter.</EmptyPanel>}
    </>
  );
}

export function ActivityPanel({ workspace, openSource, openDetails, openMonitoring }: SourceActions & { openDetails: (id: string) => void; openMonitoring?: () => void }) {
  const history = [...workspace.activity].reverse();
  return (
    <>
      <SectionHeading title="My activity" description="Monitoring groups, changes and decisions in this workspace." />
      {openMonitoring && <ShiftMonitoringActivity workspace={workspace} openMonitor={openMonitoring} />}
      <div>
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="flex items-center gap-2.5"><IconBox icon={Activity} /><h3 className="text-base font-semibold">Activity log</h3></div>
          <ol className="mt-3 border-l border-[#d2e5dd] pl-4">
            {history.map((entry) => (
              <li className="relative pb-4 last:pb-0 before:absolute before:-left-[21px] before:top-1.5 before:size-2.5 before:rounded-full before:border-2 before:border-white before:bg-primary" key={entry.id}>
                <p className="text-xs text-ink-soft"><When value={entry.at} /></p>
                <p className="mt-1 break-words text-sm font-semibold">{entry.title}</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink-soft">{entry.detail}</p>
                {entry.taskId && workspace.tasks.some((task) => task.id === entry.taskId)
                  ? <Button variant="quiet" size="sm" type="button" className="mt-0.5 px-1 text-xs" onClick={() => openDetails(entry.taskId!)}>Inspect task <ArrowRight size={13} aria-hidden /></Button> : null}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

export function TaskDetails({ task, workspace, state, close, openSource }: SourceActions & {
  task: CareTask;
  state: CareWorkspaceState;
  close: () => void;
}) {
  const [action, setAction] = useState<TaskAction | ''>('');
  const [reason, setReason] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const { search } = useLocation();
  const episode = new URLSearchParams(search);
  episode.set('encounter', task.encounterId);
  const busy = state.busy === 'command';
  const expected = taskSource(task);
  const availableActions = canManage(workspace.role) ? actionsFor(task) : [];
  const events = workspace.events.filter((event) => event.encounterId === task.encounterId && event.orderId === task.orderId)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const encounter = workspace.encounters.find((item) => item.id === task.encounterId);
  const order = workspace.orders.find((item) => item.id === task.orderId);
  const activeAction = availableActions.includes(action as TaskAction) ? action : '';
  const taskActivity = workspace.activity.filter((entry) => entry.taskId === task.id);
  const expiry = task.status === 'expired' ? 'Expired at' : 'Expires';
  const { me } = useSession();
  const team = state.team.data;
  const actorId = me?.actor.userId;
  const roster = workspace.coordination?.staff ?? [];
  const recipients = roster.filter((person) => team?.access.shared === true
    ? person.userId && person.userId !== actorId && team.members.some((member) =>
      member.userId === person.userId && member.active && member.role === person.role)
    : team?.access.shared === false && !person.userId && person.id !== workspace.demoStaffId);
  const selectedRecipient = recipients.find((person) => person.id === recipient);
  const personLabel = (person: (typeof recipients)[number]) => {
    const label = `${person.name} · ${roleLabels[person.role]} · ${person.team}`;
    const duplicate = recipients.some((peer) => peer.id !== person.id && peer.name === person.name && peer.role === person.role && peer.team === person.team);
    if (!duplicate) return label;
    const email = team?.members.find((member) => member.userId === person.userId)?.email;
    return `${label} · ${email ?? person.id.slice(0, 8)}`;
  };
  const transfer = task.transfer;
  const pendingRecipient = roster.find((person) => person.id === transfer?.recipientStaffId);
  const canRespond = !!transfer && !!pendingRecipient && pendingRecipient.role === transfer.role && transfer.role === workspace.role
    && (team?.access.shared === true
      ? !!actorId && pendingRecipient.userId === actorId && transfer.recipientUserId === actorId
      : team?.access.shared === false && !pendingRecipient.userId && !transfer.recipientUserId && pendingRecipient.id === workspace.demoStaffId);

  return (
    <CareDialog open title={task.title} description={[encounter?.patientName, order?.testName].filter(Boolean).join(' · ')}
      onOpenChange={(open) => { if (!open && !busy) close(); }}>
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge status={task.status} />
        <Badge>Playbook v{task.playbookVersion}</Badge>
        {task.skillVersion ? <Badge tone="primary">Routine v{task.skillVersion}</Badge> : null}
        <Button asChild variant="quiet" size="sm"><Link to={{ search: episode.toString() }} onClick={close}>View episode <ArrowRight size={14} aria-hidden /></Link></Button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-canvas p-3 text-sm">
        <div><dt className="text-xs text-ink-soft">Owner</dt><dd className="mt-1 font-medium">{task.owner}</dd></div>
        <div><dt className="text-xs text-ink-soft">Evidence</dt><dd className="mt-1 font-medium">{expected.source} · {taskKindLabels[task.kind]}</dd></div>
        <div><dt className="text-xs text-ink-soft"><Clock3 size={13} className="mr-1 inline" aria-hidden /> Last status change</dt><dd className="mt-1">{task.lastCheckedAt ? <When value={task.lastCheckedAt} /> : 'Pending approval'}</dd></div>
        <div><dt className="text-xs text-ink-soft"><Timer size={13} className="mr-1 inline" aria-hidden /> {expiry}</dt><dd className="mt-1"><When value={task.expiresAt} /></dd></div>
      </dl>
      {events.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold"><Database size={15} className="mr-1 inline text-primary" aria-hidden /> Source history</h3>
          <ol className="mt-1 divide-y divide-line">
            {events.map((event) => (
              <li className="flex flex-wrap items-center justify-between gap-1 py-1.5 text-xs text-ink-soft" key={event.id}>
                <SourceChip event={event} open={() => openSource(event)} />
                {event.id === task.completionEventId ? <Badge tone="success">Completion evidence</Badge> : null}
                {event.id === task.skillSourceEventId ? <Badge tone="primary">Routine applicability evidence</Badge> : null}
                <When value={event.occurredAt} short />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {taskActivity.length ? (
        <details className="mt-4 rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">Task activity</summary>
          <ul className="mt-2 divide-y divide-line text-sm">
            {taskActivity.map((entry) => (
              <li key={entry.id} className="py-2">
                <p className="font-medium">{entry.title} <span className="text-xs font-normal text-ink-soft"><When value={entry.at} short /></span></p>
                <p className="text-ink-soft">{entry.detail}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <SkillCapture task={task} workspace={workspace} disabled={!!state.busy} close={close} />
      {availableActions.length ? (
        <form className="mt-4 grid gap-2.5 border-t border-line pt-4" onSubmit={async (event) => {
          event.preventDefault();
          if (!activeAction || (activeAction === 'attest' && !reason.trim())) return;
          const completed = await state.command({
            type: 'task_action', taskId: task.id, action: activeAction,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          });
          if (completed) { setAction(''); setReason(''); }
        }}>
          <div className="grid gap-1">
            <Label htmlFor="care-task-action">Task action</Label>
            <Select id="care-task-action" value={activeAction} onChange={(event) => { setAction(event.target.value as TaskAction | ''); setReason(''); state.clearError(); }}>
              <option value="">Choose an action</option>
              {availableActions.map((item) => <option key={item} value={item}>{actionLabels[item]}</option>)}
            </Select>
          </div>
          {activeAction === 'attest' || activeAction === 'cancel' ? (
            <div className="grid gap-1">
              <Label htmlFor="care-task-reason">{activeAction === 'attest' ? 'Attestation reason' : 'Cancellation reason (optional)'}</Label>
              <Textarea id="care-task-reason" maxLength={400} required={activeAction === 'attest'} value={reason} onChange={(event) => setReason(event.target.value)} />
              {activeAction === 'attest' ? <p className="text-xs text-ink-soft">The activity log records who attested and why. Source confirmation requires a matching event.</p> : null}
            </div>
          ) : null}
          <Button type="submit" className="justify-self-end" variant={activeAction === 'cancel' ? 'danger' : 'primary'}
            disabled={busy || !activeAction || (activeAction === 'attest' && !reason.trim())}>
            {activeAction ? actionLabels[activeAction] : 'Confirm action'}
          </Button>
        </form>
      ) : null}
      {!terminalStatuses.has(task.status) ? <section className="mt-4 border-t border-line pt-3">
        {task.transfer?.status === 'pending' ? <div className="grid gap-2 text-sm">
          <p><strong>Awaiting {task.transfer.owner}</strong> · {task.owner} remains responsible.</p>
          <p className="text-ink-soft">{task.transfer.reason}</p>
          {!canRespond ? <p className="text-xs text-ink-soft">{task.transfer.recipientStaffId
            ? 'Only the named recipient can respond.'
            : 'This earlier request has no verified recipient. Withdraw it and choose a named person.'}</p> : null}
          {canRespond || canManage(workspace.role) ? <div className="flex flex-wrap justify-end gap-2">
            {canManage(workspace.role) ? <Button variant="quiet" disabled={busy} onClick={() => void state.command({type:'resolve_transfer', taskId:task.id, decision:'withdraw'})}>Withdraw request</Button> : null}
            {canRespond ? <>
              <Button variant="quiet" disabled={busy} onClick={() => void state.command({type:'resolve_transfer', taskId:task.id, decision:'reject'})}>Decline handover</Button>
              <Button disabled={busy} onClick={() => void state.command({type:'resolve_transfer', taskId:task.id, decision:'accept'})}>Accept responsibility</Button>
            </> : null}
          </div> : null}
        </div> : canManage(workspace.role) ? <>
          <Button variant="quiet" size="sm" onClick={() => setTransferOpen(!transferOpen)} aria-expanded={transferOpen}>Hand over responsibility</Button>
          {transferOpen ? <form className="mt-2 grid gap-2" onSubmit={async (event) => {
            event.preventDefault();
            if (selectedRecipient && await state.command({type:'request_transfer',taskId:task.id,recipientStaffId:selectedRecipient.id,reason:transferReason.trim()})) {
              setTransferOpen(false); setRecipient(''); setTransferReason('');
            }
          }}>
            <Label htmlFor="transfer-recipient">Receiving person</Label>
            <Select id="transfer-recipient" required value={selectedRecipient?.id ?? ''} onChange={event=>setRecipient(event.target.value)}>
              <option value="">Choose a roster member</option>
              {recipients.map((person) => <option key={person.id} value={person.id}>{personLabel(person)}</option>)}
            </Select>
            {!recipients.length ? <p className="text-xs text-ink-soft">{team ? 'Add an eligible person in Coordinate care before requesting a handover.' : 'Workspace team access is loading.'}</p> : null}
            <Label htmlFor="transfer-reason">Handover reason</Label>
            <Input id="transfer-reason" required maxLength={400} value={transferReason} onChange={event=>setTransferReason(event.target.value)} placeholder="Shift change; lab receipt still pending" />
            <p className="text-xs text-ink-soft">The current owner stays responsible until the named person accepts. No notification is sent.</p>
            <Button className="justify-self-end" disabled={busy || !selectedRecipient || !transferReason.trim()}>Request handover</Button>
          </form> : null}
        </> : null}
      </section> : null}
      {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}
    </CareDialog>
  );
}

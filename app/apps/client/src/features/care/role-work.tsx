import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Label, Textarea } from '@glucoflow/ui';
import { specimenReceiptMatchesCollection, type CareEvent, type CareOrder, type CareTask, type CareWorkspace } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';
import { latestPipelineEvent } from './pipeline-evidence';
import { handoverReviewParams, pendingHandoverReceipts } from './handover-inbox';
import { ageLabel, CareDialog, isFeedFresh, SectionHeading, SourceChip, StateBadge, terminalStatuses, When } from './shared';
import type { CareWorkspaceState } from './use-care-workspace';

type SourceProps = {
  workspace: CareWorkspace;
  openSource: (event: CareEvent) => void;
};

function specimenEvidence(workspace: CareWorkspace, order: CareOrder) {
  const events = workspace.events.filter(event => event.encounterId === order.encounterId && event.orderId === order.id);
  const collected = latestPipelineEvent(events, 'specimen_collected');
  const rawReceipt = latestPipelineEvent(events, 'specimen_received');
  const validReceipt = specimenReceiptMatchesCollection(collected, rawReceipt);
  return {
    order,
    cancelled: latestPipelineEvent(events, 'order_cancelled'),
    placed: latestPipelineEvent(events, 'order_placed'),
    collected,
    received: validReceipt ? rawReceipt : undefined,
    unverifiedReceipt: validReceipt ? undefined : rawReceipt,
    validated: latestPipelineEvent(events, 'result_validated', 'result_corrected'),
  };
}

function SourceFreshness({ workspace, now }: { workspace: CareWorkspace; now: number }) {
  return <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
    {(['HIS', 'LIS'] as const).map(source => {
      const feed = workspace.feeds[source];
      return <span key={source}>{source} · {!feed.connected ? 'Disconnected' : isFeedFresh(feed, now) ? 'Current feed' : 'Stale feed'}
        {' · Synced '}<When value={feed.lastSyncAt} /></span>;
    })}
  </div>;
}

function currentTask(task: CareTask, now: number) {
  return !terminalStatuses.has(task.status) && Date.parse(task.expiresAt) > now;
}

export function NurseShiftPanel({ workspace, state, openSource, openDetails, openCoordination }: SourceProps & {
  state: CareWorkspaceState;
  openDetails: (taskId: string) => void;
  openCoordination: (encounterId: string) => void;
}) {
  const { me } = useSession();
  const [params, setParams] = useSearchParams();
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const now = Date.now();
  const access = state.team.data?.access;
  const handovers = pendingHandoverReceipts(workspace, { shared: state.team.isSuccess ? access?.shared : undefined, actorId: me?.actor.userId });
  const staff = workspace.coordination?.staff.find(person => person.role === 'nurse' && (
    access?.shared === true ? !!me && person.userId === me.actor.userId
      : access?.shared === false && person.userId === null && person.id === workspace.demoStaffId
  ));
  const open = workspace.tasks.filter(task => currentTask(task, now));
  const assigned = (workspace.coordination?.assignments ?? []).flatMap(assignment => {
    if (assignment.staffId !== staff?.id || !['accepted', 'offered'].includes(assignment.status)) return [];
    if (assignment.status === 'offered' && Date.parse(assignment.expiresAt) <= now) return [];
    const task = open.find(item => item.id === assignment.taskId);
    return task ? [{ task, assignment }] : [];
  });
  const transfers = staff ? open.filter(task => task.transfer?.status === 'pending' && task.transfer.recipientStaffId === staff.id
    && (access?.shared ? task.transfer.recipientUserId === me?.actor.userId : !task.transfer.recipientUserId)) : [];
  const feedsFresh = isFeedFresh(workspace.feeds.HIS, now) && isFeedFresh(workspace.feeds.LIS, now);
  const exceptions = workspace.orders.map(order => specimenEvidence(workspace, order))
    .filter(item => item.collected && !item.received && !item.cancelled && (
      !feedsFresh || item.unverifiedReceipt || item.validated || now - Date.parse(item.collected.occurredAt) >= item.order.targetMinutes * 60_000
    ))
    .sort((a, b) => Date.parse(a.collected!.occurredAt) - Date.parse(b.collected!.occurredAt));
  const ackTask = open.find(task => task.id === acknowledging);
  const closeAck = () => { setAcknowledging(null); state.clearError(); };
  const startAck = (task: CareTask) => {
    state.clearError();
    setAcknowledging(task.id);
  };
  const latestNote = (task?: CareTask) => {
    const note = task?.softAcknowledgements?.at(-1);
    return note ? <p className="mt-2 break-words text-xs text-ink-soft">Soft acknowledgement · {note.actor.name} · <When value={note.at} /> · {note.note}</p> : null;
  };

  return <>
    <SectionHeading title="My Shift" description={staff ? `${staff.name} · ${staff.team}. Named work and specimen exceptions.` : 'Named work and specimen exceptions.'} />
    <SourceFreshness workspace={workspace} now={now} />
    <div className="grid gap-3">
      {handovers.length > 0 && <Card className="p-4">
        <h3 className="text-sm font-semibold">Handover receipts</h3>
        <ul className="divide-y divide-line">
          {handovers.map(({ document, version, sharedAt }) => <li key={`${document.id}-${version.version}`}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-semibold">Shift handover v{version.version}</p>
              <p className="text-xs text-ink-soft">From {document.createdBy.name} · Shared <When value={sharedAt} /></p>
            </div>
            <Button type="button" variant="secondary" className="min-h-11" onClick={() =>
              setParams(handoverReviewParams(params, document.id, version.version), { preventScrollReset: true })}>
              Review v{version.version}
            </Button>
          </li>)}
        </ul>
      </Card>}
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Assigned to me</h3>
        {staff && <p className="mt-1 text-xs text-ink-soft">Recorded shift end <When value={staff.shiftEnd} /></p>}
        {!assigned.length && !transfers.length && <p className="mt-2 text-sm text-ink-soft">No active work offers or assignments for this person.</p>}
        <ul className="divide-y divide-line">
          {assigned.map(({ task, assignment }) => <li key={assignment.id} className="space-y-2 py-3 text-sm">
            <p className="font-semibold">{task.title}</p>
            <p className="text-xs text-ink-soft">{workspace.encounters.find(encounter => encounter.id === task.encounterId)?.patientName ?? 'Encounter'} · Owner {task.owner} · {assignment.status === 'offered' ? 'Offer awaiting response' : 'Accepted assignment'} · {assignment.sourceRef}</p>
            <p className="text-xs text-ink-soft">Offered <When value={assignment.offeredAt} /> · {ageLabel(assignment.offeredAt, now)} elapsed</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" className="min-h-11" onClick={() => openCoordination(task.encounterId)}>Open assignment</Button>
              <Button type="button" variant="quiet" className="min-h-11" disabled={!!state.busy} onClick={() => startAck(task)}>Soft acknowledge</Button>
            </div>
            {latestNote(task)}
          </li>)}
          {transfers.map(task => <li key={task.id} className="space-y-2 py-3 text-sm">
            <p className="font-semibold">{task.title}</p>
            <p className="text-xs text-ink-soft">Named task handover offer · Current owner {task.owner} · Requested <When value={task.transfer!.requestedAt} /></p>
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => openDetails(task.id)}>Review offer</Button>
          </li>)}
        </ul>
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Specimen exceptions</h3>
        {!exceptions.length && <p className="mt-2 text-sm text-ink-soft">No specimen receipt exceptions from the available events.</p>}
        <ul className="divide-y divide-line">
          {exceptions.map(({ order, collected, validated, unverifiedReceipt }) => {
            if (!collected) return null;
            const task = open.find(item => item.kind === 'specimen_receipt' && item.orderId === order.id && item.encounterId === order.encounterId);
            const elapsed = now - Date.parse(collected.occurredAt);
            const overdue = elapsed >= order.targetMinutes * 60_000;
            return <li key={order.id} className="space-y-2 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{order.specimenId} · {order.testName}</p>
                <Badge tone="review">{!feedsFresh ? 'Unknown / stale' : overdue ? 'Overdue' : 'Receipt unverified'}</Badge>
              </div>
              <p className="text-xs text-ink-soft">{workspace.encounters.find(encounter => encounter.id === order.encounterId)?.patientName ?? 'Encounter'}
                {' · Follow-up owner '}{task?.owner ?? 'Unassigned'}</p>
              <p className="text-xs text-ink-soft">Collected {ageLabel(collected.occurredAt, now)} ago · Demo collection-to-receipt target {order.targetMinutes} min</p>
              <p className="text-xs text-ink-soft">{unverifiedReceipt
                ? 'LIS records a receipt before the documented collection. Receipt stays unverified.'
                : 'No LIS receipt event is recorded.'}{validated ? ' Result evidence is present separately.' : ''}</p>
              <div className="flex flex-wrap items-center gap-2">
                <SourceChip event={collected} open={openSource} /><When value={collected.occurredAt} />
                {task && <Button type="button" variant="quiet" className="min-h-11" disabled={!!state.busy} onClick={() => startAck(task)}>Soft acknowledge</Button>}
              </div>
              {unverifiedReceipt && <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <SourceChip event={unverifiedReceipt} open={openSource} /><When value={unverifiedReceipt.occurredAt} />
              </div>}
              {task && <StateBadge status={task.status} />}
              {latestNote(task)}
            </li>;
          })}
        </ul>
      </Card>
    </div>
    {ackTask && <SoftAcknowledge key={ackTask.id} task={ackTask} state={state} close={closeAck} />}
  </>;
}

function SoftAcknowledge({ task, state, close }: { task: CareTask; state: CareWorkspaceState; close: () => void }) {
  const [note, setNote] = useState('');
  return <CareDialog open title="Soft acknowledge"
    description="Record a progress note. The source requirement, task status and ownership stay in place."
    onOpenChange={open => { if (!open && !state.busy) close(); }}>
    <form className="grid gap-3 p-4" onSubmit={async event => {
      event.preventDefault();
      if (note.trim() && await state.command({ type: 'soft_acknowledge_task', taskId: task.id, note: note.trim() })) close();
    }}>
      <Label htmlFor="care-soft-ack-note">Progress note</Label>
      <Textarea id="care-soft-ack-note" required maxLength={240} value={note} onChange={event => setNote(event.target.value)}
        placeholder="For example, checking with specimen collection." />
      {state.errorFor === 'soft_acknowledge_task' && state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" className="justify-self-end" disabled={!!state.busy || !note.trim()}>Record acknowledgement</Button>
    </form>
  </CareDialog>;
}

export function LabQueuePanel({ workspace, openSource }: SourceProps) {
  const now = Date.now();
  const queue = workspace.orders.map(order => specimenEvidence(workspace, order)).filter(item => !item.cancelled);
  return <>
    <SectionHeading title="Lab queue" description="Synthetic orders and recorded lab evidence. Receipt, processing and validation are separate stages." />
    <SourceFreshness workspace={workspace} now={now} />
    <Card className="p-4">
      {!queue.length && <p className="text-sm text-ink-soft">No active orders in the lab queue.</p>}
      <ul className="divide-y divide-line">
        {queue.map(({ order, placed, collected, received, validated, unverifiedReceipt }) => {
          const stage = validated ? 'Validated' : received ? 'Received' : placed || collected ? 'Expected' : 'Unknown';
          const latest = validated ?? received ?? collected ?? placed;
          const missingReceipt = !received && collected && now - Date.parse(collected.occurredAt) >= order.targetMinutes * 60_000;
          return <li key={order.id} className="space-y-2 py-3 text-sm first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{order.specimenId} · {order.testName}</p>
              <Badge tone={validated ? 'primary' : 'neutral'}>{stage}</Badge>
              {missingReceipt && <Badge tone="review">{isFeedFresh(workspace.feeds.LIS, now) ? 'Receipt overdue' : 'Receipt status stale'}</Badge>}
            </div>
            <p className="text-xs text-ink-soft">{workspace.encounters.find(encounter => encounter.id === order.encounterId)?.patientName ?? 'Encounter'}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-soft">
              <div><dt className="font-medium">Lab receipt</dt><dd>{received ? <When value={received.occurredAt} /> : 'Unverified'}</dd></div>
              <div><dt className="font-medium">Processing</dt><dd>Unverified</dd></div>
            </dl>
            {missingReceipt && <p className="text-xs text-ink-soft">Collected {ageLabel(collected.occurredAt, now)} ago · Demo receipt target {order.targetMinutes} min</p>}
            {latest ? <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <SourceChip event={latest} open={openSource} /><When value={latest.occurredAt} />
            </div> : <p className="text-xs text-ink-soft">No matching source event.</p>}
            {received && validated && <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <SourceChip event={received} open={openSource} /><When value={received.occurredAt} />
            </div>}
            {unverifiedReceipt && <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <p>{collected ? 'Receipt timestamp predates collection.' : 'Receipt has no matching collection.'}</p>
              <SourceChip event={unverifiedReceipt} open={openSource} /><When value={unverifiedReceipt.occurredAt} />
            </div>}
          </li>;
        })}
      </ul>
    </Card>
    <p className="mt-3 text-xs text-ink-soft">The synthetic feed has no processing event. Record or flag lab activity in the authorised laboratory workflow.</p>
  </>;
}

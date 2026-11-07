import { useSearchParams } from 'react-router-dom';
import { Badge, Button } from '@glucoflow/ui';
import type { CareEvent, CareWorkspace } from '@glucoflow/contracts';
import { CareDialog, SourceChip, StateBadge, When, isFeedFresh } from './shared';

/** One encounter-scoped view. No clinical conclusions are inferred from the timeline. */
export function EpisodeDrawer({ workspace, openSource, openDetails }: {
  workspace: CareWorkspace; openSource: (event: CareEvent) => void; openDetails: (id: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const id = params.get('encounter');
  const encounter = workspace.encounters.find(item => item.id === id);
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('encounter');
    setParams(next, { replace: true, preventScrollReset: true });
  };
  if (!id) return null;
  const events = workspace.events.filter(item => item.encounterId === id)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const tasks = workspace.tasks.filter(item => item.encounterId === id);
  const activity = workspace.activity.filter(item => item.taskId && tasks.some(task => task.id === item.taskId)).slice().reverse();
  return <CareDialog open title={encounter ? `Episode · ${encounter.patientName}` : 'Episode unavailable'}
    description="Encounter context, operational work and source evidence in one place."
    onOpenChange={open => { if (!open) close(); }}>
    {!encounter ? <p className="text-sm">This encounter is not in the current workspace. Close this view and choose an assigned encounter.</p> : <div className="space-y-5">
      <div className="rounded-xl border border-line bg-canvas p-3 text-sm">
        <Badge>Synthetic episode</Badge>
        <p className="mt-2 font-medium">{encounter.patientCode} · {encounter.bed}</p>
        <p className="mt-1">Assigned clinician: {encounter.assignedTo}</p>
        <p className="mt-1 text-ink-soft">Admitted <When value={encounter.admittedAt} /></p>
      </div>
      <section aria-label="Episode context">
        <h3 className="font-semibold">Documented context</h3>
        <p className="mt-1 text-xs text-ink-soft">Synthetic context entered in this workspace; original hospital documents are not connected.</p>
        {encounter.documentedContext.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{encounter.documentedContext.map((line, i) => <li key={i}>{line}</li>)}</ul>
          : <p className="mt-2 text-sm text-ink-soft">No documented context.</p>}
      </section>
      <section aria-label="Episode work">
        <h3 className="font-semibold">Tasks and handovers</h3>
        {tasks.length ? <ul className="mt-2 space-y-2">{tasks.map(task => <li key={task.id} className="rounded-xl border border-line p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{task.title}</span><StateBadge status={task.status} /></div>
          <p className="mt-1 text-ink-soft">Owner: {task.owner}</p>
          {task.transfer?.status === 'pending' ? <p className="text-xs text-review">Awaiting handover acceptance by {task.transfer.owner}</p> : null}
          <p className="mt-1 text-xs text-ink-soft">Scope expires <When value={task.expiresAt} /></p>
          <Button type="button" size="sm" className="mt-2" onClick={() => { close(); openDetails(task.id); }}>View task</Button>
        </li>)}</ul> : <p className="mt-2 text-sm text-ink-soft">No delegated tasks for this encounter.</p>}
      </section>
      <section aria-label="Episode source timeline">
        <h3 className="font-semibold">Source timeline</h3>
        <div className="mt-2 flex flex-wrap gap-2">{(['HIS', 'LIS'] as const).map(source => <Badge key={source} tone={isFeedFresh(workspace.feeds[source]) ? 'primary' : 'review'}>
          {source} · {!workspace.feeds[source].connected ? 'Disconnected' : isFeedFresh(workspace.feeds[source]) ? 'Current' : 'Stale'}
        </Badge>)}</div>
        <p className="mt-1 text-xs text-ink-soft">HIS sync <When value={workspace.feeds.HIS.lastSyncAt} /> · LIS sync <When value={workspace.feeds.LIS.lastSyncAt} />. Missing events remain unknown.</p>
        <ol className="mt-2 divide-y divide-line">{events.map(event => <li key={event.id} className="space-y-1 py-2 text-xs text-ink-soft">
          <SourceChip event={event} open={openSource} />
          <p>{workspace.orders.find(order => order.id === event.orderId)?.testName ?? 'Encounter handover'} · <When value={event.occurredAt} /></p>
        </li>)}</ol>
      </section>
      <section aria-label="Episode task activity">
        <h3 className="font-semibold">Task activity</h3>
        {activity.length ? <ol className="mt-2 space-y-2 text-sm">{activity.map(item => <li key={item.id}>
          <p className="font-medium">{item.title}</p><p className="text-ink-soft">{item.detail}</p><span className="text-xs text-ink-soft"><When value={item.at} /></span>
        </li>)}</ol> : <p className="mt-2 text-sm text-ink-soft">No task actions recorded yet.</p>}
      </section>
    </div>}
  </CareDialog>;
}

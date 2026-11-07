import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button } from '@glucoflow/ui';
import type { CareEvent, CareOrder, CareWorkspace, CareEpisodeRecord } from '@glucoflow/contracts';
import { Check, CircleHelp, RotateCcw } from 'lucide-react';
import { CareDialog, SourceChip, StateBadge, When, isFeedFresh, roleLabels } from './shared';
import { episodeMeasurements, episodeRecordStatus, type EpisodeMeasurementSeries } from './episode-measurements';
import { pipelineEvidence, pipelineStages } from './pipeline-evidence';

function OrderEvidence({ order, events, openSource }: { order: CareOrder; events: CareEvent[]; openSource: (event: CareEvent) => void }) {
  const cancellation = pipelineEvidence(events, 'order_cancelled').event;
  return <div className="rounded-xl border border-line px-3 py-2.5">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <h4 className="min-w-0 break-words font-medium">{order.testName}</h4>
      {cancellation && <Button size="sm" variant="quiet" onClick={() => openSource(cancellation)}>Cancellation recorded</Button>}
    </div>
    <ol className="mt-2 flex flex-wrap gap-1.5">
      {pipelineStages.map(stage => {
        const { event, superseded, result } = pipelineEvidence(events, stage.kind);
        const Icon = superseded ? RotateCcw : event ? Check : CircleHelp;
        const status = superseded ? result ? 'Acknowledgement needed' : 'Result evidence missing' : event ? 'Source recorded' : 'Unverified';
        const tone = superseded ? 'text-review' : event ? 'text-primary' : 'text-ink-soft';
        const chip = 'inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line px-2 text-xs';
        const label = <><Icon aria-hidden size={13} className={`shrink-0 ${tone}`} /><span>{stage.label}</span></>;
        return <li key={stage.kind}>{event ? <button type="button" className={`${chip} hover:bg-canvas focus-visible:ring-2 focus-visible:ring-primary`}
          aria-label={`Inspect ${stage.label.toLowerCase()} evidence. ${status}.`} title={`${status} · ${event.sourceRef}`} onClick={() => openSource(event)}>{label}</button>
          : <span className={`${chip} bg-canvas text-ink-soft`} title={status}>{label}<span className="sr-only"> · {status}</span></span>}</li>;
      })}
    </ol>
  </div>;
}

function MeasurementPlot({ series, select }: { series: EpisodeMeasurementSeries; select: (record: CareEpisodeRecord) => void }) {
  const { points, label, unit } = series;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const min = Math.min(...points.map(point => point.value));
  const max = Math.max(...points.map(point => point.value));
  const magnitude = Math.max(Math.abs(min), Math.abs(max)) || 1;
  const range = max / magnitude - min / magnitude;
  return <figure className="rounded-xl border border-line px-3 py-2.5">
    <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <span className="min-w-0 break-words font-medium">{label} · {unit || 'dimensionless'}</span><span className="text-xs text-ink-soft">{points.length} recorded values</span>
    </figcaption>
    <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-stretch gap-2">
      <div aria-hidden="true" className="flex flex-col justify-between py-1 text-xs tabular-nums text-ink-soft"><span>{max}</span>{min !== max && <span>{min}</span>}</div>
      <svg viewBox="0 0 320 70" className="w-full text-primary" role="img" aria-label={`${label}, ${unit}. Recorded points over time. Exact values and sources are listed below.`}>
        <path d="M10 10H310 M10 35H310 M10 60H310" className="stroke-line" fill="none" strokeDasharray="3 3" />
        {points.map(point => <circle key={point.record.id} r="3.5" tabIndex={0} role="button"
          aria-label={`Inspect ${label}: ${point.record.value} ${unit || 'dimensionless'} at ${point.record.occurredAt}`}
          onClick={()=>select(point.record)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(point.record);}}} className="fill-current stroke-surface" strokeWidth="1"
          cx={10 + 300 * (point.time - first.time) / (last.time - first.time)}
          cy={range ? 60 - 50 * (point.value / magnitude - min / magnitude) / range : 10}>
          <title>{point.record.value} {unit} · {point.record.sourceRef}</title>
        </circle>)}
      </svg>
    </div>
    <div className="flex flex-wrap justify-between gap-x-2 text-xs text-ink-soft"><When value={first.record.occurredAt} /><When value={last.record.occurredAt} /></div>
  </figure>;
}

/** One encounter-scoped view. No clinical conclusions are inferred from the timeline. */
export function EpisodeDrawer({ workspace, openSource, openDetails, onCoordinate }: {
  onCoordinate: (id: string) => void;
  workspace: CareWorkspace; openSource: (event: CareEvent) => void; openDetails: (id: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [earlierOrders, setEarlierOrders] = useState(false);
  const [morePlots, setMorePlots] = useState(false);
  const [showRecords, setShowRecords] = useState<boolean | null>(null);
  const id = params.get('encounter');
  const encounter = workspace.encounters.find(item => item.id === id);
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('encounter');
    setParams(next, { replace: true, preventScrollReset: true });
  };
  if (!id) return null;
  const sourceEvents = workspace.events.filter(item => item.encounterId === id);
  const events = sourceEvents.slice()
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const orders = workspace.orders.filter(item => item.encounterId === id).reverse();
  const records = (workspace.coordination?.records ?? []).filter(item => item.encounterId === id);
  const series = episodeMeasurements(records);
  const inspectedRecord = records.find(record=>record.id===selectedRecord);
  const tasks = workspace.tasks.filter(item => item.encounterId === id);
  const activity = workspace.activity.filter(item => item.taskId && tasks.some(task => task.id === item.taskId)).slice().reverse();
  const orderEvidence = (order: CareOrder) => <OrderEvidence key={order.id} order={order}
    events={sourceEvents.filter(event => event.orderId === order.id)} openSource={openSource} />;
  return <CareDialog open title={encounter ? `Episode · ${encounter.patientName}` : 'Episode unavailable'}
    description="Encounter context, operational work and source evidence in one place."
    onOpenChange={open => { if (!open) close(); }}>
    {!encounter ? <p className="text-sm">This encounter is not in the current workspace. Close this view and choose an assigned encounter.</p> : <div className="space-y-5">
      <div className="rounded-xl border border-line bg-canvas p-3 text-sm">
        <Badge>Synthetic episode</Badge>
        <p className="mt-2 font-medium">{encounter.patientCode} · {encounter.bed}</p>
        <p className="mt-1">Current clinical responsibility · {encounter.assignedTo.trim() || 'Unassigned'}</p>
        <p className="mt-1 text-ink-soft">Admitted <When value={encounter.admittedAt} /></p>
        <p className="mt-1 text-xs text-ink-soft">Registered in Gluco by {encounter.registeredBy ? `${encounter.registeredBy.name} · ${roleLabels[encounter.registeredBy.role]}${encounter.registeredBy.simulated ? ' · Simulated' : ''}` : 'Unknown'}</p>
      </div>
      <Button onClick={() => { close(); onCoordinate(encounter.id); }}>Coordinate team & handover</Button>
      <section aria-label="Order evidence">
        <h3 className="font-semibold">Order evidence</h3>
        <p className="mt-1 text-xs text-ink-soft">Open a recorded step to inspect its source. Question marks indicate unverified steps.</p>
        {orders.length ? <div className="mt-2 space-y-2">{orders.slice(0, 2).map(orderEvidence)}
          {orders.length > 2 && <div className="text-sm">
            <Button size="sm" variant="quiet" aria-expanded={earlierOrders} onClick={()=>setEarlierOrders(!earlierOrders)}>{earlierOrders ? 'Hide earlier orders' : `Earlier orders (${orders.length - 2})`}</Button>
            {earlierOrders && <div className="mt-2 space-y-2">{orders.slice(2).map(orderEvidence)}</div>}
          </div>}
        </div> : <p className="mt-2 text-sm text-ink-soft">No orders recorded for this encounter.</p>}
      </section>
      <section aria-label="Episode context">
        <h3 className="font-semibold">Documented context</h3>
        <p className="mt-1 text-xs text-ink-soft">Synthetic context entered in this workspace; original hospital documents are not connected.</p>
        {encounter.documentedContext.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{encounter.documentedContext.map((line, i) => <li key={i}>{line}</li>)}</ul>
          : <p className="mt-2 text-sm text-ink-soft">No documented context.</p>}
      </section>
      {records.length > 0 && <section aria-label="Transcribed source records" className="space-y-2">
        <h3 className="font-semibold">Transcribed source records</h3>
        <p className="text-xs text-ink-soft">Unverified synthetic transcription preview. Original documents are not connected. Disputed and superseded values are excluded from plots. Select a point to inspect its reference.</p>
        {series[0] && <MeasurementPlot series={series[0]} select={record=>setSelectedRecord(record.id)} />}
        {series.length > 1 && <div className="text-sm">
          <Button size="sm" variant="quiet" aria-expanded={morePlots} onClick={()=>setMorePlots(!morePlots)}>{morePlots ? 'Hide additional plots' : `More plots (${series.length - 1})`}</Button>
          {morePlots && <div className="mt-2 space-y-2">{series.slice(1).map(group => <MeasurementPlot key={JSON.stringify([group.label, group.unit])} series={group} select={record=>setSelectedRecord(record.id)} />)}</div>}
        </div>}
        {inspectedRecord && <div role="status" className="rounded-lg border border-line p-3 text-sm">
          <p className="font-medium">{inspectedRecord.label}: {inspectedRecord.value} {inspectedRecord.dimensionless ? '(dimensionless)' : inspectedRecord.unit}</p>
          <p><When value={inspectedRecord.occurredAt} /> · Reference {inspectedRecord.sourceRef}</p>
          <p>{episodeRecordStatus(inspectedRecord,records)} · Original source not connected</p>
          <p>Recorded by {inspectedRecord.recorder?.name ?? 'Unknown'}{inspectedRecord.recorder?.simulated ? ' (simulated)' : ''}</p>
        </div>}
        <div className="text-sm">
          <Button size="sm" variant="quiet" aria-expanded={showRecords ?? series.length===0} onClick={()=>setShowRecords(!(showRecords ?? series.length===0))}>Values and source references ({records.length})</Button>
          {(showRecords ?? series.length===0) && <ul className="mt-1 divide-y divide-line">{records.slice().sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).map(record => <li key={record.id} className="space-y-1 py-2">
            <p className="break-words font-medium">{record.label}{record.kind === 'followup' && <span className="ml-2 text-xs font-normal text-ink-soft">Follow-up</span>}</p>
            <p className="whitespace-pre-wrap break-words">{record.value} {record.dimensionless ? '(dimensionless)' : record.unit}</p>
            <p className="break-words text-xs text-ink-soft"><When value={record.occurredAt} /> · Reference {record.sourceRef}</p>
            <p className="text-xs text-ink-soft">{episodeRecordStatus(record,records)} · Recorded by {record.recorder?.name ?? 'Unknown'}{record.recorder?.simulated ? ' (simulated)' : ''}</p>
            {record.revisionReason && <p className="text-xs text-ink-soft">Revision reason: {record.revisionReason}</p>}
          </li>)}</ul>}
        </div>
      </section>}
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
          <p className="font-medium">{item.title}</p><p className="text-ink-soft">{item.detail}</p><span className="text-xs text-ink-soft"><When value={item.at} />{item.actor && ` · ${item.actor.name}${item.actor.simulated ? ' · Simulated' : ''}`}</span>
        </li>)}</ol> : <p className="mt-2 text-sm text-ink-soft">No task actions recorded yet.</p>}
      </section>
    </div>}
  </CareDialog>;
}

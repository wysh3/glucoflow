import { useCallback, useEffect, useRef, useState } from 'react';
import type { CareWorkspace, CareEvent } from '@glucoflow/contracts';
import { Button, Dialog, DialogClose, DialogContent, DialogHeader } from '@glucoflow/ui';
import { Check, CircleHelp, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { isFeedFresh, SourceChip, When, roleLabels, taskStatusLabels } from './shared';
import { pipelineEvidence, pipelineFollowup, pipelineStages } from './pipeline-evidence';
import './pipeline-canvas.css';

const WIDTH = 1160;
const HEIGHT = 636;
const stagePositions = {
  order_placed: { left: 30, top: 50 },
  specimen_collected: { left: 250, top: 194 },
  specimen_received: { left: 470, top: 338 },
  result_validated: { left: 690, top: 338 },
  result_acknowledged: { left: 910, top: 50 },
};

/** Evidence is per stage. Edges show the workflow, never proof of missing transitions. */
export function CarePipeline({ workspace, close, openEpisode, openSource, encounterId: initialEncounter }: {
  workspace: CareWorkspace; close: () => void; openEpisode: (id: string) => void;
  openSource?: (event: CareEvent) => void; encounterId?: string;
}) {
  const [encounterId, setEncounterId] = useState(initialEncounter ?? workspace.encounters[0]?.id ?? '');
  const [orderId, setOrderId] = useState('');
  const [selected, setSelected] = useState<string>('order_placed');
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null);
  const bindCanvas = useCallback((node: HTMLDivElement | null) => { viewport.current = node; setCanvasElement(node); }, []);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const encounter = workspace.encounters.find(item => item.id === encounterId) ?? workspace.encounters[0];
  const orders = workspace.orders.filter(item => item.encounterId === encounter?.id);
  const order = orders.find(item => item.id === orderId) ?? orders[0];
  const events = workspace.events.filter(item => item.encounterId === encounter?.id && !!order && item.orderId === order.id);
  const cancelled = !!pipelineEvidence(events, 'order_cancelled').event;
  const handover = workspace.coordination?.handovers.filter(item => item.encounterId === encounter?.id).at(-1);
  const receivingStaff = workspace.coordination?.staff.find(item => item.id === handover?.toStaffId);
  const bed = encounter?.bedTransfer;
  const selectedStage = pipelineStages.find(item => item.kind === selected);
  const evidence = selectedStage ? pipelineEvidence(events, selectedStage.kind) : undefined;
  const actor = evidence?.event?.recordedBy;
  const now = new Date().toISOString();
  const clinicalOwner = encounter?.assignedTo.trim() || 'Unassigned';
  const followup = selectedStage && encounter && order && !cancelled ? pipelineFollowup(workspace.tasks, encounter.id, order.id, selectedStage.kind, now) : [];
  const offers = workspace.coordination?.assignments.filter(item => item.status === 'offered' && item.expiresAt > now
    && followup.some(task => task.id === item.taskId)) ?? [];
  const fit = () => {
    if (!viewport.current) return;
    setZoom(Math.max(0.45, Math.min(1, (viewport.current.clientWidth - 28) / WIDTH, (viewport.current.clientHeight - 28) / HEIGHT)));
    viewport.current.scrollTo({ left: 0, top: 0 });
  };
  useEffect(() => {
    if (!canvasElement) return;
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvasElement);
    return () => observer.disconnect();
  }, [canvasElement]);
  const handoverPending = handover?.status === 'pending' && handover.expiresAt > now;
  const handoverStatus = handover?.status === 'pending' && !handoverPending ? 'Expired' : handover?.status ?? 'Not requested';
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent side="floating" className="care-pipeline-dialog">
      <DialogHeader title="Care pipeline" description="One encounter, across teams. Select a step to inspect its evidence."
        actions={<DialogClose asChild><Button variant="quiet" size="icon" aria-label="Close care pipeline"><X size={18} /></Button></DialogClose>} />
      <div className="care-pipeline-toolbar">
        <label className="care-pipeline-picker"><span>Encounter</span><select aria-label="Pipeline encounter" value={encounter?.id ?? ''} onChange={event => { setEncounterId(event.target.value); setOrderId(''); setSelected('order_placed'); }}>
          {workspace.encounters.map(item => <option key={item.id} value={item.id}>{item.patientName} · {item.patientCode}</option>)}
        </select></label>
        <label className="care-pipeline-picker"><span>Order</span><select aria-label="Pipeline order" value={order?.id ?? ''} disabled={!orders.length} onChange={event => { setOrderId(event.target.value); setSelected('order_placed'); }}>
          {!orders.length && <option value="">No orders recorded</option>}{orders.map(item => <option key={item.id} value={item.id}>{item.testName}</option>)}
        </select></label>
        <div className="care-pipeline-zoom" aria-label="Canvas zoom"><Button variant="quiet" size="icon" aria-label="Zoom out" disabled={zoom <= 0.45} onClick={() => setZoom(value => Math.max(0.45, value - 0.15))}><Minus size={16} /></Button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span><Button variant="quiet" size="icon" aria-label="Zoom in" disabled={zoom >= 1.6} onClick={() => setZoom(value => Math.min(1.6, value + 0.15))}><Plus size={16} /></Button>
          <Button variant="quiet" size="icon" aria-label="Fit pipeline to screen" onClick={fit}><Maximize2 size={16} /></Button></div>
      </div>
      <div className="care-pipeline-body">
        <div className="care-pipeline-viewport" ref={bindCanvas} tabIndex={0} role="region" aria-label="Patient journey canvas. Use arrow keys to scroll, or drag the background."
          onPointerDown={event => { if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return; const node = event.currentTarget; drag.current = { x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop }; node.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { if (!drag.current) return; event.currentTarget.scrollLeft = drag.current.left - event.clientX + drag.current.x; event.currentTarget.scrollTop = drag.current.top - event.clientY + drag.current.y; }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          {encounter ? <div className="care-pipeline-scroll-area" style={{ width: WIDTH * zoom, height: HEIGHT * zoom }}><div className="care-pipeline-board" style={{ width: WIDTH, height: HEIGHT, transform: `scale(${zoom})` }}>
            {['Clinical team', 'Nursing / collection', 'Laboratory', 'Care coordination'].map((label, index) => <div key={label} className="care-pipeline-lane" style={{ top: index * 144, height: index === 3 ? 204 : 144 }}><span>{label}</span></div>)}
            <svg className="care-pipeline-edges" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true"><defs><marker id="care-pipeline-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#a3aba7" /></marker></defs>
              <path d="M224 96 C247 96 226 240 250 240" /><path d="M444 240 C467 240 446 384 470 384" /><path d="M664 384 H690" /><path d="M884 384 C908 384 886 96 910 96" />
            </svg>
            {pipelineStages.map(stage => { const result = pipelineEvidence(events, stage.kind); const recorded = !!result.event && !result.superseded;
              return <button key={stage.kind} type="button" className={`care-pipeline-node ${selected === stage.kind ? 'is-selected' : ''} ${recorded ? 'is-recorded' : ''}`}
                style={stagePositions[stage.kind]} aria-pressed={selected === stage.kind} onClick={() => setSelected(stage.kind)}>
                <span className="care-pipeline-node-heading">{stage.label}{recorded ? <Check size={15} aria-hidden /> : result.superseded ? <RotateCcw size={15} aria-hidden /> : <CircleHelp size={15} aria-hidden />}</span>
                <span>{result.superseded ? result.result ? 'Acknowledgement needed' : 'Result evidence missing' : recorded ? 'Source recorded' : 'Evidence unverified'}</span>
                <small>{result.event ? <When value={result.event.occurredAt} short /> : 'No matching source event'}</small>
              </button>;
            })}
            <button type="button" className={`care-pipeline-node care-pipeline-coordination ${selected === 'handover' ? 'is-selected' : ''}`} style={{ left: 250, top: 490 }} aria-pressed={selected === 'handover'} onClick={() => setSelected('handover')}>
              <span className="care-pipeline-node-heading">Receiving responsibility</span><span>{handoverStatus}</span><small>{clinicalOwner}</small>
            </button>
            <button type="button" className={`care-pipeline-node care-pipeline-coordination ${selected === 'bed' ? 'is-selected' : ''}`} style={{ left: 690, top: 490 }} aria-pressed={selected === 'bed'} onClick={() => setSelected('bed')}>
              <span className="care-pipeline-node-heading">Bed / transfer</span><span>{bed ? bed.stage === 'requested' ? 'Allocation pending' : bed.stage === 'allocated' ? 'Awaiting arrival' : 'Arrival recorded' : 'No transfer recorded'}</span><small>{bed?.destination ?? encounter.bed}</small>
            </button>
            <p className="care-pipeline-separation">Responsibility and physical placement are tracked independently.</p>
          </div></div> : <p className="p-8 text-sm text-ink-soft">No encounters yet. Add a synthetic encounter to begin.</p>}
        </div>
        <aside className="care-pipeline-detail" aria-label="Selected step evidence" aria-live="polite">
          <p className="care-pipeline-eyebrow">{encounter?.patientCode} · Synthetic</p>
          <h3>{selectedStage?.label ?? (selected === 'bed' ? 'Bed / transfer' : 'Receiving responsibility')}</h3>
          {cancelled && <p className="care-pipeline-warning">This order has a recorded cancellation. Historical evidence remains visible.</p>}
          {selectedStage ? <><p className="care-pipeline-detail-status">{evidence?.superseded ? evidence.result ? 'A newer result needs acknowledgement.' : 'Acknowledgement recorded. Matching result evidence is missing.' : evidence?.event ? 'Matching source evidence recorded.' : 'No matching evidence has been received.'}</p>
            <dl>
              <dt>Expected performer</dt><dd>{selectedStage.performer}</dd>
              <dt>Recorded in Gluco by</dt><dd>{actor ? `${actor.name} · ${roleLabels[actor.role]}${actor.simulated ? ' · Simulated' : ''}` : 'Unknown'}</dd>
              <dt>Current clinical responsibility</dt><dd>{clinicalOwner}</dd>
              {'followup' in selectedStage && <>
                <dt>Follow-up assignee</dt><dd>{followup.length ? followup.map(task => <div key={task.id}>{task.owner.trim() || 'Unassigned'}<small className="block">{taskStatusLabels[task.status]}</small></div>) : 'Unassigned'}</dd>
              </>}
              {followup.filter(task => task.transfer?.status === 'pending').map(task => <div key={task.id}>
                <dt>Pending follow-up transfer</dt><dd>{task.transfer?.owner || 'Unknown recipient'}</dd>
              </div>)}
              {offers.map(offer => <div key={offer.id}>
                <dt>Pending follow-up offer</dt><dd>{workspace.coordination?.staff.find(item => item.id === offer.staffId)?.name ?? 'Unknown recipient'} · {offer.sourceRef}</dd>
              </div>)}
              {evidence?.event && <>
                <dt>Source</dt><dd>{openSource ? <SourceChip event={evidence.event} open={openSource} /> : evidence.event.source}<small className="block">{evidence.event.sourceRef}</small></dd>
                <dt>Event occurred</dt><dd><When value={evidence.event.occurredAt} /></dd>
                <dt>Received by workspace</dt><dd><When value={evidence.event.receivedAt} /></dd>
              </>}
            </dl>
            {!evidence?.event && <p className="text-xs text-ink-soft">Later events leave this stage unverified.</p>}</> : selected === 'handover' ? <>
              <p className="care-pipeline-detail-status">{handoverStatus}</p>
              <dl>
                <dt>Current clinical responsibility</dt><dd>{clinicalOwner}</dd>
                {handover && <>
                  <dt>{handoverPending ? 'Pending receiving clinician' : 'Named receiving clinician'}</dt><dd>{receivingStaff?.name ?? 'Unknown recipient'}</dd>
                  <dt>Destination</dt><dd>{handover.destination}</dd><dt>Source</dt><dd>{handover.sourceRef}</dd>
                  <dt>Requested</dt><dd><When value={handover.requestedAt} /></dd>
                </>}
              </dl>
              <p className="text-xs text-ink-soft">Clinical responsibility changes when the named recipient accepts.</p>
            </> : <>
              <dl><dt>Recorded location</dt><dd>{encounter?.bed}</dd><dt>Destination</dt><dd>{bed?.destination ?? 'No transfer requested'}</dd><dt>Stage</dt><dd>{bed?.stage ?? 'Not recorded'}</dd></dl>
              {bed?.history.map(item => <p key={item.stage} className="text-xs text-ink-soft">{item.stage} · {item.sourceRef}<br /><When value={item.at} /></p>)}
            </>}
          {encounter && <Button size="sm" onClick={() => { close(); openEpisode(encounter.id); }}>Open encounter</Button>}
        </aside>
      </div>
      <footer className="care-pipeline-footer"><span>Connections show workflow · Missing evidence stays unknown</span><div>{(['HIS', 'LIS'] as const).map(source => <span key={source} className={!isFeedFresh(workspace.feeds[source]) ? 'care-pipeline-warning-text' : ''}>{source}: {!workspace.feeds[source].connected ? 'disconnected' : isFeedFresh(workspace.feeds[source]) ? 'recent sync' : 'out of date'} · <When value={workspace.feeds[source].lastSyncAt} short /></span>)}</div></footer>
    </DialogContent>
  </Dialog>;
}

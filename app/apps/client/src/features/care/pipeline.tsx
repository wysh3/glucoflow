import { useCallback, useEffect, useRef, useState } from 'react';
import type { CareWorkspace, CareEventKind } from '@glucoflow/contracts';
import { Button, Dialog, DialogClose, DialogContent, DialogHeader } from '@glucoflow/ui';
import { Check, CircleHelp, Maximize2, Minus, Plus, X } from 'lucide-react';
import { isFeedFresh, When } from './shared';
import { pipelineEvidence } from './pipeline-evidence';
import './pipeline-canvas.css';

const WIDTH = 1160;
const HEIGHT = 636;
const stages: { kind: CareEventKind; label: string; x: number; y: number; owner: string }[] = [
  { kind: 'order_placed', label: 'Order placed', x: 30, y: 50, owner: 'Ordering team' },
  { kind: 'specimen_collected', label: 'Specimen collected', x: 250, y: 194, owner: 'Collecting team' },
  { kind: 'specimen_received', label: 'Lab receipt', x: 470, y: 338, owner: 'Laboratory' },
  { kind: 'result_validated', label: 'Result available', x: 690, y: 338, owner: 'Laboratory' },
  { kind: 'result_acknowledged', label: 'Result acknowledged', x: 910, y: 50, owner: 'Responsible clinician' },
];

/** Evidence is per stage. Edges show the workflow, never proof of missing transitions. */
export function CarePipeline({ workspace, close, openEpisode }: {
  workspace: CareWorkspace; close: () => void; openEpisode: (id: string) => void;
}) {
  const [encounterId, setEncounterId] = useState(workspace.encounters[0]?.id ?? '');
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
  const cancelled = events.some(item => item.kind === 'order_cancelled');
  const handover = workspace.coordination?.handovers.filter(item => item.encounterId === encounter?.id).at(-1);
  const receivingStaff = workspace.coordination?.staff.find(item => item.id === handover?.toStaffId);
  const bed = encounter?.bedTransfer;
  const selectedStage = stages.find(item => item.kind === selected);
  const evidence = selectedStage ? pipelineEvidence(events, selectedStage.kind) : undefined;
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
  const taskOwner = selectedStage && ['specimen_collected', 'specimen_received', 'result_acknowledged'].includes(selected) ? workspace.tasks.find(task => task.encounterId === encounter?.id && task.orderId === order?.id
    && task.kind === (selected === 'result_acknowledged' ? 'result_acknowledgement' : 'specimen_receipt'))?.owner : undefined;
  const handoverStatus = handover?.status === 'pending' && handover.expiresAt <= new Date().toISOString() ? 'Expired' : handover?.status ?? 'Not requested';
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
            {stages.map(stage => { const result = pipelineEvidence(events, stage.kind); const recorded = !!result.event && !result.superseded;
              return <button key={stage.kind} type="button" className={`care-pipeline-node ${selected === stage.kind ? 'is-selected' : ''} ${recorded ? 'is-recorded' : ''}`}
                style={{ left: stage.x, top: stage.y }} aria-pressed={selected === stage.kind} onClick={() => setSelected(stage.kind)}>
                <span className="care-pipeline-node-heading">{stage.label}{recorded ? <Check size={15} aria-label="Recorded" /> : <CircleHelp size={15} aria-label="Unverified" />}</span>
                <span>{result.superseded ? 'New result needs review' : recorded ? 'Source recorded' : 'Evidence unverified'}</span>
                <small>{result.event ? <When value={result.event.occurredAt} short /> : 'No matching source event'}</small>
              </button>;
            })}
            <button type="button" className={`care-pipeline-node care-pipeline-coordination ${selected === 'handover' ? 'is-selected' : ''}`} style={{ left: 250, top: 490 }} aria-pressed={selected === 'handover'} onClick={() => setSelected('handover')}>
              <span className="care-pipeline-node-heading">Receiving responsibility</span><span>{handoverStatus}</span><small>{encounter.assignedTo}</small>
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
          {selectedStage ? <><p className="care-pipeline-detail-status">{evidence?.superseded ? 'A newer result needs acknowledgement.' : evidence?.event ? 'Matching source evidence recorded.' : 'No matching evidence has been received.'}</p>
            <dl><dt>Responsible team</dt><dd>{selected === 'result_acknowledged' ? encounter?.assignedTo : taskOwner ?? selectedStage.owner}</dd>
              {evidence?.event && <><dt>Source</dt><dd>{evidence.event.source} · {evidence.event.sourceRef}</dd><dt>Event occurred</dt><dd><When value={evidence.event.occurredAt} /></dd><dt>Received by workspace</dt><dd><When value={evidence.event.receivedAt} /></dd></>}</dl>
            {!evidence?.event && <p className="text-xs text-ink-soft">Later events do not prove this step was completed. Check the original source before acting.</p>}</> : selected === 'handover' ? <><p className="care-pipeline-detail-status">{handoverStatus}</p><dl><dt>Current responsibility</dt><dd>{encounter?.assignedTo}</dd>{handover && <><dt>Receiving clinician</dt><dd>{receivingStaff?.name ?? 'Recipient unavailable'}</dd><dt>Destination</dt><dd>{handover.destination}</dd><dt>Source</dt><dd>{handover.sourceRef}</dd><dt>Requested</dt><dd><When value={handover.requestedAt} /></dd></>}</dl><p className="text-xs text-ink-soft">The current team retains responsibility until the recipient accepts.</p></> : <><dl><dt>Recorded location</dt><dd>{encounter?.bed}</dd><dt>Destination</dt><dd>{bed?.destination ?? 'No transfer requested'}</dd><dt>Stage</dt><dd>{bed?.stage ?? 'Not recorded'}</dd></dl>{bed?.history.map(item => <p key={item.stage} className="text-xs text-ink-soft">{item.stage} · {item.sourceRef}<br /><When value={item.at} /></p>)}<p className="text-xs text-ink-soft">Bed allocation does not establish arrival or transfer of clinical responsibility.</p></>}
          {encounter && <Button size="sm" onClick={() => { close(); openEpisode(encounter.id); }}>Open encounter</Button>}
        </aside>
      </div>
      <footer className="care-pipeline-footer"><span>Connections show workflow · Missing evidence stays unknown</span><div>{(['HIS', 'LIS'] as const).map(source => <span key={source} className={!isFeedFresh(workspace.feeds[source]) ? 'care-pipeline-warning-text' : ''}>{source}: {!workspace.feeds[source].connected ? 'disconnected' : isFeedFresh(workspace.feeds[source]) ? 'recent sync' : 'out of date'} · <When value={workspace.feeds[source].lastSyncAt} short /></span>)}</div></footer>
    </DialogContent>
  </Dialog>;
}

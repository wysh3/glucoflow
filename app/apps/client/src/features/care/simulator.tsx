import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Database, FlaskConical, Radio, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Input, Label, Select } from '@glucoflow/ui';
import { randomIdempotencyKey } from '../../lib/api';
import type { CareEvent, CareEventKind, CareOrder, CareRole, CareWorkspace } from '@glucoflow/contracts';
import { eventLabels, IconBox, isFeedFresh, roleLabels, When } from './shared';
import type { CareWorkspaceState } from './use-care-workspace';

type Source = keyof CareWorkspace['feeds'];
const eventOptions: Record<CareRole, { kind: CareEventKind; source: Source }[]> = {
  doctor: [{ kind: 'result_acknowledged', source: 'HIS' }, { kind: 'order_cancelled', source: 'HIS' }],
  nurse: [{ kind: 'specimen_collected', source: 'HIS' }, { kind: 'handover_received', source: 'HIS' }],
  lab: [
    { kind: 'specimen_received', source: 'LIS' }, { kind: 'result_validated', source: 'LIS' },
    { kind: 'result_corrected', source: 'LIS' },
  ],
  coordinator: [{ kind: 'handover_received', source: 'HIS' }],
};


const prerequisites: Partial<Record<CareEventKind, CareEventKind[]>> = {
  order_cancelled: ['order_placed'],
  specimen_collected: ['order_placed'],
  specimen_received: ['specimen_collected'],
  result_validated: ['specimen_received'],
  result_acknowledged: ['result_validated', 'result_corrected'],
  result_corrected: ['result_validated', 'result_corrected'],
};

function blockedEvent(kind: CareEventKind, order: CareOrder | undefined, events: readonly CareEvent[]) {
  if (kind === 'handover_received') return '';
  if (!order) return 'Add a lab order for this encounter first.';
  const recorded = events.filter((item) => item.orderId === order.id);
  if (recorded.some((item) => item.kind === 'order_cancelled')) return 'This simulated order is cancelled. Choose another order.';
  const prerequisite = prerequisites[kind];
  const latestPrerequisite = prerequisite ? recorded.reduce(
    (last, item, index) => prerequisite.includes(item.kind) ? index : last, -1,
  ) : -1;
  if (prerequisite && latestPrerequisite < 0) {
    return `Record ${prerequisite.map((item) => eventLabels[item].toLowerCase()).join(' or ')} before this step.`;
  }
  const alreadyRecorded = kind === 'result_acknowledged' ? recorded.slice(latestPrerequisite + 1) : recorded;
  if (kind !== 'result_corrected' && alreadyRecorded.some((item) => item.kind === kind)) {
    return 'This step is already recorded. Choose another order or event type.';
  }
  return '';
}

export function FeedStatus({ source, feed }: { source: Source; feed: CareWorkspace['feeds'][Source] }) {
  const fresh = isFeedFresh(feed);
  const label = fresh ? 'Connected' : feed.connected ? 'Stale · status unknown' : 'Disconnected · status unknown';
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge tone={fresh ? 'primary' : 'review'} className="whitespace-normal">
        <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${fresh ? 'bg-primary' : 'bg-review'}`} />
        {source} {label}
      </Badge>
      <span className="text-xs text-ink-soft">Last sync <When value={feed.lastSyncAt} short /></span>
    </span>
  );
}

export function Simulator({ workspace, state, openSource, openDetails }: {
  workspace: CareWorkspace;
  state: CareWorkspaceState;
  openSource: (event: CareEvent) => void;
  openDetails: (taskId: string) => void;
}) {
  const [encounterId, setEncounterId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [kind, setKind] = useState<CareEventKind>();
  const [sourceRef, setSourceRef] = useState('');
  const [automaticRef, setAutomaticRef] = useState('');
  const [receipt, setReceipt] = useState<{ source: Source; ref: string } | null>(null);
  const receiptPanel = useRef<HTMLDivElement>(null);
  const options = eventOptions[workspace.role];
  const selectedEvent = options.find((item) => item.kind === kind) ?? options[0]!;
  const isHandover = selectedEvent.kind === 'handover_received';
  const eligible = (order: CareOrder) => !blockedEvent(selectedEvent.kind, order, workspace.events);
  const defaultOrder = isHandover ? undefined : workspace.orders.find(eligible);
  const actualEncounter = workspace.encounters.find((item) => item.id === (encounterId || defaultOrder?.encounterId)) ?? workspace.encounters[0];
  const orders = workspace.orders.filter((item) => item.encounterId === actualEncounter?.id);
  const selectedOrder = orders.find((item) => item.id === orderId) ?? orders.find(eligible) ?? orders[0];
  const busy = !!state.busy;
  const connected = workspace.feeds[selectedEvent.source].connected;
  const replayRef = sourceRef.trim() || automaticRef;
  const replay = !!replayRef && workspace.events.some((item) =>
    item.source === selectedEvent.source && item.sourceRef === replayRef && item.kind === selectedEvent.kind &&
    item.encounterId === actualEncounter?.id && item.orderId === (isHandover ? null : selectedOrder?.id));
  const blocking = replay ? '' : blockedEvent(selectedEvent.kind, selectedOrder, workspace.events);
  const disconnected = !connected && !replay;
  const emitted = receipt && workspace.events.find((item) => item.source === receipt.source && item.sourceRef === receipt.ref);
  const completed = emitted ? workspace.tasks.filter((task) => task.status === 'source_confirmed' && task.completionEventId === emitted.id) : [];
  const justRecorded = emitted && emitted.kind === selectedEvent.kind && emitted.encounterId === actualEncounter?.id &&
    emitted.orderId === (isHandover ? null : selectedOrder?.id);

  useEffect(() => {
    if (emitted?.id) receiptPanel.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [emitted?.id]);

  return (
    <details id="care-simulator" className="group mt-6 scroll-mt-20 overflow-hidden rounded-2xl border border-[#c3d9d0] bg-white">
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 p-3.5 marker:content-none sm:px-5 [&::-webkit-details-marker]:hidden">
        <IconBox icon={FlaskConical} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Hospital simulator</span>
          <span className="block text-xs text-ink-soft">Switch roles, emit source events and test feed interruptions.</span>
        </span>
        <Badge className="hidden sm:inline-flex">Synthetic</Badge>
        <ChevronDown size={18} className="shrink-0 text-ink-soft transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="border-t border-line bg-[#f4f8f5] p-3.5 sm:p-5">
        <p className="mb-3 text-sm leading-relaxed text-ink-soft">Use fictional encounter details and source references. The simulator writes events inside this workspace only.</p>
        {state.errorFor === 'set_role' || state.errorFor === 'set_feed' ? (
          <p className="mb-3 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-danger" role="alert">{state.error}</p>
        ) : null}
        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="grid min-w-0 gap-3">
            <Card className="p-3.5">
              <div className="mb-2 flex items-center gap-2"><Radio size={16} className="text-primary" aria-hidden /><Label htmlFor="care-role">{state.team.data?.access.shared ? 'Assigned team role' : 'Simulation role'}</Label></div>
              <Select id="care-role" value={state.team.data?.access.role ?? workspace.role} disabled={busy || !state.team.isSuccess || state.team.data.access.shared} onChange={async (event) => {
                const success = await state.command({ type: 'set_role', role: event.target.value as CareRole });
                if (success) { setKind(undefined); setAutomaticRef(''); }
              }}>
                {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">{state.team.data?.access.shared ? 'This role is assigned by the workspace administrator. Simulation role switching is disabled.' : state.team.isError ? 'Team access could not be verified. Role changes are unavailable.' : !state.team.isSuccess ? 'Checking workspace access…' : 'The selected role changes simulator actions. Your signed-in account stays the same.'}</p>
            </Card>
            {(['HIS', 'LIS'] as const).map((source) => {
              const feed = workspace.feeds[source];
              const stale = feed.connected && !isFeedFresh(feed);
              return (
                <Card key={source} className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                  <FeedStatus source={source} feed={feed} />
                  <div className="flex flex-wrap gap-1.5">
                    {stale ? <Button type="button" size="sm" disabled={busy} onClick={() => void state.command({ type: 'set_feed', source, connected: true })}>
                      <RefreshCw size={14} aria-hidden /> Resync {source}
                    </Button> : null}
                    <Button type="button" size="sm" disabled={busy} onClick={() => void state.command({ type: 'set_feed', source, connected: !feed.connected })}>
                      {feed.connected ? 'Disconnect' : 'Reconnect'} {source}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
          <Card className="min-w-0 p-3.5 sm:p-4">
            <form className="grid gap-2.5" onSubmit={async (event) => {
              event.preventDefault();
              if (!actualEncounter || blocking || disconnected) return;
              const ref = sourceRef.trim() || automaticRef || `SIM-${selectedEvent.source}-${randomIdempotencyKey()}`;
              setEncounterId(actualEncounter.id);
              setOrderId(selectedOrder?.id ?? '');
              setAutomaticRef(ref);
              const sent = await state.command({
                type: 'source_event', encounterId: actualEncounter.id, orderId: isHandover ? null : selectedOrder?.id ?? null,
                kind: selectedEvent.kind, source: selectedEvent.source, sourceRef: ref,
              });
              if (sent) {
                setSourceRef('');
                setAutomaticRef('');
                setReceipt({ source: selectedEvent.source, ref });
              }
            }}>
              <h3 className="mb-0.5 flex items-center gap-2 text-sm font-semibold"><Database size={16} className="text-primary" aria-hidden /> Emit a source event</h3>
              <div className="grid gap-1">
                <Label htmlFor="sim-encounter">Encounter</Label>
                <Select id="sim-encounter" value={actualEncounter?.id ?? ''} onChange={(event) => {
                  setEncounterId(event.target.value); setOrderId(''); setAutomaticRef('');
                }}>
                  {workspace.encounters.map((item) => <option key={item.id} value={item.id}>{item.patientName} · {item.bed}</option>)}
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="sim-event">Event type</Label>
                <Select id="sim-event" value={selectedEvent.kind} onChange={(event) => {
                  setKind(event.target.value as CareEventKind); setAutomaticRef('');
                }}>
                  {options.map((item) => <option key={item.kind} value={item.kind}>{eventLabels[item.kind]} · {item.source}</option>)}
                </Select>
              </div>
              {!isHandover ? (
                <div className="grid gap-1">
                  <Label htmlFor="sim-order">Order</Label>
                  <Select id="sim-order" value={selectedOrder?.id ?? ''} disabled={!orders.length} onChange={(event) => { setOrderId(event.target.value); setAutomaticRef(''); }}>
                    {!orders.length ? <option value="">No orders for this encounter</option> : null}
                    {orders.map((item) => <option key={item.id} value={item.id}>{item.testName} · {item.specimenId}</option>)}
                  </Select>
                </div>
              ) : null}
              <div className="grid gap-1">
                <Label htmlFor="sim-reference">Source reference (optional)</Label>
                <Input id="sim-reference" maxLength={100} value={sourceRef} onChange={(event) => {
                  setSourceRef(event.target.value); setAutomaticRef('');
                }} placeholder="Generated if left blank" />
              </div>
              {state.errorFor === 'source_event' ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
              {disconnected || (blocking && !justRecorded) ? <p className="text-sm text-review">
                {disconnected ? `Reconnect ${selectedEvent.source} before emitting this event.` : blocking}
              </p> : null}
              <Button variant="primary" type="submit" className="mt-1 justify-self-end"
                disabled={busy || !actualEncounter || disconnected || !!blocking}>Emit synthetic event</Button>
            </form>
            {emitted ? (
              <div ref={receiptPanel} className="mt-3 scroll-mb-20 rounded-xl border border-success/25 bg-success-bg p-3 text-sm">
                <p className="flex items-start gap-2 font-medium text-success" role="status">
                  <Check size={16} className="mt-0.5 shrink-0" aria-hidden /> {emitted.source} · {eventLabels[emitted.kind]} recorded
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => openSource(emitted)}>Inspect source event</Button>
                  {completed.map((task) => (
                    <Button key={task.id} type="button" size="sm" onClick={() => openDetails(task.id)}>
                      <span>Inspect completed task<span className="sr-only"> {task.title}</span></span><ArrowRight size={14} aria-hidden />
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </details>
  );
}

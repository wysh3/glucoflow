import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, BellRing, CheckCircle2, Clock3, FlaskConical, Play, ShieldCheck } from 'lucide-react';
import type { CareEvent, CareWorkspace } from '@glucoflow/contracts';
import { pipelineStages } from './pipeline-evidence';
import { roleLabels } from './shared';
import type { CareWorkspaceState } from './use-care-workspace';
import { formatElapsed, shiftGlance, unitBoard, type BoardRow, type FeedStep } from './unit-board';

const stageShort = ['Ordered', 'Collected', 'At lab', 'Result', 'Acknowledged'];

interface FeedReceipt { ref: string; source: CareEvent['source']; actor: string; patient: string; label: string }

/** Ward-style board: every encounter's next step, derived only from recorded source events. */
export function UnitBoard({ workspace, state, shared, openSource }: {
  workspace: CareWorkspace;
  state: CareWorkspaceState;
  shared?: boolean;
  openSource: (event: CareEvent) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [now, setNow] = useState(() => Date.now());
  const [receipt, setReceipt] = useState<FeedReceipt | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [feedError, setFeedError] = useState('');
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const rows = useMemo(() => unitBoard(workspace, now), [workspace, now]);
  const glance = shiftGlance(rows, workspace);
  const emitted = receipt ? workspace.events.find((item) => item.source === receipt.source && item.sourceRef === receipt.ref) : undefined;
  const closed = emitted ? workspace.tasks.filter((task) => task.completionEventId === emitted.id && task.status === 'source_confirmed') : [];
  const labFeed = rows.findIndex((row) => row.feed?.kind === 'specimen_received');
  const firstFeed = labFeed >= 0 ? labFeed : rows.findIndex((row) => !!row.feed);
  const firstPlain = rows.findIndex((row) => !row.corrected);
  const canSimulate = !shared && !workspace.archivedAt && !!workspace.coordination?.staff.length;

  const openEpisode = (encounterId: string) => {
    const next = new URLSearchParams(params);
    next.set('encounter', encounterId);
    setParams(next, { preventScrollReset: true });
  };

  async function send(row: BoardRow, step: FeedStep) {
    const staff = workspace.coordination?.staff ?? [];
    const original = workspace.demoStaffId;
    const person = workspace.role === step.role
      ? staff.find((item) => item.id === original) ?? staff.find((item) => item.role === step.role && !item.userId)
      : staff.find((item) => item.role === step.role && !item.userId);
    if (!person) return;
    setSendingId(row.encounter.id);
    setReceipt(null);
    setFeedError('');
    try {
      const switched = workspace.role !== step.role;
      if (switched && !await state.command({ type: 'set_demo_staff', staffId: person.id })) return;
      const ref = `${step.source}-FEED-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const ok = await state.command({
        type: 'source_event', encounterId: step.encounterId, orderId: step.orderId, kind: step.kind, source: step.source, sourceRef: ref,
      });
      // Return to the evaluator's own perspective; the event keeps its recording actor.
      if (switched && original) await state.command({ type: 'set_demo_staff', staffId: original });
      if (!ok) setFeedError('The simulated hospital system could not record that event. The workspace may have changed; try again.');
      if (ok) setReceipt({ ref, source: step.source, actor: `${person.name}, ${roleLabels[person.role]}`, patient: row.encounter.patientName, label: step.label });
    } finally {
      setSendingId(null);
    }
  }

  return <section className="care-board" aria-label="Unit board" data-tour="unit-board">
    <div className="care-glance" data-tour="shift-glance">
      <Glance tone="danger" icon={AlertTriangle} value={glance.overdue} label="Overdue or corrected" />
      <Glance tone="review" icon={BellRing} value={glance.acknowledgement} label="Results to acknowledge" />
      <Glance tone="primary" icon={Clock3} value={glance.approval} label="Awaiting your approval" />
      <Glance tone="done" icon={ShieldCheck} value={glance.confirmed} label="Closed by source evidence" />
    </div>
    {feedError ? <p className="care-feed-error" role="alert">{feedError}</p> : null}
    {receipt ? <div className="care-feed-receipt" role="status" data-tour="feed-receipt">
      <CheckCircle2 size={18} aria-hidden />
      <div>
        <strong>{receipt.source} · {receipt.label} recorded for {receipt.patient}</strong>
        <span>Recorded as {receipt.actor} (fictional). {closed.length
          ? <>Gluco closed “{closed.map((task) => task.title).join('”, “')}” because the matching source event arrived. No one had to mark it done.</>
          : <>The pipeline moved to the next step. Follow-up stays open until its own source evidence arrives.</>}</span>
      </div>
      {emitted ? <button type="button" onClick={() => openSource(emitted)}>View source</button> : null}
    </div> : null}
    <div className="care-board-head"><h3>Unit board</h3><span>{rows.length} fictional encounters · sorted by urgency</span></div>
    <ol className="care-board-list">
      {rows.map((row, index) => <li key={row.encounter.id} data-tone={row.tone} className={emitted?.encounterId === row.encounter.id ? 'is-updated' : undefined}
        {...(row.corrected && row.tone === 'danger' ? { 'data-tour': 'board-corrected' } : index === firstPlain ? { 'data-tour': 'board-first-row' } : {})}>
        <button type="button" className="care-board-patient" onClick={() => openEpisode(row.encounter.id)} aria-label={`Open ${row.encounter.patientName} episode`}>
          <span className="care-board-avatar" aria-hidden>{row.encounter.patientName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
          <span className="min-w-0">
            <strong>{row.encounter.patientName}</strong>
            <small>{row.encounter.bed} · {row.encounter.patientCode} · {row.encounter.assignedTo}</small>
          </span>
        </button>
        <div className="care-board-order">
          <span className="care-board-test"><FlaskConical size={13} aria-hidden /> {row.order?.testName ?? 'No order'}</span>
          <span className="care-board-track" aria-label={`Pipeline: ${pipelineStages.map((stage, i) => `${stage.label} ${row.done[i] ? 'recorded' : 'not recorded'}`).join(', ')}`}>
            {stageShort.map((label, i) => <span key={label} data-done={row.done[i]} data-next={row.next?.kind === pipelineStages[i]?.kind} title={label}><i />{label}</span>)}
          </span>
        </div>
        <div className="care-board-status">
          <span className="care-board-chip" data-tone={row.tone}>{row.status}</span>
          <small>{row.order ? `${formatElapsed(row.elapsedMinutes)} since order · target ${formatElapsed(row.order.targetMinutes)}` : ''}</small>
        </div>
        {canSimulate && row.feed ? <button type="button" className="care-board-feed" disabled={!!state.busy}
          onClick={() => void send(row, row.feed!)} {...(index === firstFeed ? { 'data-tour': 'feed-button' } : {})}
          title={`Simulate the ${row.feed.source} sending “${row.feed.label}”, recorded by a fictional ${roleLabels[row.feed.role].toLowerCase()}`}>
          <Play size={12} aria-hidden /> {sendingId === row.encounter.id ? 'Sending…' : <>Simulate {row.feed.source}: {row.feed.label}</>}
        </button> : <span className="care-board-feed-placeholder" />}
      </li>)}
    </ol>
    {canSimulate ? <p className="care-board-note">“Simulate” plays the hospital or lab system for this fictional demo. The event is recorded by a fictional staff member with the right role; the server refuses it from any other role.</p> : null}
  </section>;
}

function Glance({ tone, icon: Icon, value, label }: { tone: string; icon: typeof Clock3; value: number; label: string }) {
  return <div className="care-glance-item" data-tone={tone}><Icon size={16} aria-hidden /><strong>{value}</strong><span>{label}</span></div>;
}

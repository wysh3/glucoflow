import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bed, ChevronDown, ClipboardList, FlaskConical,
  Hospital, Plus, Users,
} from 'lucide-react';
import { Button, Input, Label, Select, Textarea } from '@glucoflow/ui';
import { BedTransferPanel } from './bed-transfer';
import { ShiftHandover } from './shift-handover';
import type { CareEncounter, CareEvent, CareWorkspace } from '@glucoflow/contracts';
import {
  canManage, CareDialog, EmptyPanel, SectionHeading, SourceChip, When,
} from './shared';
import type { CareWorkspaceState } from './use-care-workspace';

type TeamsProps = {
  workspace: CareWorkspace;
  state: CareWorkspaceState;
  openSource: (event: CareEvent) => void;
};

type TeamForm = 'encounter' | CareEncounter;

export function TeamsPanel({ workspace, state, openSource }: TeamsProps) {
  const [form, setForm] = useState<TeamForm | null>(null);
  const close = () => { setForm(null); state.clearError(); };
  return (
    <>
      <SectionHeading title="Encounters" description="Assigned encounters, documented context and source event history." action={
        canManage(workspace.role) ? <Button type="button" variant="primary" disabled={!!state.busy}
          onClick={() => { state.clearError(); setForm('encounter'); }}>
          <Plus size={16} aria-hidden /> Add synthetic encounter
        </Button> : null
      } />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-label="Assigned encounters" className="min-w-0 space-y-3">
          {workspace.encounters.length ? workspace.encounters.map((encounter) => (
            <EncounterCard key={encounter.id} encounter={encounter} workspace={workspace} state={state} openSource={openSource}
              addOrder={() => { state.clearError(); setForm(encounter); }} />
          )) : <EmptyPanel icon={Users} title="No encounters">Add a synthetic encounter to begin tracking hospital events.</EmptyPanel>}
        </section>
        <div className="min-w-0 space-y-4"><ShiftHandover workspace={workspace} state={state} openSource={openSource} /></div>
      </div>
      {form === 'encounter' ? <AddEncounter state={state} close={close} /> : null}
      {form && form !== 'encounter' ? <AddOrder encounter={form} state={state} close={close} /> : null}
    </>
  );
}

function EncounterCard({ encounter, workspace, state, openSource, addOrder }: TeamsProps & { encounter: CareEncounter; addOrder: () => void }) {
  const [params, setParams] = useSearchParams();
  const orders = workspace.orders.filter((item) => item.encounterId === encounter.id);
  const events = workspace.events.filter((item) => item.encounterId === encounter.id).reverse();
  const initial = encounter.patientName.split(/\s+/).slice(0, 2).map((name) => name[0]).join('');
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-surface"><details className="group">
      <summary className="flex min-h-[72px] cursor-pointer list-none items-center gap-3 p-3.5 marker:content-none sm:p-4 [&::-webkit-details-marker]:hidden">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e6f3ef] text-sm font-semibold text-primary" aria-hidden>{initial}</span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold">{encounter.patientName}</span>
          <span className="mt-0.5 block text-xs text-ink-soft">{encounter.patientCode} · {encounter.bed} · {encounter.assignedTo}</span>
          {encounter.bedTransfer ? <span className="mt-1 block text-xs text-ink-soft">Transfer {encounter.bedTransfer.stage} · {encounter.bedTransfer.destination}</span> : null}
        </span>
        <ChevronDown size={18} className="shrink-0 text-ink-soft transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="space-y-4 border-t border-line p-3.5 sm:p-4">
        <BedTransferPanel encounter={encounter} workspace={workspace} state={state} />
        <section aria-label="Documented context">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Bed size={16} className="text-primary" aria-hidden /> Documented context</h3>
          <p className="mt-1 text-xs text-ink-soft">Admitted <When value={encounter.admittedAt} /></p>
          {encounter.documentedContext.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
              {encounter.documentedContext.map((line, index) => <li className="break-words" key={index}>{line}</li>)}
            </ul>
          ) : <p className="mt-1 text-sm text-ink-soft">No context was entered for this encounter.</p>}
        </section>
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><FlaskConical size={16} className="text-primary" aria-hidden /> Lab orders</h3>
            {workspace.role === 'doctor' ? (
              <Button type="button" size="sm" disabled={!!state.busy || !workspace.feeds.HIS.connected} onClick={addOrder}>
                <Plus size={14} aria-hidden /> Add lab order
              </Button>
            ) : null}
          </div>
          {workspace.role === 'doctor' && !workspace.feeds.HIS.connected ? <p className="mt-1 text-xs text-review">Reconnect HIS before placing an order.</p> : null}
          {orders.length ? (
            <ul className="mt-2 grid gap-2">
              {orders.map((order) => {
                const latest = events.find((event) => event.orderId === order.id);
                return (
                  <li key={order.id} className="rounded-xl border border-line bg-canvas p-3">
                    <p className="break-words text-sm font-medium">{order.testName}</p>
                    <p className="mt-1 text-xs text-ink-soft">{order.specimenId} · {order.targetMinutes} min demo target</p>
                    {latest ? <div className="mt-2"><SourceChip event={latest} open={openSource} /></div> : null}
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-2 text-sm text-ink-soft">No laboratory orders are recorded.</p>}
        </section>
        <section>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ClipboardList size={16} className="text-primary" aria-hidden /> Source timeline</h3>
          {events.length ? (
            <ol className="mt-2 divide-y divide-line">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-1.5 py-1.5 text-xs text-ink-soft">
                  <SourceChip event={event} open={openSource} /><When value={event.occurredAt} />
                </li>
              ))}
            </ol>
          ) : <p className="mt-1 text-sm text-ink-soft">No source events have arrived.</p>}
        </section>
      </div>
    </details><div className="border-t border-line px-3.5 py-2"><Button type="button" size="sm" variant="quiet" aria-label={`Open episode for ${encounter.patientName}`} onClick={() => {
      const next = new URLSearchParams(params); next.set('encounter', encounter.id); setParams(next, { preventScrollReset: true });
    }}>Open episode</Button></div></div>
  );
}

function AddEncounter({ state, close }: { state: CareWorkspaceState; close: () => void }) {
  const [name, setName] = useState('');
  const [bed, setBed] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [context, setContext] = useState('');
  const lines = context.split('\n').map((line) => line.trim()).filter(Boolean);
  const invalidContext = lines.length > 6 || lines.some((line) => line.length > 300);
  return (
    <CareDialog open onOpenChange={(open) => { if (!open && !state.busy) close(); }} title="Add synthetic encounter"
      description="Enter fictional information for this simulator.">
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim() || !bed.trim() || invalidContext) return;
        if (await state.command({ type: 'add_encounter', patientName: name.trim(), bed: bed.trim(), documentedContext: lines, ...(assignedTo.trim() ? {assignedTo:assignedTo.trim()} : {}) })) close();
      }}>
        <div className="grid gap-1">
          <Label htmlFor="care-scenario">Fictional scenario</Label>
          <Select id="care-scenario" defaultValue="" disabled={!!state.busy} onChange={(event) => {
            const scenario = event.target.value;
            if (!scenario) { setName(''); setBed(''); setContext(''); return; }
            setName(scenario === 'dka' ? 'Nila Sen (synthetic)' : 'Kabir Das (synthetic)');
            setBed('Demo transfer bay');
            setContext(scenario === 'dka'
              ? 'Fictional admission note documents DKA and known CKD.\nRenal-team handover acknowledgement is not yet recorded in this simulation.\nScenario tests ownership and handover evidence, not clinical management.'
              : 'Fictional admission note documents HHS.\nTransfer documentation awaits receiving-team acknowledgement in this simulation.\nScenario tests documentation continuity, not diagnosis or treatment.');
          }}>
            <option value="">Custom fictional encounter</option>
            <option value="dka">DKA · renal-team handover</option>
            <option value="hhs">HHS · transfer handover</option>
          </Select>
          <p className="text-xs text-ink-soft">Templates fill editable context only. They do not recommend tests, doses or treatment.</p>
        </div>
        <div className="grid gap-1"><Label htmlFor="new-care-name">Synthetic patient name</Label><Input id="new-care-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="grid gap-1"><Label htmlFor="new-care-bed">Ward or bed</Label><Input id="new-care-bed" required maxLength={40} value={bed} onChange={(event) => setBed(event.target.value)} /></div>
        <div className="grid gap-1"><Label htmlFor="new-care-owner">Recorded responsible clinician or team</Label><Input id="new-care-owner" maxLength={80} value={assignedTo} onChange={event=>setAssignedTo(event.target.value)} placeholder="Leave empty if responsibility is unconfirmed" /><p className="text-xs text-ink-soft">Transcribe documented responsibility. Registration does not establish a clinician’s acceptance.</p></div>
        <div className="grid gap-1">
          <Label htmlFor="new-care-context">Documented context (optional)</Label>
          <Textarea id="new-care-context" maxLength={1805} value={context} onChange={(event) => setContext(event.target.value)} placeholder="One documented detail per line" />
          <p className={`text-xs ${invalidContext ? 'text-danger' : 'text-ink-soft'}`}>Up to six lines, with 300 characters per line.</p>
        </div>
        {state.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
        <Button type="submit" variant="primary" disabled={!!state.busy || !name.trim() || !bed.trim() || invalidContext} className="justify-self-end">
          <Hospital size={16} aria-hidden /> Create encounter
        </Button>
      </form>
    </CareDialog>
  );
}

function AddOrder({ encounter, state, close }: { encounter: CareEncounter; state: CareWorkspaceState; close: () => void }) {
  const [testName, setTestName] = useState('');
  const [target, setTarget] = useState('60');
  const targetMinutes = Number(target);
  const ready = !!testName.trim() && Number.isInteger(targetMinutes) && targetMinutes >= 1 && targetMinutes <= 1440;
  return (
    <CareDialog open onOpenChange={(open) => { if (!open && !state.busy) close(); }} title="Add synthetic lab order"
      description={`${encounter.patientName} · ${encounter.bed}. A matching HIS order event is recorded.`}>
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        if (!ready) return;
        if (await state.command({ type: 'add_order', encounterId: encounter.id, testName: testName.trim(), targetMinutes })) close();
      }}>
        <div className="grid gap-1"><Label htmlFor="new-care-test">Test name</Label><Input id="new-care-test" required maxLength={100} value={testName} onChange={(event) => setTestName(event.target.value)} /></div>
        <div className="grid gap-1">
          <Label htmlFor="new-care-target">Demo handoff target in minutes</Label>
          <Input id="new-care-target" required type="number" min={1} max={1440} step={1} value={target} onChange={(event) => setTarget(event.target.value)} />
          <p className="text-xs text-ink-soft">The target applies to simulated operational handoffs.</p>
        </div>
        {state.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
        <Button type="submit" variant="primary" disabled={!!state.busy || !ready} className="justify-self-end">Create lab order</Button>
      </form>
    </CareDialog>
  );
}

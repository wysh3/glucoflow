import { useState, type FormEvent, type ReactNode } from 'react';
import { Button, Input, Label } from '@glucoflow/ui';
import type { CareCapability, CareCoordinationCommand, CareRole, CareStaff, CareWorkspace } from '@glucoflow/contracts';
import { CareDialog, When, roleLabels, taskStatusLabels } from './shared';
import { BedTransferPanel } from './bed-transfer';
import type { CareWorkspaceState } from './use-care-workspace';

const capabilities: Record<CareCapability, string> = {
  specimen_followup: 'Specimen follow-up', result_followup: 'Result follow-up',
  handover: 'Receiving care', documentation: 'Documentation',
};
const selectClass = 'h-10 w-full rounded-lg border border-border bg-white px-3 text-sm';
function localTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function Field({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return <div className="grid gap-1.5"><Label htmlFor={`coord-${name}`}>{label}</Label>{children}</div>;
}

/** Coordination records ownership and evidence; it never interprets clinical measurements. */
export function EpisodeCoordination({ workspace, encounterId, state, close, actorId }: {
  workspace: CareWorkspace; encounterId: string; state: CareWorkspaceState;
  close: () => void; actorId?: string;
}) {
  const [tab, setTab] = useState<'work' | 'handover' | 'records'>('work');
  const [form, setForm] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [validation, setValidation] = useState('');
  const encounter = workspace.encounters.find(item => item.id === encounterId);
  const data = workspace.coordination ?? { staff: [], assignments: [], handovers: [], records: [] };
  const now = new Date().toISOString();
  const busy = !!state.busy;
  const manager = ['doctor', 'coordinator'].includes(workspace.role);
  const shared = state.team.data?.access.shared;
  // Unresolved access is deliberately not treated as a personal simulation.
  const canRespond = (staff?: CareStaff) => !!staff && staff.role === workspace.role
    && (shared === false || (shared === true && !!actorId && staff.userId === actorId));
  const tasks = workspace.tasks.filter(task => task.encounterId === encounterId);
  const assignments = data.assignments.filter(item => tasks.some(task => task.id === item.taskId));
  const handovers = data.handovers.filter(item => item.encounterId === encounterId);
  const pendingHandover = handovers.find(item => item.status === 'pending' && item.expiresAt > now);
  const records = data.records.filter(item => item.encounterId === encounterId);
  const staffFor = (id: string) => data.staff.find(item => item.id === id);
  const openForm = (value: string | null) => { setForm(value); setValidation(''); setNotice(''); state.clearError(); };
  const submit = async (command: CareCoordinationCommand) => {
    setValidation(''); setNotice('');
    if (await state.command(command)) { setForm(null); setNotice('Saved. The shared record is updated.'); }
  };
  const handleForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? '').trim();
    const iso = (key: string) => new Date(text(key)).toISOString();
    try {
      if (form === 'staff') {
        const selected = values.getAll('capabilities') as CareCapability[];
        if (!selected.length) { setValidation('Choose at least one work capability.'); return; }
        if (shared === undefined) { setValidation('Workspace access is still loading. Try again once it is available.'); return; }
        if (shared && !state.team.data?.members.some(member => member.active && member.userId === text('userId') && member.role === text('role'))) {
          setValidation('Choose an active workspace account with the same role.'); return;
        }
        await submit({ type: 'coordination', action: 'register_staff', name: text('name'), team: text('team'),
          role: text('role') as CareRole, userId: text('userId') || null, capabilities: selected, shiftEnd: iso('shiftEnd') });
      } else if (form?.startsWith('capacity:')) {
        await submit({ type: 'coordination', action: 'confirm_capacity', staffId: form.slice(9),
          slots: Number(text('slots')), validUntil: iso('validUntil'), sourceRef: text('sourceRef') });
      } else if (form?.startsWith('complete:')) {
        await submit({ type: 'coordination', action: 'complete_assignment', assignmentId: form.slice(9), sourceRef: text('sourceRef') });
      } else if (form === 'offer') {
        const task = tasks.find(item => item.id === text('taskId'));
        const capability: CareCapability = task?.kind === 'specimen_receipt' ? 'specimen_followup' : task?.kind === 'result_acknowledgement' ? 'result_followup' : 'handover';
        if (!staffFor(text('staffId'))?.capabilities.includes(capability)) {
          setValidation(`This task needs ${capabilities[capability].toLowerCase()}. Choose a team member with that capability.`); return;
        }
        await submit({ type: 'coordination', action: 'offer_task', taskId: text('taskId'), staffId: text('staffId'),
          durationMinutes: Number(text('durationMinutes')), sourceRef: text('sourceRef') });
      } else if (form === 'handover') {
        await submit({ type: 'coordination', action: 'request_episode_handover', encounterId, staffId: text('staffId'),
          destination: text('destination'), durationMinutes: Number(text('durationMinutes')), sourceRef: text('sourceRef') });
      } else if (form === 'record') {
        await submit({ type: 'coordination', action: text('kind') === 'followup' ? 'record_followup' : 'record_observation',
          encounterId, label: text('label'), value: text('value'), unit: text('unit'), occurredAt: iso('occurredAt'), sourceRef: text('sourceRef') });
      }
    } catch { setValidation('Check the date and time before saving.'); }
  };
  const availableTasks = tasks.filter(task => ['monitoring', 'awaiting_evidence', 'paused'].includes(task.status)
    && !assignments.some(item => item.taskId === task.id && (item.status === 'accepted' || (item.status === 'offered' && item.expiresAt > now))));
  const readyStaff = data.staff.filter(staff => staff.shiftEnd > now && staff.capacity && staff.capacity.validUntil > now
    && staff.capacity.slots > data.assignments.filter(item => item.staffId === staff.id && (item.status === 'accepted' || (item.status === 'offered' && item.expiresAt > now))).length);
  const input = (name: string, label: string, options: { type?: string; value?: string; required?: boolean; min?: number; max?: number } = {}) =>
    <Field name={name} label={label}><Input id={`coord-${name}`} name={name} type={options.type ?? 'text'} defaultValue={options.value}
      required={options.required !== false} min={options.min} max={options.max} maxLength={600} /></Field>;
  const select = (name: string, label: string, children: ReactNode) => <Field name={name} label={label}>
    <select id={`coord-${name}`} name={name} required className={selectClass} defaultValue=""><option value="" disabled>Choose…</option>{children}</select>
  </Field>;
  if (!encounter) return null;
  return <CareDialog open title="Coordinate care" description={`${encounter.patientName} · ${encounter.patientCode} · Synthetic workspace`}
    onOpenChange={open => { if (!open) close(); }}>
    <div className="grid gap-4 p-5 text-sm">
      <div className="flex flex-wrap gap-2" aria-label="Coordination sections">
        {(['work', 'handover', 'records'] as const).map(value => <Button key={value} size="sm" variant={tab === value ? 'primary' : 'quiet'}
          aria-pressed={tab === value} onClick={() => { setTab(value); openForm(null); }}>{value === 'work' ? 'Team & work' : value === 'handover' ? 'Handover' : 'Source records'}</Button>)}
      </div>
      {notice && <p role="status" className="text-primary">{notice}</p>}
      {tab === 'work' && <>
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Assigned work</h3>
          {manager && <Button size="sm" variant="quiet" disabled={!availableTasks.length || !readyStaff.length || busy} onClick={() => openForm('offer')}>Offer work</Button>}</div>
        {!assignments.length && <p className="text-ink-soft">No work has been offered for this encounter. Confirm team capacity, then offer an approved task.</p>}
        <div className="divide-y divide-border">{assignments.slice().reverse().map(item => {
          const staff = staffFor(item.staffId); const task = tasks.find(candidate => candidate.id === item.taskId);
          const pending = item.status === 'offered' && item.expiresAt > now;
          return <article key={item.id} className="grid gap-1.5 py-3"><div className="flex flex-wrap justify-between gap-2"><strong>{task?.title ?? 'Task'}</strong>
            <span className="text-ink-soft">{item.status === 'offered' && !pending ? 'Offer expired' : item.status}</span></div>
            <p>{staff?.name ?? 'Team member'} · {staff?.team}</p>
            <p className="text-xs text-ink-soft">Source: {item.sourceRef}{item.completionRef ? ` · Completion: ${item.completionRef}` : ''}</p>
            {pending && <p className="text-xs text-ink-soft">Respond by <When value={item.expiresAt} /></p>}
            {canRespond(staff) && pending && <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void submit({ type: 'coordination', action: 'respond_offer', assignmentId: item.id, decision: 'accept' })}>Accept work</Button>
              <Button size="sm" variant="quiet" disabled={busy} onClick={() => void submit({ type: 'coordination', action: 'respond_offer', assignmentId: item.id, decision: 'decline' })}>Decline</Button></div>}
            {pending && !canRespond(staff) && <p className="text-xs text-ink-soft">Waiting for {staff?.name ?? 'the named recipient'} to respond.</p>}
            {canRespond(staff) && item.status === 'accepted' && <Button size="sm" variant="quiet" className="justify-self-start" onClick={() => openForm(`complete:${item.id}`)}>Record work completed</Button>}
          </article>;
        })}</div>
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Team capacity</h3>{manager && <Button size="sm" variant="quiet" onClick={() => openForm('staff')}>Add member</Button>}</div>
        {!data.staff.length && <p className="text-ink-soft">Add the synthetic team members participating in this workspace. Availability starts unconfirmed.</p>}
        <div className="divide-y divide-border">{data.staff.map(staff => <div key={staff.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div><p className="font-medium">{staff.name} <span className="font-normal text-ink-soft">· {staff.team}</span></p>
            <p className="text-xs text-ink-soft">{roleLabels[staff.role]} · {staff.shiftEnd <= now ? 'Shift ended' : staff.capacity && staff.capacity.validUntil > now ? `${staff.capacity.slots} confirmed slot(s)` : 'Capacity unconfirmed'}</p>
            {staff.capacity && <p className="text-xs text-ink-soft">{staff.capacity.sourceRef} · Valid until <When value={staff.capacity.validUntil} /></p>}</div>
          {workspace.role === 'coordinator' && staff.shiftEnd > now && <Button size="sm" variant="quiet" onClick={() => openForm(`capacity:${staff.id}`)}>Confirm capacity</Button>}
        </div>)}</div>
        <p className="text-xs text-ink-soft">Only a coordinator confirms capacity. Finishing assigned work does not confirm lab receipt or result acknowledgement; those still need source evidence.</p>
      </>}
      {tab === 'handover' && <>
        <div><h3 className="font-semibold">Responsible team</h3><p className="mt-1">{encounter.assignedTo}</p><p className="mt-1 text-xs text-ink-soft">Responsibility stays here until the receiving clinician accepts. Bed movement is recorded separately.</p></div>
        {manager && !pendingHandover && <Button size="sm" variant="quiet" className="justify-self-start" onClick={() => openForm('handover')}>Request receiving team</Button>}
        {handovers.slice().reverse().map(item => { const staff = staffFor(item.toStaffId); const pending = item.status === 'pending' && item.expiresAt > now;
          return <article key={item.id} className="grid gap-2 rounded-xl border border-border p-3"><div className="flex justify-between gap-2"><strong>{staff?.name ?? 'Receiving clinician'}</strong><span>{item.status === 'pending' && !pending ? 'Expired' : item.status}</span></div>
            <p>{item.fromOwner} → {item.destination}</p><p className="text-xs text-ink-soft">Source: {item.sourceRef} · Requested <When value={item.requestedAt} /></p>
            {pending && canRespond(staff) ? <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void submit({ type: 'coordination', action: 'respond_episode_handover', handoverId: item.id, decision: 'accept' })}>Accept responsibility</Button><Button size="sm" variant="quiet" disabled={busy} onClick={() => void submit({ type: 'coordination', action: 'respond_episode_handover', handoverId: item.id, decision: 'decline' })}>Decline</Button></div> : pending ? <p className="text-xs text-ink-soft">Waiting for the named recipient · Expires <When value={item.expiresAt} /></p> : null}
          </article>;
        })}
        <div className="border-t border-border pt-4"><BedTransferPanel encounter={encounter} workspace={workspace} state={state} /></div>
      </>}
      {tab === 'records' && <>
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Recorded facts</h3>{workspace.role !== 'coordinator' && <Button size="sm" variant="quiet" onClick={() => openForm('record')}>Add source record</Button>}</div>
        <p className="text-xs text-ink-soft">Transcribe a documented observation or follow-up. Values are shown as recorded, without clinical interpretation.</p>
        {!records.length && <p className="text-ink-soft">No source records added for this encounter.</p>}
        <div className="divide-y divide-border">{records.slice().reverse().map(item => <article key={item.id} className="grid gap-1 py-3"><div className="flex justify-between gap-2"><strong>{item.label}</strong><span className="text-ink-soft">{item.kind === 'followup' ? 'Follow-up' : 'Observation'}</span></div>
          <p className="whitespace-pre-wrap break-words">{item.value} {item.unit}</p><p className="text-xs text-ink-soft">Observed <When value={item.occurredAt} /> · Source: {item.sourceRef}</p></article>)}</div>
      </>}
      {form && <form onSubmit={handleForm} className="grid gap-3 rounded-xl border border-border bg-white p-4" aria-label="Coordination details">
        <h3 className="font-semibold">{form === 'staff' ? 'Add synthetic team member' : form.startsWith('capacity:') ? 'Confirm available capacity' : form.startsWith('complete:') ? 'Record completed work' : form === 'offer' ? 'Offer approved work' : form === 'handover' ? 'Request receiving clinician' : 'Add documented fact'}</h3>
        {form === 'staff' && <>{input('name', 'Name')}{input('team', 'Team')}{select('role', 'Role', Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>))}
          {shared && select('userId', 'Workspace account', state.team.data?.members.filter(member => member.active).map(member => <option key={member.userId} value={member.userId}>{member.userId} · {roleLabels[member.role]}</option>))}
          {shared === false && <p className="text-xs text-ink-soft">Synthetic participant only. Use the workspace’s explicit role switch to simulate responses.</p>}
          <fieldset className="grid gap-2"><legend className="mb-2 font-medium">Work capabilities</legend>{Object.entries(capabilities).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input name="capabilities" type="checkbox" value={value} />{label}</label>)}</fieldset>
          {input('shiftEnd', 'Shift ends', { type: 'datetime-local', value: localTime(new Date(Date.now() + 8 * 3600000)) })}</>}
        {form.startsWith('capacity:') && <>{input('slots', 'Available operational slots', { type: 'number', min: 0, max: 20 })}
          {input('validUntil', 'Capacity valid until', { type: 'datetime-local', value: localTime(new Date(Math.min(Date.now() + 3600000, Date.parse(staffFor(form.slice(9))?.shiftEnd ?? now)))) })}</>}
        {form === 'offer' && <>{select('taskId', 'Approved task', availableTasks.map(task => <option key={task.id} value={task.id}>{task.title} · {taskStatusLabels[task.status]}</option>))}
          {select('staffId', 'Recipient with confirmed capacity', readyStaff.map(staff => <option key={staff.id} value={staff.id}>{staff.name} · {staff.capabilities.map(item => capabilities[item]).join(', ')}</option>))}</>}
        {form === 'handover' && <>{select('staffId', 'Receiving clinician', data.staff.filter(staff => staff.role === 'doctor' && staff.capabilities.includes('handover') && staff.shiftEnd > now).map(staff => <option key={staff.id} value={staff.id}>{staff.name} · {staff.team}</option>))}{input('destination', 'Receiving service / destination')}</>}
        {(form === 'offer' || form === 'handover') && input('durationMinutes', 'Response window (minutes)', { type: 'number', value: '30', min: 1, max: 240 })}
        {form === 'record' && <>{select('kind', 'Record type', <><option value="observation">Documented observation</option><option value="followup">Documented follow-up</option></>)}
          {input('label', 'Label')}{input('value', 'Value or documented note')}{input('unit', 'Unit (if applicable)', { required: false })}
          {input('occurredAt', 'Observed / completed at', { type: 'datetime-local', value: localTime(new Date()) })}</>}
        {form !== 'staff' && input('sourceRef', 'Synthetic source reference')}
        <div className="flex justify-end gap-2"><Button type="button" variant="quiet" disabled={busy} onClick={() => openForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
      </form>}
      {(validation || (state.errorFor === 'coordination' && state.error)) && <p role="alert" className="text-sm text-danger">{validation || state.error}</p>}
    </div>
  </CareDialog>;
}

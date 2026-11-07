import { useState } from 'react';
import { Badge, Button, Card, Input, Label, Select } from '@glucoflow/ui';
import type { CareWorkspace } from '@glucoflow/contracts';

/** PDF MVP: a static, explicitly reviewed logistics template, with no delivery integration. */
export function AppointmentPreview({ workspace }: { workspace: CareWorkspace }) {
  const [encounterId, setEncounterId] = useState(workspace.encounters[0]?.id ?? '');
  const [when, setWhen] = useState('');
  const [location, setLocation] = useState('');
  const [approved, setApproved] = useState(false);
  const encounter = workspace.encounters.find(item => item.id === encounterId);
  const ready = !!encounter && !!when && Number.isFinite(new Date(when).getTime()) && !!location.trim();
  return <Card className="p-4 sm:p-5"><section aria-label="Appointment message preview">
    <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">Appointment message preview</h3><Badge>Static demo</Badge></div>
    <p className="mt-2 text-sm text-ink-soft">Enter a staff-selected appointment to review a logistics-only message. Nothing is scheduled or sent.</p>
    <form className="mt-4 grid gap-3" onSubmit={event => { event.preventDefault(); if (ready) setApproved(true); }}>
      <div><Label htmlFor="appointment-encounter">Synthetic recipient</Label><Select id="appointment-encounter" value={encounterId} onChange={event => { setEncounterId(event.target.value); setApproved(false); }}>
        {workspace.encounters.map(item => <option key={item.id} value={item.id}>{item.patientName} · {item.patientCode}</option>)}
      </Select></div>
      <div><Label htmlFor="appointment-when">Appointment date and time</Label><Input id="appointment-when" type="datetime-local" required value={when} onChange={event => { setWhen(event.target.value); setApproved(false); }} /></div>
      <div><Label htmlFor="appointment-location">Clinic location</Label><Input id="appointment-location" required maxLength={100} value={location} placeholder="Enter a fictional clinic location" onChange={event => { setLocation(event.target.value); setApproved(false); }} /></div>
      {ready ? <blockquote className="rounded-xl border border-line bg-canvas p-3 text-sm leading-relaxed">Hello {encounter!.patientName}. Your demo appointment is on {new Date(when).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} at {location.trim()}. Please contact the clinic desk if you need to change this appointment.</blockquote> : null}
      <p className="text-xs text-ink-soft">Time is entered in your browser’s local timezone. Preview approval stays on this screen and resets when details change. Live delivery would require verified recipient consent and an approved hospital template.</p>
      {approved ? <p role="status" className="text-sm font-medium text-primary">Approved for this demo preview. No message sent.</p> : null}
      <Button type="submit" disabled={!ready || approved} className="justify-self-start">Approve demo preview</Button>
    </form>
  </section></Card>;
}

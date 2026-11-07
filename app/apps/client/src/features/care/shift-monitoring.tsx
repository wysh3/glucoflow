import { useState } from 'react';
import { Badge, Button, Input, Label } from '@glucoflow/ui';
import type { CareEvent, CareShiftMonitor, CareShiftScope, CareWorkspace } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';
import { CareDialog, SourceChip, When, canManage, roleLabels } from './shared';
import type { CareWorkspaceState } from './use-care-workspace';

const ruleLabels = { validated_result_acknowledgement: 'Validated result awaiting acknowledgement', specimen_receipt: 'Collected specimen awaiting lab receipt' };
const statusLabels = { awaiting_approval:'Awaiting approval', monitoring:'Monitoring', paused:'Paused', stopped:'Stopped', expired:'Expired' };
const itemLabels = { pending:'Awaiting source confirmation', source_unknown:'Source evidence unavailable', source_confirmed:'Source confirmed', cancelled:'Order cancelled' };
const localDate = (value:string) => { const date=new Date(value); return Number.isFinite(date.getTime()) ? new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16) : ''; };

export function ShiftMonitoringActivity({workspace,openMonitor}:{workspace:CareWorkspace;openMonitor:()=>void}) {
 const groups=workspace.shiftMonitoring??[];
 if(!groups.length)return null;
 return <section className="mb-4 rounded-xl border border-line p-4" aria-label="Shift monitoring activity">
  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Shift monitoring</h3><Button size="sm" variant="quiet" onClick={openMonitor}>Inspect groups</Button></div>
  <ul className="mt-2 divide-y divide-line">{groups.slice().reverse().map(group=><li key={group.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
   <span>{ruleLabels[group.scope.rule]}<small className="block text-ink-soft">{group.scope.encounterIds.length} encounters · Ends <When value={group.scope.expiresAt}/></small></span>
   <Badge>{statusLabels[group.status]}</Badge>
  </li>)}</ul>
 </section>;
}

export function ShiftMonitoringPanel({workspace,state,openSource,close}:{workspace:CareWorkspace;state:CareWorkspaceState;openSource:(event:CareEvent)=>void;close:()=>void}) {
 const {me}=useSession();
 const groups=workspace.shiftMonitoring??[];
 const [editing,setEditing]=useState<CareShiftMonitor|null>(null);
 const [formOpen,setFormOpen]=useState(groups.length===0);
 const [encounters,setEncounters]=useState<string[]>([]);
 const [recipients,setRecipients]=useState<string[]>([]);
 const [rule,setRule]=useState<CareShiftScope['rule']>('validated_result_acknowledgement');
 const shared=state.team.data?.access.shared;
 const person=workspace.coordination?.staff.find(item=> shared===true ? !!item.userId&&item.userId===me?.actor.userId : shared===false&&item.id===workspace.demoStaffId);
 const [expiry,setExpiry]=useState(person&&Date.parse(person.shiftEnd)>Date.now()?localDate(person.shiftEnd):'');
 const [validation,setValidation]=useState('');
 const manager=canManage(workspace.role);
 const busy=!!state.busy;
 const roster=(workspace.coordination?.staff??[]).filter(item=> shared===false ? !item.userId : shared===true&&!!item.userId&&state.team.data?.members.some(member=>member.active&&member.userId===item.userId&&member.role===item.role));
 const toggle=(values:string[],value:string)=>values.includes(value)?values.filter(item=>item!==value):[...values,value];
 const begin=(group:CareShiftMonitor|null)=>{
  state.clearError();setValidation('');setEditing(group);setFormOpen(true);
  setEncounters(group?.scope.encounterIds??[]);setRecipients(group?.scope.recipientStaffIds??[]);setRule(group?.scope.rule??'validated_result_acknowledgement');
  setExpiry(group?localDate(group.scope.expiresAt):person&&Date.parse(person.shiftEnd)>Date.now()?localDate(person.shiftEnd):'');
 };
 const save=async()=>{
  setValidation('');const end=new Date(expiry);
  if(!encounters.length||encounters.length>12||!recipients.length||!Number.isFinite(end.getTime())||end.getTime()<=Date.now()||end.getTime()>Date.now()+24*3600000) {setValidation('Select 1–12 encounters, at least one recipient and a future shift-end time within 24 hours.');return;}
  const scope:CareShiftScope={encounterIds:encounters,recipientStaffIds:recipients,rule,sources:['HIS','LIS'],expiresAt:end.toISOString()};
  const okay=await state.command(editing?{type:'shift_monitoring',action:'edit',monitorId:editing.id,expectedVersion:editing.version,scope}:{type:'shift_monitoring',action:'create',scope});
  if(okay){setFormOpen(false);setEditing(null);}
 };
 return <CareDialog open title="Shift monitoring" description="A bounded group of source checks. Review the exact scope before approving." onOpenChange={open=>{if(!open&&!busy)close();}}>
  <div className="space-y-4 text-sm">
   <p className="text-ink-soft">Synthetic sources only. Read authorised events and show status in this workspace. No messages are sent, clinical urgency inferred, or source records changed.</p>
   {manager&&!formOpen&&<Button size="sm" onClick={()=>begin(null)}>New monitoring group</Button>}
   {formOpen&&manager&&<form className="space-y-4 rounded-xl border border-line p-4" aria-label="Monitoring scope" onSubmit={event=>{event.preventDefault();void save();}}>
    <div><Label htmlFor="shift-rule">Monitoring rule</Label><select id="shift-rule" className="mt-1 min-h-10 w-full rounded-lg border border-line bg-white px-2" value={rule} onChange={event=>setRule(event.target.value as CareShiftScope['rule'])}>{Object.entries(ruleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
    <fieldset><legend className="font-medium">Encounter scope</legend><p className="mb-2 text-xs text-ink-soft">Select only encounters assigned to your current work. This fixed scope does not grow automatically.</p><div className="grid gap-2">{workspace.encounters.map(encounter=><label key={encounter.id} className="flex items-start gap-2"><input type="checkbox" checked={encounters.includes(encounter.id)} onChange={()=>setEncounters(toggle(encounters,encounter.id))}/><span>{encounter.patientName} · {encounter.patientCode}<small className="block text-ink-soft">Current responsibility: {encounter.assignedTo||'Unassigned'}</small></span></label>)}</div></fieldset>
    <fieldset><legend className="font-medium">Named in-workspace recipients</legend><p className="mb-2 text-xs text-ink-soft">These names define the approved scope; no email, SMS or external alert is sent.</p><div className="grid gap-2">{roster.map(staff=><label key={staff.id} className="flex items-center gap-2"><input type="checkbox" checked={recipients.includes(staff.id)} onChange={()=>setRecipients(toggle(recipients,staff.id))}/>{staff.name} · {roleLabels[staff.role]}</label>)}</div>{!roster.length&&<p className="text-ink-soft">No eligible roster members. Add an authorised team member in encounter coordination first.</p>}</fieldset>
    <div><Label htmlFor="shift-expiry">Shift ends (local time)</Label><Input id="shift-expiry" type="datetime-local" required value={expiry} onChange={event=>setExpiry(event.target.value)}/><p className="mt-1 text-xs text-ink-soft">Explicit expiry, within 24 hours. Monitoring does not renew automatically.</p></div>
    <p>Sources: HIS + LIS. Source absence remains unknown. Existing single-order tasks remain separate.</p>
    {editing&&<p className="text-review">Saving changes pauses the previous scope and requires fresh approval.</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="quiet" disabled={busy} onClick={()=>setFormOpen(false)}>Cancel</Button><Button type="submit" disabled={busy||shared===undefined}>Review scope</Button></div>
   </form>}
   {!manager&&<p className="text-ink-soft">A doctor or coordinator approves and changes monitoring scope. You can inspect its status and evidence.</p>}
   {validation&&<p role="alert" className="text-danger">{validation}</p>}
   {state.errorFor==='shift_monitoring'&&state.error&&<p role="alert" className="text-danger">{state.error}</p>}
   {groups.slice().reverse().map(group=><section key={group.id} className="space-y-3 rounded-xl border border-line p-4" aria-label={`Monitoring group version ${group.version}`}>
    <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{ruleLabels[group.scope.rule]}</h3><Badge>{statusLabels[group.status]} · v{group.version}</Badge></div>
    <dl className="grid gap-1"><dt className="text-xs text-ink-soft">Encounters</dt><dd>{group.scope.encounterIds.map(id=>{const item=workspace.encounters.find(encounter=>encounter.id===id);return item?`${item.patientName} (${item.patientCode})`:'Unavailable encounter';}).join(', ')}</dd><dt className="text-xs text-ink-soft">Sources</dt><dd>{group.scope.sources.join(' + ')}</dd><dt className="text-xs text-ink-soft">Recipients</dt><dd>{group.scope.recipientStaffIds.map(id=>workspace.coordination?.staff.find(item=>item.id===id)?.name??'Unavailable recipient').join(', ')}</dd><dt className="text-xs text-ink-soft">Absolute expiry</dt><dd><When value={group.scope.expiresAt}/></dd></dl>
    <p className="text-xs text-ink-soft">Prepared by {group.createdBy.name}{group.approvedBy&&<> · Approved by {group.approvedBy.name}{group.approvedAt&&<> at <When value={group.approvedAt}/></>}</>}</p>
    {group.status==='awaiting_approval'&&<p>Review this exact scope. Approval starts read-only source monitoring until the stated expiry.</p>}
    {manager&&group.createdBy.id===(shared===true?me?.actor.userId:person?.id)&&<div className="flex flex-wrap gap-2">
     {(['awaiting_approval','paused'] as string[]).includes(group.status)&&<Button size="sm" disabled={busy} onClick={()=>void state.command({type:'shift_monitoring',action:'approve',monitorId:group.id,expectedVersion:group.version})}>{group.status==='paused'?'Approve resume':'Approve monitoring'}</Button>}
     {group.status==='monitoring'&&<Button size="sm" variant="quiet" disabled={busy} onClick={()=>void state.command({type:'shift_monitoring',action:'pause',monitorId:group.id,expectedVersion:group.version})}>Pause</Button>}
     {!['stopped','expired'].includes(group.status)&&<><Button size="sm" variant="quiet" disabled={busy} onClick={()=>begin(group)}>Edit scope</Button><Button size="sm" variant="quiet" disabled={busy} onClick={()=>void state.command({type:'shift_monitoring',action:'stop',monitorId:group.id,expectedVersion:group.version})}>Stop monitoring</Button></>}
    </div>}
    {!group.items.length&&group.status==='monitoring'&&<p className="text-xs text-ink-soft">No matching order checks are currently available in this fixed encounter scope.</p>}
    {!!group.items.length&&<ul className="divide-y divide-line">{group.items.map(item=>{const event=workspace.events.find(event=>event.id===item.sourceEventId);return <li key={`${item.encounterId}:${item.orderId}`} className="space-y-1 py-2"><p className="font-medium">{workspace.encounters.find(encounter=>encounter.id===item.encounterId)?.patientName??'Encounter'} · {workspace.orders.find(order=>order.id===item.orderId)?.testName??'Order'}</p><p>{itemLabels[item.status]}</p><p className="text-xs text-ink-soft">Last check <When value={item.lastCheckedAt}/>{item.existingTaskId&&' · Existing single-order task retained separately'}</p>{event&&<SourceChip event={event} open={openSource}/>}</li>;})}</ul>}
   </section>)}
  </div>
 </CareDialog>;
}

import {useState} from 'react';
import {Button,Label} from '@glucoflow/ui';
import {Users} from 'lucide-react';
import {CareDialog,roleLabels} from './shared';
import type {CareWorkspace} from '@glucoflow/contracts';
import type {CareWorkspaceState} from './use-care-workspace';

const duties = {
 doctor:'Review source records, acknowledge results and request receiving care. Clinical decisions remain with the treating team.',
 nurse:'Record collection and assigned work. Accept only work offered to this person.',
 lab:'Record specimen receipt and laboratory results. Physician acknowledgement is a separate step.',
 coordinator:'Register encounters, confirm staff capacity and coordinate bed placement. This role does not authorize clinical orders.',
};
export function DemoPersonSwitcher({workspace,state}:{workspace:CareWorkspace;state:CareWorkspaceState}) {
 const [open,setOpen]=useState(false);
 const active=workspace.coordination?.staff.find(person=>person.id===workspace.demoStaffId);
 const shared=state.team.data?.access.shared;
 return <>
  <Button size="sm" variant="quiet" disabled={!state.team.isSuccess||!!state.busy} onClick={()=>setOpen(true)} aria-label={shared?'View assigned role':'Switch demo person'}>
   <Users size={15} aria-hidden/><span className="max-w-36 truncate">{shared?roleLabels[workspace.role]:active?.name??'Demo person'}</span>
  </Button>
  <CareDialog open={open} onOpenChange={setOpen} title={shared?'Your workspace role':'Try another perspective'} description={shared?'Authority comes from your authenticated account.':'Fictional staff share this simulation. Switching people keeps all encounters and work.'}>
   {shared?<p className="text-sm">{roleLabels[workspace.role]} · {duties[workspace.role]}</p>:<div className="grid gap-4">
    <div className="grid gap-1.5"><Label htmlFor="demo-person">Demo person and role</Label>
     <select id="demo-person" className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm" value={active?.id??''} disabled={!!state.busy} onChange={async event=>{
      if(await state.command({type:'set_demo_staff',staffId:event.target.value}))setOpen(false);
     }}><option value="" disabled>Choose a fictional person</option>
      {Object.entries(roleLabels).map(([role,label])=><optgroup key={role} label={label}>{workspace.coordination?.staff.filter(person=>person.role===role&&!person.userId).map(person=><option key={person.id} value={person.id}>{person.name} · {person.team}</option>)}</optgroup>)}
     </select></div>
    <p className="text-sm text-ink-soft">{duties[workspace.role]}</p>
    <p className="text-xs text-ink-soft">Demo only. Your signed-in account does not change. Real shared workspaces use assigned permissions.</p>
    {state.errorFor==='set_demo_staff'&&state.error?<p role="alert" className="text-sm text-danger">{state.error}</p>:null}
   </div>}
  </CareDialog>
 </>;
}

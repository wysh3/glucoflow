import {useState} from 'react';
import {Button,Input,Label} from '@glucoflow/ui';
import type {CareEncounter,CareWorkspace} from '@glucoflow/contracts';
import type {CareWorkspaceState} from './use-care-workspace';
import {When} from './shared';

export function BedTransferPanel({encounter,workspace,state}:{encounter:CareEncounter;workspace:CareWorkspace;state:CareWorkspaceState}) {
 const transfer=encounter.bedTransfer;
 const stage=!transfer?'requested':transfer.stage==='requested'?'allocated':'arrived';
 const allowed=!transfer?workspace.role==='doctor':transfer.stage==='requested'?workspace.role==='coordinator':transfer.stage==='allocated'&&['nurse','coordinator'].includes(workspace.role);
 const [editing,setEditing]=useState(false);
 const [destination,setDestination]=useState('');
 const [reference,setReference]=useState('');
 const label=stage==='requested'?'Record transfer request':stage==='allocated'?'Record bed allocation':'Confirm arrival';
 return <section className="grid gap-2 text-sm" aria-label="Bed transfer coordination">
  <h3 className="font-semibold">Bed transfer</h3>
  {transfer?<><p>{transfer.stage==='requested'?'Awaiting bed allocation':transfer.stage==='allocated'?'Bed allocated · awaiting arrival':'Arrival recorded'} · {transfer.destination}</p>
   <ol className="space-y-1 text-xs text-ink-soft">{transfer.history.map(item=><li key={item.stage}>{item.stage} · {item.destination} · {item.sourceRef} · <When value={item.at}/></li>)}</ol>
  </>:<p className="text-xs text-ink-soft">No transfer request recorded. Eligibility is decided by the clinical team.</p>}
  {allowed?<Button variant="quiet" size="sm" className="justify-self-start" onClick={()=>{setEditing(!editing);setDestination(transfer?.destination??'');}} aria-expanded={editing}>{label}</Button>:transfer?.stage!=='arrived'?<p className="text-xs text-ink-soft">Next recording role: {!transfer?'doctor':transfer.stage==='requested'?'coordinator':'nurse or coordinator'}.</p>:null}
  {editing&&allowed?<form className="grid gap-2" onSubmit={async event=>{
   event.preventDefault();
   if(await state.command({type:'bed_transfer',encounterId:encounter.id,stage,destination:destination.trim(),sourceRef:reference.trim()})){setEditing(false);setReference('');}
  }}>
   <Label htmlFor={`bed-destination-${encounter.id}`}>{stage==='requested'?'Requested department':'Allocated bed'}</Label>
   <Input id={`bed-destination-${encounter.id}`} required maxLength={40} readOnly={stage==='arrived'} value={destination} onChange={event=>setDestination(event.target.value)} />
   <Label htmlFor={`bed-reference-${encounter.id}`}>Synthetic source reference</Label>
   <Input id={`bed-reference-${encounter.id}`} required maxLength={100} value={reference} onChange={event=>setReference(event.target.value)} placeholder={stage==='requested'?'SIM-CLINICIAN-DECISION-01':'SIM-TRANSFER-01'} />
   <p className="text-xs text-ink-soft">Staff-recorded demo logistics. No live bed system is connected; this does not determine clinical suitability.</p>
   {state.error?<p role="alert" className="text-danger">{state.error}</p>:null}
   <Button className="justify-self-end" disabled={!!state.busy||!destination.trim()||!reference.trim()}>{label}</Button>
  </form>:null}
 </section>;
}

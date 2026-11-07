import type { CareWorkspace, CareEventKind } from '@glucoflow/contracts';
import { Button } from '@glucoflow/ui';
import { CareDialog, When } from './shared';
import {pipelineEvidence} from './pipeline-evidence';

const stages: [CareEventKind, string][] = [['order_placed','Ordered'],['specimen_collected','Collected'],['specimen_received','Received'],['result_validated','Result available'],['result_acknowledged','Acknowledged']];
/** Displays evidence independently: a later event never fabricates missing earlier stages. */
export function CarePipeline({workspace,close,openEpisode}:{workspace:CareWorkspace;close:()=>void;openEpisode:(id:string)=>void}) {
 return <CareDialog open title="Care pipeline" description="Track recorded evidence, responsibility and placement. Missing evidence stays unknown." onOpenChange={open=>{if(!open)close();}}>
  <div className="space-y-5">{workspace.encounters.map(encounter=><section key={encounter.id} className="border-b border-line pb-4">
   <div className="flex items-center justify-between gap-2"><div><h3 className="font-semibold">{encounter.patientName}</h3><p className="text-xs text-ink-soft">{encounter.patientCode} · Responsible clinician: {encounter.assignedTo}</p></div><Button size="sm" onClick={()=>{close();openEpisode(encounter.id);}}>Coordinate</Button></div>
   {workspace.orders.filter(order=>order.encounterId===encounter.id).map(order=>{
    const events=workspace.events.filter(event=>event.orderId===order.id&&event.encounterId===encounter.id);
    const cancelled=events.some(event=>event.kind==='order_cancelled');
    return <div key={order.id} className="mt-3"><p className="text-sm font-medium">{order.testName}{cancelled?' · Cancelled':''}</p>
     <ol aria-label={`${order.testName} evidence pipeline`} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{stages.map(([kind,label])=>{
      const {event,superseded}=pipelineEvidence(events,kind);
      return <li key={kind} className="rounded-lg border border-line p-2 text-xs"><p className="font-medium">{label}</p><p className={event&&!superseded?'text-primary':'text-ink-soft'}>{superseded?'New result needs acknowledgement':event?'Recorded':'Unverified'}</p>{event?<><When value={event.occurredAt}/><p className="mt-1 break-all text-ink-soft">{event.source} · {event.sourceRef}</p></>:null}</li>;
     })}</ol></div>;
   })}
   <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><p>Placement: {encounter.bedTransfer?.stage ?? 'No transfer recorded'} · {encounter.bedTransfer?.destination ?? encounter.bed}</p><p>Receiving responsibility: {workspace.coordination?.handovers.filter(item=>item.encounterId===encounter.id).at(-1)?.status ?? 'No handover requested'}</p></div>
  </section>)}</div>
 </CareDialog>;
}

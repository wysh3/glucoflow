import type {CareEvent,CareEventKind,CareTask} from '@glucoflow/contracts';

export const pipelineStages = [
 {kind: 'order_placed', label: 'Order placed', performer: 'Ordering clinician'},
 {kind: 'specimen_collected', label: 'Specimen collected', performer: 'Nursing / collection team'},
 {kind: 'specimen_received', label: 'Lab receipt', performer: 'Laboratory staff', followup: 'specimen_receipt'},
 {kind: 'result_validated', label: 'Result available', performer: 'Laboratory staff'},
 {kind: 'result_acknowledged', label: 'Result acknowledged', performer: 'Responsible clinician', followup: 'result_acknowledgement'},
] as const;

const openTaskStatuses = new Set<CareTask['status']>(['awaiting_approval', 'monitoring', 'paused', 'awaiting_evidence']);

export function pipelineFollowup(tasks: readonly CareTask[], encounterId: string, orderId: string, kind: CareEventKind, at: string) {
 const stage = pipelineStages.find(item => item.kind === kind);
 if (!stage || !('followup' in stage)) return [];
 return tasks.filter(task => task.encounterId === encounterId && task.orderId === orderId && task.kind === stage.followup
  && openTaskStatuses.has(task.status) && task.expiresAt > at);
}

const sourceFor=(kind:CareEventKind)=>['specimen_received','result_validated','result_corrected'].includes(kind)?'LIS':'HIS';
/** Preserve source occurrence and insertion ordering used by backend reconciliation. */
export function latestPipelineEvent(events:readonly CareEvent[],...kinds:CareEventKind[]):CareEvent|undefined {
 let latest:CareEvent|undefined;
 for(const event of events){
  if(!kinds.includes(event.kind)||event.source!==sourceFor(event.kind))continue;
  if(!latest||event.occurredAt>latest.occurredAt||(event.occurredAt===latest.occurredAt&&
   (event.kind==='result_corrected'||latest.kind!=='result_corrected')&&event.receivedAt>=latest.receivedAt))latest=event;
 }
 return latest;
}
export function pipelineEvidence(events:readonly CareEvent[],kind:CareEventKind){
 const result=latestPipelineEvent(events,'result_validated','result_corrected');
 const event=kind==='result_validated'?result:latestPipelineEvent(events,kind);
 if(kind!=='result_acknowledged'||!event)return {event,superseded:false,result};
 const resultIndex=result?events.indexOf(result):-1;
 const current=result?latestPipelineEvent(events.filter((candidate,index)=>candidate.occurredAt>result.occurredAt||
  (candidate.occurredAt===result.occurredAt&&index>resultIndex)),kind):undefined;
 return {event:current??event,superseded:!current,result};
}

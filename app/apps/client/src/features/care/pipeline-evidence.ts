import type {CareEvent,CareEventKind} from '@glucoflow/contracts';
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
 const superseded=kind==='result_acknowledged'&&!!event&&(!result||event.occurredAt<result.occurredAt||
  (event.occurredAt===result.occurredAt&&events.indexOf(event)<=events.indexOf(result)));
 return {event,superseded};
}

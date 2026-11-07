import {expect,it} from 'vitest';
import {seedCareWorkspace} from './seed';
import {recordSourceEvent,latestEvent,latestAcknowledgement,orderEvents} from './events';
const at='2026-11-07T12:00:00.000Z';
it('records a LIS receipt without inventing a missing collection',()=>{
 const s=seedCareWorkspace(new Date(at));const o=s.orders[0]!;s.role='lab';
 expect(recordSourceEvent(s,{type:'source_event',encounterId:o.encounterId,orderId:o.id,source:'LIS',kind:'specimen_received',sourceRef:'LATE-LIS'},at)).toBe(true);
 expect(orderEvents(s,o.encounterId,o.id).some(e=>e.kind==='specimen_collected')).toBe(false);
 expect(s.activity.some(a=>a.kind==='source_sequence_gap')).toBe(true);
});
it('uses event chronology, not arrival order, for corrected results and acknowledgement',()=>{
 const s=seedCareWorkspace(new Date(at));const o=s.orders[2]!;const es=orderEvents(s,o.encounterId,o.id); const result=es.find(e=>e.kind==='result_validated')!;
 const corrected={...result,id:'correction',kind:'result_corrected' as const,occurredAt:at,receivedAt:at};
 const ack={...result,id:'ack',kind:'result_acknowledged' as const,source:'HIS' as const,occurredAt:result.occurredAt,receivedAt:at};
 expect(latestEvent([...es,corrected,ack,result],'result_validated','result_corrected')?.id).toBe('correction');
 expect(latestAcknowledgement([...es,corrected,ack,result])).toBeUndefined();
});
it('retains delayed lab evidence after cancellation and keeps replay idempotent',()=>{
 const s=seedCareWorkspace(new Date(at));const o=s.orders[0]!;
 recordSourceEvent(s,{type:'source_event',encounterId:o.encounterId,orderId:o.id,source:'HIS',kind:'order_cancelled',sourceRef:'CANCEL'},at);
 s.role='lab';const c={type:'source_event' as const,encounterId:o.encounterId,orderId:o.id,source:'LIS' as const,kind:'specimen_received' as const,sourceRef:'AFTER-CANCEL'};
 expect(recordSourceEvent(s,c,at)).toBe(true);expect(recordSourceEvent(s,c,at)).toBe(false);
 expect(()=>recordSourceEvent(s,{...c,kind:'result_validated'},at)).toThrow();
});
it('keeps seeded evidence within its encounter and order with unique source references',()=>{
 const s=seedCareWorkspace(new Date(at));
 expect(new Set(s.events.map(e=>`${e.source}:${e.sourceRef}`)).size).toBe(s.events.length);
 for(const e of s.events){const enc=s.encounters.find(x=>x.id===e.encounterId)!;const order=s.orders.find(x=>x.id===e.orderId)!;
  expect(enc).toBeDefined();expect(order.encounterId).toBe(enc.id);expect(e.occurredAt>=order.createdAt).toBe(true);expect(e.receivedAt<=at).toBe(true);
 }
 for(const t of s.tasks)expect(s.orders.find(o=>o.id===t.orderId)?.encounterId).toBe(t.encounterId);
});

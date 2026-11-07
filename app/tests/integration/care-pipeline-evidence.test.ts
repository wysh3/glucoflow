import {it,expect} from 'vitest';
import type {CareEvent} from '@glucoflow/contracts';
import {pipelineEvidence} from '../../apps/client/src/features/care/pipeline-evidence';
const time='2026-11-07T12:00:00.000Z';
const event=(id:string,kind:CareEvent['kind'],source:CareEvent['source']):CareEvent=>({id,kind,source,encounterId:'encounter',orderId:'order',sourceRef:id,label:id,occurredAt:time,receivedAt:time});
it('requires re-acknowledgement when correction arrives after an acknowledgement at the same timestamp',()=>{
 const events=[event('result','result_validated','LIS'),event('ack','result_acknowledged','HIS'),event('correction','result_corrected','LIS')];
 expect(pipelineEvidence(events,'result_validated').event?.id).toBe('correction');
 expect(pipelineEvidence(events,'result_acknowledged').superseded).toBe(true);
 events.push(event('new-ack','result_acknowledged','HIS'));
 expect(pipelineEvidence(events,'result_acknowledged')).toMatchObject({event:{id:'new-ack'},superseded:false});
});
it('ignores the wrong source and does not fabricate earlier pipeline stages',()=>{
 const events=[event('bad-ack','result_acknowledged','LIS'),event('result','result_validated','LIS')];
 expect(pipelineEvidence(events,'result_acknowledged').event).toBeUndefined();
 expect(pipelineEvidence(events,'specimen_received').event).toBeUndefined();
});

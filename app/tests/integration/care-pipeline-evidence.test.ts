import {it,expect} from 'vitest';
import type {CareEvent, CareTask} from '@glucoflow/contracts';
import {pipelineEvidence, pipelineFollowup} from '../../apps/client/src/features/care/pipeline-evidence';
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

it('selects current acknowledgement by correction order before comparing receipt timestamps', () => {
 const events = [
  event('result', 'result_validated', 'LIS'),
  {...event('old-ack', 'result_acknowledged', 'HIS'), receivedAt: '2026-11-07T12:02:00.000Z'},
  event('correction', 'result_corrected', 'LIS'),
  {...event('new-ack', 'result_acknowledged', 'HIS'), receivedAt: '2026-11-07T12:01:00.000Z'},
 ];
 expect(pipelineEvidence(events, 'result_acknowledged')).toMatchObject({event: {id: 'new-ack'}, superseded: false});
});

const receiptTask: CareTask = {
 id: 'receipt', encounterId: 'encounter', orderId: 'order', kind: 'specimen_receipt', title: 'Check lab receipt',
 owner: 'Lab team', status: 'monitoring', createdAt: time, expiresAt: '2026-11-07T13:00:00.000Z',
 lastCheckedAt: null, completionEventId: null, playbookVersion: 1,
};

it('scopes lab follow-up to the receipt stage and its own encounter and order', () => {
 const tasks = [receiptTask, {...receiptTask, id: 'other-order', orderId: 'other'},
  {...receiptTask, id: 'other-encounter', encounterId: 'other'}];
 expect(pipelineFollowup(tasks, 'encounter', 'order', 'specimen_collected', time)).toEqual([]);
 expect(pipelineFollowup(tasks, 'encounter', 'order', 'specimen_received', time)).toEqual([receiptTask]);
});

it('omits closed and expired follow-up while retaining separate open assignees', () => {
 const second = {...receiptTask, id: 'second', owner: 'Asha'};
 const tasks: CareTask[] = [receiptTask, second, {...receiptTask, status: 'source_confirmed'},
  {...receiptTask, status: 'cancelled'}, {...receiptTask, expiresAt: time}];
 expect(pipelineFollowup(tasks, 'encounter', 'order', 'specimen_received', time)).toEqual([receiptTask, second]);
});

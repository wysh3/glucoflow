import { expect, it } from 'vitest';
import { seedCareWorkspace } from './seed';
import { executeCoordinationCommand, reconcileCoordination } from './coordination';
const at='2026-11-07T12:00:00.000Z';
const later='2026-11-07T12:10:00.000Z';
const end='2026-11-07T18:00:00.000Z';
function setup(){
 const state=seedCareWorkspace(new Date(at)); state.role='coordinator';
 executeCoordinationCommand(state,{type:'coordination',action:'register_staff',name:'Synthetic lab staff',userId:null,role:'lab',team:'Lab team',capabilities:['specimen_followup'],shiftEnd:end},at);
 const staff=state.coordination!.staff.at(-1)!;
 executeCoordinationCommand(state,{type:'coordination',action:'confirm_capacity',staffId:staff.id,slots:1,validUntil:later,sourceRef:'SIM-CAPACITY'},at);
 return {state,staff};
}
it('reserves pending offers and prevents a second offer from double-booking staff',()=>{
 const {state,staff}=setup();
 const offer={type:'coordination',action:'offer_task',taskId:state.tasks[1]!.id,staffId:staff.id,durationMinutes:5,sourceRef:'SIM-OFFER'} as const;
 executeCoordinationCommand(state,offer,at);
 state.tasks[0]!.status='monitoring';
 expect(()=>executeCoordinationCommand(state,{...offer,taskId:state.tasks[0]!.id},at)).toThrow('No current confirmed capacity');
 expect(state.coordination!.assignments).toHaveLength(1);
});
it('rechecks capacity freshness at acceptance and returns expired offers to team ownership',()=>{
 const {state,staff}=setup(); const owner=state.tasks[1]!.owner;
 executeCoordinationCommand(state,{type:'coordination',action:'offer_task',taskId:state.tasks[1]!.id,staffId:staff.id,durationMinutes:5,sourceRef:'SIM-OFFER'},at);
 state.role='lab';
 expect(()=>executeCoordinationCommand(state,{type:'coordination',action:'respond_offer',assignmentId:state.coordination!.assignments[0]!.id,decision:'accept'},later)).toThrow();
 reconcileCoordination(state,later);
 expect(state.coordination!.assignments[0]!.status).toBe('expired');expect(state.tasks[1]!.owner).toBe(owner);
});
it('accepts and completes assigned operational work without falsely completing source monitoring',()=>{
 const {state,staff}=setup(); const task=state.tasks[1]!;
 executeCoordinationCommand(state,{type:'coordination',action:'offer_task',taskId:task.id,staffId:staff.id,durationMinutes:5,sourceRef:'SIM-OFFER'},at);
 const assignment=state.coordination!.assignments[0]!;state.role='lab';
 executeCoordinationCommand(state,{type:'coordination',action:'respond_offer',assignmentId:assignment.id,decision:'accept'},at);
 executeCoordinationCommand(state,{type:'coordination',action:'complete_assignment',assignmentId:assignment.id,sourceRef:'SIM-CALL-RECEIPT'},at);
 expect(assignment.status).toBe('completed');expect(task.status).toBe('monitoring');expect(task.completionEventId).toBeNull();
});
it('binds shared acceptance to the actual authenticated recipient',()=>{
 const {state,staff}=setup();staff.userId='11111111-1111-4111-8111-111111111111';
 executeCoordinationCommand(state,{type:'coordination',action:'offer_task',taskId:state.tasks[1]!.id,staffId:staff.id,durationMinutes:5,sourceRef:'SIM-OFFER'},at);
 state.role='lab';const command={type:'coordination',action:'respond_offer',assignmentId:state.coordination!.assignments[0]!.id,decision:'accept'} as const;
 expect(()=>executeCoordinationCommand(state,command,at,{shared:true,actorId:'22222222-2222-4222-8222-222222222222'})).toThrow();
 expect(()=>executeCoordinationCommand(state,command,at,{shared:true,actorId:staff.userId!})).not.toThrow();
});
it('keeps episode responsibility until the named receiving clinician accepts without moving the patient',()=>{
 const {state}=setup();const encounter=state.encounters[0]!;const old=encounter.assignedTo;const bed=encounter.bed;
 executeCoordinationCommand(state,{type:'coordination',action:'register_staff',name:'Receiving clinician',userId:null,role:'doctor',team:'ICU',capabilities:['handover'],shiftEnd:end},at);
 const staff=state.coordination!.staff.at(-1)!;
 executeCoordinationCommand(state,{type:'coordination',action:'request_episode_handover',encounterId:encounter.id,staffId:staff.id,destination:'ICU 6',durationMinutes:10,sourceRef:'SIM-HANDOVER'},at);
 expect(encounter.assignedTo).toBe(old);
 state.role='doctor';executeCoordinationCommand(state,{type:'coordination',action:'respond_episode_handover',handoverId:state.coordination!.handovers[0]!.id,decision:'accept'},at);
 expect(encounter.assignedTo).toBe(staff.name);expect(encounter.bed).toBe(bed);
});
it('keeps source-linked observations immutable and rejects future times and conflicting source replay',()=>{
 const {state}=setup();state.role='doctor';const command={type:'coordination',action:'record_observation',encounterId:state.encounters[0]!.id,label:'Recorded glucose',value:'340',unit:'mg/dL',occurredAt:at,sourceRef:'SIM-OBS'} as const;
 executeCoordinationCommand(state,command,at);expect(executeCoordinationCommand(state,command,at)).toBe(false);
 expect(()=>executeCoordinationCommand(state,{...command,value:'240'},at)).toThrow();
 expect(()=>executeCoordinationCommand(state,{...command,sourceRef:'SIM-FUTURE',occurredAt:end},at)).toThrow();
 expect(state.coordination!.records).toHaveLength(1);
});

it('declining releases capacity while unknown capacity cannot receive offers',()=>{
 const {state,staff}=setup();const task=state.tasks[1]!;
 const offer={type:'coordination',action:'offer_task',taskId:task.id,staffId:staff.id,durationMinutes:5,sourceRef:'SIM-OFFER'} as const;
 const capacity=staff.capacity;staff.capacity=null;
 expect(()=>executeCoordinationCommand(state,offer,at)).toThrow('No current confirmed capacity');staff.capacity=capacity;
 executeCoordinationCommand(state,offer,at);state.role='lab';
 executeCoordinationCommand(state,{type:'coordination',action:'respond_offer',assignmentId:state.coordination!.assignments[0]!.id,decision:'decline'},at);
 state.role='coordinator';expect(()=>executeCoordinationCommand(state,offer,at)).not.toThrow();
 expect(state.coordination!.assignments.map(a=>a.status)).toEqual(['declined','offered']);
});
it('rejects clinical-role impersonation and preserves owner on declined episode handover',()=>{
 const {state}=setup();const encounter=state.encounters[0]!;const owner=encounter.assignedTo;
 executeCoordinationCommand(state,{type:'coordination',action:'register_staff',name:'Receiver',userId:null,role:'doctor',team:'Ward',capabilities:['handover'],shiftEnd:end},at);
 const staff=state.coordination!.staff.at(-1)!;
 executeCoordinationCommand(state,{type:'coordination',action:'request_episode_handover',encounterId:encounter.id,staffId:staff.id,destination:'Ward',durationMinutes:5,sourceRef:'SIM-HANDOVER'},at);
 const command={type:'coordination',action:'respond_episode_handover',handoverId:state.coordination!.handovers[0]!.id,decision:'decline'} as const;
 state.role='lab';expect(()=>executeCoordinationCommand(state,command,at)).toThrow();
 state.role='doctor';executeCoordinationCommand(state,command,at);expect(encounter.assignedTo).toBe(owner);
});

it('renews a shift without carrying capacity or a pending offer forward', () => {
 const {state,staff}=setup();
 const task=state.tasks[1]!;
 const offer={type:'coordination',action:'offer_task',taskId:task.id,staffId:staff.id,durationMinutes:5,sourceRef:'SIM-OFFER'} as const;
 executeCoordinationCommand(state,offer,at);
 const renew={type:'coordination',action:'renew_staff_shift',staffId:staff.id,shiftEnd:'2026-11-07T20:00:00.000Z',sourceRef:'SIM-SHIFT'} as const;
 state.role='lab';
 expect(()=>executeCoordinationCommand(state,renew,at)).toThrow();
 expect(staff.shiftEnd).toBe(end);
 state.role='doctor';
 expect(()=>executeCoordinationCommand(state,{...renew,shiftEnd:'2026-11-09T12:00:00.000Z'},at)).toThrow('next 24 hours');
 executeCoordinationCommand(state,renew,at);
 expect(staff.shiftEnd).toBe(renew.shiftEnd);
 expect(staff.capacity).toBeNull();
 expect(state.coordination!.assignments[0]!.status).toBe('withdrawn');
 expect(state.activity.at(-1)).toMatchObject({kind:'staff_shift_renewed',detail:expect.stringContaining('SIM-SHIFT')});
 expect(()=>executeCoordinationCommand(state,offer,at)).toThrow('No current confirmed capacity');
 state.role='coordinator';
 executeCoordinationCommand(state,{type:'coordination',action:'confirm_capacity',staffId:staff.id,slots:1,validUntil:later,sourceRef:'SIM-CAPACITY-2'},at);
 expect(()=>executeCoordinationCommand(state,offer,at)).not.toThrow();
});

it('records a new shift for an expired roster member without re-registering their identity', () => {
 const {state,staff}=setup();
 const afterShift='2026-11-07T19:00:00.000Z';
 executeCoordinationCommand(state,{type:'coordination',action:'renew_staff_shift',staffId:staff.id,
  shiftEnd:'2026-11-08T01:00:00.000Z',sourceRef:'SIM-NEXT-SHIFT'},afterShift);
 expect(state.coordination!.staff.at(-1)).toMatchObject({id:staff.id,shiftEnd:'2026-11-08T01:00:00.000Z',capacity:null});
});

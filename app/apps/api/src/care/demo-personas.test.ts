import {expect,it} from 'vitest';
import {seedCareWorkspace} from './seed';
import {executeCareCommand} from './commands';
const at='2026-11-07T12:00:00.000Z';
it('offers multiple named demo people in every role and preserves the encounter when switching',()=>{
 const state=seedCareWorkspace(new Date(at));
 for(const role of ['doctor','nurse','lab','coordinator'])expect(state.coordination!.staff.filter(s=>s.role===role).length).toBeGreaterThanOrEqual(2);
 const nurse=state.coordination!.staff.find(s=>s.role==='nurse')!;const ids=state.encounters.map(e=>e.id);
 executeCareCommand(state,{type:'set_demo_staff',staffId:nurse.id},at);
 expect(state.role).toBe('nurse');expect(state.demoStaffId).toBe(nurse.id);expect(state.encounters.map(e=>e.id)).toEqual(ids);
 expect(()=>executeCareCommand(state,{type:'add_order',encounterId:ids[0]!,testName:'Test',targetMinutes:60},at)).toThrow();
});
it('does not let another nurse accept the named recipient offer',()=>{
 const state=seedCareWorkspace(new Date(at));const [nurse,other]=state.coordination!.staff.filter(s=>s.role==='nurse');
 expect(other).toBeDefined();
 const coordinator=state.coordination!.staff.find(s=>s.role==='coordinator')!;
 executeCareCommand(state,{type:'set_demo_staff',staffId:coordinator.id},at);
 executeCareCommand(state,{type:'coordination',action:'confirm_capacity',staffId:nurse!.id,slots:1,validUntil:'2026-11-07T13:00:00.000Z',sourceRef:'SIM-CAPACITY'},at);
 executeCareCommand(state,{type:'coordination',action:'offer_task',taskId:state.tasks[1]!.id,staffId:nurse!.id,durationMinutes:30,sourceRef:'SIM-OFFER'},at);
 const command={type:'coordination',action:'respond_offer',assignmentId:state.coordination!.assignments[0]!.id,decision:'accept'} as const;
 executeCareCommand(state,{type:'set_demo_staff',staffId:other!.id},at);
 expect(()=>executeCareCommand(state,command,at)).toThrow('named');
 executeCareCommand(state,{type:'set_demo_staff',staffId:nurse!.id},at);executeCareCommand(state,command,at);
 expect(state.tasks[1]!.owner).toBe(nurse!.name);expect(state.tasks[1]!.status).toBe('monitoring');
});
it('records event actor without inventing a responsible clinician on admission',()=>{
 const state=seedCareWorkspace(new Date(at));
 executeCareCommand(state,{type:'add_encounter',patientName:'Fictional person',bed:'Admission bay',documentedContext:[]},at);
 expect(state.encounters.at(-1)!.assignedTo).toBe('Unassigned care team');
 expect(state.encounters.at(-1)!.registeredBy?.simulated).toBe(true);
 executeCareCommand(state,{type:'add_order',encounterId:state.encounters[0]!.id,testName:'Fictional order',targetMinutes:60},at);
 expect(state.events.at(-1)!.recordedBy?.name).toBe('Dr Mira Rao');
 expect(state.activity.at(-1)!.actor?.simulated).toBe(true);
});
it('cannot switch simulated people in a shared authenticated workspace',()=>{
 const state=seedCareWorkspace(new Date(at));
 expect(()=>executeCareCommand(state,{type:'set_demo_staff',staffId:state.coordination!.staff[0]!.id},at,{shared:true,actorId:'real-user'})).toThrow();
});

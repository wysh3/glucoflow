import { expect, it } from 'vitest';
import { executeCareCommand } from './commands';
import { seedCareWorkspace } from './seed';
import { episodeMeasurements } from '../../../client/src/features/care/episode-measurements';
const at = '2026-11-07T12:00:00.000Z';
const initial = '2026-11-07T10:00:00.000Z';
function setup() {
 const state = seedCareWorkspace(new Date(at));
 const encounterId = state.encounters[0]!.id;
 const add = {type:'coordination',action:'record_observation',encounterId,label:'Glucose',value:'200',unit:'mg/dL',occurredAt:initial,sourceRef:'SIM-REPORT'} as const;
 executeCareCommand(state,add,at,{shared:false,actorId:'authenticated-demo-account'});
 return {state,add};
}
it('preserves original transcription and excludes superseded and disputed values from plots',()=>{
 const {state,add}=setup(); const original={...state.coordination!.records[0]!};
 executeCareCommand(state,{...add,occurredAt:'2026-11-07T11:00:00.000Z',sourceRef:'SIM-REPORT-2',value:'180'},at);
 executeCareCommand(state,{type:'coordination',action:'correct_episode_record',recordId:original.id,value:'190',unit:'mg/dL',occurredAt:initial,reason:'Corrected transcription against synthetic source'},at);
 expect(state.coordination!.records[0]).toEqual(original);
 expect(episodeMeasurements(state.coordination!.records)[0]!.points.map(p=>p.value)).toEqual([190,180]);
 const corrected=state.coordination!.records.at(-1)!;
 executeCareCommand(state,{type:'coordination',action:'dispute_episode_record',recordId:corrected.id,reason:'Synthetic source requires reconciliation'},at);
 expect(episodeMeasurements(state.coordination!.records)).toEqual([]);
 expect(state.coordination!.records).toHaveLength(4);
 expect(()=>executeCareCommand(state,{type:'coordination',action:'dispute_episode_record',recordId:original.id,reason:'Old version'},at)).toThrow();
});
it('accepts multiple analytes from one report and preserves named simulated attribution',()=>{
 const {state,add}=setup();
 executeCareCommand(state,{...add,label:'Potassium',value:'4.1',unit:'mmol/L'},at);
 expect(state.coordination!.records).toHaveLength(2);
 expect(state.coordination!.records[0]!.recorder?.name).toBe('Dr Mira Rao');
 expect(state.coordination!.records[0]!.recordedBy).toBe('authenticated-demo-account');
 expect(()=>executeCareCommand(state,{...add,value:'999'},at)).toThrow();
});
it('plots explicitly dimensionless pH without accepting unknown units',()=>{
 const {state,add}=setup();
 executeCareCommand(state,{...add,label:'pH',value:'7.2',unit:'',dimensionless:true},at);
 executeCareCommand(state,{...add,label:'pH',value:'7.3',unit:'',dimensionless:true,occurredAt:'2026-11-07T11:00:00.000Z'},at);
 expect(episodeMeasurements(state.coordination!.records)[0]?.label).toBe('pH');
});
it('refuses coordinator revisions and contradictory dimensionless units',()=>{
 const {state,add}=setup(); const id=state.coordination!.records[0]!.id;
 const coordinator=state.coordination!.staff.find(staff=>staff.role==='coordinator')!;
 executeCareCommand(state,{type:'set_demo_staff',staffId:coordinator.id},at);
 expect(()=>executeCareCommand(state,{type:'coordination',action:'dispute_episode_record',recordId:id,reason:'Test'},at)).toThrow();
 executeCareCommand(state,{type:'set_role',role:'doctor'},at);
 expect(()=>executeCareCommand(state,{...add,label:'pH',value:'7.2',dimensionless:true},at)).toThrow('dimensionless');
 expect(state.coordination!.records).toHaveLength(1);
});

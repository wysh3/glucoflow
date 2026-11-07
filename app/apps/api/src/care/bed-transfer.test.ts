import {expect,it} from 'vitest';
import {seedCareWorkspace} from './seed';
import {executeCareCommand} from './commands';
const at='2026-11-07T12:00:00.000Z';
it('tracks a documented transfer decision separately from allocation and arrival',()=>{
 const s=seedCareWorkspace(new Date(at)); const e=s.encounters[0]!; const old=e.bed;
 executeCareCommand(s,{type:'bed_transfer',encounterId:e.id,stage:'requested',destination:'ICU',sourceRef:'SIM-DECISION-1'},at);
 expect(e.bed).toBe(old); expect(e.bedTransfer?.stage).toBe('requested');
 expect(()=>executeCareCommand(s,{type:'bed_transfer',encounterId:e.id,stage:'arrived',destination:'ICU 2',sourceRef:'SIM-ARRIVAL'},at)).toThrow();
 s.role='coordinator';executeCareCommand(s,{type:'bed_transfer',encounterId:e.id,stage:'allocated',destination:'ICU 2',sourceRef:'SIM-BED-2'},at);
 expect(e.bed).toBe(old);
 s.role='nurse';executeCareCommand(s,{type:'bed_transfer',encounterId:e.id,stage:'arrived',destination:'ICU 2',sourceRef:'SIM-ARRIVAL'},at);
 expect(e.bed).toBe('ICU 2');expect(e.bedTransfer?.history).toHaveLength(3);
 expect(s.tasks[0]!.completionEventId).toBeNull();
});
it('refuses allocation without a request and arrival into a different bed',()=>{
 const s=seedCareWorkspace(new Date(at)); const e=s.encounters[0]!;s.role='coordinator';
 expect(()=>executeCareCommand(s,{type:'bed_transfer',encounterId:e.id,stage:'allocated',destination:'ICU 2',sourceRef:'SIM-BED'},at)).toThrow();
 s.role='doctor';executeCareCommand(s,{type:'bed_transfer',encounterId:e.id,stage:'requested',destination:'ICU',sourceRef:'SIM-DECISION'},at);
 s.role='coordinator';executeCareCommand(s,{type:'bed_transfer',encounterId:e.id,stage:'allocated',destination:'ICU 2',sourceRef:'SIM-BED'},at);
 s.role='nurse';expect(()=>executeCareCommand(s,{type:'bed_transfer',encounterId:e.id,stage:'arrived',destination:'ICU 3',sourceRef:'SIM-ARRIVAL'},at)).toThrow();
});

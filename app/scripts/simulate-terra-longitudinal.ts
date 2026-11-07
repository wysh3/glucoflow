import { writeFileSync } from 'node:fs';
import { seedCareWorkspace } from '../apps/api/src/care/seed';
import { executeCareCommand } from '../apps/api/src/care/commands';
import { reconcileCareWorkspace } from '../apps/api/src/care/monitor';
const base=Date.parse('2026-01-01T00:00:00Z');
const time=(m:number)=>new Date(base+m*60000).toISOString();
const results=['tier1','tier2','tier3','rural'].map(context=>{
 const state=seedCareWorkspace(new Date(base)); const counts:Record<string,number>={}; const errors:Record<string,string>={};
 const add=(k:string)=>counts[k]=(counts[k]??0)+1;
 const run=(k:string,c:any,t:string)=>{try {const changed=executeCareCommand(state,c,t);add(k+(changed?'.changed':'.duplicate'));return changed;}catch(e){add(k+'.rejected');errors[k]??=e instanceof Error?e.message:String(e);return false;}};
 const doctor=state.coordination!.staff.find(s=>s.role==='doctor')!; const nurse=state.coordination!.staff.find(s=>s.role==='nurse')!; const lab=state.coordination!.staff.find(s=>s.role==='lab')!;
 const order=state.orders[2]!; const task=state.tasks.find(t=>t.kind==='specimen_receipt')!;
 run('roleNurse',{type:'set_demo_staff',staffId:nurse.id},time(0));
 for(let i=0;i<14;i++)run('soft',{type:'soft_acknowledge_task',taskId:task.id,note:`Synthetic shift note ${i}`},time(i));
 run('softDuplicate',{type:'soft_acknowledge_task',taskId:task.id,note:'Synthetic shift note 11'},time(14));
 run('roleDoctor',{type:'set_demo_staff',staffId:doctor.id},time(15));
 for(let day=0;day<90;day++){
  const m=day*1440+20, at=time(m); const scope={encounterIds:[order.encounterId],rule:'validated_result_acknowledgement',sources:['HIS','LIS'],recipientStaffIds:[lab.id],expiresAt:time(m+480)};
  const n=state.shiftMonitoring?.length??0;
  if(run('monitorCreate',{type:'shift_monitoring',action:'create',scope},at)){const monitor=state.shiftMonitoring![n]!;
   run('monitorApprove',{type:'shift_monitoring',action:'approve',monitorId:monitor.id,expectedVersion:1},at);
   run('monitorDuplicateApprove',{type:'shift_monitoring',action:'approve',monitorId:monitor.id,expectedVersion:1},at);
   reconcileCareWorkspace(state,at);reconcileCareWorkspace(state,time(m+481));if(monitor.status==='expired')add('monitorExpired');}
  const d=state.handoverDocuments?.length??0;
  if(run('handoverCreate',{type:'handover_document',action:'create',encounterIds:[order.encounterId],recipientStaffId:nurse.id},at)){const doc=state.handoverDocuments![d]!;
   run('handoverShare',{type:'handover_document',action:'share',documentId:doc.id,expectedVersion:1},at);
   run('handoverDuplicateShare',{type:'handover_document',action:'share',documentId:doc.id,expectedVersion:1},at);}
 }
 return {context,assumptions:'One eight-hour scope and one draft per day; identical workload, no demographic inference.',counts,errors,retained:{monitors:state.shiftMonitoring?.length??0,documents:state.handoverDocuments?.length??0,softAcknowledgements:task.softAcknowledgements?.length??0}};
});
const output={run:'2026-11-07',days:90,model:'In-process reducer, persistent synthetic workspace per scenario',limitations:['No database, API authorization, continuation transaction, capacity, network, real staff or AI model exercised.','UUIDs are random; counts and scenario schedule are deterministic.','Tier labels are scenario labels only, not empirical geographic assumptions.'],results};
writeFileSync('reports/terra-longitudinal-2026-11-07.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));

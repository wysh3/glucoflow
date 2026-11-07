import {randomUUID} from 'node:crypto';
import type {CareWorkspace,CareCoordinationCommand,CareCoordination,CareStaff,CareCapability,CareTask,CareActor} from '@glucoflow/contracts';
import {ApiError} from '../errors';
import {assertRole,assertRoom,encounterFor,logActivity} from './events';

export type CoordinationActor = {shared:boolean;actorId:string;displayName?:string;demoStaffId?:string};
const activeTask=(task:CareTask)=>['monitoring','awaiting_evidence','paused'].includes(task.status);
const capabilityFor=(task:CareTask):CareCapability=>task.kind==='specimen_receipt'?'specimen_followup':task.kind==='result_acknowledgement'?'result_followup':'handover';
export function emptyCoordination():CareCoordination{return {staff:[],assignments:[],handovers:[],records:[]};}
function data(state:CareWorkspace):CareCoordination{return state.coordination??(state.coordination=emptyCoordination());}
function staffFor(state:CareWorkspace,id:string):CareStaff{
 const staff=data(state).staff.find(s=>s.id===id);if(!staff)throw ApiError.notFound('That team member is unavailable.');return staff;
}
function taskFor(state:CareWorkspace,id:string):CareTask{
 const task=state.tasks.find(t=>t.id===id);if(!task||!activeTask(task))throw ApiError.conflict('Approve an open monitoring task before assigning follow-up work.','task_state_conflict');return task;
}
function activeLoads(state:CareWorkspace,staffId:string,at:string,except?:string):number{
 return data(state).assignments.filter(a=>a.id!==except&&a.staffId===staffId&&(a.status==='accepted'||(a.status==='offered'&&a.expiresAt>at))).length;
}
function eligible(state:CareWorkspace,staff:CareStaff,capability:CareCapability,at:string,except?:string){
 if(staff.shiftEnd<=at||!staff.capabilities.includes(capability))throw ApiError.conflict('The required capability or current shift is not confirmed.','staff_unavailable');
 if(!staff.capacity||staff.capacity.validUntil<=at||activeLoads(state,staff.id,at,except)>=staff.capacity.slots)throw ApiError.conflict('No current confirmed capacity. Ask the team lead to check availability.','capacity_unavailable');
}
function recipient(state:CareWorkspace,staff:CareStaff,context?:CoordinationActor){
 assertRole(state,staff.role);
 if(!context?.shared && context?.demoStaffId && staff.id!==context.demoStaffId)throw ApiError.forbidden('Only the named simulated recipient can respond.');
 if(context?.shared&&(!staff.userId||staff.userId!==context.actorId))throw ApiError.forbidden('Only the named authenticated recipient can respond.');
}
function future(value:string,at:string,maxHours=24){
 const ms=Date.parse(value)-Date.parse(at);if(!Number.isFinite(ms)||ms<=0||ms>maxHours*3600000)throw ApiError.validation('Choose a future time within the next 24 hours.');
}

function transcriptionActor(state:CareWorkspace,context?:CoordinationActor):CareActor {
 const person=!context?.shared ? state.coordination?.staff.find(s=>s.id===state.demoStaffId&&s.role===state.role&&!s.userId) : undefined;
 return context?.shared ? {id:context.actorId,name:context.displayName??'Authenticated staff',role:state.role,simulated:false}
 : {id:person?.id??`simulation:${state.role}`,name:person?.name??`Demo ${state.role}`,role:state.role,simulated:true};
}
function validateObservationTime(occurredAt:string,unit:string,dimensionless:boolean|undefined,at:string){
 if(!Number.isFinite(Date.parse(occurredAt))||Date.parse(occurredAt)>Date.parse(at))throw ApiError.validation('A source record cannot have a future observation time.');
 if(dimensionless&&unit.trim())throw ApiError.validation('A dimensionless observation cannot also have a measurement unit.');
}

/** Domain transitions are executed inside the existing workspace row-lock transaction. */
export function executeCoordinationCommand(state:CareWorkspace,command:CareCoordinationCommand,at:string,context?:CoordinationActor):boolean {
 const store=data(state);
 switch(command.action){
 case 'register_staff': {
  assertRole(state,'coordinator','doctor');assertRoom(store.staff,30,'staff');future(command.shiftEnd,at);
  if(!command.userId&&store.staff.some(s=>!s.userId&&s.name===command.name&&s.team===command.team))throw ApiError.conflict('This person is already on the roster.','duplicate_staff');
  if(command.userId&&store.staff.some(s=>s.userId===command.userId))throw ApiError.conflict('This account already has a roster entry.','duplicate_staff');
  store.staff.push({id:randomUUID(),name:command.name,userId:command.userId,role:command.role,team:command.team,capabilities:[...new Set(command.capabilities)],shiftEnd:command.shiftEnd,capacity:null});
  logActivity(state,at,'staff_registered','Team member added',`${command.name} · Capacity is not confirmed.`);return true;
 }
 case 'renew_staff_shift': {
  assertRole(state,'doctor','coordinator');
  const staff=staffFor(state,command.staffId);
  future(command.shiftEnd,at);
  if (staff.shiftEnd===command.shiftEnd) return false;
  staff.shiftEnd=command.shiftEnd;
  staff.capacity=null;
  for (const offer of store.assignments) {
   if (offer.staffId!==staff.id || offer.status!=='offered' || offer.expiresAt<=at) continue;
   offer.status='withdrawn';
   offer.resolvedAt=at;
   logActivity(state,at,'assignment_withdrawn','Task offer withdrawn',`${staff.name} · Staff shift changed; confirm capacity before offering again.`,offer.taskId);
  }
  logActivity(state,at,'staff_shift_renewed','Staff shift updated',
    `${staff.name} · Ends ${staff.shiftEnd} · ${command.sourceRef} · Capacity needs a separate confirmation.`);
  return true;
 }
 case 'confirm_capacity': {
  assertRole(state,'coordinator');const staff=staffFor(state,command.staffId);future(command.validUntil,at);
  if(command.validUntil>staff.shiftEnd)throw ApiError.validation('Capacity confirmation cannot outlast the recorded shift.');
  if(command.slots<activeLoads(state,staff.id,at))throw ApiError.conflict('Resolve existing offers or assignments before reducing capacity.','capacity_reserved');
  staff.capacity={slots:command.slots,validUntil:command.validUntil,confirmedAt:at,sourceRef:command.sourceRef};
  logActivity(state,at,'capacity_confirmed','Staff capacity recorded',`${staff.name} · ${command.slots} operational slot(s) · ${command.sourceRef}`);return true;
 }
 case 'offer_task': {
  assertRole(state,'doctor','coordinator');const task=taskFor(state,command.taskId);const staff=staffFor(state,command.staffId);const capability=capabilityFor(task);
  if(store.assignments.some(a=>a.taskId===task.id&&(a.status==='accepted'||(a.status==='offered'&&a.expiresAt>at))))throw ApiError.conflict('An active offer or assignment already covers this task.','assignment_exists');
  eligible(state,staff,capability,at);assertRoom(store.assignments,160,'assignment');
  const expiresAt=new Date(Math.min(Date.parse(at)+command.durationMinutes*60000,Date.parse(staff.capacity!.validUntil),Date.parse(staff.shiftEnd))).toISOString();
  store.assignments.push({id:randomUUID(),taskId:task.id,staffId:staff.id,capability,status:'offered',offeredAt:at,expiresAt,sourceRef:command.sourceRef});
  logActivity(state,at,'assignment_offered','Operational task offered',`${staff.name} · Team ownership remains unchanged until acceptance.`,task.id);return true;
 }
 case 'respond_offer': {
  const assignment=store.assignments.find(a=>a.id===command.assignmentId);if(!assignment||assignment.status!=='offered'||assignment.expiresAt<=at)throw ApiError.conflict('This offer is no longer pending. Refresh to see current work.','offer_expired');
  const staff=staffFor(state,assignment.staffId);recipient(state,staff,context);const task=taskFor(state,assignment.taskId);
  if(command.decision==='accept')eligible(state,staff,assignment.capability,at,assignment.id);
  assignment.status=command.decision==='accept'?'accepted':'declined';assignment.resolvedAt=at;
  if(command.decision==='accept')task.owner=staff.name;
  logActivity(state,at,`assignment_${assignment.status}`,`Task ${assignment.status}`,`${staff.name} · Monitoring still requires source evidence.`,task.id);return true;
 }
 case 'complete_assignment': {
  const assignment=store.assignments.find(a=>a.id===command.assignmentId);if(!assignment||assignment.status!=='accepted')throw ApiError.conflict('Accept an active assignment before recording work.','assignment_state_conflict');
  const staff=staffFor(state,assignment.staffId);recipient(state,staff,context);
  assignment.status='completed';assignment.resolvedAt=at;assignment.completionRef=command.sourceRef;
  logActivity(state,at,'assignment_completed','Follow-up work recorded',`${staff.name} · ${command.sourceRef} · This does not verify a laboratory result.`,assignment.taskId);return true;
 }
 case 'request_episode_handover': {
  assertRole(state,'doctor','coordinator');const encounter=encounterFor(state,command.encounterId);const staff=staffFor(state,command.staffId);
  if(staff.role!=='doctor'||!staff.capabilities.includes('handover')||staff.shiftEnd<=at)throw ApiError.validation('Choose an on-shift receiving clinician with handover responsibility.');
  if(store.handovers.some(h=>h.encounterId===encounter.id&&h.status==='pending'&&h.expiresAt>at))throw ApiError.conflict('An episode handover is already pending.','handover_pending');
  assertRoom(store.handovers,120,'handover');
  store.handovers.push({id:randomUUID(),encounterId:encounter.id,fromOwner:encounter.assignedTo,toStaffId:staff.id,destination:command.destination,status:'pending',requestedAt:at,expiresAt:new Date(Math.min(Date.parse(at)+command.durationMinutes*60000,Date.parse(staff.shiftEnd))).toISOString(),sourceRef:command.sourceRef});
  logActivity(state,at,'episode_handover_requested','Receiving team asked to accept',`${encounter.patientCode} · ${staff.name} · ${command.destination}. Current team remains accountable.`);return true;
 }
 case 'respond_episode_handover': {
  const handover=store.handovers.find(h=>h.id===command.handoverId);if(!handover||handover.status!=='pending'||handover.expiresAt<=at)throw ApiError.conflict('This episode handover is no longer pending.','handover_expired');
  const staff=staffFor(state,handover.toStaffId);recipient(state,staff,context);const encounter=encounterFor(state,handover.encounterId);
  if(staff.shiftEnd<=at||!staff.capabilities.includes('handover'))throw ApiError.conflict('Receiving clinician shift or capability has changed.','staff_unavailable');
  if(encounter.assignedTo!==handover.fromOwner)throw ApiError.conflict('The accountable clinician changed. Prepare a fresh handover.','handover_stale');
  handover.status=command.decision==='accept'?'accepted':'declined';handover.resolvedAt=at;
  if(command.decision==='accept'){
   encounter.assignedTo=staff.name;
   // Carry only the sending clinician's open responsibilities; lab/nursing owners stay intact.
   for(const task of state.tasks)if(task.encounterId===encounter.id&&task.owner===handover.fromOwner&&activeTask(task))task.owner=staff.name;
  }
  logActivity(state,at,`episode_handover_${handover.status}`,`Episode handover ${handover.status}`,`${encounter.patientCode} · ${staff.name}. Physical location is recorded separately.`);return true;
 }
 case 'correct_episode_record': case 'dispute_episode_record': {
  assertRole(state,'doctor','nurse','lab');
  const previous=store.records.find(r=>r.id===command.recordId);
  if(!previous)throw ApiError.notFound('That source transcription is unavailable.');
  if(store.records.some(r=>r.supersedesId===previous.id))throw ApiError.conflict('This transcription has a newer version. Refresh before revising it.','record_superseded');
  const reason=command.reason.trim();if(!reason)throw ApiError.validation('Record why this transcription is being revised.');
  if(command.action==='correct_episode_record')validateObservationTime(command.occurredAt,command.unit,command.dimensionless,at);
  assertRoom(store.records,240,'episode record');
  store.records.push({...previous,id:randomUUID(),supersedesId:previous.id,revisionReason:reason,
   ...(command.action==='correct_episode_record'?{value:command.value,unit:command.unit,occurredAt:command.occurredAt,dimensionless:command.dimensionless??false,disposition:'transcription' as const}:{disposition:'disputed' as const}),
   recordedAt:at,recordedBy:context?.actorId??`simulation:${state.role}`,recorder:transcriptionActor(state,context)});
  logActivity(state,at,'episode_record_revised',command.action==='correct_episode_record'?'Transcription corrected':'Transcription disputed',`${previous.label} · ${previous.sourceRef} · ${reason}. Original retained; no clinical verification implied.`);return true;
 }
 case 'record_observation': case 'record_followup': {
  assertRole(state,'doctor','nurse','lab');encounterFor(state,command.encounterId);
  validateObservationTime(command.occurredAt,command.unit,command.dimensionless,at);
  const kind=command.action==='record_observation'?'observation':'followup';
  const previous=store.records.find(r=>r.encounterId===command.encounterId&&r.kind===kind&&r.sourceRef===command.sourceRef&&r.label===command.label&&r.unit===command.unit&&r.occurredAt===command.occurredAt);
  if(previous){
   if(previous.encounterId===command.encounterId&&previous.kind===kind&&previous.label===command.label&&previous.value===command.value&&previous.unit===command.unit&&previous.occurredAt===command.occurredAt&&!!previous.dimensionless===!!command.dimensionless&&!store.records.some(r=>r.supersedesId===previous.id)&&previous.disposition!=='disputed')return false;
   throw ApiError.conflict('That source reference already identifies a different record.','source_conflict');
  }
  assertRoom(store.records,240,'episode record');
  store.records.push({id:randomUUID(),encounterId:command.encounterId,kind,label:command.label,value:command.value,unit:command.unit,occurredAt:command.occurredAt,recordedAt:at,sourceRef:command.sourceRef,recordedBy:context?.actorId??`simulation:${state.role}`,recorder:transcriptionActor(state,context),dimensionless:command.dimensionless??false,disposition:'transcription'});
  logActivity(state,at,`episode_${kind}`,kind==='observation'?'Source observation recorded':'Follow-up recorded',`${command.label} · ${command.sourceRef} · Staff transcription, not clinical interpretation.`);return true;
 }
 }
}

/** Expired offers release reserved capacity; acceptance never proves source completion. */
export function reconcileCoordination(state:CareWorkspace,at:string):boolean{
 const store=state.coordination;if(!store)return false;let changed=false;
 for(const assignment of store.assignments){
  if(!['offered','accepted'].includes(assignment.status))continue;
  const task=state.tasks.find(t=>t.id===assignment.taskId);
  const next=!task||!activeTask(task)?'withdrawn':assignment.status==='offered'&&assignment.expiresAt<=at?'expired':null;
  if(next){assignment.status=next;assignment.resolvedAt=at;logActivity(state,at,`assignment_${next}`,`Assignment ${next}`,'Team retains unresolved responsibilities.',assignment.taskId);changed=true;}
 }
 for(const handover of store.handovers)if(handover.status==='pending'&&handover.expiresAt<=at){handover.status='expired';handover.resolvedAt=at;logActivity(state,at,'episode_handover_expired','Episode handover expired','Original team retains responsibility.');changed=true;}
 return changed;
}

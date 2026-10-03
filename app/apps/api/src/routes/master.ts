import type {FastifyInstance} from 'fastify';
import {createHash} from 'node:crypto';
import {masterEventSchema,type MasterEvent,type MasterProfile} from '@glucoflow/contracts';
import {MASTER_SCENARIO,MEDICATION_PHASES} from '@glucoflow/domain';
import {getPatientSummary,loadTimelinePage,listNotes} from '@glucoflow/data';
import {assertPatientAccess} from '../auth';
import {ApiError} from '../errors';
import {requireActor,withActorTx,parseBody,idempotencyKey} from './helpers';
import type {AppContext} from '../context';
const sha=(text:string):string=>createHash('sha256').update(text).digest('hex');
type Row={id:string;kind:MasterEvent['kind'];payload:Record<string,unknown>;created_at:Date;actor_id:string;digest:string|null;input_hash:string};
const map=(r:Row):MasterEvent=>({id:r.id,kind:r.kind,payload:r.payload,createdAt:new Date(r.created_at).toISOString(),actorId:r.actor_id,digest:r.digest});
export function registerMasterRoutes(app:FastifyInstance,ctx:AppContext):void{
 app.get<{Params:{id:string}}>('/api/v1/patients/:id/master',async request=>withActorTx(ctx,request,async client=>{
  const patient=await getPatientSummary(client,request.params.id);
  if(!patient)throw ApiError.notFound();
  assertPatientAccess(requireActor(request),patient.patientId,patient.clinicId);
  const demo=await client.query('select c.is_demo,p.master_scenario from sutra.clinics c join sutra.patients p on p.clinic_id=c.id where p.id=$1',[patient.patientId]);
  if(!demo.rows[0]?.is_demo)throw ApiError.forbidden('The master scenario is available only in the synthetic demo clinic.');
  const rows=await client.query<Row>('select * from sutra.master_events where patient_id=$1 order by created_at desc,id desc limit 500',[patient.patientId]);
  return {patientId:patient.patientId,scenario:!!demo.rows[0]?.master_scenario,events:rows.rows.map(map),serverTime:new Date().toISOString()} satisfies MasterProfile;
 }));
 app.get<{Params:{id:string;snapshotId:string}}>('/api/v1/patients/:id/master/snapshots/:snapshotId/download',async request=>withActorTx(ctx,request,async client=>{
  const patient=await getPatientSummary(client,request.params.id);if(!patient)throw ApiError.notFound();
  assertPatientAccess(requireActor(request),patient.patientId,patient.clinicId);
  const result=await client.query<Row>("select * from sutra.master_events where patient_id=$1 and id=$2 and kind='sos'",[patient.patientId,request.params.snapshotId]);
  const event=result.rows[0];if(!event)throw ApiError.notFound('That snapshot is not available.');
  const path=`snapshots/${patient.clinicId}/${patient.patientId}/${event.id}.json`;
  const bucket=ctx.config.STORAGE_BUCKET_EXPORTS;
  if(!await ctx.storage.headObject(bucket,path)){
   try{await ctx.storage.putObject(bucket,path,Buffer.from(JSON.stringify({id:event.id,digest:event.digest,...event.payload},null,2)),'application/json');}
   catch(error){if(!await ctx.storage.headObject(bucket,path))throw error;}
  }
  const url=await ctx.storage.createDownloadUrl(bucket,path,60);
  return {url,filename:`glucoflow-snapshot-${event.id}.json`,expiresAt:new Date(Date.now()+60000).toISOString()};
 }));
 app.post<{Params:{id:string}}>('/api/v1/patients/:id/master/events',{config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async(request,reply)=>{
  const input=parseBody(masterEventSchema,request.body);const key=idempotencyKey(request,true)!;
  const inputHash=sha(JSON.stringify(input));
  const event=await withActorTx(ctx,request,async client=>{
   const patient=await getPatientSummary(client,request.params.id);if(!patient)throw ApiError.notFound();
   const actor=requireActor(request);assertPatientAccess(actor,patient.patientId,patient.clinicId);
   const own=actor.capabilities.patientIds.includes(patient.patientId);
   const patientKind=['glucose','symptom','sos'].includes(input.kind);
   if(patientKind?!own:!actor.contexts.some(c=>c.kind==='clinic'&&c.clinicId===patient.clinicId&&(c.clinician||c.reviewer)))throw ApiError.forbidden('This action is not available to this role.');
   const existing=await client.query<Row>('select * from sutra.master_events where patient_id=$1 and actor_id=$2 and request_key=$3',[patient.patientId,actor.profile.userId,key]);
   if(existing.rows[0]){if(existing.rows[0].input_hash!==inputHash)throw new ApiError(409,'idempotency_conflict','This action key was already used for different data.');return map(existing.rows[0]);}
   let payload:Record<string,unknown>=input.payload;let digest:string|null=null;
   if('timestamp' in payload&&Date.parse(String(payload.timestamp))>Date.now()+60000)throw ApiError.validation('The report timestamp cannot be in the future.');
   if(input.kind==='screening'&&input.payload.lastDate&&input.payload.lastDate>new Date().toISOString().slice(0,10))throw ApiError.validation('The completion date cannot be in the future.');
   if(input.kind==='ack_sos'){
    const target=await client.query('select id from sutra.master_events where id=$1 and patient_id=$2 and kind=\'sos\'',[input.payload.snapshotId,patient.patientId]);
    if(!target.rowCount)throw ApiError.notFound('That snapshot is not available.');
   }
   if(input.kind==='sos'){
    const timeline=await loadTimelinePage(client,patient.patientId,{testCodes:[]},2000,0);
    const notes=await listNotes(client,patient.patientId);
    const history=await client.query<Row>('select * from sutra.master_events where patient_id=$1 order by created_at asc,id asc limit 500',[patient.patientId]);
    const assigned=await client.query('select master_scenario from sutra.patients where id=$1',[patient.patientId]);
    payload={patient:{id:patient.patientId,name:patient.displayName,identifier:patient.clinicIdentifier},capturedAt:new Date().toISOString(),approvalRevision:patient.approvalRevision,scenario:assigned.rows[0]?.master_scenario?{measurements:MASTER_SCENARIO,medications:MEDICATION_PHASES}:null,approvedRecords:timeline,patientNotes:notes,homeEvents:history.rows.filter(e=>['glucose','symptom'].includes(e.kind)).map(map),delivery:'Demo clinic desk',emergencyDispatch:false};
    digest=sha(JSON.stringify(payload));
   }
   const rows=await client.query<Row>('insert into sutra.master_events(patient_id,actor_id,kind,payload,input_hash,request_key,digest) values($1,$2,$3,$4,$5,$6,$7) on conflict(actor_id,patient_id,request_key) do nothing returning *',[patient.patientId,actor.profile.userId,input.kind,JSON.stringify(payload),inputHash,key,digest]);
   if(rows.rows[0])return map(rows.rows[0]);
   const retry=await client.query<Row>('select * from sutra.master_events where patient_id=$1 and actor_id=$2 and request_key=$3',[patient.patientId,actor.profile.userId,key]);
   if(retry.rows[0]?.input_hash!==inputHash)throw new ApiError(409,'idempotency_conflict','This action key was already used.');
   return map(retry.rows[0]!);
  });return reply.code(201).send(event);
 });
}

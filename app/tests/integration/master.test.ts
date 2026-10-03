import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createFixture,createTestContext,removeClinic,type TestContext,type TestFixture} from './harness';
let ctx:TestContext;let f:TestFixture;
beforeAll(async()=>{ctx=await createTestContext();f=await createFixture(ctx,'master');});
afterAll(async()=>{await removeClinic(ctx,f.clinicId);await removeClinic(ctx,f.otherClinicId);await ctx.close();});
const append=(actor:string,kind:string)=>ctx.asActor(actor,c=>c.query('insert into sutra.master_events(patient_id,kind,payload,input_hash,request_key) values($1,$2,$3,$4,$5) returning id',[f.patientId,kind,'{}','test',crypto.randomUUID()]));
describe('master append-only actor boundaries',()=>{
 it('patient can append home readings and snapshots',async()=>{expect((await append(f.patientUserId,'glucose')).rowCount).toBe(1);expect((await append(f.patientUserId,'sos')).rowCount).toBe(1);});
 it('patient cannot change screening/category or acknowledge staff inbox',async()=>{for(const kind of ['screening','category','ack_sos'])await expect(append(f.patientUserId,kind)).rejects.toThrow();});
 it('clinic can configure screening but cannot impersonate a patient reading',async()=>{expect((await append(f.reviewerId,'screening')).rowCount).toBe(1);await expect(append(f.reviewerId,'glucose')).rejects.toThrow();});
 it('another clinic cannot see or append this history',async()=>{
  expect((await ctx.asActor(f.otherReviewerId,c=>c.query('select * from sutra.master_events where patient_id=$1',[f.patientId]))).rowCount).toBe(0);
  await expect(append(f.otherReviewerId,'screening')).rejects.toThrow();
 });
 it('application actor cannot overwrite or delete saved events',async()=>{
  for(const sql of ['update sutra.master_events set payload=\'{}\' where patient_id=$1','delete from sutra.master_events where patient_id=$1'])await expect(ctx.asActor(f.patientUserId,c=>c.query(sql,[f.patientId]))).rejects.toThrow();
 });
});

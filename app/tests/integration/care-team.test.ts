import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createTestContext,createFixture,removeClinic,type TestContext,type TestFixture} from './harness';
import {createWorkspace,applyCommand,readWorkspace} from '../../apps/api/src/care/repository';
import {configureTeamMember,resolveCareAccess,listTeamAudit,auditTeamCommand,listTeamMembers} from '../../apps/api/src/care/team';
let db:TestContext;let f:TestFixture;
beforeAll(async()=>{db=await createTestContext();f=await createFixture(db,'care-team');});
afterAll(async()=>{if(f){await removeClinic(db,f.clinicId);await removeClinic(db,f.otherClinicId);}await db?.close();});
const create=()=>db.asActor(f.clinicianId,c=>createWorkspace(c,f.clinicianId,f.clinicId));
const invite=(id:string,active=true)=>db.asActor(f.clinicianId,c=>configureTeamMember(c,id,{userId:f.reviewerId,role:'nurse',active}));
it('keeps private workspaces private and grants explicit same-clinic authenticated membership',async()=>{
 const w=await create();
 expect(await db.asActor(f.clinicianId,c=>resolveCareAccess(c,w.id,f.clinicianId))).toEqual({ownerId:f.clinicianId,shared:false,role:null});
 await expect(db.asActor(f.reviewerId,c=>resolveCareAccess(c,w.id,f.reviewerId))).rejects.toThrow();
 await expect(db.asActor(f.clinicianId,c=>configureTeamMember(c,w.id,{userId:f.otherReviewerId,role:'doctor',active:true}))).rejects.toThrow();
 await invite(w.id);
 expect(await db.asActor(f.reviewerId,c=>resolveCareAccess(c,w.id,f.reviewerId))).toEqual({ownerId:f.clinicianId,shared:true,role:'nurse'});
 expect((await db.asActor(f.clinicianId,c=>resolveCareAccess(c,w.id,f.clinicianId))).role).toBe('doctor');
 await expect(db.asActor(f.otherReviewerId,c=>resolveCareAccess(c,w.id,f.otherReviewerId))).rejects.toThrow();
 await expect(db.asActor(f.patientUserId,c=>resolveCareAccess(c,w.id,f.patientUserId))).rejects.toThrow();
});
it('prevents teammate self-promotion and direct membership/audit edits',async()=>{
 const w=await create();await invite(w.id);
 await expect(db.asActor(f.reviewerId,c=>configureTeamMember(c,w.id,{userId:f.reviewerId,role:'doctor',active:true}))).rejects.toThrow();
 await expect(db.asActor(f.reviewerId,c=>c.query("update sutra.care_workspace_team_members set role='doctor' where workspace_id=$1",[w.id]))).rejects.toThrow();
 await db.asActor(f.reviewerId,c=>auditTeamCommand(c,w.id,'source_event',2));
 expect((await db.asActor(f.clinicianId,c=>listTeamAudit(c,w.id))).events[0]).toMatchObject({actorId:f.reviewerId,actorRole:'nurse',action:'source_event',revision:2});
 await expect(db.asActor(f.clinicianId,c=>c.query('delete from sutra.care_team_audit where workspace_id=$1',[w.id]))).rejects.toThrow();
 await expect(db.asActor(f.clinicianId,c=>c.query("update sutra.care_team_audit set action='changed' where workspace_id=$1",[w.id]))).rejects.toThrow();
});
it('revokes access immediately and refuses impersonation',async()=>{
 const w=await create();await invite(w.id);
 await expect(db.asActor(f.reviewerId,c=>resolveCareAccess(c,w.id,f.clinicianId))).rejects.toThrow();
 await invite(w.id,false);
 await expect(db.asActor(f.reviewerId,c=>resolveCareAccess(c,w.id,f.reviewerId))).rejects.toThrow();
 await expect(db.asActor(f.reviewerId,c=>auditTeamCommand(c,w.id,'chat',2))).rejects.toThrow();
 expect((await db.asActor(f.clinicianId,c=>listTeamAudit(c,w.id))).events[0]!.action).toBe('member_revoked');
});
it('clinic membership revocation wins over team enrollment',async()=>{
 const w=await create();await invite(w.id);
 await db.owner(c=>c.query('update sutra.memberships set active=false where clinic_id=$1 and user_id=$2',[f.clinicId,f.reviewerId]));
 try{await expect(db.asActor(f.reviewerId,c=>resolveCareAccess(c,w.id,f.reviewerId))).rejects.toThrow();}
 finally{await db.owner(c=>c.query('update sutra.memberships set active=true where clinic_id=$1 and user_id=$2',[f.clinicId,f.reviewerId]));}
});
it('derives role on shared reads and refuses simulation role switching through repository',async()=>{
 const w=await create();await invite(w.id);
 expect((await db.asActor(f.reviewerId,c=>readWorkspace(c,w.id,f.reviewerId))).role).toBe('nurse');
 await expect(db.asActor(f.reviewerId,c=>applyCommand(c,w.id,f.reviewerId,randomUUID(),{expectedRevision:w.revision,command:{type:'set_role',role:'doctor'}}))).rejects.toThrow();
 await expect(db.asActor(f.clinicianId,c=>applyCommand(c,w.id,f.clinicianId,randomUUID(),{expectedRevision:w.revision,command:{type:'set_role',role:'lab'}}))).rejects.toThrow();
});
it('applies only the assigned role, audits once on retry, and does not persist actor-specific role',async()=>{
 const w=await create();await invite(w.id);
 const order=w.orders[0]!;
 const request={expectedRevision:w.revision,command:{type:'source_event' as const,encounterId:order.encounterId,orderId:order.id,kind:'specimen_collected' as const,source:'HIS' as const,sourceRef:'TEAM-COLLECTION-1'}};
 const key=randomUUID();
 const applied=await db.asActor(f.reviewerId,c=>applyCommand(c,w.id,f.reviewerId,key,request));
 expect(applied.role).toBe('nurse');
 await db.asActor(f.reviewerId,c=>applyCommand(c,w.id,f.reviewerId,key,request));
 expect((await db.asActor(f.clinicianId,c=>listTeamAudit(c,w.id))).events.filter(e=>e.action==='source_event')).toHaveLength(1);
 expect(await db.owner(async c=>(await c.query("select state->>'role' as role from sutra.care_workspaces where id=$1",[w.id])).rows[0]!.role)).toBe(w.role);
 await expect(db.asActor(f.reviewerId,c=>applyCommand(c,w.id,f.reviewerId,randomUUID(),{expectedRevision:applied.revision,command:{type:'add_order',encounterId:order.encounterId,testName:'Synthetic test',targetMinutes:30}}))).rejects.toThrow();
 await expect(db.asActor(f.clinicianId,c=>applyCommand(c,w.id,f.clinicianId,key,request))).rejects.toThrow();
});
it('pages audit by numeric ID without duplicate entries',async()=>{
 const w=await create();await invite(w.id);
 await db.asActor(f.reviewerId,async c=>{for(let i=0;i<55;i++)await auditTeamCommand(c,w.id,'chat',i+1);});
 const first=await db.asActor(f.clinicianId,c=>listTeamAudit(c,w.id));
 const second=await db.asActor(f.clinicianId,c=>listTeamAudit(c,w.id,Number(first.nextCursor)));
 expect(first.events).toHaveLength(50);expect(second.events).toHaveLength(6);
 const ids=[...first.events,...second.events].map(e=>Number(e.id));
 expect(new Set(ids).size).toBe(56);expect(ids).toEqual([...ids].sort((a,b)=>b-a));
});
it('removes doctor access when clinician capability is downgraded, including the workspace owner',async()=>{
 const w=await create();
 await db.asActor(f.clinicianId,c=>configureTeamMember(c,w.id,{userId:f.reviewerId,role:'doctor',active:true}));
 await db.owner(c=>c.query('update sutra.memberships set clinician=false where clinic_id=$1 and user_id in ($2,$3)',[f.clinicId,f.reviewerId,f.clinicianId]));
 try {
   for(const actor of [f.reviewerId,f.clinicianId]){
     await expect(db.asActor(actor,c=>resolveCareAccess(c,w.id,actor))).rejects.toThrow();
     await expect(db.asActor(actor,c=>readWorkspace(c,w.id,actor))).rejects.toThrow();
     await expect(db.asActor(actor,c=>auditTeamCommand(c,w.id,'chat',2))).rejects.toThrow();
   }
   expect(await db.asActor(f.reviewerId,async c=>(await c.query('select id from sutra.care_workspaces where id=$1',[w.id])).rowCount)).toBe(0);
 }finally{
   await db.owner(c=>c.query('update sutra.memberships set clinician=true where clinic_id=$1 and user_id in ($2,$3)',[f.clinicId,f.reviewerId,f.clinicianId]));
 }
});

it('enrolls existing clinic accounts by email and refuses other-clinic discovery or teammate enrollment',async()=>{
 const w=await create();
 const email=await db.owner(async c=>(await c.query('select email from sutra.app_users where id=$1',[f.reviewerId])).rows[0]!.email as string);
 await db.asActor(f.clinicianId,c=>configureTeamMember(c,w.id,{email:email.toUpperCase(),role:'nurse',active:true}));
 expect((await db.asActor(f.reviewerId,c=>resolveCareAccess(c,w.id,f.reviewerId))).role).toBe('nurse');
 expect((await db.asActor(f.reviewerId,c=>listTeamMembers(c,w.id))).every(member=>member.email===null)).toBe(true);
 expect((await db.asActor(f.clinicianId,c=>listTeamMembers(c,w.id))).find(member=>member.userId===f.reviewerId)?.email).toBe(email);
 await expect(db.asActor(f.reviewerId,c=>configureTeamMember(c,w.id,{email,role:'doctor',active:true}))).rejects.toThrow();
 const otherEmail=await db.owner(async c=>(await c.query('select email from sutra.app_users where id=$1',[f.otherReviewerId])).rows[0]!.email as string);
 await expect(db.asActor(f.clinicianId,c=>configureTeamMember(c,w.id,{email:otherEmail,role:'nurse',active:true}))).rejects.toThrow('An existing active staff account');
 await expect(db.asActor(f.clinicianId,c=>configureTeamMember(c,w.id,{email:'absent@example.invalid',role:'nurse',active:true}))).rejects.toThrow('An existing active staff account');
 await expect(db.asActor(f.clinicianId,c=>configureTeamMember(c,w.id,{userId:f.clinicianId,role:'doctor',active:false}))).rejects.toThrow();
});

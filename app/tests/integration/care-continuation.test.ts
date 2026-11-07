import {beforeAll,afterAll,it,expect} from 'vitest';
import {createTestContext,createFixture,removeClinic,type TestContext,type TestFixture} from './harness';
import {createWorkspace,continueWorkspace,readWorkspace,applyCommand} from '../../apps/api/src/care/repository';
import {configureTeamMember} from '../../apps/api/src/care/team';
import {seedCareWorkspace} from '../../apps/api/src/care/seed';
import {monitorCareBatch} from '../../apps/worker/src/care-monitor';
let db:TestContext;let f:TestFixture;
beforeAll(async()=>{db=await createTestContext();f=await createFixture(db,'continuation');});
afterAll(async()=>{if(f){await removeClinic(db,f.clinicId);await removeClinic(db,f.otherClinicId);}await db?.close();});
it('refuses active work, then archives settled evidence and creates one linked fresh demo on retries',async()=>{
 const s=await db.asActor(f.clinicianId,c=>createWorkspace(c,f.clinicianId,f.clinicId));
 await expect(db.asActor(f.clinicianId,c=>continueWorkspace(c,s.id,f.clinicianId,s.revision))).rejects.toMatchObject({code:'P0001'});
 await db.asWorker(c=>monitorCareBatch(c,new Date(Date.now()+2*86400000).toISOString(),s.id));
 const settled=await db.asActor(f.clinicianId,c=>readWorkspace(c,s.id,f.clinicianId));
 const first=await db.asActor(f.clinicianId,c=>continueWorkspace(c,s.id,f.clinicianId,settled.revision));
 const again=await db.asActor(f.clinicianId,c=>continueWorkspace(c,s.id,f.clinicianId,settled.revision));
 expect(again.workspace.id).toBe(first.workspace.id);
 expect(first.workspace.previousWorkspaceId).toBe(s.id);
 const archived=await db.asActor(f.clinicianId,c=>readWorkspace(c,s.id,f.clinicianId));
 expect(archived.archivedAt).toBeTruthy();
 expect(archived.events).toEqual(settled.events);
 expect(archived.tasks).toEqual(settled.tasks);
 await expect(db.asActor(f.clinicianId,c=>applyCommand(c,s.id,f.clinicianId,'archived-command',{expectedRevision:settled.revision,command:{type:'set_role',role:'nurse'}}))).rejects.toMatchObject({status:409});
 expect(await db.asWorker(c=>monitorCareBatch(c,new Date(Date.now()+3*86400000).toISOString(),s.id))).toBe(0);
 await expect(db.asActor(f.clinicianId,c=>c.query("update sutra.care_workspaces set state=jsonb_set(state,'{name}','\"changed\"') where id=$1",[s.id]))).rejects.toThrow();
});

it('guards pending episode handovers inside the SQL lock and preserves settled retry idempotency',async()=>{
 const s=await db.asActor(f.clinicianId,c=>createWorkspace(c,f.clinicianId,f.clinicId));
 await db.asWorker(c=>monitorCareBatch(c,new Date(Date.now()+2*86400000).toISOString(),s.id));
 const settled=await db.asActor(f.clinicianId,c=>readWorkspace(c,s.id,f.clinicianId));
 await db.owner(c=>c.query("update sutra.care_workspaces set state=jsonb_set(state,'{coordination,handovers}',$2::jsonb) where id=$1",[s.id,JSON.stringify([{status:'pending'}])]));
 const invoke=()=>db.asActor(f.clinicianId,c=>c.query('select sutra.continue_care_workspace($1,$2,$3::jsonb) as id',[s.id,settled.revision,JSON.stringify(seedCareWorkspace(new Date()))]));
 await expect(invoke()).rejects.toMatchObject({code:'P0001'});
 await db.owner(c=>c.query("update sutra.care_workspaces set state=jsonb_set(state,'{coordination,handovers}','[]'::jsonb) where id=$1",[s.id]));
 const first=await invoke();const second=await invoke();expect(second.rows[0]!.id).toBe(first.rows[0]!.id);
});

it('does not copy a revoked doctor capability or allow a revoked shared owner to archive via SQL',async()=>{
 const s=await db.asActor(f.reviewerId,c=>createWorkspace(c,f.reviewerId,f.clinicId));
 await db.asActor(f.reviewerId,c=>configureTeamMember(c,s.id,{userId:f.clinicianId,role:'doctor',active:true}));
 await db.asWorker(c=>monitorCareBatch(c,new Date(Date.now()+2*86400000).toISOString(),s.id));
 const settled=await db.asActor(f.reviewerId,c=>readWorkspace(c,s.id,f.reviewerId));
 await db.owner(c=>c.query('update sutra.memberships set clinician=false where user_id=$1 and clinic_id=$2',[f.clinicianId,f.clinicId]));
 const next=await db.asActor(f.reviewerId,c=>continueWorkspace(c,s.id,f.reviewerId,settled.revision));
 const copied=await db.owner(async c=>(await c.query('select user_id from sutra.care_workspace_team_members where workspace_id=$1 and user_id=$2',[next.workspace.id,f.clinicianId])).rows);
 expect(copied).toEqual([]);
 await db.owner(c=>c.query('update sutra.memberships set clinician=false where user_id=$1 and clinic_id=$2',[f.reviewerId,f.clinicId]));
 await expect(db.asActor(f.reviewerId,c=>c.query('select sutra.continue_care_workspace($1,$2,$3::jsonb)',[next.workspace.id,next.workspace.revision,JSON.stringify(seedCareWorkspace(new Date()))]))).rejects.toMatchObject({code:'42501'});
});

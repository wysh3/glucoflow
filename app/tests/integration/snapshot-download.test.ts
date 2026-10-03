import { beforeAll, afterAll, expect, it } from 'vitest';
import { buildServer } from '../../apps/api/src/server';
import { createAppContext } from '../../apps/api/src/context';
import { signLocalToken } from '../../apps/api/src/auth';
import { createFixture, createTestContext, removeClinic, type TestContext, type TestFixture } from './harness';
let ctx: TestContext; let f: TestFixture; let app: Awaited<ReturnType<typeof buildServer>>;
let config: Awaited<ReturnType<typeof createAppContext>>['config']; let snapshotId: string;
beforeAll(async () => {
 ctx = await createTestContext(); f = await createFixture(ctx, 'snapshot-download');
 const api = await createAppContext(); config = api.config; app = await buildServer(api);
 const result = await ctx.asActor(f.patientUserId, c => c.query("insert into sutra.master_events(patient_id,kind,payload,input_hash,request_key,digest) values($1,'sos',$2,'test',$3,'synthetic-digest') returning id", [f.patientId, JSON.stringify({delivery:'Demo clinic desk',emergencyDispatch:false}), crypto.randomUUID()]));
 snapshotId = result.rows[0].id;
});
afterAll(async () => {await app.close();await removeClinic(ctx,f.clinicId);await removeClinic(ctx,f.otherClinicId);await ctx.close();});
it('provides an authorized short-lived JSON link for the frozen snapshot', async () => {
 const token = await signLocalToken(config, {userId:f.patientUserId,email:'patient@glucoflow.demo'});
 const response = await app.inject({method:'GET',url:`/api/v1/patients/${f.patientId}/master/snapshots/${snapshotId}/download`,headers:{authorization:`Bearer ${token.accessToken}`}});
 expect(response.statusCode).toBe(200);
 expect(response.json().url).toContain('expires=');
 const stored = await ctx.storage.getObject(ctx.exportBucket, `snapshots/${f.clinicId}/${f.patientId}/${snapshotId}.json`);
 expect(JSON.parse(stored.toString())).toMatchObject({id:snapshotId,digest:'synthetic-digest',emergencyDispatch:false});
});
it('does not issue a snapshot link to another clinic', async () => {
 const token = await signLocalToken(config, {userId:f.otherReviewerId,email:'reviewer@glucoflow.demo'});
 const response = await app.inject({method:'GET',url:`/api/v1/patients/${f.patientId}/master/snapshots/${snapshotId}/download`,headers:{authorization:`Bearer ${token.accessToken}`}});
 expect([403,404]).toContain(response.statusCode);
});

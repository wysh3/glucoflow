import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {CareWorkspace,CareCommand} from '@glucoflow/contracts';
import {localRoot} from './lib/env';
async function main(){
  const hosted = JSON.parse(readFileSync(join(localRoot, 'azure-deployment-secrets.json'), 'utf8'));
  const fixture = JSON.parse(readFileSync(join(localRoot, 'hosted-demo-credentials.json'), 'utf8'));
  const accounts = fixture.accounts ?? fixture;
  const base = new URL('/api/v1', hosted.apiUrlPublic).href;

  async function signIn(role: 'clinic' | 'clinician' | 'other-clinic' | 'patient'): Promise<string> {
    const { email, password } = accounts[role];
    assert.ok(email.endsWith('@glucoflow.demo'), 'Smoke login must use a synthetic demo account');
    const response = await fetch(`${hosted.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: hosted.publishableKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 200, `Synthetic ${role} login HTTP status`);
    const { access_token } = (await response.json()) as { access_token?: string };
    assert.ok(access_token, `Synthetic ${role} login did not issue an access token`);
    return access_token;
  }

  async function api<T>(path: string, status: number, token?: string, body?: object, key?: string): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(token && { authorization: `Bearer ${token}` }),
        ...(body && { 'content-type': 'application/json' }),
        ...(key && { 'idempotency-key': key }),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(75_000),
    });
    assert.equal(response.status, status, `Care ${path.replace(/\/[a-f0-9-]{36}/, '/:id')} HTTP status`);
    return response.json() as Promise<T>;
  }


 const token=await signIn('clinic');
 let state=await api<CareWorkspace>('/care/workspaces',201,token,{});
 const path=`/care/workspaces/${state.id}`;
 const send=async(command:CareCommand)=>{state=await api<CareWorkspace>(`${path}/commands`,200,token,{expectedRevision:state.revision,command},randomUUID());};
 const doctor=state.coordination!.staff.find(p=>p.role==='doctor'&&!p.userId)!;
 const nurse=state.coordination!.staff.find(p=>p.role==='nurse'&&!p.userId)!;
 const encounter=state.orders[2]!.encounterId;
 const scope={encounterIds:[encounter],rule:'validated_result_acknowledgement' as const,sources:['HIS','LIS'] as ('HIS'|'LIS')[],recipientStaffIds:[doctor.id],expiresAt:new Date(Date.now()+3600000).toISOString()};
 await send({type:'shift_monitoring',action:'create',scope});
 assert.equal(state.shiftMonitoring![0]!.status,'awaiting_approval');
 const monitorId=state.shiftMonitoring![0]!.id;
 await send({type:'shift_monitoring',action:'approve',monitorId,expectedVersion:1});
 assert.equal(state.shiftMonitoring![0]!.items.length,1);
 await send({type:'shift_monitoring',action:'pause',monitorId,expectedVersion:1});
 await send({type:'shift_monitoring',action:'edit',monitorId,expectedVersion:1,scope});
 assert.equal(state.shiftMonitoring![0]!.approvedAt,undefined);
 await send({type:'shift_monitoring',action:'approve',monitorId,expectedVersion:2});
 await send({type:'shift_monitoring',action:'stop',monitorId,expectedVersion:2});
 assert.equal(state.shiftMonitoring![0]!.status,'stopped');
 console.log('PASS Hosted bounded monitoring approval, pause, edit/reapproval and stop');
 await send({type:'handover_document',action:'create',encounterIds:[encounter],recipientStaffId:nurse.id});
 const documentId=state.handoverDocuments![0]!.id;
 await send({type:'handover_document',action:'edit',documentId,expectedVersion:1,recipientStaffId:nurse.id,body:'Synthetic release check: please inspect the recorded result acknowledgement.'});
 await send({type:'handover_document',action:'share',documentId,expectedVersion:2});
 const before=state.encounters.find(e=>e.id===encounter)!.assignedTo;
 await send({type:'set_demo_staff',staffId:nurse.id});
 await send({type:'handover_document',action:'receive',documentId,expectedVersion:2});
 assert.ok(state.handoverDocuments![0]!.versions[1]!.receivedAt);
 assert.equal(state.encounters.find(e=>e.id===encounter)!.assignedTo,before);
 const task=state.tasks.find(t=>t.kind==='specimen_receipt')!;
 const originalStatus=task.status;
 await send({type:'soft_acknowledge_task',taskId:task.id,note:'Synthetic release check: collection team contacted.'});
 assert.equal(state.tasks.find(t=>t.id===task.id)!.status,originalStatus);
 console.log('PASS Hosted edited handover exact-version receipt and non-closing nurse acknowledgement');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

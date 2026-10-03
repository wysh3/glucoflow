import {spawn} from 'node:child_process';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createTestContext,createFixture,stageFixtureUpload,jobState,removeClinic} from '../tests/integration/harness';
import {appRoot,ensureLocalEnv} from './lib/env';
if (!process.argv.includes('--confirm-live')) throw new Error('Pass --confirm-live to authorize up to three bounded synthetic model jobs');
const config = ensureLocalEnv();
if (config.APP_ENV === 'production' || config.EXTRACTION_PROVIDER !== 'openai-compatible' || config.EXTRACTION_MODEL !== 'gpt-6-luna') throw new Error('This check requires local GPT-6 Luna configuration');
const context=await createTestContext();
const fixture=await createFixture(context,'luna-production-worker');
let worker: ReturnType<typeof spawn> | undefined;
const objects: string[]=[];const jobIds:string[]=[];
try {
 const pending=await context.owner(c=>c.query("select count(*)::int as n from sutra.jobs where state in ('queued','running','retry_wait')"));
 if(pending.rows[0].n!==0)throw new Error('Refusing isolated verification while unrelated jobs are pending');
 worker=spawn(process.execPath,[join(appRoot,'apps/worker/dist/worker.mjs')],{cwd:appRoot,env:{...process.env,...ensureLocalEnv()},stdio:'ignore'});
 const filenames=['2026-09-14_lab_report.pdf','2026-03-02_prescription.pdf','2026-05-20_eye_examination.pdf'];
 const staged=[];
 for(const filename of filenames) {
  const upload=await stageFixtureUpload(context,fixture,{filename,queueJob:true});
  objects.push(...upload.objectPaths);jobIds.push(upload.jobId);staged.push({...upload,filename});
 }
 const reports=[];
 for(const upload of staged) {
  const deadline=Date.now()+180000;
  let status=await jobState(context,upload.jobId);
  while(!['succeeded','failed'].includes(status.state) && Date.now()<deadline) {
   await new Promise(r=>setTimeout(r,500));status=await jobState(context,upload.jobId);
  }
  if(status.state!=='succeeded')throw new Error(`Job failed: ${upload.filename}, ${status.state}, ${status.error_code}`);
  const details=await context.owner(async c=>{
   const facts=await c.query('select kind, normalized_json from sutra.draft_facts where document_id=$1',[upload.documentId]);
   const run=await c.query('select provider, model, mode, input_tokens, output_tokens, actual_cost_usd from sutra.extraction_runs where document_id=$1 order by created_at desc limit 1',[upload.documentId]);
   const doc=await c.query('select released_to_patient from sutra.documents where id=$1',[upload.documentId]);
   return {facts:facts.rows,run:run.rows[0],releasedToPatient:doc.rows[0].released_to_patient};
  });
  if(details.run.model!=='gpt-6-luna'||details.run.mode!=='live'||details.releasedToPatient)throw new Error('Live provenance or publication gate failed');
  const kind=upload.filename.includes('prescription')?'prescription':upload.filename.includes('examination')?'examination':'observation';
  const matching=details.facts.filter(f=>f.kind===kind);
  if(!matching.length)throw new Error(`Expected ${kind} facts missing`);
  if(kind==='prescription'&&!matching.some(f=>f.normalized_json.name==='Metformin'))throw new Error('Prescription name lost');
  if(kind==='examination'&&!matching.some(f=>f.normalized_json.sourceText))throw new Error('Examination text lost');
  reports.push({filename:upload.filename,...details});
 }
 await writeFile('reports/live-worker-luna-2026-10-03.json',JSON.stringify({synthetic:true,productionBundle:true,model:'gpt-6-luna',automaticPublication:false,documents:reports},null,2)+'\n');
 console.log(JSON.stringify({passed:reports.length,productionBundle:true,model:'gpt-6-luna',humanPublicationGate:true}));
} finally {
 if(worker){worker.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));}
 await removeClinic(context,fixture.clinicId);await removeClinic(context,fixture.otherClinicId);
 for(const path of objects)await context.storage.deleteObject(context.sourceBucket,path);
 for(const id of jobIds)await rm(join(ensureLocalEnv().TMP_ROOT!,id),{recursive:true,force:true});
 await context.close();
}

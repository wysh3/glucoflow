import * as React from 'react';
import { Activity, Upload, NotebookPen, FileText, HeartPulse } from 'lucide-react';
import {useParams,Link,Navigate} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,Legend,ResponsiveContainer} from 'recharts';
import {MEDICATION_PHASES,screeningState} from '@glucoflow/domain';
import type {MasterProfile,MasterEventInput,MasterEvent} from '@glucoflow/contracts';
import {Button,Input,Select,Textarea,Label} from '@glucoflow/ui';
import {useSession} from '../../auth/session';
import {openAuthorizedUrl} from '../../platform/download';
import {QueryState} from '../../components/state-views';
import {MasterChart} from './plot';
const SCREENINGS=['Retinal screening','Renal monitoring','Foot / neuropathy review','Cardiovascular review'] as const;
const box='rounded-2xl border border-line bg-surface p-4 sm:p-5';
function localTimestamp():string{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function latest(events:MasterEvent[],kind:string,test?:string):MasterEvent|undefined{return events.find(e=>e.kind===kind&&(!test||e.payload.test===test));}
export function MasterPage():React.ReactElement{
 const {me,api}=useSession();const params=useParams();const cache=useQueryClient();
 const clinic=!!params.patientId;
 const patientId=params.patientId??me?.capabilities.patientIds[0];
 const query=useQuery({queryKey:['master',patientId],queryFn:()=>api.request<MasterProfile>(`/api/v1/patients/${patientId}/master`),enabled:!!patientId,refetchInterval:15000});
 const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState('');const [notice,setNotice]=React.useState('');
 const [value,setValue]=React.useState('');const [context,setContext]=React.useState<'fasting'|'postmeal'|'random'>('fasting');
 const [time,setTime]=React.useState(localTimestamp);const [symptomTime,setSymptomTime]=React.useState(localTimestamp);const [medication,setMedication]=React.useState('');
 const [symptom,setSymptom]=React.useState('');const [severity,setSeverity]=React.useState<'mild'|'moderate'|'severe'>('mild');
 const [test,setTest]=React.useState<(typeof SCREENINGS)[number]>('Retinal screening');const [lastDate,setLastDate]=React.useState('');const [interval,setInterval]=React.useState('');
 const [selectedSnapshot,setSelectedSnapshot]=React.useState<MasterEvent|null>(null);
 const send=async(input:MasterEventInput):Promise<void>=>{
  setBusy(true);setError('');setNotice('');
  try{const saved=await api.request<MasterEvent>(`/api/v1/patients/${patientId}/master/events`,{method:'POST',body:input,idempotencyKey:crypto.randomUUID()});
   if(input.kind==='sos'){setSelectedSnapshot(saved);setNotice('Snapshot delivered to the demo clinic desk.');}
   else setNotice('Saved to the patient timeline.');
   await cache.invalidateQueries({queryKey:['master',patientId]});
  }catch(e){setError(e instanceof Error?e.message:'Could not save this entry.');}finally{setBusy(false);}
 };
 if(!patientId)return <Navigate to="/account" replace/>;
 const data=query.data;const events=data?.events??[];const today=(data?.serverTime??new Date().toISOString()).slice(0,10);
 const readings=events.filter(e=>e.kind==='glucose');const symptoms=events.filter(e=>e.kind==='symptom');
 const snapshots=events.filter(e=>e.kind==='sos');
 const category=latest(events,'category')?.payload.category??'';
 const downloadSnapshot=async(event:MasterEvent):Promise<void>=>{
  setError('');
  try{const result=await api.request<{url:string;filename:string}>(`/api/v1/patients/${patientId}/master/snapshots/${event.id}/download`);await openAuthorizedUrl(result.url,result.filename);}
  catch(error){setError(error instanceof Error?error.message:'The snapshot could not be downloaded.');}
 };
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold text-ink">{clinic?'Home reports':'Home readings & reporting'}</h1><span className="text-xs text-ink-soft">Synthetic demo</span></div>
  {!clinic ? <div className="flex flex-wrap gap-2"><Button asChild variant="primary"><Link to="/patient/add-report"><Upload size={16} aria-hidden />Try a sample report</Link></Button><Button asChild variant="secondary"><Link to="/patient/records"><FileText size={16} aria-hidden />My records</Link></Button><Button asChild variant="secondary"><Link to="/patient/visit-notes"><NotebookPen size={16} aria-hidden />Write a note</Link></Button></div> : null}
  <QueryState isLoading={query.isLoading} error={query.error} onRetry={()=>void query.refetch()}>{data?<>
  {!clinic?<div className="grid gap-4 lg:grid-cols-2">
   <form className={`${box} space-y-3`} onSubmit={e=>{e.preventDefault();void send({kind:'glucose',payload:{value:Number(value),context,timestamp:new Date(time).toISOString(),medicationTiming:medication}});}}><h2 className="text-lg font-semibold">Add a home glucose reading</h2>
    <Label htmlFor="home-value">Glucose (mg/dL)</Label><Input id="home-value" type="number" min="10" max="1000" required value={value} onChange={e=>setValue(e.target.value)}/>
    <Label htmlFor="home-context">Reading type</Label><Select id="home-context" value={context} onChange={e=>setContext(e.target.value as typeof context)}><option value="fasting">Fasting</option><option value="postmeal">Post-meal</option><option value="random">Random</option></Select>
    <Label htmlFor="home-time">Measured at</Label><Input id="home-time" type="datetime-local" required value={time} onChange={e=>setTime(e.target.value)}/>
    <Label htmlFor="home-medication">Medication timing (optional)</Label><Input id="home-medication" maxLength={160} value={medication} onChange={e=>setMedication(e.target.value)}/><Button type="submit" disabled={busy}>Save reading</Button>
   </form>
   <form className={`${box} space-y-3`} onSubmit={e=>{e.preventDefault();void send({kind:'symptom',payload:{body:symptom,severity,timestamp:new Date(symptomTime).toISOString()}});}}><h2 className="text-lg font-semibold">Report a problem</h2><Label htmlFor="symptom-body">What happened?</Label><Textarea id="symptom-body" required maxLength={1000} placeholder="Dizziness, foot numbness, shaking or medication side effects" value={symptom} onChange={e=>setSymptom(e.target.value)}/><Label htmlFor="symptom-severity">Reported severity</Label><Select id="symptom-severity" value={severity} onChange={e=>setSeverity(e.target.value as typeof severity)}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></Select><Label htmlFor="symptom-time">Occurred at</Label><Input id="symptom-time" type="datetime-local" required value={symptomTime} onChange={e=>setSymptomTime(e.target.value)}/><Button type="submit" disabled={busy}>Send problem report</Button></form>
  </div>:<div className="grid gap-4 lg:grid-cols-2">
   <form className={`${box} space-y-3`} onSubmit={e=>{e.preventDefault();void send({kind:'screening',payload:{test,lastDate:lastDate||null,intervalDays:Number(interval)}});}}><h2 className="text-lg font-semibold">Screening tracking</h2><Label htmlFor="screening-test">Review</Label><Select id="screening-test" value={test} onChange={e=>setTest(e.target.value as typeof test)}>{SCREENINGS.map(t=><option key={t}>{t}</option>)}</Select><Label htmlFor="screening-date">Last completed date</Label><Input id="screening-date" type="date" value={lastDate} onChange={e=>setLastDate(e.target.value)}/><Label htmlFor="screening-interval">Configured interval (days)</Label><Input id="screening-interval" type="number" min="1" max="730" required value={interval} onChange={e=>setInterval(e.target.value)}/><Button type="submit" disabled={busy}>Save tracking rule</Button></form>
   <section className={`${box} space-y-3`}><h2 className="text-lg font-semibold">20/80 operational categories</h2><p className="text-xs leading-5 text-ink-soft">Proposed framework: 80% routine maintenance and 20% higher-supervision cases. These proportions are illustrative, not a measured clinic distribution.</p><Label htmlFor="care-category">Clinician-assigned category</Label><Select id="care-category" value={String(category)} disabled={busy} onChange={e=>void send({kind:'category',payload:{category:e.target.value as 'Routine maintenance'|'Higher supervision'}})}><option value="" disabled>Not assigned</option><option>Routine maintenance</option><option>Higher supervision</option></Select><p className="text-xs text-ink-soft">The category organizes review. It does not decide access to care.</p><Link className="inline-block min-h-11 py-3 text-sm text-primary" to={`/clinic/patients/${patientId}/documents`}>Open uploaded reports</Link></section>
  </div>}
  {!data.scenario?<div className={box}><p>No supplied five-year scenario is assigned to this patient. Home entries remain separate from the other clinic.</p></div>:<details className={box}><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Synthetic example history</summary>
   <div className={`${box} flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-soft`} role="group" aria-label="Data pipeline">{['Synthetic source records','Clinic review','Approved timeline','Home reports','Patient view','Care team view'].map((stage,i)=><React.Fragment key={stage}><span>{stage}</span>{i<5?<span aria-hidden>→</span>:null}</React.Fragment>)}</div>
   <div className="grid gap-4 ">
    <div className={box}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Longitudinal glucose trends</h2><span className="text-xs text-ink-soft">Five supplied observations per test</span></div><MasterChart/></div>

   </div>
   <div className={box}><h2 className="mb-3 text-lg font-semibold">Synchronized event timeline</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{MEDICATION_PHASES.map((p,i)=><div key={p.phase} className="border-l-2 border-primary pl-3 text-xs leading-5"><p className="font-semibold">{i===2?'| + △':'|'} {p.date??p.period}</p><p>{p.medication}</p><details className="mt-1 text-ink-soft"><summary className="cursor-pointer">{p.phase}</summary><p>{p.detail}</p></details></div>)}</div><p className="mt-3 text-xs text-ink-soft">| Medication / intervention · △ Patient-reported problem. Events show timing; they do not establish why a value changed.</p></div>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
    ['eGFR','75 → 70 → 64 → 58 → 55','mL/min as supplied · synthetic source values'],['LDL','125 → 148 mg/dL','2022 → 2026 · synthetic source values'],['HDL','45 → 38 mg/dL','2022 → 2026 · synthetic source values'],['Peripheral / neurological','Monofilament sensory checks','Recorded intervals and clinic review'],['Cardiovascular','ECG + review milestones','Recorded examinations and clinic review'],
   ].map(([name,v,n])=><div className={box} key={name}><p className="text-xs font-semibold">{name}</p><p className="mt-2 text-sm font-medium">{v}</p><p className="mt-2 text-xs text-ink-soft">{n}</p></div>)}</div>
  </details>}
  <div>
   <section className={box}><h2 className="mb-3 text-lg font-semibold">Configured tracking</h2><div className="space-y-3">{SCREENINGS.map(t=>{const event=latest(events,'screening',t);const date=event?.payload.lastDate as string|null??null;const days=event ? Number(event.payload.intervalDays) : null;const state=days ? screeningState(date,days,today) : 'No tracking rule configured';return <div key={t} className="flex items-start justify-between gap-3 text-xs"><div><p className="font-medium">{t}</p><p className="mt-1 text-ink-soft">{date??'No date entered'}{days ? ` · Staff-configured ${days}-day interval` : ''}</p></div><span className={state==='Pending review'?'text-[#a66808]':'text-ink-soft'}>{state}</span></div>;})}</div><p className="mt-4 text-xs leading-5 text-ink-soft">Pending means the staff-configured administrative interval elapsed; it is not a clinical screening recommendation. No recorded date does not establish whether a test was performed.</p></section>

  </div>

  {(readings.length>0||symptoms.length>0)?<section className={box}><h2 className="mb-3 text-lg font-semibold">Home telemetry & patient-reported events</h2>{readings.length>0?<div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={readings.slice().reverse().map(e=>({time:new Date(String(e.payload.timestamp)).getTime(),value:Number(e.payload.value)}))} margin={{left:0,right:18,bottom:12}}><CartesianGrid strokeDasharray="3 4"/><XAxis dataKey="time" type="number" domain={['dataMin','dataMax']} tickFormatter={v=>new Date(v).toLocaleDateString()} fontSize={11}/><YAxis unit=" mg/dL" width={65} fontSize={11}/><Tooltip labelFormatter={v=>new Date(Number(v)).toLocaleString()}/><Line type="linear" dataKey="value" stroke="#137a76" connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>:null}<ul className="divide-y divide-line">{events.filter(e=>['glucose','symptom'].includes(e.kind)).slice(0,30).map(e=><li key={e.id} className="py-3 text-sm"><p>{e.kind==='glucose'?`${e.payload.value} mg/dL · ${e.payload.context}`:`△ ${e.payload.body} · ${e.payload.severity}`}</p><p className="mt-1 text-xs text-ink-soft">Patient reported · {new Date(String(e.payload.timestamp)).toLocaleString()}{e.payload.medicationTiming?` · ${e.payload.medicationTiming}`:''}</p></li>)}</ul></section>:null}
  <section className={`${box} border-[#d9a5ae]`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{clinic?'Emergency snapshot inbox':'One-tap SOS snapshot'}</h2>{!clinic?<Button variant="secondary" disabled={busy} onClick={()=>void send({kind:'sos',payload:{}})}>Send SOS snapshot</Button>:null}</div><p className="mt-2 text-xs leading-5 text-ink-soft">Freezes medication history, approved records, reported problems and baseline telemetry for the demo clinic desk. This demo does not contact emergency responders or replace emergency medical care.</p><ul className="mt-3 divide-y divide-line">{snapshots.map(e=>{const ack=events.find(a=>a.kind==='ack_sos'&&a.payload.snapshotId===e.id);return <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"><span>{new Date(e.createdAt).toLocaleString()} · {ack?'Acknowledged by clinic':'Delivered to demo clinic desk'}</span><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>setSelectedSnapshot(e)}>Inspect snapshot</Button><Button variant="secondary" onClick={()=>void downloadSnapshot(e)}>Download JSON</Button>{clinic&&!ack?<Button disabled={busy} onClick={()=>void send({kind:'ack_sos',payload:{snapshotId:e.id}})}>Acknowledge</Button>:null}</div></li>;})}</ul>{selectedSnapshot?<details open className="mt-4"><summary className="cursor-pointer text-sm font-medium">Frozen snapshot · SHA-256</summary><p className="mt-2 break-all font-mono text-[11px] text-ink-soft">{selectedSnapshot.digest}</p><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-canvas p-3 text-[11px]">{JSON.stringify(selectedSnapshot.payload,null,2)}</pre></details>:null}</section>
  {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}{notice?<p role="status" className="text-sm text-primary">{notice}</p>:null}
  <p className="text-xs leading-5 text-ink-soft">Objective technical tracking. Clinical interpretation remains with the licensed physician. The supplied five-year scenario is illustrative; home reports remain patient reported. Saved events are append-only in the application. Database administrators retain technical control.</p>
  </>:null}</QueryState>
 </div>;
}

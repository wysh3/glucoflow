import { ArrowUpRight, Network, ClipboardCheck, Users } from 'lucide-react';
import type { CareWorkspace } from '@glucoflow/contracts';
import { terminalStatuses, taskStatusLabels } from './shared';

export function GlucoGreeting({workspace,openTask,openPipeline,openView}:{workspace:CareWorkspace;openTask:(id:string)=>void;openPipeline:()=>void;openView:(view:'teams'|'worklist')=>void}) {
 const active=workspace.tasks.filter(task=>!terminalStatuses.has(task.status));
 const approvals=active.filter(task=>task.status==='awaiting_approval');
 return <section lang="en" aria-label="Your care at a glance" className="gluco-greeting">
  <p className="gluco-greeting-eyebrow">YOUR CARE, AT A GLANCE · SYNTHETIC</p>
  <h3>Hi, I’m Gluco.</h3><p className="gluco-greeting-intro">Let’s see what needs the team’s attention.</p>
  <div className="gluco-greeting-stats">
   <button onClick={()=>openView('worklist')}><ClipboardCheck size={17}/><strong>{active.length}</strong><span>open tasks</span><ArrowUpRight size={15}/></button>
   <button onClick={()=>openView('teams')}><Users size={17}/><strong>{workspace.encounters.length}</strong><span>encounters</span><ArrowUpRight size={15}/></button>
  </div>
  <button className="gluco-greeting-map" onClick={openPipeline} aria-label="Explore the visual care pipeline">
   <span className="gluco-greeting-map-title"><Network size={17}/> See how the work connects <ArrowUpRight size={16}/></span>
   <span className="gluco-greeting-path" aria-hidden="true"><span>Care team</span><i/><span>Laboratory</span><i/><span>Receiving team</span></span>
   <span className="gluco-greeting-map-caption">Open the map to inspect evidence, owners and handovers.</span>
  </button>
  <div className="gluco-greeting-tasks"><p>{approvals.length ? `${approvals.length} awaiting approval` : 'Current work'}</p>
   {active.slice(0,3).map(task=><button key={task.id} onClick={()=>openTask(task.id)}><span><strong>{workspace.encounters.find(item=>item.id===task.encounterId)?.patientName ?? 'Encounter'}</strong><small>{task.title}</small></span><span className="gluco-greeting-status">{taskStatusLabels[task.status]}<ArrowUpRight size={14}/></span></button>)}
   {!active.length?<span>No open tasks in this workspace. You can still explore its recorded evidence.</span>:null}
  </div>
  <p className="gluco-greeting-footnote">Current workspace view. Actions stay with your team.</p>
 </section>;
}

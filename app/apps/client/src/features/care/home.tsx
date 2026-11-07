import { ArrowUpRight, CheckCheck, Clock3, FileText } from 'lucide-react';
import type { CareEvent, CareWorkspace } from '@glucoflow/contracts';
import { terminalStatuses, taskStatusLabels, When } from './shared';

export function CareHome({workspace, openView, openSource, openTask}: {
  workspace: CareWorkspace;
  openView: (view: 'teams' | 'activity' | 'worklist') => void;
  openSource: (event: CareEvent) => void;
  openTask: (taskId: string) => void;
}) {
  const open = workspace.tasks.filter(task => !terminalStatuses.has(task.status));
  const nextTasks = [...open].sort((a,b) => Number(b.status === 'awaiting_approval') - Number(a.status === 'awaiting_approval') || Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(0,3);
  const recent = [...workspace.events].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,3);
  const owners = [...new Set(open.map(task=>task.owner))];
  return <div className="care-home">
    <header className="care-home-heading">
      <p>{new Intl.DateTimeFormat('en-IN',{weekday:'long',month:'short',day:'numeric'}).format(new Date())}</p>
      <h2 id="care-ask-title">Your care desk</h2>
      <span>Pending work across {workspace.encounters.length} fictional encounters.</span>
    </header>
    <div className="care-home-grid">
      <button type="button" className="care-home-card care-home-total" onClick={()=>openView('worklist')}>
        <span className="care-home-card-label"><Clock3 size={15} aria-hidden /> Open operational tasks <ArrowUpRight size={15} aria-hidden /></span>
        <strong>{open.length}</strong>
        <span>{open.length ? 'Open the worklist or choose a task beside it.' : 'No open tasks in this workspace.'}</span>
        <div className="care-home-total-footer"><CheckCheck size={15} aria-hidden />{workspace.tasks.filter(task=>task.status==='source_confirmed').length} confirmed by source events</div>
      </button>
      <section className="care-home-card" aria-label="Tasks to review">
        <h3>Pick up where the team left off</h3>
        {nextTasks.map(task => <button type="button" key={task.id} className="care-home-event" onClick={() => openTask(task.id)}>
          <span><strong>{task.title}</strong><small>{workspace.encounters.find(encounter=>encounter.id===task.encounterId)?.patientName ?? 'Encounter'} · {taskStatusLabels[task.status]}</small></span>
          <ArrowUpRight size={14} aria-hidden />
        </button>)}
        {!nextTasks.length ? <p className="care-home-muted">Nothing is waiting for review.</p> : null}
      </section>
      <section className="care-home-card" aria-label="Recent source events">
        <h3>Recent source events</h3>
        {recent.length ? recent.map(event=><button className="care-home-event" type="button" key={event.id} onClick={()=>openSource(event)}>
          <FileText size={15} aria-hidden /><span><strong>{event.label}</strong><small>{workspace.encounters.find(encounter=>encounter.id===event.encounterId)?.patientName ?? 'Encounter'} · {event.source}</small></span><span className="care-home-event-time"><When value={event.occurredAt} short /></span>
        </button>):<p className="care-home-muted">No source events recorded.</p>}
      </section>
      <section className="care-home-card" aria-label="Handover ownership">
        <div className="care-home-section-title"><h3>Handover owners</h3><button type="button" aria-label="Open encounters" onClick={()=>openView('teams')}><ArrowUpRight size={17} aria-hidden /></button></div>
        {owners.slice(0,3).map(owner=><div key={owner} className="care-home-owner"><span>{owner}</span><strong>{open.filter(task=>task.owner===owner).length} open</strong></div>)}
        {!owners.length ? <p className="care-home-muted">No unresolved ownership to hand over.</p>:null}
        <p className="care-home-muted">Ownership comes from the saved task. Clinical decisions stay with the treating team.</p>
      </section>
    </div>
  </div>;
}

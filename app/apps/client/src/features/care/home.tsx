import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CheckCheck, Clock3, FileText } from 'lucide-react';
import type { CareEvent, CareWorkspace } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';
import { When, roleLabels } from './shared';
import { homeWork } from './home-work';
import { handoverReviewParams } from './handover-inbox';

export function CareHome({workspace, shared, openView, openSource, openTask, openCoordination}: {
  workspace: CareWorkspace;
  shared?: boolean;
  openView: (view: 'teams' | 'activity' | 'worklist') => void;
  openSource: (event: CareEvent) => void;
  openTask: (taskId: string) => void;
  openCoordination: (encounterId: string) => void;
}) {
  const { me } = useSession();
  const [params, setParams] = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const now = new Date();
  const { person, items, incomingCount, open } = homeWork(workspace, { shared, actorId: me?.actor.userId }, now.toISOString());
  const recent = [...workspace.events].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,3);
  const owners = [...new Set(open.map(task=>task.owner))];
  const renderItem = ({ id, encounterId, title, detail, target, due }: typeof items[number]) => <button type="button" key={id}
    className="care-home-event" onClick={() => {
      if (target.kind === 'source') openSource(target.event);
      else if (target.kind === 'task') openTask(target.id);
      else if (target.kind === 'handover') setParams(handoverReviewParams(params, target.id, target.version), { preventScrollReset: true });
      else openCoordination(target.id);
    }}>
    <span className="break-words"><strong>{title}</strong><small>{workspace.encounters.find(encounter => encounter.id === encounterId)?.patientName ?? 'Encounter'} · {detail}
      {due && <> · Respond by <When value={due} /></>}</small></span>
    <ArrowUpRight size={14} aria-hidden />
  </button>;
  return <div className="care-home">
    <header className="care-home-heading">
      <p>{new Intl.DateTimeFormat('en-IN',{weekday:'long',month:'short',day:'numeric'}).format(now)}</p>
      <h2 id="care-ask-title">{roleLabels[workspace.role]} care desk</h2>
      <span>{person ? `${person.name} · ${person.team}. ` : ''}Pending work across {workspace.encounters.length} fictional encounters.</span>
    </header>
    <div className="care-home-grid">
      <section className="care-home-card" aria-label="Work for this role">
        <h3>{incomingCount ? `${incomingCount} awaiting your response` : 'Work for this role'}</h3>
        {items.slice(0, 3).map(renderItem)}
        {items.length > 3 && <>
          {expanded && items.slice(3).map(renderItem)}
          <button type="button" aria-expanded={expanded} className="mt-2 min-h-8 text-xs text-primary"
            onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `Show more work (${items.length - 3})`}</button>
        </>}
        {!items.length && <p className="care-home-muted">No offers or review items for this role. The team worklist shows open tasks across the workspace.</p>}
      </section>
      <button type="button" className="care-home-card care-home-total" onClick={()=>openView('worklist')}>
        <span className="care-home-card-label"><Clock3 size={15} aria-hidden /> Team worklist <ArrowUpRight size={15} aria-hidden /></span>
        <strong>{open.length}</strong>
        <span>{open.length ? 'Open operational tasks across the workspace' : 'No open tasks in this workspace.'}</span>
        <div className="care-home-total-footer"><CheckCheck size={15} aria-hidden />{workspace.tasks.filter(task=>task.status==='source_confirmed').length} confirmed by source events</div>
      </button>
      <section className="care-home-card" aria-label="Recent source events">
        <h3>Recent source events</h3>
        {recent.length ? recent.map(event=><button className="care-home-event" type="button" key={event.id} onClick={()=>openSource(event)}>
          <FileText size={15} aria-hidden /><span><strong>{event.label}</strong><small>{workspace.encounters.find(encounter=>encounter.id===event.encounterId)?.patientName ?? 'Encounter'} · {event.source}</small></span><span className="care-home-event-time"><When value={event.occurredAt} short /></span>
        </button>):<p className="care-home-muted">No source events recorded.</p>}
      </section>
      <section className="care-home-card" aria-label="Team task ownership">
        <div className="care-home-section-title"><h3>Task owners</h3><button type="button" aria-label="Open encounters" onClick={()=>openView('teams')}><ArrowUpRight size={17} aria-hidden /></button></div>
        {owners.slice(0,3).map(owner=><div key={owner} className="care-home-owner"><span>{owner}</span><strong>{open.filter(task=>task.owner===owner).length} open</strong></div>)}
        {!owners.length ? <p className="care-home-muted">No unresolved ownership to hand over.</p>:null}
        <p className="care-home-muted">Ownership comes from the saved task. Clinical decisions stay with the treating team.</p>
      </section>
    </div>
  </div>;
}

import { useEffect, useState } from 'react';
import type { CareWorkspace } from '@glucoflow/contracts';
import { Button, Spinner } from '@glucoflow/ui';
import { useApi } from '../../auth/session';
import { careErrorText } from './use-care-workspace';
import { CareDialog, When } from './shared';

type Revision = { id: string; revision: number; recordedAt: string; baseline: boolean; origin: 'staff' | 'worker' | 'baseline' };
type RevisionPage = { revisions: Revision[]; nextCursor: string | null };
type Snapshot = { id: string; revision: number; recordedAt: string; baseline: boolean; state: CareWorkspace };

/** Read-only evidence: viewing history never replaces the active workspace. */
export function WorkspaceHistory({ workspaceId, close }: { workspaceId: string; close: () => void }) {
  const { request } = useApi();
  const [rows, setRows] = useState<Revision[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const base = `/api/v1/care/workspaces/${encodeURIComponent(workspaceId)}/history`;
    const load = async () => {
      try {
        if (selected) {
          setSnapshot(await request<Snapshot>(`${base}/${encodeURIComponent(selected)}`, { signal: controller.signal }));
        } else {
          const page = await request<RevisionPage>(base, { query: { cursor }, signal: controller.signal });
          if (controller.signal.aborted) return;
          setRows(previous => cursor ? [...new Map([...previous, ...page.revisions].map(row => [row.id, row])).values()] : page.revisions);
          setNextCursor(page.nextCursor);
        }
      } catch (caught) {
        if (!controller.signal.aborted) setError(careErrorText(caught));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [request, workspaceId, selected, cursor, retry]);

  return <CareDialog open title="Workspace history" description="Saved revisions and their source evidence. Viewing a revision does not change your current work."
    onOpenChange={open => { if (!open) close(); }}>
    {selected ? <Button type="button" size="sm" variant="quiet" onClick={() => { setSelected(null); setSnapshot(null); }}>Back to revisions</Button> : null}
    {loading ? <div className="py-4"><Spinner label="Loading history" /></div> : null}
    {error ? <div role="alert" className="py-3 text-sm text-danger"><p>{error}</p><Button type="button" size="sm" onClick={() => setRetry(value => value + 1)}>Try again</Button></div> : null}
    {!selected ? <>
      {!rows.length && !loading && !error ? <p className="py-4 text-sm text-ink-soft">No saved revisions yet.</p> : null}
      <ul className="divide-y divide-line">
        {rows.map(row => <li key={row.id}><button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left hover:bg-canvas"
          onClick={() => { setSelected(row.id); setSnapshot(null); }}>
          <span><strong className="block text-sm font-medium">Revision {row.revision}</strong><span className="text-xs text-ink-soft"><When value={row.recordedAt} /></span></span>
          <span className="text-xs text-ink-soft">{row.baseline ? 'Initial retained snapshot' : row.origin === 'worker' ? 'Background update' : 'Staff update'}</span>
        </button></li>)}
      </ul>
      {nextCursor ? <Button type="button" variant="quiet" size="sm" disabled={loading} onClick={() => setCursor(nextCursor)}>Load earlier revisions</Button> : null}
    </> : snapshot && !loading && !error ? <div className="space-y-4 pt-3">
      <div><h3 className="text-sm font-semibold">Revision {snapshot.revision}</h3><p className="text-xs text-ink-soft"><When value={snapshot.recordedAt} /></p></div>
      <p className="text-sm">{snapshot.state.encounters.length} encounters · {snapshot.state.tasks.length} tasks · {snapshot.state.events.length} source events</p>
      {snapshot.baseline ? <p className="text-xs text-ink-soft">History starts at this retained snapshot. Earlier changes are not reconstructed.</p> : null}
      <section><h3 className="mb-2 text-sm font-medium">Task ownership</h3><ul className="divide-y divide-line">{snapshot.state.tasks.map(task => <li key={task.id} className="py-2 text-sm"><p>{task.title}</p><p className="text-xs text-ink-soft">{task.owner} · {task.status.replaceAll('_', ' ')}</p></li>)}</ul>{!snapshot.state.tasks.length ? <p className="text-xs text-ink-soft">No tasks recorded.</p> : null}</section>
      <section><h3 className="mb-2 text-sm font-medium">Source evidence at this revision</h3><ul className="divide-y divide-line">{[...snapshot.state.events].reverse().map(event => <li key={event.id} className="py-2 text-sm"><p>{event.label}</p><p className="break-words text-xs text-ink-soft">{event.source} · {event.sourceRef} · <When value={event.occurredAt} /></p></li>)}</ul></section>
    </div> : null}
  </CareDialog>;
}

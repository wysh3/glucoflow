import { Button, Spinner } from '@glucoflow/ui';
import { useSession } from '../../auth/session';
import { CareDialog, roleLabels, When } from './shared';
import { careErrorText, type CareWorkspaceState } from './use-care-workspace';

export function WorkspaceTeamPanel({ state, close }: { state: CareWorkspaceState; close: () => void }) {
  const { me } = useSession();
  const { team } = state;
  const active = team.data?.members.filter(member => member.active) ?? [];
  return <CareDialog open title="Workspace team" description="Access is verified by the server. Team assignments are configured by an authorized workspace administrator."
    onOpenChange={open => { if (!open) close(); }}>
    {team.isPending ? <Spinner label="Loading team access" /> : null}
    {team.error ? <div role="alert" className="space-y-2 text-sm text-danger"><p>{careErrorText(team.error)}</p><Button type="button" size="sm" onClick={() => void team.refetch()}>Try again</Button></div> : null}
    {team.data ? <div className="space-y-4">
      <div className="rounded-lg bg-canvas p-3 text-sm">
        <p className="font-medium">{team.data.access.shared ? 'Shared workspace' : 'Private simulation'}</p>
        <p className="mt-1 text-ink-soft">{team.data.access.shared ? `Your assigned role: ${team.data.access.role ? roleLabels[team.data.access.role] : 'Unavailable'}.` : 'Only the owning account can open this workspace. Simulation roles do not create separate staff identities.'}</p>
      </div>
      {active.length ? <ul className="divide-y divide-line">{active.map((member, index) => <li key={member.userId} className="flex items-center justify-between gap-3 py-3">
        <div><p className="text-sm font-medium">{member.userId === me?.actor.userId ? 'You' : `Team member ${index + 1}`}</p><p className="text-xs text-ink-soft">Assigned <When value={member.assignedAt} /></p></div>
        <span className="text-sm">{roleLabels[member.role]}</span>
      </li>)}</ul> : <p className="text-sm text-ink-soft">No additional staff assignments.</p>}
      {team.data.access.shared ? <p className="text-xs text-ink-soft">Members use separate authenticated accounts. Demo account sharing does not identify individual staff members.</p> : null}
    </div> : null}
  </CareDialog>;
}

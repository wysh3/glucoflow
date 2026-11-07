import { useState } from 'react';
import { Button, Input, Label, Spinner } from '@glucoflow/ui';
import type { CareRole } from '@glucoflow/contracts';
import { useApi, useSession } from '../../auth/session';
import { CareDialog, roleLabels, When } from './shared';
import { careErrorText, type CareWorkspaceState } from './use-care-workspace';

export function WorkspaceTeamPanel({ state, close }: { state: CareWorkspaceState; close: () => void }) {
  const { me } = useSession();
  const { request } = useApi();
  const { team } = state;
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [role, setRole] = useState<CareRole>('nurse');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const owner = !!me && team.data?.access.ownerId === me.actor.userId;
  const members = (team.data?.members ?? []) as Array<{ userId: string; role: CareRole; active: boolean; assignedAt: string; displayName?: string; email?: string | null }>;
  const active = members.filter(member => member.active);
  const target = members.find(member => member.userId === editing);
  const begin = (userId: string, currentRole: CareRole = 'nurse') => {
    setEditing(userId); setRemoving(false); setRole(currentRole); setEmail(''); setError(''); setNotice('');
  };
  const save = async (revoke = false) => {
    if (!state.workspace || !owner || !editing || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/api/v1/care/workspaces/${state.workspace.id}/team`, {
        method: 'POST', body: editing === 'add' ? { email: email.trim(), role, active: true } : { userId: editing, role, active: !revoke },
      });
      setEditing(null); setEmail('');
      await Promise.all([team.refetch(), state.refresh()]);
      setNotice(revoke ? 'Workspace access removed.' : 'Team access saved.');
    } catch (failure) { setError(careErrorText(failure)); }
    finally { setBusy(false); }
  };
  return <CareDialog open title="Workspace team" description="People with access to this care workspace. Each person signs in with their own account."
    onOpenChange={open => { if (!open && !busy) close(); }}>
    <div className="grid gap-4 p-5">
      {team.isPending ? <Spinner label="Loading team access" /> : null}
      {team.error ? <div role="alert" className="space-y-2 text-sm text-danger"><p>{careErrorText(team.error)}</p><Button type="button" size="sm" onClick={() => void team.refetch()}>Try again</Button></div> : null}
      {team.data && <>
        <div className="text-sm"><p className="font-medium">{team.data.access.shared ? 'Shared workspace' : 'Private simulation'}</p>
          <p className="mt-1 text-ink-soft">{team.data.access.shared ? `Your role: ${team.data.access.role ? roleLabels[team.data.access.role] : 'Unavailable'}.` : 'Only you can open this workspace. Simulation roles represent fictional staff.'}</p></div>
        {owner && <Button type="button" size="sm" variant="quiet" className="justify-self-start" disabled={busy} onClick={() => begin('add')}>Add staff member</Button>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        {active.length ? <ul className="divide-y divide-line">{active.map((member, index) => <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><p className="text-sm font-medium">{member.userId === me?.actor.userId ? 'You' : member.displayName || `Team member ${index + 1}`}{member.userId === team.data?.access.ownerId ? ' · Owner' : ''}</p>
            {owner && member.email && <p className="text-xs text-ink-soft">{member.email}</p>}
            <p className="text-xs text-ink-soft">Assigned <When value={member.assignedAt} /></p></div>
          <div className="flex items-center gap-2"><span className="text-sm">{roleLabels[member.role]}</span>{owner && <Button type="button" size="sm" variant="quiet" disabled={busy} onClick={() => begin(member.userId, member.role)} aria-label={`Manage ${member.displayName || (member.userId === me?.actor.userId ? 'your access' : `team member ${index + 1}`)}`}>Manage</Button>}</div>
        </li>)}</ul> : <p className="text-sm text-ink-soft">No staff have been added yet.</p>}
        {!owner && <p className="text-xs text-ink-soft">The workspace owner manages staff access.</p>}
        {editing && owner && <form className="grid gap-3 rounded-xl border border-line p-4" onSubmit={event => { event.preventDefault(); void save(removing); }}>
          <h3 className="font-semibold">{removing ? 'Remove workspace access?' : editing === 'add' ? 'Add staff member' : `Manage ${target?.displayName || 'staff access'}`}</h3>
          {editing === 'add' && <><div className="grid gap-1.5"><Label htmlFor="team-email">Clinic account email</Label><Input id="team-email" type="email" required autoComplete="off" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></div>
            <p className="text-xs text-ink-soft">Use an existing active account in your clinic. This grants workspace access; it does not send an invitation.</p>
            {!team.data.access.shared && <p className="text-xs text-ink-soft">Adding staff creates a shared workspace. Your owner account is enrolled too; simulation role switching is then disabled.</p>}</>}
          {removing ? <p className="text-sm text-ink-soft">This person will no longer be able to open this workspace. Existing records remain in the audit history.</p> : <div className="grid gap-1.5"><Label htmlFor="team-role">Workspace role</Label><select id="team-role" className="h-10 rounded-lg border border-line bg-white px-3 text-sm" value={role} onChange={event => setRole(event.target.value as CareRole)}>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></div>}
          <p className="text-xs text-ink-soft">Doctor access requires an existing clinician account. Roles are enforced by the server.</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!removing && editing !== 'add' && editing !== team.data.access.ownerId && <Button type="button" variant="quiet" disabled={busy} className="mr-auto" onClick={() => { setRemoving(true); setError(''); }}>Remove access</Button>}
            <Button type="button" variant="quiet" disabled={busy} onClick={() => { setEditing(null); setError(''); }}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : removing ? 'Remove access' : 'Save access'}</Button>
          </div>
        </form>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </>}
    </div>
  </CareDialog>;
}

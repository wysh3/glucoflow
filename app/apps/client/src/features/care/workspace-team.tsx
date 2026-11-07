import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button, Input, Label, Spinner } from '@glucoflow/ui';
import type { CareRole, HospitalStaffDirectory } from '@glucoflow/contracts';
import { useApi, useSession } from '../../auth/session';
import { hospitalTeamPath } from '../hospital/use-hospitals';
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
  const [selectedStaff, setSelectedStaff] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const owner = !!me && team.data?.access.ownerId === me.actor.userId;
  const hospitalClinicId = team.data?.access.hospitalClinicId;
  const members = (team.data?.members ?? []) as Array<{ userId: string; role: CareRole; active: boolean; assignedAt: string; displayName?: string; email?: string | null }>;
  const active = members.filter(member => member.active);
  const target = members.find(member => member.userId === editing);
  const directory = useInfiniteQuery({
    queryKey: ['hospital-workspace-candidates', me?.actor.userId, hospitalClinicId],
    queryFn: ({ signal, pageParam }) => request<HospitalStaffDirectory>(
      `/api/v1/hospitals/${encodeURIComponent(hospitalClinicId!)}/staff`, { signal, query: { cursor: pageParam } },
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: !!hospitalClinicId && owner && editing === 'add',
    retry: false,
  });
  const candidates = (directory.data?.pages.flatMap(page => page.members) ?? [])
    .filter(member => member.active && member.careRole && !active.some(item => item.userId === member.userId));
  const candidate = !directory.error && candidates.find(member => member.userId === selectedStaff);
  const begin = (userId: string, currentRole: CareRole = 'nurse') => {
    setEditing(userId); setRemoving(false); setRole(currentRole); setEmail(''); setSelectedStaff(''); setError(''); setNotice('');
  };
  const save = async (revoke = false) => {
    if (!state.workspace || !owner || !editing || busy) return;
    const body = editing === 'add'
      ? hospitalClinicId
        ? candidate && candidate.careRole && { userId: candidate.userId, role: candidate.careRole, active: true }
        : { email: email.trim(), role, active: true }
      : { userId: editing, role, active: !revoke };
    if (!body || (hospitalClinicId && editing !== 'add' && !revoke)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/api/v1/care/workspaces/${state.workspace.id}/team`, { method: 'POST', body });
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
        {(owner || hospitalClinicId) && <div className="flex flex-wrap items-center gap-2">
          {owner && <Button type="button" size="sm" variant="quiet" disabled={busy} onClick={() => begin('add')}>Add staff member</Button>}
          {hospitalClinicId && <Button asChild size="sm" variant="secondary">
            <Link to={`${hospitalTeamPath}?clinicId=${encodeURIComponent(hospitalClinicId)}`}>Hospital team</Link>
          </Button>}
        </div>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        {active.length ? <ul className="divide-y divide-line">{active.map((member, index) => <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><p className="text-sm font-medium">{member.userId === me?.actor.userId ? 'You' : member.displayName || `Team member ${index + 1}`}{member.userId === team.data?.access.ownerId ? ' · Owner' : ''}</p>
            {owner && member.email && <p className="text-xs text-ink-soft">{member.email}</p>}
            <p className="text-xs text-ink-soft">Assigned <When value={member.assignedAt} /></p></div>
          <div className="flex items-center gap-2"><span className="text-sm">{roleLabels[member.role]}</span>{owner && (!hospitalClinicId || member.userId !== me?.actor.userId) && <Button type="button" size="sm" variant="quiet" disabled={busy} onClick={() => begin(member.userId, member.role)} aria-label={`Manage ${member.displayName || (member.userId === me?.actor.userId ? 'your access' : `team member ${index + 1}`)}`}>Manage</Button>}</div>
        </li>)}</ul> : <p className="text-sm text-ink-soft">No staff have been added yet.</p>}
        {!owner && <p className="text-xs text-ink-soft">The workspace owner manages staff access.</p>}
        {editing && owner && <form className="grid gap-3 rounded-xl border border-line p-4" onSubmit={event => { event.preventDefault(); void save(removing); }}>
          <h3 className="font-semibold">{removing ? 'Remove workspace access?' : editing === 'add' ? 'Add staff member' : `Manage ${target?.displayName || 'staff access'}`}</h3>
          {editing === 'add' && hospitalClinicId && <div className="grid gap-2">
            {directory.isPending ? <Spinner label="Loading hospital staff" /> : null}
            {directory.error ? <div role="alert" className="space-y-2 text-sm text-danger">
              <p>{careErrorText(directory.error)}</p>
              <Button type="button" size="sm" onClick={() => void directory.refetch()}>Try again</Button>
            </div> : directory.isSuccess && (candidates.length ? <>
              <Label htmlFor="workspace-hospital-member">Hospital staff member</Label>
              <select id="workspace-hospital-member" className="h-10 max-w-full rounded-lg border border-line bg-surface px-3 text-sm"
                required disabled={busy} value={selectedStaff} onChange={event => setSelectedStaff(event.target.value)}>
                <option value="">Choose a staff member</option>
                {candidates.map(member => <option key={member.userId} value={member.userId}>
                  {member.displayName} · {member.careRole && roleLabels[member.careRole]} · {member.email || member.userId.slice(0, 8)}
                </option>)}
              </select>
            </> : <p className="text-sm text-ink-soft">No eligible staff members on this page.</p>)}
            {!directory.error && directory.hasNextPage && <Button type="button" size="sm" variant="quiet"
              disabled={directory.isFetchingNextPage} onClick={() => void directory.fetchNextPage()}>
              {directory.isFetchingNextPage ? 'Loading more staff…' : 'Load more staff'}
            </Button>}
          </div>}
          {editing === 'add' && !hospitalClinicId && <><div className="grid gap-1.5"><Label htmlFor="team-email">Clinic account email</Label><Input id="team-email" type="email" required autoComplete="off" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></div>
            <p className="text-xs text-ink-soft">Use an existing active account in your clinic. This grants workspace access; it does not send an invitation.</p>
            {!team.data.access.shared && <p className="text-xs text-ink-soft">Adding staff creates a shared workspace. Your owner account is enrolled too; simulation role switching is then disabled.</p>}</>}
          {removing ? <p className="text-sm text-ink-soft">This person will no longer be able to open this workspace. Existing records remain in the audit history.</p> : !hospitalClinicId && <div className="grid gap-1.5"><Label htmlFor="team-role">Workspace role</Label><select id="team-role" className="h-10 rounded-lg border border-line bg-white px-3 text-sm" value={role} onChange={event => setRole(event.target.value as CareRole)}>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></div>}
          {hospitalClinicId ? <p className="text-xs text-ink-soft">Workspace access uses the member’s current hospital care role. A hospital administrator manages that assignment.</p>
            : <p className="text-xs text-ink-soft">Doctor access requires an existing clinician account. Roles are enforced by the server.</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!removing && editing !== 'add' && editing !== team.data.access.ownerId && <Button type="button" variant="quiet" disabled={busy} className="mr-auto" onClick={() => { setRemoving(true); setError(''); }}>Remove access</Button>}
            <Button type="button" variant="quiet" disabled={busy} onClick={() => { setEditing(null); setError(''); }}>Cancel</Button>
            {(!hospitalClinicId || editing === 'add' || removing) && <Button type="submit"
              disabled={busy || (!!hospitalClinicId && editing === 'add' && !candidate)}>{busy ? 'Saving…' : removing ? 'Remove access' : 'Save access'}</Button>}
          </div>
        </form>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </>}
    </div>
  </CareDialog>;
}

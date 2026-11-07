import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Label, Spinner } from '@glucoflow/ui';
import type { CareRole, HospitalContext, HospitalStaffAssignment, HospitalStaffUpdate, HospitalStaffAudit, HospitalStaffDirectory, HospitalStaffMember } from '@glucoflow/contracts';
import { describeApiError, useSession } from '../../auth/session';
import { SystemPageHeader } from '../../components/system-page-header';
import { ApiRequestError } from '../../lib/api';
import { CARE_HOME } from '../../lib/clinic-home';
import { roleLabels, When } from '../care/shared';
import { useHospitals } from './use-hospitals';

const selectStyle = 'min-h-11 rounded-lg border border-line bg-surface px-3 text-sm';
const responsibilities: Record<CareRole, string> = {
  doctor: 'Reviews and acknowledges results and requests or accepts clinical handovers.',
  nurse: 'Accepts assigned work and documents specimen collection or other work performed.',
  lab: 'Records specimen receipt, processing and source-validated lab events.',
  coordinator: 'Registers encounters, records locations and coordinates placement and administrative handoffs.',
};

export function HospitalTeamPage() {
  const hospitals = useHospitals();
  const [params, setParams] = useSearchParams();
  const options = hospitals.data?.hospitals ?? [];
  const clinic = options.find(item => item.clinicId === params.get('clinicId')) ?? options[0];
  return <div className="max-w-[760px] space-y-4">
    <SystemPageHeader title="Hospital team" meta="Staff accounts and assigned responsibilities"
      actions={<Button asChild variant="quiet"><Link to="/account">Back to account</Link></Button>} />
    {hospitals.isPending && <Spinner label="Loading hospital access" />}
    {hospitals.error ? <LoadError error={hospitals.error} retry={() => void hospitals.refetch()} /> :
      hospitals.isSuccess && (clinic ? <>
        {options.length > 1 && <div className="grid max-w-sm gap-1.5">
          <Label htmlFor="hospital-context">Hospital</Label>
          <select id="hospital-context" className={selectStyle} value={clinic.clinicId}
            onChange={event => setParams({ clinicId: event.target.value })}>
            {options.map(item => <option key={item.clinicId} value={item.clinicId}>{item.displayName}</option>)}
          </select>
        </div>}
        <StaffDirectory key={clinic.clinicId} clinic={clinic} />
      </> : <p className="text-sm text-ink-soft">Your account has no active hospital staff access.</p>)}
  </div>;
}

function StaffDirectory({ clinic }: { clinic: HospitalContext }) {
  const { api, me } = useSession();
  const actorId = me?.actor.userId;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string>();
  const [notice, setNotice] = useState('');
  const base = `/api/v1/hospitals/${encodeURIComponent(clinic.clinicId)}`;
  const directoryKey = ['hospital-staff', actorId, clinic.clinicId, clinic.administrator];
  const auditKey = ['hospital-audit', actorId, clinic.clinicId];
  const directory = useInfiniteQuery({
    queryKey: directoryKey,
    queryFn: ({ pageParam, signal }) => api.request<HospitalStaffDirectory>(`${base}/staff`, { query: { cursor: pageParam }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    retry: false,
  });
  const assignment = useMutation({
    mutationFn: ({ member, body }: { member: HospitalStaffMember; body: HospitalStaffUpdate }) =>
      api.request<HospitalStaffMember>(`${base}/staff/${encodeURIComponent(member.userId)}`, { method: 'PATCH', body }),
    onSuccess: (_result, { member, body }) => {
      setEditing(undefined);
      setNotice(!body.active ? 'Hospital access revoked.' : member.active ? 'Hospital access updated.' : 'Hospital access activated.');
    },
    onError: error => {
      if (error instanceof ApiRequestError && error.isStale) {
        setEditing(undefined);
        setNotice('This staff account changed while you were editing. Review the refreshed access before making another change.');
      }
    },
    onSettled: async (_result, error) => {
      // A timed-out request can have committed. Re-read the server before another edit.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: directoryKey }),
        queryClient.invalidateQueries({ queryKey: auditKey }),
        queryClient.invalidateQueries({ queryKey: ['hospitals', actorId] }),
      ]);
      if (!error) void queryClient.invalidateQueries({ queryKey: ['care-workspaces', actorId] });
    },
  });
  const members = directory.data?.pages.flatMap(page => page.members) ?? [];
  return <>
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{clinic.displayName}</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">Your access · <AccessText access={clinic} /></p>
        </div>
        {clinic.careRole && <Button asChild variant="secondary">
          <Link to={`${CARE_HOME}?workspaces=shared&clinicId=${encodeURIComponent(clinic.clinicId)}`}>
            Shared workspaces <ArrowRight size={16} aria-hidden />
          </Link>
        </Button>}
      </CardHeader>
      <CardBody className="text-sm text-ink-soft">
        {clinic.careRole
          ? 'Open a shared workspace assigned to your signed-in account. The care workspace uses synthetic encounters.'
          : 'Shared care workspaces require a separately assigned care role.'}
      </CardBody>
    </Card>
    <Card>
      <CardHeader><CardTitle>Staff directory</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        {clinic.administrator && <p className="text-sm text-ink-soft">
          An operator adds verified sign-in accounts to the directory. Activate a listed account and assign its responsibilities here.
        </p>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        {directory.isPending && <Spinner label="Loading staff directory" />}
        {directory.error ? <LoadError error={directory.error} retry={() => void directory.refetch()} /> :
          directory.isSuccess && (members.length ? <ul className="divide-y divide-line">
            {members.map(member => <li key={member.userId} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="break-words font-semibold">{member.displayName}{member.userId === actorId && ' (you)'}</p>
                  {clinic.administrator && member.email && <p className="break-words text-ink-soft">{member.email}</p>}
                  <p className="mt-1 text-ink-soft"><AccessText access={member} /></p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!member.active && <Badge tone="neutral">Inactive</Badge>}
                  {clinic.administrator && editing !== member.userId && <Button type="button" variant="quiet" size="sm"
                    aria-label={`Manage ${member.displayName}`} disabled={assignment.isPending} onClick={() => {
                      assignment.reset(); setNotice(''); setEditing(member.userId);
                    }}>Manage</Button>}
                </div>
              </div>
              {clinic.administrator && editing === member.userId && <StaffEditor member={member}
                self={member.userId === actorId} busy={assignment.isPending} error={assignment.error}
                cancel={() => { assignment.reset(); setEditing(undefined); }}
                save={body => assignment.mutate({ member, body })} />}
            </li>)}
          </ul> : <p className="text-sm text-ink-soft">No staff accounts are available.</p>)}
        {!directory.error && directory.hasNextPage && <Button type="button" size="sm" variant="quiet" disabled={directory.isFetchingNextPage}
          onClick={() => void directory.fetchNextPage()}>{directory.isFetchingNextPage ? 'Loading more staff…' : 'Load more staff'}</Button>}
      </CardBody>
    </Card>
    <Card>
      <details className="px-4 py-4 sm:px-6">
        <summary className="cursor-pointer text-sm font-semibold">What each role can do</summary>
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="font-medium">Hospital administrator</dt><dd className="text-ink-soft">Manages staff access and assignments. Clinical permissions require separate authorization.</dd></div>
          {Object.entries(responsibilities).map(([role, description]) =>
            <div key={role}><dt className="font-medium">{roleLabels[role as CareRole]}</dt><dd className="text-ink-soft">{description}</dd></div>)}
        </dl>
      </details>
    </Card>
    {clinic.administrator && <AuditPanel base={base} auditKey={auditKey} members={members} />}
  </>;
}

function AccessText({ access }: { access: Pick<HospitalContext, 'administrator' | 'careRole'> }) {
  return <>{access.administrator ? 'Hospital administrator · ' : ''}{access.careRole ? roleLabels[access.careRole] : 'No care role'}</>;
}

function StaffEditor({ member, self, busy, error, cancel, save }: {
  member: HospitalStaffMember;
  self: boolean;
  busy: boolean;
  error: unknown;
  cancel: () => void;
  save: (assignment: HospitalStaffUpdate) => void;
}) {
  const [expectedAssignment] = useState<HospitalStaffAssignment>(() => ({ administrator: member.administrator, careRole: member.careRole, active: member.active }));
  const [careRole, setCareRole] = useState(member.careRole);
  const [administrator, setAdministrator] = useState(member.administrator);
  const [revoking, setRevoking] = useState(false);
  const missingRole = !administrator && careRole === null;
  return <form className="mt-3 grid gap-3 rounded-xl border border-line p-3 sm:p-4"
    onSubmit={event => {
      event.preventDefault();
      if (busy) return;
      if (revoking) save({ administrator: member.administrator, careRole: member.careRole, active: false, expectedAssignment });
      else if (!missingRole) save({ administrator, careRole, active: true, expectedAssignment });
    }}>
    <h3 className="text-sm font-semibold">{revoking ? `Revoke access for ${member.displayName}?` : `Manage ${member.displayName}`}</h3>
    {revoking ? <p className="text-sm text-ink-soft">This removes hospital access and access to its shared workspaces. Past activity stays in the audit log.</p> :
      <fieldset disabled={busy} className="grid gap-3">
        <div className="grid max-w-sm gap-1.5">
          <Label htmlFor="hospital-care-role">Care role</Label>
          <select id="hospital-care-role" className={selectStyle} value={careRole ?? ''} disabled={self}
            onChange={event => setCareRole((event.target.value || null) as CareRole | null)}>
            <option value="">No care role</option>
            {Object.entries(roleLabels).map(([value, label]) =>
              <option key={value} value={value} disabled={value === 'doctor' && !member.clinician}>{label}</option>)}
          </select>
          <p className="text-xs text-ink-soft">{self
            ? 'Another administrator can change your care role.'
            : 'The doctor role requires independently granted clinician permission.'}</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={administrator}
            onChange={event => setAdministrator(event.target.checked)} />
          Hospital administrator
        </label>
        {missingRole && <p className="text-xs text-ink-soft">Choose a care role or hospital administrator access before saving.</p>}
      </fieldset>}
    {Boolean(error) && <p role="alert" className="text-sm text-danger">{describeApiError(error)}</p>}
    <div className="flex flex-wrap items-center justify-end gap-2">
      {member.active && !revoking && <Button type="button" variant="quiet" className="mr-auto" disabled={busy}
        onClick={() => setRevoking(true)}>Revoke access</Button>}
      <Button type="button" variant="quiet" disabled={busy} onClick={cancel}>Cancel</Button>
      <Button type="submit" disabled={busy || (!revoking && missingRole)}>
        {busy ? 'Saving…' : revoking ? 'Confirm revocation' : member.active ? 'Save access' : 'Activate access'}
      </Button>
    </div>
  </form>;
}

function AuditPanel({ base, auditKey, members }: { base: string; auditKey: (string | undefined)[]; members: HospitalStaffMember[] }) {
  const { api } = useSession();
  const [open, setOpen] = useState(false);
  const audit = useInfiniteQuery({
    queryKey: auditKey,
    queryFn: ({ pageParam, signal }) => api.request<HospitalStaffAudit>(`${base}/audit`, { query: { before: pageParam }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: open,
    retry: false,
  });
  const events = audit.data?.pages.flatMap(page => page.events) ?? [];
  const person = (id: string) => members.find(member => member.userId === id)?.displayName ?? `Account ${id.slice(0, 8)}`;
  return <Card>
    <details className="px-4 py-4 sm:px-6" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-semibold">Access history</summary>
      {open && <div className="mt-3 text-sm">
        {audit.isPending && <Spinner label="Loading access history" />}
        {audit.error ? <LoadError error={audit.error} retry={() => void audit.refetch()} /> :
          audit.isSuccess && (events.length ? <ul className="divide-y divide-line">
            {events.map(event => <li key={event.id} className="space-y-1 py-2">
              <p className="font-medium">{person(event.targetUserId)}</p>
              <p className="text-ink-soft"><When value={event.at} /> · {event.actorId ? person(event.actorId) : 'Operator'}</p>
              {event.previous && <p className="text-ink-soft">Previous · {event.previous.active ? 'Active' : 'Inactive'} · <AccessText access={event.previous} /></p>}
              <p className="text-ink-soft">Saved · {event.current.active ? 'Active' : 'Inactive'} · <AccessText access={event.current} /></p>
            </li>)}
          </ul> : <p className="text-ink-soft">No access changes have been recorded.</p>)}
        {!audit.error && audit.hasNextPage && <Button type="button" size="sm" variant="quiet" disabled={audit.isFetchingNextPage}
          onClick={() => void audit.fetchNextPage()}>{audit.isFetchingNextPage ? 'Loading history…' : 'Load older changes'}</Button>}
      </div>}
    </details>
  </Card>;
}

function LoadError({ error, retry }: { error: Error; retry: () => void }) {
  return <div role="alert" className="space-y-2 text-sm text-danger">
    <p>{describeApiError(error)}</p>
    <Button type="button" size="sm" variant="quiet" onClick={retry}>Try again</Button>
  </div>;
}

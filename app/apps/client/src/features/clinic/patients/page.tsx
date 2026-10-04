import { FlaskConical, ArrowRight, HeartPulse } from 'lucide-react';
import { demoEnabled } from '../../../auth/demo';
import { LoadMore } from '../../../components/load-more';
import * as React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Input, ScreenTitle, Table, TBody, TD, TH, THead, TR, formatDateOnly } from '@glucoflow/ui';
import { useSession } from '../../../auth/session';
import { usePatients } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';

/** Clinic patient list with search, identifier, last record date and pending count. */
export function ClinicPatientsPage(): React.ReactElement {
  const { me } = useSession();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const patients = usePatients(debounced.trim());

  if (!me?.contexts.some((context) => context.kind === 'clinic')) {
    return <Navigate to="/patient/records" replace />;
  }

  return (
    <div className="space-y-4">
      <ScreenTitle
        title="Patients"
        meta={me.capabilities.canReview ? 'Review queue and records' : 'Approved records'}
      />
      {demoEnabled && patients.data?.items[0] ? <section className="rounded-[20px] border border-primary/20 bg-gradient-to-br from-[#e7f3ec] to-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-lg"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-primary"><HeartPulse size={22} aria-hidden /></div>
            <h2 className="text-lg font-semibold tracking-tight">A ready-to-explore clinic</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">Meet Asha, our synthetic patient. Explore her records, or upload a sample and follow it from source to approved timeline.</p>
          </div>
          <Button asChild variant="primary"><Link to={`/clinic/patients/${patients.data.items[0].patientId}/${me.capabilities.canReview ? 'documents?sample=1' : 'overview'}`}>
            {me.capabilities.canReview ? <FlaskConical size={18} aria-hidden /> : <HeartPulse size={18} aria-hidden />}{me.capabilities.canReview ? 'Try a sample report' : 'Explore approved records'}<ArrowRight size={16} aria-hidden />
          </Link></Button>
        </div>
        <ol className="mt-5 grid gap-2 text-xs text-ink-soft sm:grid-cols-3">{(me.capabilities.canReview?['1 · Upload a labelled sample','2 · Check each entry against its source','3 · Publish and view the timeline']:['1 · Open the visit overview','2 · Inspect sources and dated context','3 · Export the approved visit summary']).map(step=><li key={step} className="rounded-xl border border-line bg-surface/75 px-3 py-3">{step}</li>)}</ol>
      </section> : null}
      <div className="max-w-[420px]">
        <label className="sr-only" htmlFor="patient-search">
          Search patients
        </label>
        <Input
          id="patient-search"
          value={search}
          placeholder="Search by name or identifier"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <QueryState
        isLoading={patients.isLoading}
        error={patients.error}
        isEmpty={patients.data?.items.length === 0}
        emptyTitle={debounced ? 'No matching patients' : 'No patients yet'}
        emptyDescription={
          debounced
            ? 'Clear the search or check the spelling of the identifier.'
            : 'Patients linked to this clinic appear here.'
        }
        emptyAction={
          debounced ? (
            <Button variant="secondary" onClick={() => setSearch('')}>
              Clear search
            </Button>
          ) : null
        }
        onRetry={() => void patients.refetch()}
      >
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Patient</TH>
                <TH className="hidden sm:table-cell">Identifier</TH>
                <TH className="hidden md:table-cell">Last record</TH>
                <TH className="hidden sm:table-cell">Pending</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {patients.data?.items.map((patient) => (
                <TR key={patient.patientId}>
                  <TD>
                    <span className="font-medium text-ink">{patient.displayName}</span><div className="mt-1 text-xs text-ink-soft sm:hidden">{patient.clinicIdentifier}{patient.pendingCount > 0 ? ` · ${patient.pendingCount} awaiting review` : ''}</div>
                  </TD>
                  <TD className="hidden sm:table-cell">{patient.clinicIdentifier}</TD>
                  <TD className="hidden md:table-cell">{patient.lastRecordDate ? formatDateOnly(patient.lastRecordDate) : 'None'}</TD>
                  <TD className="hidden sm:table-cell">
                    {patient.pendingCount > 0 ? (
                      <Badge tone="review">{patient.pendingCount} awaiting review</Badge>
                    ) : (
                      <span className="text-ink-soft">None</span>
                    )}
                  </TD>
                  <TD>
                    <Link
                      to={`/clinic/patients/${patient.patientId}/overview`}
                      className="inline-flex min-h-11 items-center rounded-[10px] border border-line px-4 text-sm text-ink hover:bg-canvas"
                    >
                      Open patient
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </QueryState>
      <LoadMore query={patients} />

      {me?.capabilities.canReview?<Button variant="quiet" onClick={() => navigate('/clinic/queue')}>
        Open the review queue
      </Button>:null}
    </div>
  );
}

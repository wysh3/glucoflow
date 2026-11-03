import * as React from 'react';
import { Link, useNavigate, useParams, Outlet, Navigate } from 'react-router-dom';
import { useSession } from '../../auth/session';
import { usePatient } from '../../lib/queries';
import { PatientContextHeader } from '../../components/patient-context';
import { QueryState } from '../../components/state-views';
import { Alert } from '@glucoflow/ui';
import { PatientSearch } from '../search/patient-search';

/**
 * Patient context layout. The patient identity stays pinned above the record tabs,
 * and no screen can change the active patient without this visible update.
 */
export function ClinicPatientLayout(): React.ReactElement {
  const { patientId } = useParams<{ patientId: string }>();
  const { me } = useSession();
  const navigate = useNavigate();
  const validPatientId = Boolean(
    patientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(patientId),
  );
  const patientQuery = usePatient(validPatientId ? patientId : undefined);

  const canViewClinic = me?.contexts.some((context) => context.kind === 'clinic') ?? false;
  if (!canViewClinic) return <Navigate to="/patient/records" replace />;
  if (!validPatientId) {
    return (
      <Alert tone="neutral" title="Patient not found">
        This patient link is not valid. Open the patient from the clinic list instead.
        <Link to="/clinic/patients" className="mt-3 inline-flex min-h-9 items-center rounded-[10px] border border-line px-3 text-sm font-medium text-ink hover:bg-canvas">
          Back to patients
        </Link>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <QueryState
        isLoading={patientQuery.isLoading}
        error={patientQuery.error}
        onRetry={() => void patientQuery.refetch()}
      >
        {patientQuery.data ? (
          <>
            <PatientContextHeader
              patient={patientQuery.data}
              actions={
                <span className="flex flex-wrap items-center gap-2">
                  <PatientSearch patientId={patientQuery.data.patientId} />
                </span>
              }
            />
            <Outlet context={patientQuery.data} />
            <div className="pt-2 pb-24 lg:pb-0">
              <button
                type="button"
                onClick={() => navigate('/clinic/patients')}
                className="min-h-11 rounded-[10px] border border-line bg-surface px-4 text-sm text-ink lg:hidden"
              >
                ← All patients
              </button>
            </div>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}

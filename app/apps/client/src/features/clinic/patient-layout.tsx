import * as React from 'react';
import { useNavigate, useParams, Outlet, Navigate } from 'react-router-dom';
import { useSession } from '../../auth/session';
import { usePatient } from '../../lib/queries';
import { PatientContextHeader } from '../../components/patient-context';
import { QueryState } from '../../components/state-views';
import { PatientSearch } from '../search/patient-search';

/**
 * Patient context layout. The patient identity stays pinned above the record tabs,
 * and no screen can change the active patient without this visible update.
 */
export function ClinicPatientLayout(): React.ReactElement {
  const { patientId } = useParams<{ patientId: string }>();
  const { me } = useSession();
  const navigate = useNavigate();
  const patientQuery = usePatient(patientId);

  const canViewClinic = me?.contexts.some((context) => context.kind === 'clinic') ?? false;
  if (!canViewClinic) return <Navigate to="/patient/records" replace />;

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
            <div className="pt-2">
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

import * as React from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { useSession } from './auth/session';
import { AppShell } from './components/app-shell';
import { ErrorState, Spinner } from '@sutra/ui';
import { SignInPage } from './features/sign-in/page';
import { AccountPage } from './features/account/page';
import { ClinicPatientsPage } from './features/clinic/patients/page';
import { ClinicQueuePage } from './features/clinic/queue/page';
import { ClinicPatientLayout } from './features/clinic/patient-layout';
import { ProgressionPage } from './features/clinic/progression/page';
import { DocumentsPage } from './features/clinic/documents/page';
import { HistoryPage } from './features/clinic/history/page';
import { ReviewPage } from './features/clinic/review/page';
import { PatientRecordsPage } from './features/patient/records/page';
import { PatientAddReportPage } from './features/patient/add-report/page';
import { PatientVisitNotesPage } from './features/patient/visit-notes/page';

/**
 * Routes for both roles on web and Android. The active role comes from the
 * server-verified contexts, never from a client-selected claim.
 */
export function AppRoutes(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route element={<ProtectedShell />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/clinic/patients" element={<ClinicPatientsPage />} />
          <Route path="/clinic/queue" element={<ClinicQueuePage />} />
          <Route path="/clinic/patients/:patientId" element={<ClinicPatientLayout />}>
            <Route index element={<Navigate to="progression" replace />} />
            <Route path="progression" element={<ProgressionPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
          <Route path="/clinic/review/:documentId" element={<ReviewPage />} />
          <Route path="/patient/records" element={<PatientRecordsPage />} />
          <Route path="/patient/add-report" element={<PatientAddReportPage />} />
          <Route path="/patient/visit-notes" element={<PatientVisitNotesPage />} />
        </Route>
        <Route path="*" element={<LandingRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedShell(): React.ReactElement {
  const { status, error, me } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner label="Loading your session" />
      </div>
    );
  }
  if (status === 'unavailable') {
    return (
      <div className="mx-auto flex min-h-screen max-w-[560px] items-center justify-center px-4">
        <ErrorState
          title="The service is not reachable"
          description={error ?? 'Check that the API is running and try again.'}
        />
      </div>
    );
  }
  if (status !== 'signed-in' || !me) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function LandingRedirect(): React.ReactElement {
  const { status, me } = useSession();
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner label="Loading" />
      </div>
    );
  }
  if (status !== 'signed-in' || !me) return <Navigate to="/sign-in" replace />;
  const clinic = me.contexts.some((context) => context.kind === 'clinic');
  const patient = me.contexts.some((context) => context.kind === 'patient');
  if (clinic && !patient) return <Navigate to="/clinic/patients" replace />;
  if (patient && !clinic) return <Navigate to="/patient/records" replace />;
  return <Navigate to="/account" replace />;
}

/** Exported for tests: the role landing decision without the router. */
export function landingPathFor(contexts: { kind: string }[]): string {
  const clinic = contexts.some((context) => context.kind === 'clinic');
  const patient = contexts.some((context) => context.kind === 'patient');
  if (clinic && !patient) return '/clinic/patients';
  if (patient && !clinic) return '/patient/records';
  return '/account';
}

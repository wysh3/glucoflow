import {GlucoGuide} from './features/guide/gluco-guide';
import {VisitOverviewPage} from './features/clinic/overview/page';
import {DeltaPage} from './features/delta/page';
import {DeltaDemoPage} from './features/delta/demo-page';
import {BodyMapPage} from './features/clinic/bodymap/page';
import {LandingPage} from './features/landing/page';
import {MasterPage} from './features/master/page';
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
import { ErrorState, Spinner } from '@glucoflow/ui';
import { SignInPage } from './features/sign-in/page';
import { AccountPage } from './features/account/page';
import { ClinicPatientsPage } from './features/clinic/patients/page';
import { ResultsPage } from './features/clinic/results/page';
import { ClinicQueuePage } from './features/clinic/queue/page';
import { ClinicPatientLayout } from './features/clinic/patient-layout';
import { ProgressionPage } from './features/clinic/progression/page';
import { DocumentsPage } from './features/clinic/documents/page';
import { HistoryPage } from './features/clinic/history/page';
import { ReviewPage } from './features/clinic/review/page';
import { PatientRecordsPage } from './features/patient/records/page';
import { PatientAddReportPage } from './features/patient/add-report/page';
import { PatientVisitNotesPage } from './features/patient/visit-notes/page';
import { NotFoundPage } from './features/not-found/page';

/**
 * Routes for both roles on web and Android. The active role comes from the
 * server-verified contexts, never from a client-selected claim.
 */
export function AppRoutes(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/demo/delta" element={<DeltaDemoPage />} />
        <Route element={<ProtectedShell />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/clinic/results" element={<ClinicGate><ResultsPage /></ClinicGate>} />
          <Route path="/clinic/patients" element={<ClinicGate><ClinicPatientsPage /></ClinicGate>} />
          <Route path="/clinic/queue" element={<ClinicGate><ClinicQueuePage /></ClinicGate>} />
          <Route path="/clinic/patients/:patientId" element={<ClinicGate><ClinicPatientLayout /></ClinicGate>}>
            <Route index element={<Navigate to="delta" replace />} />
            <Route path="delta" element={<DeltaPage />} />
            <Route path="bodymap" element={<BodyMapPage />} />
            <Route path="overview" element={<VisitOverviewPage />} />
            <Route path="master" element={<MasterPage />} />
            <Route path="progression" element={<ProgressionPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
          <Route path="/clinic/review/:documentId" element={<ClinicGate><ReviewPage /></ClinicGate>} />
          <Route path="/patient/master" element={<PatientGate><MasterPage /></PatientGate>} />
          <Route path="/patient/records" element={<PatientGate><PatientRecordsPage /></PatientGate>} />
          <Route path="/patient/add-report" element={<PatientGate><PatientAddReportPage /></PatientGate>} />
          <Route path="/patient/visit-notes" element={<PatientGate><PatientVisitNotesPage /></PatientGate>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <GlucoGuide/>
    </BrowserRouter>
  );
}

function roleFallback(contexts: { kind: string }[]): string {
  if (contexts.some((context) => context.kind === 'clinic')) return '/clinic/results';
  if (contexts.some((context) => context.kind === 'patient')) return '/patient/records';
  return '/account';
}

function ClinicGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const { me } = useSession();
  if (!me?.contexts.some((context) => context.kind === 'clinic')) {
    return <Navigate to={roleFallback(me?.contexts ?? [])} replace />;
  }
  return <>{children}</>;
}

function PatientGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const { me } = useSession();
  if (!me?.contexts.some((context) => context.kind === 'patient')) {
    return <Navigate to={roleFallback(me?.contexts ?? [])} replace />;
  }
  return <>{children}</>;
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

/** Exported for tests: the role landing decision without the router. */
export function landingPathFor(contexts: { kind: string }[]): string {
  const clinic = contexts.some((context) => context.kind === 'clinic');
  const patient = contexts.some((context) => context.kind === 'patient');
  if (clinic && !patient) return '/clinic/results';
  if (patient && !clinic) return '/patient/records';
  return '/account';
}

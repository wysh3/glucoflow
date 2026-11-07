import { LocaleDocument } from './i18n';

import { CARE_HOME, roleHome } from './lib/clinic-home';
import { normalizePathname } from './lib/route-path';


import * as React from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { useSession } from './auth/session';
import { AppShell } from './components/app-shell';
import { ErrorState, Spinner } from '@glucoflow/ui';
import { SignInPage } from './features/sign-in/page';






import { RoleGate } from './components/role-gate';











import { NotFoundPage } from './features/not-found/page';



const GlucoGuide = React.lazy(() => import('./features/guide/gluco-guide').then(module => ({ default: module.GlucoGuide })));
const VisitOverviewPage = React.lazy(() => import('./features/clinic/overview/page').then(module => ({ default: module.VisitOverviewPage })));
const AccountPage = React.lazy(() => import('./features/account/page').then(module => ({ default: module.AccountPage })));
const ClinicPatientsPage = React.lazy(() => import('./features/clinic/patients/page').then(module => ({ default: module.ClinicPatientsPage })));
const ShowcasePage = React.lazy(() => import('./features/showcase/page').then(module => ({ default: module.ShowcasePage })));
const ClinicQueuePage = React.lazy(() => import('./features/clinic/queue/page').then(module => ({ default: module.ClinicQueuePage })));
const ClinicPatientLayout = React.lazy(() => import('./features/clinic/patient-layout').then(module => ({ default: module.ClinicPatientLayout })));
const DocumentsPage = React.lazy(() => import('./features/clinic/documents/page').then(module => ({ default: module.DocumentsPage })));
const HistoryPage = React.lazy(() => import('./features/clinic/history/page').then(module => ({ default: module.HistoryPage })));
const PatientRecordsPage = React.lazy(() => import('./features/patient/records/page').then(module => ({ default: module.PatientRecordsPage })));
const PatientAddReportPage = React.lazy(() => import('./features/patient/add-report/page').then(module => ({ default: module.PatientAddReportPage })));
const PatientVisitNotesPage = React.lazy(() => import('./features/patient/visit-notes/page').then(module => ({ default: module.PatientVisitNotesPage })));
const PrivacyPage = React.lazy(() => import('./features/privacy/page').then(module => ({ default: module.PrivacyPage })));
const VerifyReceiptPage = React.lazy(() => import('./features/verify/page').then(module => ({ default: module.VerifyReceiptPage })));

const MasterPage = React.lazy(() => import('./features/master/page').then(module => ({ default: module.MasterPage })));

const ResultsPage = React.lazy(() => import('./features/clinic/results/page').then(module => ({ default: module.ResultsPage })));

const ObligationWorkspace = React.lazy(() => import('./features/clinic/obligations/page').then(module => ({ default: module.ObligationWorkspace })));

const ReplayPage = React.lazy(() => import('./features/clinic/replay/page').then(module => ({ default: module.ReplayPage })));

const ClosureCertificatePage = React.lazy(() => import('./features/clinic/results/certificate').then(module => ({ default: module.ClosureCertificatePage })));

const PatientReceiptSlipPage = React.lazy(() => import('./features/clinic/results/patient-slip').then(module => ({ default: module.PatientReceiptSlipPage })));

const ProgressionPage = React.lazy(() => import('./features/clinic/progression/page').then(module => ({ default: module.ProgressionPage })));

const ReviewPage = React.lazy(() => import('./features/clinic/review/page').then(module => ({ default: module.ReviewPage })));

const CarePage = React.lazy(async () => {
  const { CarePage } = await import('./features/care/page');
  return { default: CarePage };
});

/**
 * Routes for both roles on web and Android. The active role comes from the
 * server-verified contexts, never from a client-selected claim.
 */
export function AppRoutes(): React.ReactElement {
  return (
    <BrowserRouter>
      <LocaleDocument />
      <React.Suspense fallback={<div className="p-6"><Spinner label="Opening page" /></div>}>
      <Routes>
        <Route path="/" element={<SignInPage />} />
        <Route path="/sign-in" element={<EntryRedirect />} />
        <Route path="/demo/delta" element={<Navigate to="/showcase" replace />} />
        <Route path="/showcase" element={<ShowcasePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/verify/:code?" element={<VerifyReceiptPage />} />
        <Route path="/clinic/results/:resultId/survey-pack" element={<ClinicGate><ClosureCertificatePage /></ClinicGate>} />
        <Route path="/clinic/results/:resultId/patient-slip" element={<ClinicGate><PatientReceiptSlipPage /></ClinicGate>} />
        <Route element={<ProtectedShell />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/clinic/care" element={
            <ClinicGate>
              <React.Suspense fallback={<Spinner label="Opening care workspace" />}>
                <CarePage />
              </React.Suspense>
            </ClinicGate>
          } />
          <Route path="/clinic/results" element={<ClinicGate><ResultsPage /></ClinicGate>} />
          <Route path="/clinic/line" element={<ClinicGate><RoleGate capability="canClinician"><ObligationWorkspace view="line" /></RoleGate></ClinicGate>} />
          <Route path="/clinic/calls" element={<ClinicGate><RoleGate capability="canNurse"><ObligationWorkspace view="calls" /></RoleGate></ClinicGate>} />
          <Route path="/clinic/intake" element={<ClinicGate><RoleGate capability="canDesk"><ObligationWorkspace view="intake" /></RoleGate></ClinicGate>} />
          <Route path="/clinic/register" element={<ClinicGate><RoleGate capability="canQuality"><ObligationWorkspace view="register" /></RoleGate></ClinicGate>} />
          <Route path="/clinic/replay" element={<ClinicGate><ReplayPage /></ClinicGate>} />
          <Route path="/clinic/patients" element={<ClinicGate><ClinicPatientsPage /></ClinicGate>} />
          <Route path="/clinic/queue" element={<ClinicGate><ClinicQueuePage /></ClinicGate>} />
          <Route path="/clinic/patients/:patientId" element={<ClinicGate><ClinicPatientLayout /></ClinicGate>}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="delta" element={<Navigate to="../overview" relative="path" replace />} />
            <Route path="bodymap" element={<Navigate to="../overview" relative="path" replace />} />
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
      </React.Suspense>
      <RouteTitle />
      <ContextualGuide />
    </BrowserRouter>
  );
}

function EntryRedirect() {
  const { state } = useLocation();
  return <Navigate to="/" replace state={state} />;
}

const titles: Record<string, string> = {
  '/': 'Inpatient diabetes care',
  '/sign-in': 'Sign in',
  '/showcase': 'Walkthrough',
  '/privacy': 'Privacy and data use',
  '/account': 'Account',
  [CARE_HOME]: 'Care',
  '/clinic/patients': 'Patient records',
  '/clinic/queue': 'Report review queue',
  '/clinic/results': 'Result ledger',
  '/clinic/line': 'Clinician review',
  '/clinic/calls': 'Patient calls',
  '/clinic/intake': 'Lab intake',
  '/clinic/register': 'Closure register',
  '/clinic/replay': 'Cohort replay',
  '/patient/records': 'My records',
  '/patient/master': 'Home readings',
  '/patient/add-report': 'Add a report',
  '/patient/visit-notes': 'Visit notes',
};

function RouteTitle() {
  const location = useLocation();
  const { hash } = location;
  const pathname = normalizePathname(location.pathname);
  const action = useNavigationType();
  React.useEffect(() => {
    const name = titles[pathname] ??
      (pathname.startsWith('/verify') ? 'Verify a receipt' :
        pathname.startsWith('/clinic/patients/') ? 'Patient record' :
        pathname.startsWith('/clinic/review/') ? 'Report review' :
        pathname.startsWith('/clinic/results/') ? 'Result receipt' : 'Page not found');
    document.title = `${name} · GlucoFlow`;
  }, [pathname]);
  React.useEffect(() => {
    if (action !== 'POP' && !hash) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function ContextualGuide() {
  const { pathname } = useLocation();
  const path = normalizePathname(pathname);
  const { status } = useSession();
  return status !== 'signed-in' || path === CARE_HOME || path === '/privacy' || path === '/' ? null :
    <React.Suspense fallback={null}><GlucoGuide /></React.Suspense>;
}

function roleFallback(contexts: { kind: string; clinician?: boolean; desk?: boolean; nurse?: boolean; quality?: boolean }[]): string {
  return roleHome(contexts);
}

function ClinicGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const { status, me } = useSession();
  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-canvas"><Spinner label="Loading your session" /></div>;
  }
  if (status !== 'signed-in' || !me) {
    return <Navigate to="/sign-in" replace />;
  }
  if (!me.contexts.some((context) => context.kind === 'clinic')) {
    return <Navigate to={roleFallback(me.contexts)} replace />;
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
    return <Navigate to="/sign-in" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  }
  return (
    <AppShell>
      <React.Suspense fallback={<div className="p-6"><Spinner label="Opening page" /></div>}>
        <Outlet />
      </React.Suspense>
    </AppShell>
  );
}

/** Exported for tests: the role landing decision without the router. */
export function landingPathFor(contexts: { kind: string; clinician?: boolean; desk?: boolean; nurse?: boolean; quality?: boolean }[]): string {
  return roleHome(contexts);
}

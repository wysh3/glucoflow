import { ClinicNavigation } from './clinic-navigation';
import * as React from 'react';
import { Link, NavLink, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { ArrowLeftIcon, FileTextIcon, HeartPulseIcon, FilePenLineIcon, UploadIcon, UserIcon, UsersIcon } from 'lucide-animated';
import { Alert, Button, cn, useAnimatedIcon } from '@glucoflow/ui';
import { useSession } from '../auth/session';
import { ClipboardList, History, Inbox, NotebookPen, MessageCircle, TrendingUp, Home, Users, FolderOpen } from 'lucide-react';
import { installBackHandler } from '../platform/back';
import { CARE_HOME } from '../lib/clinic-home';
import { LanguageNotice, LanguagePicker, useI18n } from '../i18n';
import { normalizePathname } from '../lib/route-path';
import { CodexDesktopLayout, CodexSidebarRow } from '../vendor/codexapp/desktop-layout';
import { hospitalTeamPath, useHospitals } from '../features/hospital/use-hospitals';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  React.useEffect(() => {
    const update = (): void => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function DemoLabel(): React.ReactElement | null {
  const { config, me } = useSession();
  if (!config) return null;
  const label = `${config.demoLabel}${me?.extraction.mode === 'fixture' ? ' · fixture data' : ''}`;
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-soft">
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">Demo</span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const { me, signOut } = useSession();
  const hospitals = useHospitals();
  const { locale, t } = useI18n();
  const online = useOnlineStatus();
  const location = useLocation();
  const action = useNavigationType();
  React.useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void installBackHandler().then((cleanup) => {
      if (cancelled) cleanup();
      else dispose = cleanup;
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  const navigate = useNavigate();
  const [switching, setSwitching] = React.useState(false);
  const clinicContexts = me?.contexts.filter((context) => context.kind === 'clinic') ?? [];
  const patientContexts = me?.contexts.filter((context) => context.kind === 'patient') ?? [];
  const path = normalizePathname(location.pathname);
  const isClinicView = path.startsWith('/clinic');
  const isPatientView = path.startsWith('/patient');
  const isCareView = path === CARE_HOME;
  const isHospitalView = path === hospitalTeamPath;
  const main = React.useRef<HTMLElement>(null);
  const lastPath = React.useRef(path);
  const scrollPositions = React.useRef(new Map<string, number>());

  React.useLayoutEffect(() => {
    const element = main.current;
    if (!element) return;
    if (lastPath.current !== path) {
      lastPath.current = path;
      element.scrollTop = action === 'POP' ? scrollPositions.current.get(location.key) ?? 0 : 0;
    } else {
      scrollPositions.current.set(location.key, element.scrollTop);
    }
  }, [action, location.key, path]);
  const hospitalAccess = !hospitals.error && hospitals.data?.hospitals;
  const hasHospitalCare = hospitalAccess && hospitalAccess.some(hospital => hospital.careRole);
  const clinicNav = !isPatientView && (clinicContexts.length > 0 || hasHospitalCare);
  const closurePages = [
    { to: '/clinic/results', label: t('nav.resultLedger') },
    ...(me?.capabilities.canClinician ? [{ to: '/clinic/line', label: t('nav.clinicianReview') }] : []),
    ...(me?.capabilities.canNurse ? [{ to: '/clinic/calls', label: t('nav.patientCalls') }] : []),
    ...(me?.capabilities.canDesk ? [{ to: '/clinic/intake', label: t('nav.labIntake') }] : []),
    ...(me?.capabilities.canQuality ? [{ to: '/clinic/register', label: t('nav.closureRegister') }] : []),
  ];
  const closureActive = path === '/clinic/replay' || closurePages.some((page) => path === page.to);
  const recordsActive = path.startsWith('/clinic/patients') || path === '/clinic/queue' || path.startsWith('/clinic/review/');
  const account = { to: '/account', label: t('nav.account'), icon: UserIcon, active: path === '/account' || isHospitalView };
  const careClinic = isCareView ? new URLSearchParams(location.search).get('clinicId') : null;
  const careLink = (view?: string) => {
    const query = new URLSearchParams();
    if (careClinic) query.set('clinicId', careClinic);
    if (view) query.set('view', view);
    return CARE_HOME + (query.size ? `?${query}` : '');
  };
  const links = clinicNav ? [
    { to: careLink(), label: 'Home & chat', icon: Home, active: path === CARE_HOME && !new URLSearchParams(location.search).get('view') },
    { to: careLink('worklist'), label: 'Worklist', icon: ClipboardList, active: path === CARE_HOME && new URLSearchParams(location.search).get('view') === 'worklist' },
    { to: careLink('teams'), label: 'Encounters', icon: Users, active: path === CARE_HOME && new URLSearchParams(location.search).get('view') === 'teams' },
    ...(clinicContexts.length ? [{ to: '/clinic/patients', label: 'Records', icon: FolderOpen, active: recordsActive }] : []),
    account,
  ] : patientContexts.length ? [
    { to: '/patient/records', label: t('nav.records'), icon: FileTextIcon, active: path === '/patient/records' || path === '/patient/add-report' },
    { to: '/patient/master', label: t('nav.homeReadings'), icon: HeartPulseIcon, active: path === '/patient/master' || path === '/patient/visit-notes' },
    account,
  ] : [account];

  async function switchAccount() {
    setSwitching(true);
    try {
      await signOut();
      navigate('/sign-in', { replace: true, state: null });
    } finally {
      setSwitching(false);
    }
  }

  const workspaceLabel = t(isClinicView ? 'nav.clinicWorkspace' : isPatientView ? 'nav.patientWorkspace' : 'nav.account');

  const workspaceControls = (
        <>
          <LanguagePicker className="max-sm:[&_select]:max-w-[4.75rem] max-sm:[&_svg]:hidden" />
          {(isPatientView || /^\/clinic\/patients\/[0-9a-f-]{36}(?:\/|$)/.test(path)) ? (
            <Button type="button" variant="quiet" size="sm" className="min-h-11 px-2.5"
              aria-label={t('nav.askGluco')} title={t('nav.askGluco')}
              onClick={() => window.dispatchEvent(new Event('gluco:open'))}>
              <MessageCircle size={16} aria-hidden />
              <span className="hidden sm:inline">{t('nav.askGluco')}</span>
            </Button>
          ) : null}
          {isCareView
            ? <span className="hidden rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-soft sm:inline-flex">{t('nav.careSimulation')}</span>
            : <DemoLabel />}
        </>
  );

  return (
    <CodexDesktopLayout
      title={workspaceLabel}
      sidebarLabel={t('ui.mainNav')}
      compactToolbar
      sidebarHeading={(
        <div className="flex min-w-0 items-center gap-2 text-primary">
          <HeartPulseIcon size={21} className="shrink-0" aria-hidden />
          <span className="truncate text-sm font-semibold tracking-tight">gluco</span>
        </div>
      )}
      sidebar={(close) => (
        <>
          <nav aria-label={t('ui.mainNav')} className="flex flex-col gap-0.5">
            {links.map((link) => (
              <CodexSidebarRow key={link.to} to={link.to} active={link.active} onClick={close}
                icon={<link.icon size={16} aria-hidden />}>{link.label}</CodexSidebarRow>
            ))}
          </nav>
          {clinicNav && (recordsActive || closureActive) ? (
            <div className="record-tools mt-3 border-t border-line pt-2">
              <nav aria-label="Record tools">
                <CodexSidebarRow to="/clinic/results" active={closureActive} onClick={close} icon={<Inbox size={16} aria-hidden />}>{t('nav.resultClosure')}</CodexSidebarRow>
              </nav>
            </div>
          ) : null}

        </>
      )}
      sidebarFooter={me ? (
        <div className="px-2 py-1 text-xs text-ink-soft">
          <div className="sidebar-workspace-controls">{workspaceControls}</div>
          <p className="break-words font-medium text-ink">{me.actor.displayName}</p>
          <p className="mt-0.5">{clinicContexts.length === 0 && patientContexts.length === 0 && hospitalAccess && hospitalAccess.length
            ? 'Hospital staff' : describeRoles(me)}</p>
        </div>
      ) : undefined}
      toolbar={(
        <>
          <div className="flex min-w-0 items-center gap-2 md:hidden">{workspaceControls}</div>
          <Button type="button" variant="quiet" size="sm" className="min-h-11 shrink-0 px-3"
            disabled={switching} onClick={() => void switchAccount()}>
            {t('ui.signOut')}
          </Button>
        </>
      )}
      toolbarFooter={(
        <>
          <LanguageNotice className="no-print border-t border-line px-3 py-1.5" />
          {!online ? (
            <div className="no-print px-3 py-2">
              <Alert tone="review" title={t(isCareView ? 'ui.offline' : 'ui.uploadOffline')}>
                {t(isCareView ? 'ui.careOfflineBody' : 'ui.recordOfflineBody')}
              </Alert>
            </div>
          ) : null}
        </>
      )}
      mobileFooter={(
        <nav className="flex border-t border-line bg-surface" aria-label={t('ui.mainNav')}>
          {links.map((link) => (
            <Link key={link.to} to={link.to} aria-current={link.active ? 'page' : undefined}
              className={cn(
                'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 break-words px-1 text-center text-[11px] font-medium leading-tight',
                link.active ? 'bg-zinc-100 text-ink' : 'text-ink-soft hover:bg-canvas',
              )}>
              <link.icon size={19} className="shrink-0" aria-hidden /> {link.label}
            </Link>
          ))}
        </nav>
      )}
      skipLink={(
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:bg-surface focus:p-3 focus:text-primary focus:ring-2 focus:ring-primary">
          {t('ui.skip')}
        </a>
      )}
    >
      {isClinicView && !isCareView ? <ClinicNavigation /> : null}
      <main ref={main} id="main-content" tabIndex={-1} className="codexapp-main-scroll"
        data-care={isCareView || undefined}
        onScroll={(event) => scrollPositions.current.set(location.key, event.currentTarget.scrollTop)}>
        {isCareView ? (
          <div lang="en-IN" dir="ltr" className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        ) : (
          <div className="mx-auto max-w-[84rem] px-4 pb-12 pt-4 sm:px-6 lg:px-8">
            {closureActive ? (
              <nav className="no-print mb-4 flex flex-wrap gap-1.5 rounded-xl border border-line p-1.5" aria-label={t('nav.resultSections')}>
                {closurePages.map((page) => (
                  <NavLink key={page.to} to={page.to} className={({ isActive }) =>
                    cn('inline-flex min-h-11 items-center rounded-lg px-2.5 text-xs font-medium sm:text-sm',
                      isActive ? 'bg-primary/10 text-primary' : 'text-ink-soft hover:bg-canvas')}>
                    {page.label}
                  </NavLink>
                ))}
              </nav>
            ) : null}
            {isClinicView || isHospitalView || path === '/patient/master' ? (
              <div lang="en-IN" dir="ltr">{children}</div>
            ) : <div lang={locale.tag} dir={locale.direction}>{children}</div>}
          </div>
        )}
      </main>
    </CodexDesktopLayout>
  );
}

export function describeRoles(
  me: {
    contexts: {
      kind: string;
      reviewer?: boolean;
      clinician?: boolean;
      desk?: boolean;
      nurse?: boolean;
      quality?: boolean;
    }[];
  } | null,
): string {
  if (!me) return '';
  const clinic = me.contexts.find((context) => context.kind === 'clinic');
  const patient = me.contexts.find((context) => context.kind === 'patient');
  const roles = [
    clinic?.reviewer ? 'Reviewer' : null,
    clinic?.clinician ? 'Clinician' : null,
    clinic?.desk ? 'Desk' : null,
    clinic?.nurse ? 'Nurse' : null,
    clinic?.quality ? 'Quality' : null,
  ].filter((role): role is string => role !== null);
  if (roles.length > 0) return roles.join(', ');
  if (patient) return 'Patient';
  return 'No active role';
}

/** A visible Back action on narrow screens. */
export function BackLink({ to, label = 'Back' }: { to: string; label?: string }): React.ReactElement {
  const { ref, play } = useAnimatedIcon();
  return (
    <Button asChild variant="quiet" size="sm" onClick={play}>
      <Link to={to}>
        <ArrowLeftIcon ref={ref} size={16} aria-hidden />
        {label}
      </Link>
    </Button>
  );
}

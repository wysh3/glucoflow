import {demoEnabled} from '../auth/demo';
import * as React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowLeftIcon, CircleCheckIcon, FileTextIcon, HeartPulseIcon, FilePenLineIcon, UploadIcon, UserIcon, UsersIcon } from 'lucide-animated';
import { Alert, Button, cn, useAnimatedIcon } from '@glucoflow/ui';
import { useSession } from '../auth/session';
import { installBackHandler } from '../platform/back';

/**
 * Application shell: left rail on desktop, bottom navigation on mobile.
 * A single compact page title lives inside each screen's toolbar. No slogan,
 * greeting banner or promotional subtitle appears anywhere.
 */

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
      {label}
    </span>
  );
}

function railLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors',
    isActive ? 'bg-primary/10 text-primary' : 'text-ink-soft hover:bg-canvas hover:text-ink',
  );
}

export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const { me, signOut } = useSession();
  const online = useOnlineStatus();
  const location = useLocation();
  const [backReady, setBackReady] = React.useState(false);

  React.useEffect(() => {
    let dispose: (() => void) | undefined;
    void installBackHandler().then((cleanup) => {
      dispose = cleanup;
      setBackReady(true);
    });
    return () => {
      dispose?.();
    };
  }, []);

  const clinicContexts = me?.contexts.filter((context) => context.kind === 'clinic') ?? [];
  const patientContexts = me?.contexts.filter((context) => context.kind === 'patient') ?? [];
  const isClinicView = location.pathname.startsWith('/clinic');
  const isPatientView = location.pathname.startsWith('/patient');

  const clinicLinks = [
    { to: '/clinic/patients', label: 'Patients', icon: UsersIcon },
    { to: '/clinic/queue', label: 'Review queue', icon: CircleCheckIcon },
  ];
  const patientLinks = [
    { to: '/patient/master', label: 'Home readings', icon: HeartPulseIcon },
    { to: '/patient/records', label: 'Records', icon: FileTextIcon },
    { to: '/patient/add-report', label: 'Add report', icon: UploadIcon },
    { to: '/patient/visit-notes', label: 'Visit notes', icon: FilePenLineIcon },
  ];
  const links = isClinicView ? clinicLinks : isPatientView ? patientLinks : clinicContexts.length > 0 ? clinicLinks : patientContexts.length > 0 ? patientLinks : [];

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col lg:flex-row">
        <aside className="safe-top sticky top-0 hidden h-screen w-[240px] shrink-0 border-r border-line bg-surface/90 px-4 py-6 lg:block">
          <div className="mb-6 px-2">
            <HeartPulseIcon size={28} className="mb-3 text-primary" aria-hidden />
            <p className="text-[19px] font-semibold tracking-tight text-primary">Glucoflow</p>
            <p className="mt-1 text-[12px] text-ink-soft">
              {isClinicView ? 'Clinic workspace' : isPatientView ? 'Patient workspace' : 'Account'}
            </p>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Main">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={railLinkClass}>
                <link.icon size={20} aria-hidden />
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/account" className={railLinkClass}>
              <UserIcon size={20} aria-hidden /> Account
            </NavLink>
          </nav>
          {me ? (
            <div className="mt-6 border-t border-line pt-4 text-[12px] text-ink-soft">
              <p className="font-medium text-ink">{me.actor.displayName}</p>
              <p className="mt-0.5">{describeRoles(me)}</p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-3 min-h-9 rounded-[10px] border border-line px-3 text-[12px] text-ink hover:bg-canvas"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="safe-top sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
              <div className="flex items-center gap-2 lg:hidden">
                <span className="text-[19px] font-semibold tracking-tight text-primary">Glucoflow</span>
              </div>
              <div className="hidden items-center gap-3 text-[12px] text-ink-soft lg:flex">
                <span>{me?.actor.email}</span>
                <span>·</span>
                <span>{describeRoles(me)}</span>
              </div>
              <div className="flex items-center gap-2">
                {demoEnabled?<Button variant="secondary" onClick={()=>void signOut()}>Switch role</Button>:null}
                <DemoLabel />
                {backReady ? null : null}
              </div>
            </div>
          </header>

          {!online ? (
            <div className="px-4 pt-4 lg:px-6">
              <Alert tone="review" title="You are offline. Reconnect to upload.">
                Recorded data already on this screen stays visible. Uploads and reviews need a
                connection.
              </Alert>
            </div>
          ) : null}

          <main className="flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-6">{children}</main>
        </div>
      </div>

      {links.length > 0 ? (
        <nav
          className="safe-bottom fixed bottom-0 left-0 right-0 z-30 flex border-t border-line bg-surface/95 shadow-[0_-4px_24px_rgba(24,76,68,0.05)] backdrop-blur lg:hidden"
          aria-label="Main"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1.5 px-1 text-[10px] font-medium sm:text-[11px]',
                  isActive ? 'bg-primary/8 text-primary' : 'text-ink-soft hover:bg-canvas',
                )
              }
            >
              <link.icon size={20} aria-hidden />
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/account"
            className={({ isActive }) =>
              cn(
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1.5 px-1 text-[10px] font-medium sm:text-[11px]',
                isActive ? 'bg-primary/8 text-primary' : 'text-ink-soft hover:bg-canvas',
              )
            }
          >
            <UserIcon size={20} aria-hidden /> Account
          </NavLink>
        </nav>
      ) : null}
    </div>
  );
}

export function describeRoles(me: { contexts: { kind: string; reviewer?: boolean; clinician?: boolean }[] } | null): string {
  if (!me) return '';
  const clinic = me.contexts.find((context) => context.kind === 'clinic');
  const patient = me.contexts.find((context) => context.kind === 'patient');
  if (clinic && clinic.reviewer && clinic.clinician) return 'Reviewer and clinician';
  if (clinic && clinic.reviewer) return 'Reviewer';
  if (clinic && clinic.clinician) return 'Clinician';
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

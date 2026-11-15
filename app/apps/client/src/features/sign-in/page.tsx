import { ArrowRight, AlertTriangle, Layers, Check, ArrowUpRight, Sparkles, Database, ShieldCheck, FlaskConical } from 'lucide-react';
import {demoAccounts,demoEnabled,type DemoAccount} from '../../auth/demo';
import * as React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Button, Card, CardBody, Input, Label, Spinner, LoadingOrb } from '@glucoflow/ui';
import { useSession } from '../../auth/session';

import { CARE_HOME, roleHome } from '../../lib/clinic-home';

/**
 * Sign-in. Invalid credentials are explained without revealing whether an account
 * exists, and the sign-in path in use is stated plainly (local development mode or
 * the configured identity provider).
 */
export function SignInPage(): React.ReactElement {
  const { status, signIn, config, me, error: sessionError } = useSession();
  const location = useLocation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [showRoles, setShowRoles] = React.useState(false);
  const [intent, setIntent] = React.useState<'tour' | 'explore' | null>(null);

  // Warm the care desk code while the visitor reads, so "Explore" and the tour open without waiting.
  React.useEffect(() => {
    const warm = () => { void import('../care/page'); };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = idle ? idle(warm) : window.setTimeout(warm, 1200);
    return () => { if (!idle) window.clearTimeout(id); };
  }, []);

  const from = (location.state as { from?: string } | null)?.from;
  const target = from?.startsWith('/') && !from.startsWith('//') ? from : null;

  if (status === 'signed-in' && me) {
    if (target) return <Navigate to={target} replace />;
    const home = roleHome(me.contexts);
    return <Navigate to={intent && home === CARE_HOME ? `${home}?start=${intent}` : home} replace />;
  }

  const authenticate = async (email: string, password: string): Promise<void> => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await signIn(email, password); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Sign-in did not complete.'); }
    finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent): void => {
    event.preventDefault(); void authenticate(email.trim(), password);
  };
  const enterDemo = (account: DemoAccount, start: 'tour' | 'explore' | null = null) => { setIntent(start); return authenticate(account.email, account.password); };
  if(demoEnabled)return (
    <SignInFrame>
    <main className="flex flex-1 items-center px-5 py-7 sm:px-10 sm:py-8 lg:py-4">
      <section data-testid="welcome-panel" lang="en-IN" dir="ltr" className="mx-auto w-full max-w-6xl">
        <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.15fr] lg:gap-12">
        <div className="mx-auto max-w-2xl text-center lg:text-left">
          <p className="mb-4 text-sm font-medium text-[#34776b]">Meet Gluco · For diabetes care teams</p>
          <h1 className="text-[40px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#263f3b] sm:text-[48px] lg:text-[48px]">Your care team,<br className="hidden sm:block" /> a little more connected.</h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#58665e] lg:mx-0">Less chasing lab updates. Clearer handovers. One place to ask what’s pending, check the evidence, and prepare the next step.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            {demoAccounts.filter(account=>account.key==='clinic').map(account=><React.Fragment key={account.key}>
              <button type="button" data-testid="demo-tour" disabled={busy||status==='loading'||status==='unavailable'} onClick={()=>void enterDemo(account,'tour')} className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#286e64] px-6 text-sm font-semibold text-white shadow-[0_6px_18px_-8px_rgba(40,110,100,0.5)] transition hover:opacity-90 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34776b] focus-visible:ring-offset-4 disabled:opacity-50"><Sparkles size={17} aria-hidden /> Take the 3-minute tour <ArrowRight size={17} aria-hidden /></button>
              <button type="button" data-testid="demo-card-clinic" disabled={busy||status==='loading'||status==='unavailable'} onClick={()=>void enterDemo(account,'explore')} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#cfe0d8] bg-white/70 px-5 text-sm font-semibold text-[#286e64] transition hover:bg-white active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34776b] disabled:opacity-50">Explore the clinic <ArrowRight size={16} aria-hidden /></button>
            </React.Fragment>)}
            {demoAccounts.filter(account=>account.key==='patient').map(account=><button type="button" key={account.key} data-testid="demo-card-patient" disabled={busy||status==='loading'||status==='unavailable'} onClick={()=>void enterDemo(account)} className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-[#58665e] transition hover:text-[#263f3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34776b] disabled:opacity-50">Patient view <ArrowUpRight size={15} aria-hidden /></button>)}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#58665e]">No account setup · Nine fictional inpatients · Works on phone and desktop</p>
          {status === 'loading' ? <div className="mt-3 flex justify-center"><Spinner label="Connecting securely…" /></div> : null}
          {status === 'unavailable' ? <div role="alert" className="mt-3 text-sm text-danger"><p>{sessionError ?? 'Connection could not complete.'}</p><Button type="button" size="sm" onClick={() => window.location.reload()}>Reconnect</Button></div> : null}
          {busy ? <p role="status" className="mt-2 text-xs text-[#34776b]">Opening workspace…</p> : null}
          {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
        </div>
        <figure className="mx-auto w-full max-w-2xl lg:max-w-[32rem]">
          <div className="overflow-hidden rounded-[28px] bg-[#faeee4]">
            <img src="/brand/gluco-care-hero.webp" alt="Gluco, a pearlescent care companion with a small medical cap, connecting a record, a handover and an acknowledgement."
              width={1536} height={1024} fetchPriority="high" decoding="async"
              className="pointer-events-none block h-auto w-full select-none" />
          </div>
          <figcaption className="mt-3 text-center text-xs leading-5 text-[#58665e]">A companion for the team. The decisions stay with you.</figcaption>
        </figure>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e8ddd2] bg-[#fffbf7]/80 shadow-[0_8px_30px_-20px_rgba(96,66,44,0.18)] sm:mt-6 lg:mt-5" role="region" aria-label="Problem, solution and scale">
          <div className="grid divide-y divide-[#efe4da] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-4"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#b0572f]"><AlertTriangle size={14} aria-hidden /> The problem</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#263f3b]">In diabetic emergencies like DKA and HHS, care waits on lab results that cross three teams.</p>
              <p className="mt-1.5 text-xs leading-5 text-[#58665e]">A sample not collected, a specimen the lab never logged, a result nobody acknowledged. Today these gaps surface through phone calls and memory, often at shift change.</p></div>
            <div className="px-5 py-4"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#34776b]"><Check size={14} aria-hidden /> What GlucoFlow does</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#263f3b]">One live board shows where every order is stuck and who owns the next step.</p>
              <p className="mt-1.5 text-xs leading-5 text-[#58665e]">Status comes from hospital-system events, not tick-boxes. Work closes only when the evidence arrives, and a corrected result reopens it. Gluco drafts handovers; a clinician approves.</p></div>
            <div className="px-5 py-4"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#34776b]"><Layers size={14} aria-hidden /> Built to scale</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#263f3b]">Driven by the order, collection, receipt and result steps hospitals already record.</p>
              <p className="mt-1.5 text-xs leading-5 text-[#58665e]">Clinic isolation enforced in the database, stateless cloud containers, and approved care routines one ward can reuse in the next. <Link to="/how-it-works" className="font-medium text-[#286e64] underline underline-offset-2">How it works</Link></p></div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3" aria-label="What is real in this demo">
          <div className="flex items-start gap-3 rounded-2xl bg-white/60 px-4 py-3"><Database size={17} className="mt-0.5 shrink-0 text-[#34776b]" aria-hidden /><p className="text-xs leading-5 text-[#58665e]"><span className="font-semibold text-[#263f3b]">Real software.</span> Live web app, API, database, role checks and audit trail.</p></div>
          <div className="flex items-start gap-3 rounded-2xl bg-white/60 px-4 py-3"><FlaskConical size={17} className="mt-0.5 shrink-0 text-[#34776b]" aria-hidden /><p className="text-xs leading-5 text-[#58665e]"><span className="font-semibold text-[#263f3b]">Simulated hospital.</span> HIS and lab feeds and every patient are fictional. You can play the lab yourself.</p></div>
          <div className="flex items-start gap-3 rounded-2xl bg-white/60 px-4 py-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#34776b]" aria-hidden /><p className="text-xs leading-5 text-[#58665e]"><span className="font-semibold text-[#263f3b]">Human in charge.</span> No diagnosis, prescribing or risk scores. Actions need approval.</p></div>
        </div>
        <div className="mt-3 text-center text-xs text-[#58665e]">
          <button type="button" aria-expanded={showRoles} aria-controls={showRoles ? 'demo-roles' : undefined} onClick={() => setShowRoles(value => !value)} className="min-h-11 rounded-lg px-3 py-2 hover:text-[#263f3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34776b]">{showRoles ? 'Hide team roles' : 'Explore another team role'}</button>
          {showRoles ? <div id="demo-roles" className="mt-1 flex flex-wrap justify-center gap-2">{demoAccounts.filter(account=>account.key!=='clinic'&&account.key!=='patient').map(account=><button type="button" key={account.key} data-testid={`demo-card-${account.key}`} disabled={busy||status==='loading'||status==='unavailable'} onClick={()=>void enterDemo(account)} className="min-h-11 rounded-full border border-[#d9e5de] bg-[#f2f8f3] px-4 hover:bg-[#e4f0e9] disabled:opacity-50">{account.label}</button>)}</div> : null}
        </div>
      </section>
    </main>
    </SignInFrame>
  );

  return (
    <SignInFrame>
    <main className="codexapp-main-scroll flex min-h-0 flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px] space-y-4">
        <Card lang="en-IN" dir="ltr">
          <CardBody className="pt-6">
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" variant="primary" className="w-full" disabled={busy}>
                {busy ? 'Signing in' : 'Sign in'}
              </Button>
            </form>
          </CardBody>
        </Card>
        <p lang="en-IN" dir="ltr" className="text-[12px] text-[#58665e]">
          {config?.authMode === 'supabase'
            ? 'Sign-in is handled by the configured identity provider.'
            : 'Local development sign-in. Accounts were created by the seed command; no public sign-up exists.'}
        </p>
      </div>
    </main>
    </SignInFrame>
  );
}


function SignInFrame({children}: {children: React.ReactNode}) {
  return <div className="gluco-landing flex min-h-dvh flex-col bg-[#fcf2e9] text-[#263f3b]">
    <header className="flex items-center justify-between gap-3 px-5 py-3 sm:px-8">
      <span className="flex items-center gap-2 text-base font-semibold text-[#34776b]"><LoadingOrb size={34} /> glucoflow</span>

    </header>

    {children}
    <footer className="flex flex-wrap justify-center gap-x-6 px-5 py-4 text-xs text-[#58665e]">
      <span className="inline-flex min-h-11 items-center">Workflow assistance · No diagnosis or prescribing</span>
      <Link to="/how-it-works" className="inline-flex min-h-11 items-center">How it works</Link>
      <Link to="/privacy" className="inline-flex min-h-11 items-center">Privacy and data use</Link>
      <Link to="/verify" className="inline-flex min-h-11 items-center">Verify a receipt</Link>
    </footer>
  </div>;
}

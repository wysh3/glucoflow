import { ArrowRight, FileText, Users, Check, ArrowUpRight } from 'lucide-react';
import {demoAccounts,demoEnabled,type DemoAccount} from '../../auth/demo';
import * as React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Button, Card, CardBody, Input, Label, Spinner, LoadingOrb } from '@glucoflow/ui';
import { useSession } from '../../auth/session';

import { roleHome } from '../../lib/clinic-home';

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

  const from = (location.state as { from?: string } | null)?.from;
  const target = from?.startsWith('/') && !from.startsWith('//') ? from : null;

  if (status === 'signed-in' && me) {
    if (target) return <Navigate to={target} replace />;
    return <Navigate to={roleHome(me.contexts)} replace />;
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
  const enterDemo = (account: DemoAccount) => authenticate(account.email, account.password);
  if(demoEnabled)return (
    <SignInFrame>
    <main className="flex flex-1 items-center px-5 py-7 sm:px-10 sm:py-8">
      <section data-testid="welcome-panel" lang="en-IN" dir="ltr" className="mx-auto w-full max-w-6xl">
        <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.15fr] lg:gap-12">
        <div className="mx-auto max-w-2xl text-center lg:text-left">
          <p className="mb-4 text-sm font-medium text-[#34776b]">Meet Gluco · For diabetes care teams</p>
          <h1 className="text-[40px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#263f3b] sm:text-[48px] lg:text-[48px]">Your care team,<br className="hidden sm:block" /> a little more connected.</h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#58665e] lg:mx-0">Less chasing lab updates. Clearer handovers. One place to ask what’s pending, check the evidence, and prepare the next step.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            {demoAccounts.filter(account=>account.key==='clinic').map(account=><button type="button" key={account.key} data-testid="demo-card-clinic" disabled={busy||status==='loading'||status==='unavailable'} onClick={()=>void enterDemo(account)} className="inline-flex min-h-12 items-center gap-5 rounded-full bg-[#286e64] px-6 text-sm font-semibold text-white shadow-[0_6px_18px_-8px_rgba(40,110,100,0.5)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34776b] focus-visible:ring-offset-4 disabled:opacity-50">Explore the clinic <ArrowRight size={17} aria-hidden /></button>)}
            {demoAccounts.filter(account=>account.key==='patient').map(account=><button type="button" key={account.key} data-testid="demo-card-patient" disabled={busy||status==='loading'||status==='unavailable'} onClick={()=>void enterDemo(account)} className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-[#58665e] transition hover:text-[#263f3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34776b] disabled:opacity-50">Patient view <ArrowUpRight size={15} aria-hidden /></button>)}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#58665e]">No account setup · Shared demo accounts · Fictional records only</p>
          {status === 'loading' ? <div className="mt-3 flex justify-center"><Spinner label="Connecting securely…" /></div> : null}
          {status === 'unavailable' ? <div role="alert" className="mt-3 text-sm text-danger"><p>{sessionError ?? 'Connection could not complete.'}</p><Button type="button" size="sm" onClick={() => window.location.reload()}>Reconnect</Button></div> : null}
          {busy ? <p role="status" className="mt-2 text-xs text-[#34776b]">Opening workspace…</p> : null}
          {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
        </div>
        <figure className="mx-auto w-full max-w-2xl">
          <div className="overflow-hidden rounded-[28px] bg-[#faeee4]">
            <img src="/brand/gluco-care-hero.webp" alt="Gluco, a pearlescent care companion with a small medical cap, connecting a record, a handover and an acknowledgement."
              width={1536} height={1024} fetchPriority="high" decoding="async"
              className="pointer-events-none block h-auto w-full select-none" />
          </div>
          <figcaption className="mt-3 text-center text-xs leading-5 text-[#58665e]">A companion for the team. The decisions stay with you.</figcaption>
        </figure>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e8ddd2] bg-[#fffbf7]/80 shadow-[0_8px_30px_-20px_rgba(96,66,44,0.18)] sm:mt-10" role="region" aria-label="Illustrative workflow preview">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8ddd2] px-5 py-3">
            <p className="text-sm font-medium text-[#263f3b]">“What’s still waiting for a handover?”</p>
            <span className="text-[11px] text-[#58665e]">Illustrative workflow · Dev Mehta, fictional</span>
          </div>
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-3 sm:gap-8">
            <div className="flex items-start gap-3"><FileText size={18} className="mt-0.5 shrink-0 text-[#34776b]" aria-hidden /><div><p className="text-sm font-medium text-[#263f3b]">Start with the source</p><p className="mt-1 text-xs leading-5 text-[#58665e]">Collection is recorded. Lab receipt is still unconfirmed.</p></div></div>
            <div className="flex items-start gap-3"><Users size={18} className="mt-0.5 shrink-0 text-[#34776b]" aria-hidden /><div><p className="text-sm font-medium text-[#263f3b]">Keep the owner in view</p><p className="mt-1 text-xs leading-5 text-[#58665e]">Prepare a handover for the lab team, with its supporting events.</p></div></div>
            <div className="flex items-start gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[#34776b]" aria-hidden /><div><p className="text-sm font-medium text-[#263f3b]">You make the call</p><p className="mt-1 text-xs leading-5 text-[#58665e]">Review the proposed action. Keep its source and approval history.</p></div></div>
          </div>
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
      <Link to="/showcase" className="inline-flex min-h-11 items-center">Walkthrough</Link>
      <Link to="/privacy" className="inline-flex min-h-11 items-center">Privacy and data use</Link>
      <Link to="/verify" className="inline-flex min-h-11 items-center">Verify a receipt</Link>
    </footer>
  </div>;
}

import { HeartPulse, ArrowUpRight, Stethoscope, User, ClipboardCheck, Users } from 'lucide-react';
import {demoAccounts,demoEnabled,type DemoAccount} from '../../auth/demo';
import * as React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, Input, Label, ScreenTitle } from '@glucoflow/ui';
import { useSession } from '../../auth/session';
import { SystemGlyph } from '../../components/system-glyph';

/**
 * Sign-in. Invalid credentials are explained without revealing whether an account
 * exists, and the sign-in path in use is stated plainly (local development mode or
 * the configured identity provider).
 */
export function SignInPage(): React.ReactElement {
  const { status, signIn, config, me } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (status === 'signed-in' && me) {
    const target = (location.state as { from?: string } | null)?.from;
    if (target && !demoEnabled) return <Navigate to={target} replace />;
    const clinic = me.contexts.some((context) => context.kind === 'clinic');
    const patient = me.contexts.some((context) => context.kind === 'patient');
    return <Navigate to={clinic && !patient ? '/clinic/results' : patient ? (demoEnabled ? '/patient/master' : '/patient/records') : '/account'} replace />;
  }

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate('/account', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in did not complete.');
    } finally {
      setBusy(false);
    }
  };

  const enterDemo=async(account:DemoAccount):Promise<void>=>{
    setBusy(true);setError(null);
    try{await signIn(account.email,account.password);navigate(account.key.includes('patient')?'/patient/master':'/clinic/results',{replace:true});}
    catch(caught){setError(caught instanceof Error?caught.message:'Could not open this demo role.');}
    finally{setBusy(false);}
  };
  if(demoEnabled)return (
    <main className="welcome-page">
      <section data-testid="welcome-panel" className="relative mx-auto w-full max-w-[980px] overflow-hidden rounded-[28px] border border-line bg-surface p-5 shadow-[0_16px_70px_rgba(32,59,56,0.06)] sm:p-8 lg:p-10">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><HeartPulse size={24} className="text-primary" aria-hidden/><p className="text-xl font-semibold tracking-tight text-primary">glucoflow</p></div>
          <span className="rounded-full bg-primary/7 px-3 py-1.5 text-[11px] text-primary">Interactive demo</span>
        </header>
        <div className="rule-reveal mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-y border-line py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft">
          <SystemGlyph className="mr-1 text-primary" />
          <span>Access</span><span aria-hidden>·</span><span>Synthetic workspaces</span><span aria-hidden>·</span><span>04 roles</span><span aria-hidden>·</span><span>One click</span>
        </div>
        <div className="my-6 grid items-center gap-5 sm:my-8 lg:grid-cols-[1fr_auto]">
          <div><p className="mb-2 text-xs font-medium tracking-wide text-primary">Demo access</p>
            <h1 className="reveal-up reveal-up-1 max-w-lg text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">Choose a workspace.</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-ink-soft">Four roles. One click. Each card prefills a synthetic account and signs you in automatically. Access is enforced by the API.</p>
          </div>
          <div className="hidden h-28 w-28 items-center justify-center rounded-full bg-[#edf5ef] lg:flex" aria-hidden><span className="welcome-orb"><span/><span/></span></div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">{demoAccounts.filter(account=>!account.key.startsWith('other-')).map((account, index)=>(
          <button key={account.key} data-testid={`demo-card-${account.key}`} disabled={busy||status==='loading'} onClick={()=>void enterDemo(account)}
            className="group relative flex flex-col items-start justify-start min-h-[116px] rounded-2xl border border-line bg-canvas/65 p-3.5 text-left transition hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50 sm:min-h-[160px] sm:p-4">
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-surface text-primary">{account.key.includes('patient') ? <User size={18} aria-hidden/> : account.key==='clinician' ? <Stethoscope size={18} aria-hidden/> : account.key==='reviewer' ? <ClipboardCheck size={18} aria-hidden/> : <Users size={18} aria-hidden/>}</span>
            <span aria-hidden="true" className="absolute right-3.5 top-4 flex items-center gap-1.5 text-[11px] tabular-nums text-ink-soft"><span>0{index + 1}</span><ArrowUpRight size={15} aria-hidden/></span><span className="block text-sm font-semibold text-ink">{account.label}</span>
            <span className="mt-1.5 block text-[11px] leading-4 text-ink-soft sm:text-xs sm:leading-5">{account.description}</span>
          </button>
        ))}</div>
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[11px] text-ink-soft">
          <p>All demo patient records are synthetic. Access is enforced by the API.</p>
          <details className="relative"><summary className="min-h-8 cursor-pointer px-2 py-2 text-primary">Test access separation</summary><div className="absolute bottom-full left-0 z-10 mb-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-2 shadow-lg sm:left-auto sm:right-0">{demoAccounts.filter(account=>account.key.startsWith('other-')).map(account=><button key={account.key} data-testid={`demo-card-${account.key}`} disabled={busy||status==='loading'} onClick={()=>void enterDemo(account)} className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-canvas">{account.label}<span className="sr-only"> {account.description}</span></button>)}</div></details>
        </footer>
        {busy?<p role="status" className="mt-2 text-xs text-primary">Opening workspace…</p>:null}
        {error?<p role="alert" className="mt-2 text-xs text-danger">{error}</p>:null}
      </section>
    </main>
  );

  return (
    <div className="safe-top flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[420px] space-y-4">
        <ScreenTitle title="glucoflow" />
        <Card>
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
        <p className="text-[12px] text-ink-soft">
          {config?.authMode === 'supabase'
            ? 'Sign-in is handled by the configured identity provider.'
            : 'Local development sign-in. Accounts were created by the seed command; no public sign-up exists.'}
        </p>
      </div>
    </div>
  );
}

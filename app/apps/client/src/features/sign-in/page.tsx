import {demoAccounts,demoEnabled,type DemoAccount} from '../../auth/demo';
import * as React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, Input, Label, ScreenTitle } from '@glucoflow/ui';
import { useSession } from '../../auth/session';

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
    return <Navigate to={clinic && !patient ? '/clinic/patients' : patient ? '/patient/records' : '/account'} replace />;
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
    try{await signIn(account.email,account.password);navigate(account.key.includes('patient')?'/patient/master':'/clinic/patients',{replace:true});}
    catch(caught){setError(caught instanceof Error?caught.message:'Could not open this demo role.');}
    finally{setBusy(false);}
  };
  if(demoEnabled)return (
    <div className="safe-top min-h-screen bg-canvas px-5 py-12 sm:py-20">
      <div className="mx-auto max-w-[760px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          <h1 className="text-2xl font-semibold text-ink">Glucoflow</h1>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft">Interactive demo</span>
        </div>
        <p className="text-sm text-ink-soft">Choose a role to explore. All patient records in this demo are synthetic.</p>
        <div className="grid gap-3 sm:grid-cols-2">{demoAccounts.map(account=>(
          <button key={account.key} disabled={busy||status==='loading'} onClick={()=>void enterDemo(account)}
            className="min-h-[116px] rounded-2xl border border-line bg-surface p-5 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-50">
            <span className="block text-base font-semibold text-ink">{account.label}</span>
            <span className="mt-2 block text-sm leading-6 text-ink-soft">{account.description}</span>
          </button>
        ))}</div>
        {busy?<p role="status" className="text-sm text-ink-soft">Opening workspace…</p>:null}
        {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
      </div>
    </div>
  );

  return (
    <div className="safe-top flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[420px] space-y-4">
        <ScreenTitle title="Glucoflow" />
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

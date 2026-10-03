import * as React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, Input, Label, ScreenTitle } from '@sutra/ui';
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
    if (target) return <Navigate to={target} replace />;
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

  return (
    <div className="safe-top flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[420px] space-y-4">
        <ScreenTitle title="Sutra" />
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

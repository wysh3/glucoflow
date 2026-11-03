import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, ScreenTitle } from '@glucoflow/ui';
import { useSession } from '../../auth/session';

export function NotFoundPage(): React.ReactElement {
  const { me } = useSession();
  const clinic = me?.contexts.some((context) => context.kind === 'clinic');
  const patient = me?.contexts.some((context) => context.kind === 'patient');
  const home = clinic ? '/clinic/patients' : patient ? '/patient/records' : '/';
  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col justify-center px-6 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">404</p>
      <ScreenTitle title="That page is not here" meta="The link may be old, or the address may be mistyped." />
      <p className="mt-3 max-w-[52ch] text-sm leading-6 text-ink-soft">
        No patient record was changed. Open a known workspace instead.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild>
          <Link to={home}>{me ? 'Open the workspace' : 'Go to the home page'}</Link>
        </Button>
        {me ? (
          <Button asChild variant="secondary">
            <Link to="/account">Account</Link>
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </main>
  );
}

import * as React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Timer,
  User,
} from 'lucide-react';
import { Button, Spinner } from '@glucoflow/ui';
import { useSession } from '../../auth/session';
import { demoAccounts, demoEnabled } from '../../auth/demo';

function rolePath(contexts: { kind: string }[]): string {
  const clinic = contexts.some((context) => context.kind === 'clinic');
  const patient = contexts.some((context) => context.kind === 'patient');
  if (clinic && !patient) return '/clinic/patients';
  if (patient && !clinic) return '/patient/records';
  return '/account';
}

export function LandingPage(): React.ReactElement {
  const { status, me, signIn } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner label="Loading" />
      </div>
    );
  }
  if (status === 'signed-in' && me) {
    return <Navigate to={rolePath(me.contexts)} replace />;
  }

  const enterDoctor = async (): Promise<void> => {
    const account =
      demoAccounts.find((candidate) => candidate.key === 'clinic') ??
      demoAccounts.find((candidate) => candidate.key === 'clinician');
    if (!account) {
      navigate('/sign-in');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(account.email, account.password);
      navigate('/clinic/patients', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open the demo workspace.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main data-testid="landing" className="min-h-screen bg-canvas">
      <section className="relative overflow-hidden bg-[#0f2e2a] text-white">
        <div className="pointer-events-none absolute -right-32 -top-40 size-[520px] rounded-full bg-[#1c5c4e]/40 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-[1180px] px-5 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-8">
          <header className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2.5 text-white">
              <HeartPulse size={24} className="text-[#a7d8c8]" aria-hidden />
              <span className="text-lg font-semibold tracking-tight">glucoflow</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/demo/delta"
                className="hidden min-h-9 items-center rounded-lg px-3 text-sm text-[#c8e3d8] hover:bg-white/5 sm:inline-flex"
              >
                Public demo
              </Link>
              <Link
                to="/sign-in"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Sign in <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </header>

          <div className="mt-14 grid items-center gap-12 lg:mt-20 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a7d8c8]">
                A pre-visit brief for Indian follow-up clinics
              </p>
              <h1 className="mt-4 max-w-[13ch] text-[46px] font-semibold leading-[1.03] tracking-[-0.03em] sm:text-[66px]">
                The 60-second delta.
              </h1>
              <p className="mt-5 max-w-[52ch] text-[15px] leading-7 text-[#c8e3d8] sm:text-[17px]">
                What changed. What is unresolved. What the record cannot tell you. One page
                before the patient sits down, with every line tied to its source.
              </p>
              <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
                <Link
                  to="/demo/delta"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#a7d8c8] px-5 text-sm font-semibold text-[#0f2e2a] transition hover:bg-[#bde7d8]"
                >
                  Open the synthetic demo <ArrowRight size={16} aria-hidden />
                </Link>
                {demoEnabled ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void enterDoctor()}
                    disabled={busy}
                    className="min-h-12 rounded-xl border-white/20 bg-white/5 px-5 text-white hover:bg-white/10"
                  >
                    <Stethoscope size={16} aria-hidden />
                    {busy ? 'Opening workspace' : 'Enter the doctor workspace'}
                  </Button>
                ) : (
                  <Link
                    to="/sign-in"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-medium text-white hover:bg-white/10"
                  >
                    Sign in <ArrowRight size={16} aria-hidden />
                  </Link>
                )}
              </div>
              <p className="mt-4 text-[11px] leading-5 text-[#9dc4b6]">
                Synthetic data only. One click. No password to type for the public demo.
              </p>
              {error ? (
                <p role="alert" className="mt-2 text-xs text-[#ffb4a8]">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="relative">
              <div className="rounded-[22px] border border-white/10 bg-[#123832] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a7d8c8]">
                      Pre-visit delta · synthetic
                    </p>
                    <p className="mt-1 text-[20px] font-semibold tracking-tight text-white">
                      Asha Rao, 58
                    </p>
                    <p className="text-[11px] text-[#9dc4b6]">P0482 · diabetes follow-up</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a7d8c8]/20 bg-[#a7d8c8]/10 px-2.5 py-1 text-[10px] font-semibold text-[#a7d8c8]">
                    <Timer size={12} aria-hidden /> 26s read
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-1.5">
                  {[
                    ['7', 'changes'],
                    ['3', 'open'],
                    ['2', 'conflicts'],
                    ['3', 'gaps'],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                      <p className="text-lg font-semibold leading-none text-white">{value}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-wide text-[#9dc4b6]">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ['eGFR', 'Fell from 70 to 55', 'Open source'],
                    ['Eye review', 'No later record', 'Not called overdue'],
                    ['Atorvastatin', 'Patient stopped it', 'Prescription says continue'],
                  ].map(([title, detail, meta]) => (
                    <div key={title} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-white">{title}</p>
                        <p className="truncate text-[10px] text-[#9dc4b6]">{detail}</p>
                      </div>
                      <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-[#a7d8c8]">{meta}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#9dc4b6]">
                  <Sparkles size={12} className="text-[#a7d8c8]" aria-hidden />
                  AI extracted. Every line opens its source.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: FileText,
              kicker: 'THE UNIT',
              title: 'Three decisions, not a timeline.',
              body: 'The brief shows the clinic watchlist change, the oldest unresolved item and the first disagreement. Nothing to scroll before the patient sits down.',
            },
            {
              icon: ShieldCheck,
              kicker: 'THE SOURCE',
              title: 'Every line opens its page.',
              body: 'Each item carries the original document, page and quoted line. Missing pages and partial dates are shown as gaps, not filled in.',
            },
            {
              icon: Sparkles,
              kicker: 'THE AI',
              title: 'AI reads. The doctor decides.',
              body: 'Extraction is AI-assisted and evidence-bound. No diagnosis, no risk score, no treatment advice and no automatic note.',
            },
          ].map(({ icon: Icon, kicker, title, body }) => (
            <article key={kicker} className="rounded-[18px] border border-line bg-surface p-5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <Icon size={18} aria-hidden />
              </span>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{kicker}</p>
              <h2 className="mt-1.5 text-[18px] font-semibold tracking-tight text-ink">{title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-ink-soft">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid items-center gap-5 rounded-[20px] border border-line bg-surface p-5 sm:p-7 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">THE WORKING PRODUCT</p>
            <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">
              A real API, a real record, a real audit trail.
            </h2>
            <p className="mt-2 max-w-[70ch] text-[13px] leading-6 text-ink-soft">
              The public demo is seeded with one synthetic patient. Sign in to open the clinic
              workspace, review the ledger, ask the record companion and export the draft note.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/demo/delta"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Open demo <ArrowRight size={14} aria-hidden />
            </Link>
            {demoEnabled ? (
              <Button variant="secondary" onClick={() => void enterDoctor()} disabled={busy}>
                <User size={14} aria-hidden /> Doctor demo
              </Button>
            ) : (
              <Link to="/sign-in" className="inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-medium text-ink">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 px-5 py-5 text-[11px] text-ink-soft sm:px-8">
          <p>Synthetic data. Assistive only. Human approval required. Not a diagnosis.</p>
          <div className="flex gap-4">
            <Link to="/demo/delta" className="text-primary">Demo</Link>
            <Link to="/sign-in" className="text-primary">Sign in</Link>
            <span>© 2026 glucoflow</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

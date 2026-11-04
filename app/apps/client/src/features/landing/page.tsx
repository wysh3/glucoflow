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
import { SystemGlyph } from '../../components/system-glyph';
import { demoAccounts, demoEnabled } from '../../auth/demo';

function rolePath(contexts: { kind: string }[]): string {
  const clinic = contexts.some((context) => context.kind === 'clinic');
  const patient = contexts.some((context) => context.kind === 'patient');
  if (clinic && !patient) return '/clinic/results';
  if (patient && !clinic) return '/patient/records';
  return '/account';
}

const SECTIONS = [
  {
    id: 'unit',
    index: '01',
    kicker: 'The gap',
    title: 'The result nobody owns.',
    body: 'A report arrives on WhatsApp, as a PDF, or as a paper slip. The lab has finished. The clinic has not. No one has assigned a clinician, set a clock, or proved the patient was told.',
    icon: FileText,
    points: ['Cross-lab intake', 'Namesake and duplicate hold', 'One owner per report'],
    action: { label: 'Open the synthetic ledger', to: '/sign-in' },
  },
  {
    id: 'source',
    index: '02',
    kicker: 'The receipt',
    title: 'One owner. One clock. One proof.',
    body: 'Every report gets a named clinician and a due time. The receipt records acknowledgement, the patient conversation and the close. If the clock expires, the result escalates to a human, not to another dashboard.',
    icon: ShieldCheck,
    points: ['Named clinician', 'Escalation clock', 'Patient communication receipt'],
    action: { label: 'See a receipt in the demo', to: '/sign-in' },
  },
  {
    id: 'ai',
    index: '03',
    kicker: 'The AI',
    title: 'AI reads the envelope, not the diagnosis.',
    body: 'Extraction reads the lab, patient identifiers and the lab flag from messy incoming documents. Matching links the report to the right record. The clinical value and the clinical decision remain human.',
    icon: Sparkles,
    points: ['Document extraction', 'Identity matching', 'No interpretation'],
    action: { label: 'Open the working ledger', to: '/sign-in' },
  },
  {
    id: 'product',
    index: '04',
    kicker: 'The edge',
    title: 'Built for the accreditation question.',
    body: 'NABL and NABH already ask who was told, when, and with what read-back. Most clinics keep that register on paper. The ledger turns the existing compliance obligation into the daily workflow.',
    icon: Stethoscope,
    points: ['Audit export', 'Private and public settings', 'Paper-first intake'],
    action: { label: 'Enter the clinic workspace', to: '/sign-in' },
  },
] as const;

export function LandingPage(): React.ReactElement {
  const { status, me, signIn } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [spot, setSpot] = React.useState({ x: 50, y: 50 });
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<string>('unit');
  const previewRef = React.useRef<HTMLDivElement>(null);

  const movePreview = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!previewRef.current) return;
    const box = previewRef.current.getBoundingClientRect();
    setSpot({
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    });
  };

  React.useEffect(() => {
    const update = (): void => {
      const anchor = window.scrollY + 240;
      let current: string = SECTIONS[0].id;
      for (const section of SECTIONS) {
        const target = document.getElementById(section.id);
        if (target && target.offsetTop <= anchor) current = section.id;
      }
      setActiveSection(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

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
      navigate('/clinic/results', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open the demo workspace.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main data-testid="landing" data-app-ready className="min-h-screen bg-canvas">
      <section className="hero-dots relative overflow-hidden bg-[#0f2e2a] text-white">
        <div className="relative mx-auto max-w-[1180px] px-5 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-8">
          <header className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2.5 text-white">
              <HeartPulse size={24} className="text-[#a7d8c8]" aria-hidden />
              <span className="text-lg font-semibold tracking-tight">glucoflow</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/sign-in"
                className="hidden min-h-9 items-center rounded-lg px-3 text-sm text-[#c8e3d8] hover:bg-white/5 sm:inline-flex"
              >
                Try the ledger
              </Link>
              <Link
                to="/sign-in"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Sign in <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </header>

          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-white/10 py-2.5 text-[11px] uppercase tracking-[0.14em] text-[#9dc4b6]">
            <SystemGlyph className="mr-1 text-[#a7d8c8]" />
            <span>Result ledger</span>
            <span aria-hidden>·</span>
            <span>Indian hospitals and clinics</span>
            <span aria-hidden>·</span>
            <span>Synthetic demonstration</span>
          </div>

          <div className="mt-12 grid items-center gap-12 lg:mt-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="reveal-up reveal-up-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a7d8c8]">
                A result accountability ledger for Indian hospitals and clinics
              </p>
              <h1 className="reveal-up reveal-up-2 mt-4 max-w-[13ch] text-[48px] font-semibold leading-[1.03] tracking-[-0.03em] sm:text-[64px]">
                The result nobody owns.
              </h1>
              <p className="reveal-up reveal-up-3 mt-5 max-w-[52ch] text-[16px] leading-7 text-[#c8e3d8] sm:text-[18px]">
                Every incoming report gets a named clinician, a clock and a receipt. No interpretation. No orphaned result.
              </p>
              <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
                <Link
                  to="/sign-in"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#a7d8c8] px-5 text-sm font-semibold text-[#0f2e2a] transition hover:bg-[#bde7d8]"
                >
                  Open the result ledger <ArrowRight size={16} aria-hidden />
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
                    {busy ? 'Opening workspace' : 'Enter the clinic workspace'}
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
              <Link to="/verify" className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-[12px] font-medium text-[#a7d8c8] underline underline-offset-2 hover:text-white">
                <ShieldCheck size={13} aria-hidden /> Verify a receipt
              </Link>
              {error ? (
                <p role="alert" className="mt-2 text-xs text-[#ffb4a8]">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="relative">
              <div
                ref={previewRef}
                onPointerMove={movePreview}
                onPointerLeave={() => setHovered(null)}
                className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-[#123832] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-5"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `radial-gradient(260px circle at ${spot.x}% ${spot.y}%, rgba(167,216,200,0.16), transparent 72%)` }}
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a7d8c8]">
                      Result ledger · synthetic
                    </p>
                    <p className="mt-1 text-[20px] font-semibold tracking-tight text-white">
                      Asha Rao, 58
                    </p>
                    <p className="text-[11px] text-[#9dc4b6]">P0482 · diabetes follow-up · <span className="hidden sm:inline">every report has a receipt</span><span className="sm:hidden">tap a receipt to inspect</span></p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#a7d8c8]/20 bg-[#a7d8c8]/10 px-2.5 py-1 text-[11px] font-semibold text-[#a7d8c8]">
                    <Timer size={12} aria-hidden /> Demo case
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-1.5">
                  {[
                    ['9', 'open'],
                    ['3', 'unowned'],
                    ['1', 'critical'],
                    ['2h', 'median ack'],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                      <p className="text-lg font-semibold leading-none text-white">{value}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-[#9dc4b6]">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    { title: 'Sodium 128 mmol/L', detail: 'No owner · 3h overdue', meta: 'Critical' },
                    { title: 'HbA1c 9.1 %', detail: 'Acknowledged · Dr Meera', meta: 'Due in 19h' },
                    { title: 'TSH 7.8 mIU/L', detail: 'Patient informed · call', meta: 'Receipt open' },
                    { title: 'eGFR 52', detail: 'Ready to assign', meta: 'No clock' },
                  ].map((row) => (
                    <Link
                      to="/sign-in"
                      key={row.title}
                      onMouseEnter={() => setHovered(row.title)}
                      className={`relative flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        hovered === row.title
                          ? 'border-[#a7d8c8]/50 bg-white/[0.1]'
                          : 'border-white/10 bg-white/[0.04]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-white">{row.title}</p>
                        <p className="truncate text-[11px] text-[#9dc4b6]">{row.detail}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-[#a7d8c8]">{row.meta}</span>
                    </Link>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#9dc4b6]">
                  <ShieldCheck size={12} className="text-[#a7d8c8]" aria-hidden />
                  Lab flag as supplied. No interpretation.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-16">
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">Contents</p>
              <nav aria-label="Product sections" className="mt-4 space-y-3 border-l border-dotted border-line pl-4">
                {SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    aria-current={activeSection === section.id ? 'true' : undefined}
                    className={`flex items-baseline gap-3 text-[14px] transition-colors ${
                      activeSection === section.id ? 'font-semibold text-primary' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`size-1.5 rounded-full ${activeSection === section.id ? 'bg-primary' : 'bg-line'}`} aria-hidden />
                      <span className="tabular-nums text-[11px] text-ink-soft">{section.index}</span>
                    </span>
                    <span>{section.kicker}</span>
                  </a>
                ))}
              </nav>
              <div className="mt-8 border-t border-line pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Synthetic only</p>
                <p className="mt-2 text-[12px] leading-5 text-ink-soft">
                  No real patient data. No interpretation. Human receipt.
                </p>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="rule-reveal flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">The ledger case</p>
                <p className="mt-1 text-[20px] font-semibold tracking-tight text-ink">Why this ledger, in four sections.</p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">04 sections</p>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
              {[
                ['12', 'reports'],
                ['3', 'unowned'],
                ['1', 'critical'],
                ['2h', 'median ack'],
              ].map(([value, label]) => (
                <div key={label} className="bg-surface px-4 py-3">
                  <p className="text-[20px] font-semibold leading-none text-ink">{value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-ink-soft">{label}</p>
                </div>
              ))}
            </div>

            <div>
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-24 border-b border-line py-10 last:border-0 last:pb-0"
                  >
                    <div className="grid gap-5 sm:grid-cols-[40px_minmax(0,1fr)]">
                      <p className="text-[11px] font-semibold tabular-nums tracking-[0.1em] text-primary">{section.index}</p>
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{section.kicker}</p>
                            <h2 className="mt-2 max-w-[22ch] text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[32px]">
                              {section.title}
                            </h2>
                          </div>
                          <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-primary sm:flex">
                            <Icon size={18} aria-hidden />
                          </span>
                        </div>
                        <p className="mt-3 max-w-[68ch] text-[16px] leading-7 text-ink-soft">{section.body}</p>
                        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                          {section.points.map((point) => (
                            <li key={point} className="flex items-center gap-2 text-[12px] text-ink-soft">
                              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                              {point}
                            </li>
                          ))}
                        </ul>
                        {section.id === 'source' ? (
                          <div className="mt-4 max-w-[560px] rounded-xl border border-line bg-surface px-4 py-3">
                            <p className="font-medium text-[11px] text-ink-soft">Metropolis report.pdf · page 1 · received 3h ago</p>
                            <p className="mt-1 font-medium text-[12px] leading-6 text-ink">
                              Sodium 128 mmol/L <span className="text-ink-soft">| lab flag critical</span>
                            </p>
                          </div>
                        ) : null}
                        {section.id === 'ai' ? (
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="inline-flex min-h-7 items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 text-[11px] font-semibold text-primary">extraction + matching</span>
                            <span className="inline-flex min-h-7 items-center rounded-full border border-line px-2.5 text-[11px] text-ink-soft">human receipt</span>
                            <span className="inline-flex min-h-7 items-center rounded-full border border-line px-2.5 text-[11px] text-ink-soft">no interpretation</span>
                          </div>
                        ) : null}
                        <Link
                          to={section.action.to}
                          className="mt-5 inline-flex min-h-9 items-center gap-2 border-b border-dotted border-primary/50 pb-1 text-[14px] font-semibold text-primary hover:border-primary"
                        >
                          {section.action.label}
                          <ArrowRight size={14} aria-hidden />
                        </Link>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-line bg-surface px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Open the working ledger</p>
                <p className="mt-1 text-[14px] leading-6 text-ink-soft">
                  One-click clinic workspace. Synthetic reports only.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/sign-in"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Open ledger <ArrowRight size={14} aria-hidden />
                </Link>
                {demoEnabled ? (
                  <Button variant="secondary" onClick={() => void enterDoctor()} disabled={busy}>
                    <User size={14} aria-hidden /> One-click clinic
                  </Button>
                ) : (
                  <Link to="/sign-in" className="inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-medium text-ink">
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1.2fr_0.8fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 text-primary">
              <HeartPulse size={22} aria-hidden />
              <span className="text-lg font-semibold tracking-tight">glucoflow</span>
            </div>
            <p className="mt-3 max-w-[40ch] text-[12px] leading-5 text-ink-soft">
              A result accountability ledger for Indian hospitals and clinics. Synthetic demonstration only.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Open</p>
            <div className="mt-3 flex flex-col items-start gap-2 text-[14px]">
              <Link to="/verify" className="text-primary hover:underline">Verify a receipt</Link>
              <Link to="/sign-in" className="text-primary hover:underline">Sign in</Link>
              <Link to="/" className="text-primary hover:underline">Product home</Link>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Constraints</p>
            <p className="mt-3 text-[12px] leading-5 text-ink-soft">
              Assistive only. Human approval required. Not a diagnosis. No real patient data.
            </p>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4 text-[11px] text-ink-soft sm:px-8">
          <span>© 2026 glucoflow</span>
          <span>Synthetic demonstration only.</span>
        </div>
      </footer>
    </main>
  );
}

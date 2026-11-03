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
  if (clinic && !patient) return '/clinic/patients';
  if (patient && !clinic) return '/patient/records';
  return '/account';
}

const SECTIONS = [
  {
    id: 'unit',
    index: '01',
    kicker: 'The unit',
    title: 'Three decisions, not a timeline.',
    body: 'The brief shows the clinic watchlist change, the oldest unresolved item and the first disagreement. Nothing to scroll before the patient sits down.',
    icon: FileText,
    points: ['Clinic watchlist change', 'Oldest unresolved item', 'First disagreement'],
    action: { label: 'Open the synthetic brief', to: '/demo/delta' },
  },
  {
    id: 'source',
    index: '02',
    kicker: 'The source',
    title: 'Every line opens its page.',
    body: 'Each item carries the original document, page and quoted line. Missing pages and partial dates are shown as gaps, not filled in.',
    icon: ShieldCheck,
    points: ['Document', 'Page', 'Exact quoted line'],
    action: { label: 'See a source in the demo', to: '/demo/delta' },
  },
  {
    id: 'ai',
    index: '03',
    kicker: 'The AI',
    title: 'AI reads. The doctor decides.',
    body: 'Extraction is AI-assisted and evidence-bound. The companion answers from approved records, names its sources, and refuses diagnosis, interpretation and treatment advice.',
    icon: Sparkles,
    points: ['Extraction provenance', 'Grounded source cards', 'A plain refusal'],
    action: { label: 'Open the live record companion', to: '/sign-in' },
  },
  {
    id: 'product',
    index: '04',
    kicker: 'The working product',
    title: 'A real API, a real record, a real audit trail.',
    body: 'The public demo uses one synthetic patient. Sign in to open the clinic workspace, review the ledger, ask the record companion and export the draft note. Every decision is append-only and every line stays tied to its source.',
    icon: Stethoscope,
    points: ['PDF and photo extraction', 'Human review', 'Append-only decisions'],
    action: { label: 'Enter the doctor workspace', to: '/sign-in' },
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
      navigate('/clinic/patients', { replace: true });
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

          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-white/10 py-2.5 text-[11px] uppercase tracking-[0.14em] text-[#9dc4b6]">
            <SystemGlyph className="mr-1 text-[#a7d8c8]" />
            <span>Pre-visit delta</span>
            <span aria-hidden>·</span>
            <span>Indian follow-up clinics</span>
            <span aria-hidden>·</span>
            <span>Synthetic demonstration</span>
          </div>

          <div className="mt-12 grid items-center gap-12 lg:mt-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="reveal-up reveal-up-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a7d8c8]">
                A pre-visit brief for Indian follow-up clinics
              </p>
              <h1 className="reveal-up reveal-up-2 mt-4 max-w-[13ch] text-[48px] font-semibold leading-[1.03] tracking-[-0.03em] sm:text-[64px]">
                The 60-second delta.
              </h1>
              <p className="reveal-up reveal-up-3 mt-5 max-w-[52ch] text-[16px] leading-7 text-[#c8e3d8] sm:text-[18px]">
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
                      Pre-visit delta · synthetic
                    </p>
                    <p className="mt-1 text-[20px] font-semibold tracking-tight text-white">
                      Asha Rao, 58
                    </p>
                    <p className="text-[11px] text-[#9dc4b6]">P0482 · diabetes follow-up · <span className="hidden sm:inline">move your cursor over the brief</span><span className="sm:hidden">tap a decision to inspect</span></p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#a7d8c8]/20 bg-[#a7d8c8]/10 px-2.5 py-1 text-[11px] font-semibold text-[#a7d8c8]">
                    <Timer size={12} aria-hidden /> Demo case
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
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-[#9dc4b6]">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ['eGFR', 'Fell from 70 to 55', 'Open source'],
                    ['Eye review', 'No later record', 'Not called overdue'],
                    ['Atorvastatin', 'Patient stopped it', 'Prescription says continue'],
                  ].map(([title, detail, meta]) => (
                    <div
                      key={title}
                      onMouseEnter={() => setHovered(title ?? null)}
                      className={`relative flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        hovered === title
                          ? 'border-[#a7d8c8]/50 bg-white/[0.1]'
                          : 'border-white/10 bg-white/[0.04]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-white">{title}</p>
                        <p className="truncate text-[11px] text-[#9dc4b6]">{detail}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-[#a7d8c8]">{meta}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#9dc4b6]">
                  <Sparkles size={12} className="text-[#a7d8c8]" aria-hidden />
                  AI-assisted extraction. Every line opens its source.
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
                  No real patient data. No diagnosis. No automatic note.
                </p>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="rule-reveal flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">The dossier</p>
                <p className="mt-1 text-[20px] font-semibold tracking-tight text-ink">What the product does, in four sections.</p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">04 sections</p>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
              {[
                ['7', 'changed'],
                ['3', 'unresolved'],
                ['2', 'conflicts'],
                ['3', 'gaps'],
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
                            <p className="font-medium text-[11px] text-ink-soft">2026-07-09_lab_report.pdf · page 1</p>
                            <p className="mt-1 font-medium text-[12px] leading-6 text-ink">
                              eGFR 55 mL/min/1.73m2 <span className="text-ink-soft">| previous 70</span>
                            </p>
                          </div>
                        ) : null}
                        {section.id === 'ai' ? (
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="inline-flex min-h-7 items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 text-[11px] font-semibold text-primary">gpt-6-luna</span>
                            <span className="inline-flex min-h-7 items-center rounded-full border border-line px-2.5 text-[11px] text-ink-soft">source-bound</span>
                            <span className="inline-flex min-h-7 items-center rounded-full border border-line px-2.5 text-[11px] text-ink-soft">no diagnosis</span>
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Open the working product</p>
                <p className="mt-1 text-[14px] leading-6 text-ink-soft">
                  Public demo, no sign-in. Doctor workspace, one click.
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
              A doctor-side pre-visit brief for Indian follow-up clinics. Synthetic demonstration only.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Open</p>
            <div className="mt-3 flex flex-col items-start gap-2 text-[14px]">
              <Link to="/demo/delta" className="text-primary hover:underline">Public demo</Link>
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

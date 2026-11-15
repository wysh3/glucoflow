import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowDown, ArrowRight, Bot, CheckCircle2, Database, FileClock, FlaskConical, Globe, Lock,
  RefreshCcw, ServerCog, Plug, Building2, Boxes, Repeat, ShieldCheck, Smartphone, UserCheck, Workflow, XCircle,
} from 'lucide-react';
import './how-it-works.css';

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8787';

/** Measured on the dated release recorded in app/reports; update only from fresh runs. */
const verification = {
  date: '14 November 2026',
  tests: '424 automated tests in 79 files',
  database: '12 of 12 database isolation and constraint checks',
  report: 'app/reports/evaluator-showcase-2026-11-14.md',
};

const guarantees = [
  { icon: UserCheck, title: 'Role-gated source events', text: 'Only the lab role can record lab receipt or results; only clinicians acknowledge. The API refuses the wrong role, whatever the screen shows.' },
  { icon: CheckCircle2, title: 'Closed by evidence', text: 'A follow-up task closes only when the matching source event for the same encounter and order arrives in a valid order. A tick-box attestation is kept separate.' },
  { icon: RefreshCcw, title: 'Corrections reopen work', text: 'A corrected lab result invalidates the earlier acknowledgement. The new version needs its own.' },
  { icon: ShieldCheck, title: 'Approval before monitoring', text: 'Gluco can propose monitoring or a handover. Nothing runs until a person approves its scope, owner and expiry.' },
  { icon: FileClock, title: 'Append-only history', text: 'Every change stores a revision with its actor and time. Concurrent edits are refused with a conflict instead of silently overwriting.' },
  { icon: Lock, title: 'Tenant isolation in the database', text: 'PostgreSQL row-level security scopes every query to the signed-in person and clinic, independently of the API code.' },
];

const notClaimed = [
  'Live HIS, LIS or ABHA/ABDM connections: hospital feeds are simulated',
  'Diagnosis, prescribing, clinical risk scores or treatment advice',
  'Hospital validation, clinical outcomes or production certification',
  'Real patients: every record in the demo is fictional',
];

function LiveStatus() {
  const [state, setState] = useState<{ ok: boolean; ms: number; env?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const started = performance.now();
    fetch(`${apiBase}/api/v1/config`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { appEnv?: string };
        setState({ ok: response.ok, ms: Math.round(performance.now() - started), env: body.appEnv });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ ok: false, ms: Math.round(performance.now() - started) }); });
    return () => controller.abort();
  }, []);
  return <div className="hiw-status" role="status">
    <span data-ok={state?.ok ?? undefined} aria-hidden />
    {!state ? 'Checking the live API…' : state.ok
      ? <>Live API responded in {state.ms} ms{state.env ? ` · ${state.env} environment` : ''}</>
      : <>The API did not respond. It may be restarting; try again shortly.</>}
  </div>;
}

const scale = [
  { icon: Plug, title: 'Connect, do not replace', text: 'Reads the order, collection, receipt, result and acknowledgement events a hospital system already records. Today they are simulated; a standards-based HIS/LIS adapter is the next integration step.' },
  { icon: Building2, title: 'A new clinic is a new tenant', text: 'PostgreSQL row-level security isolates every clinic and person in the database itself, so adding a site is configuration, not a new deployment.' },
  { icon: Boxes, title: 'Stateless, horizontally scaled', text: 'The API and worker run as containers that scale out on Azure. Durable jobs and revisions live in the database, so restarts lose nothing.' },
  { icon: Repeat, title: 'Learning that travels', text: 'A follow-up pattern one team confirms becomes a versioned care routine. It is tested and approved before another ward reuses it with its own evidence.' },
];
const pilot = [
  { title: 'Agree sources and owners', text: 'Map which hospital events mark each step and who owns the next one.' },
  { title: 'Measure the baseline', text: 'Record current receipt and acknowledgement delays and time spent chasing.' },
  { title: 'Run in shadow mode', text: 'GlucoFlow tracks alongside existing practice without changing it.' },
  { title: 'Compare and decide', text: 'Delays, chasing time and alert burden against the baseline, reviewed with clinicians.' },
];

export function HowItWorksPage() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.closest('section')?.scrollIntoView({ block: 'start' }), 50);
    return () => window.clearTimeout(timer);
  }, [hash]);
  return <main className="hiw">
    <header className="hiw-hero">
      <p className="hiw-kicker">How it works</p>
      <h1>Coordination you can audit,<br />not a black box.</h1>
      <p className="hiw-lead">GlucoFlow tracks the work between doctors, nurses and the laboratory. Every status shown in the app comes from a recorded source event, and the server enforces who may record what.</p>
      <LiveStatus />
      <div className="hiw-cta">
        <Link to="/" className="hiw-button" data-primary>Take the 3-minute tour <ArrowRight size={16} aria-hidden /></Link>
        <a href="#architecture" className="hiw-button">See the architecture <ArrowDown size={16} aria-hidden /></a>
      </div>
    </header>

    <section id="architecture" className="hiw-section" aria-labelledby="hiw-arch">
      <h2 id="hiw-arch">Architecture</h2>
      <p className="hiw-sub">Running today on Vercel (web), Azure Container Apps in Central India (API, worker and runtime) and Supabase PostgreSQL in Mumbai.</p>
      <div className="hiw-arch">
        <div className="hiw-node" data-kind="client"><Globe size={18} aria-hidden /><strong>Web and Android</strong><span>React, TypeScript, Vite · Capacitor Android shell</span></div>
        <div className="hiw-arrow" aria-hidden><ArrowDown size={16} /></div>
        <div className="hiw-node" data-kind="api"><ServerCog size={18} aria-hidden /><strong>API</strong><span>Fastify · authentication, role checks, schema validation, idempotent commands, streamed progress</span></div>
        <div className="hiw-row">
          <div className="hiw-node" data-kind="sim"><FlaskConical size={18} aria-hidden /><strong>Simulated HIS and LIS</strong><span>Fictional order, collection, receipt, result and acknowledgement events with source references</span></div>
          <div className="hiw-node" data-kind="db"><Database size={18} aria-hidden /><strong>PostgreSQL</strong><span>Row-level security, migrations, revision history, audit events, durable jobs</span></div>
          <div className="hiw-node" data-kind="worker"><Workflow size={18} aria-hidden /><strong>Worker</strong><span>Background reconciliation, monitoring expiry, document processing</span></div>
        </div>
        <div className="hiw-node" data-kind="ai"><Bot size={18} aria-hidden /><strong>Gluco assistant runtime</strong><span>Private sidecar with two scoped tools. Replies are validated against workspace IDs; it cannot write data or invent sources.</span></div>
      </div>
    </section>

    <section className="hiw-section" aria-labelledby="hiw-scale">
      <h2 id="hiw-scale">From one ward to a hospital network</h2>
      <p className="hiw-sub">The demo runs one simulated diabetes unit. The design does not change as sites are added.</p>
      <div className="hiw-grid hiw-grid-4">
        {scale.map(({ icon: Icon, title, text }) => <article key={title} className="hiw-card">
          <Icon size={18} aria-hidden /><h3>{title}</h3><p>{text}</p>
        </article>)}
      </div>
      <h3 className="hiw-h3">Path to a hospital pilot</h3>
      <ol className="hiw-steps">
        {pilot.map((step, index) => <li key={step.title}><span aria-hidden>{index + 1}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></li>)}
      </ol>
      <p className="hiw-note">A proposed 60–90 day single-ward pilot. No time saving or clinical outcome has been measured yet.</p>
    </section>

    <section className="hiw-section" aria-labelledby="hiw-guarantees">
      <h2 id="hiw-guarantees">Six rules the server enforces</h2>
      <div className="hiw-grid">
        {guarantees.map(({ icon: Icon, title, text }) => <article key={title} className="hiw-card">
          <Icon size={18} aria-hidden /><h3>{title}</h3><p>{text}</p>
        </article>)}
      </div>
    </section>

    <section className="hiw-section hiw-split" aria-labelledby="hiw-verified">
      <div>
        <h2 id="hiw-verified">Verified on {verification.date}</h2>
        <ul className="hiw-list" data-tone="ok">
          <li><CheckCircle2 size={16} aria-hidden /> {verification.tests} passed</li>
          <li><CheckCircle2 size={16} aria-hidden /> {verification.database} passed</li>
          <li><CheckCircle2 size={16} aria-hidden /> Typecheck and production builds for web, API and worker</li>
          <li><Smartphone size={16} aria-hidden /> Desktop and phone layouts checked in the browser</li>
        </ul>
        <p className="hiw-note">Evidence: <code>{verification.report}</code> in the public repository. Automated checks are not clinical validation.</p>
      </div>
      <div>
        <h2>Not claimed</h2>
        <ul className="hiw-list" data-tone="no">
          {notClaimed.map((item) => <li key={item}><XCircle size={16} aria-hidden /> {item}</li>)}
        </ul>
      </div>
    </section>

    <footer className="hiw-footer"><Link to="/">Back to GlucoFlow</Link> · <Link to="/privacy">Privacy and data use</Link></footer>
  </main>;
}

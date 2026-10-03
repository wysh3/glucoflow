# Sutra

Takeover status, 3 October 2026: **a working local MVP exists under [`app/`](app/), with unresolved correctness and deployment gaps**. Read the [takeover audit](app/reports/takeover-audit-2026-10-03.md) and [completion plan](app/docs/COMPLETION_PLAN.md) before proceeding. Hosted services, live-model accuracy, phone OTP and a physical Android pass remain outstanding.

Start with [the MVP documents](docs/mvp/README.md), then follow [the implementation plan](docs/mvp/06-build-plan.md). The [acceptance checklist](docs/mvp/10-acceptance-checklist.md) defines how the finished build is checked; the mapping to what was actually verified is in [app/reports/acceptance.md](app/reports/acceptance.md).

| Start here | |
|---|---|
| [app/README.md](app/README.md) | What the implementation is and how to run it |
| [app/docs/SETUP.md](app/docs/SETUP.md) | Setup, run, verify, Android build |
| [app/docs/DEMO.md](app/docs/DEMO.md) | Reproducible demonstration script |
| [app/reports/test-results.md](app/reports/test-results.md) | Measured results |
| [HANDOFF.md](HANDOFF.md) | What works, what is unverified, what is next |

## Current files

| Location | Purpose |
|---|---|
| app/ | The implementation: API, worker, web client, Android shell, migrations, tests, reports |
| docs/mvp/ | Authoritative scope, UI, architecture, extraction, data/API, build tasks and tests |
| deliverables/Sutra_Pitch.pdf | Current pitch; claims must be reconciled with final takeover evidence |
| deliverables/Sutra_Pitch.pptx | Editable version of the same deck |
| deliverables/Submission_Answers.md | Submission draft; final evidence and real team details still required |
| HANDOFF.md | Current execution status and dependencies |
| archive/ | Historical material and source assets; excluded from the build baseline |

## Fixed product

Patient and clinic roles on web and Android. Shared Vite/React/TypeScript frontend with Capacitor, shadcn/ui, Inter Variable and Lucide Animated. Fastify API and separate worker on Railway, Supabase Auth/PostgreSQL/private Storage, web assets on Vercel.

Core flow: upload records, extract draft facts with evidence, review and approve, explore progression, search original reports, retain history and export a visit summary. Patient notes remain patient-reported. ABHA is a later extension. No clinical risk alerts, causal treatment claims, inferred missing measurements or automated screening deadlines.

The application uses a restrained Apple/medical visual style. The pitch retains the user's original teal presentation theme. Use the takeover audit for current verification; archived ratings and older concept materials are historical.

[Audit details](docs/PREBUILD_AUDIT.md) record the cleanup, verification and remaining execution dependencies.

## Implementation notes

Read AGENTS.md and the current specifications before changing the product. Do not treat
older proposals, generated mockups or historical agent scores as product requirements or
evidence of a working application.

The default extraction provider is a deterministic rule engine over labelled synthetic
fixtures; every surface that shows its output says so. No diagnosis, risk score, treatment
causation, screening-deadline inference, imputation or live ABHA claim exists anywhere in
the product. [app/docs/DECISIONS.md](app/docs/DECISIONS.md) records every contradiction that
was resolved while building and every deviation that remains open.

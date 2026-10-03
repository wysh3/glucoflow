# Current Sutra handoff — takeover, 3 October 2026

The existing MVP is a working local foundation, with unresolved correctness and deployment gaps. It is not ready to describe as a fully completed hosted or live-AI application.

## Start here

- [Takeover audit](app/reports/takeover-audit-2026-10-03.md): inspected layers, actual browser observations, fresh checks and current defects.
- [Completion plan](app/docs/COMPLETION_PLAN.md): ordered implementation tasks, regression cases and release gates.
- [Setup](app/docs/SETUP.md), [demo script](app/docs/DEMO.md), [deployment](app/docs/DEPLOYMENT.md).
- `docs/mvp/` remains the product and contract baseline. Older reports and archives contain historical results, not evidence of current completeness.

## Built

Vite/React client with patient and clinic roles; Capacitor Android shell; Fastify API; PostgreSQL tenant policies; durable worker; PDF text/OCR preparation; labelled fixture extraction and live-provider adapter; human review/publication; progression, source viewing, search, patient notes, history and summary exports. Several capabilities exist in the API without complete UI access.

## Verified during takeover

Typecheck passed; 104 tests across 14 files passed; 12 database policy checks passed; 25 smoke checks passed; client/API/worker build passed. The initial browser run found a numeric-format assertion error, which was corrected. The final complete browser rerun passed **44 checks, with 2 skipped and 0 failed**, recorded in `app/reports/raw/takeover-e2e-2026-10-03.txt`. These checks do not cover all defects identified in the takeover audit.

The unfamiliar-layout fixture corpus gives complete-field accuracy **0.24**, precision 0.875 and recall 0.56. This is the relevant robustness warning; generated-fixture perfect scores are not generalization evidence. No live model was called.

## Fix in order

1. Patient report status/visibility and correct source access.
2. Every photo-batch page processed and mapped to its original source.
3. Complete timeline loading and visible pagination.
4. Date/test correction, post-publication versions and remaining role actions.
5. Actual cumulative dollar/token budget enforcement, then live model evaluation.
6. Supabase session lifecycle, real hosted services and working containers/retention.
7. Physical Android checks, screen polish, clean demo, user timing and evidence-aligned submission materials.

See the completion plan for exact files, boundaries and tests. Do not add clinical inference, imputation or live ABHA claims.

## Running locally

Web: http://127.0.0.1:5173 ; API: http://127.0.0.1:8787 . Demo credentials remain local in `app/.local/demo-credentials.json`; do not copy them into documentation. The existing database was started without reset. Browser/smoke checks added synthetic reports/notes, so the tenant is **not** in its original clean seed state.

## External dependencies

The user delegated service choice. Keep the specified Supabase + Vercel + Railway architecture. Model selection still needs measured evaluation. Actual project access, provider credentials and a concrete spending ceiling are not established by choosing services. Android evidence from prior emulator runs is historical; no fresh physical-device pass occurred during this audit. Phone OTP is absent. Productivity remains unmeasured. Real team/doctor details and actual portal submission status must be supplied/verified before external claims.

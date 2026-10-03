# Glucoflow application

Working implementation of the Glucoflow MVP: patient and clinic workflows on web and Android,
with the API, worker, database, extraction pipeline, review, progression, search, patient
notes and exports.

Baseline documents live one level up: [`../README.md`](../README.md),
[`../AGENTS.md`](../AGENTS.md), [`../docs/mvp/`](../docs/mvp/) and
[`../HANDOFF.md`](../HANDOFF.md).

## Quick start

```bash
pnpm install
pnpm db:start && pnpm db:migrate
pnpm fixtures:generate && pnpm fixtures:reference
pnpm seed:demo -- --clinic demo --confirm-demo
pnpm dev
```

Web client <http://127.0.0.1:5173>, API <http://127.0.0.1:8787>. Demonstration passwords
are written once to `.local/demo-credentials.json` (Git-ignored).

Full instructions: [`docs/SETUP.md`](docs/SETUP.md). Demonstration script:
[`docs/DEMO.md`](docs/DEMO.md). Deployment: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
Decisions and deviations: [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Layout

```
apps/api          Fastify API: auth, patients, uploads, review, exports, search
apps/worker       Durable job worker: document processing, export rendering
apps/client       React web client + Capacitor Android shell
packages/contracts  Shared schemas and vocabularies
packages/domain     Units, aliases, dates, timeline and review rules
packages/data       Database access, storage adapters, identity, queue
packages/extraction Page preparation, OCR routing, provider boundary, validation
packages/ui         Design-system primitives
supabase/migrations Database schema, policies and procedures
supabase/tests      SQL isolation and constraint checks
scripts           Setup, fixtures, seed, smoke, evaluation, maintenance
tests             Unit, integration and browser suites
reports           Measured results and acceptance mapping
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | API, worker and web client |
| `pnpm db:start` / `db:stop` / `db:status` | Private PostgreSQL 16 cluster in `.local/pgdata` |
| `pnpm db:migrate` / `db:reset` / `db:test` | Apply migrations, rebuild, run SQL checks |
| `pnpm fixtures:generate` / `fixtures:reference` / `fixtures:corpus` | Synthetic sources, reference manifests, held-out corpus |
| `pnpm seed:demo` / `reset:demo` | Build or reset the synthetic demonstration tenant |
| `pnpm maintenance:demo` | Retention and orphan cleanup (`--dry-run` by default) |
| `pnpm smoke` | Authenticated end-to-end API sequence |
| `pnpm test` / `pnpm typecheck` / `pnpm build` | Unit and integration tests, both TypeScript projects, all bundles |
| `pnpm e2e` | Browser workflows on desktop and mobile viewports |
| `pnpm evaluate:extraction` | Measured extraction report (`--live` for a model) |
| `pnpm android:keystore` / `android:sync` / `android:apk` | Android signing and release build |

## Current verification and limits

The [repository README](../README.md) and [GitHub preparation report](reports/github-upload-2026-10-03.md)
record the current local checks. The [hosted deployment report](reports/hosted-deployment-2026-10-03.md)
documents the deployed synthetic flow, including Supabase Auth/Storage and live extraction.
The newer Master dashboard is covered by domain/API tests; see the revised plan in
[`../docs/superpowers/plans/2026-10-03-pdf-demo.md`](../docs/superpowers/plans/2026-10-03-pdf-demo.md).

Local extraction defaults to a labelled deterministic fixture engine. Live extraction requires
credentials and a positive budget and keeps output in human-reviewed drafts. No clinical
validation, treatment decisions, live ABHA integration or real emergency dispatch is claimed.
Physical-device checks and phone OTP remain pending. The bundled APK predates the latest dashboard.

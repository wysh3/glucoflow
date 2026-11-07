# GlucoFlow application

The implementation behind [GlucoFlow](https://glucoflow.vercel.app/): care conversations, source-backed operational work, patient records and review workflows.

Read the [project overview](../README.md) for the product, current screenshot, verification and limitations. Use [SETUP.md](docs/SETUP.md) for the local database and application, and [CARE_SETUP.md](docs/CARE_SETUP.md) for the bundled Gluco runtime, provider configuration, containers and deployment.

## Code map

| Directory | Responsibility |
| --- | --- |
| `apps/client` | React web app and Capacitor Android shell |
| `apps/api` | Authentication, authorization, care workspaces, uploads, review and exports |
| `apps/worker` | Durable processing and export jobs |
| `packages/contracts` | Shared schemas |
| `packages/domain` | Domain rules and source interpretation |
| `packages/data` | Database, storage, identity and queue access |
| `packages/extraction` | Page preparation, provider boundary and validation |
| `packages/ui` | Shared components and orb |
| `hermes` | Gluco runtime adapter, bundled upstream source, license and checksum |
| `supabase/migrations` | Versioned database schema and access controls |
| `deploy` | Containerfiles, Compose and example configuration |
| `scripts` | Local setup, deployment, fixtures and verification |
| `tests` / `reports` | Automated checks and dated evidence |

## Development

Node 22.12–22.x and pnpm 12.5.1 are required. Run commands from this directory. Follow the setup guide before starting `pnpm dev`; it serves web on port 5173 and API on 8787.

- `pnpm typecheck` — check server and web TypeScript.
- `pnpm test` — automated tests; service-dependent checks have separate prerequisites.
- `pnpm build` — client, API and worker bundles.
- `pnpm db:test` — database isolation and constraints, against a configured test database.
- `pnpm lint:ui --json` — lintapple against the running local web application.

Credentials belong in ignored `.env` / `.local` files. Use synthetic data only in fixtures, screenshots, demos and public testing. Do not run local reset or demo seed operations against hosted customer data.

## Shipping

The [shipping checklist](docs/SHIP_CHECKLIST.md) is the current task ledger. The [release report](reports/completion-release-2026-11-07.md) records measured tests and deployed components. The [care demo guide](docs/CARE_DEMO.md) describes the intended walkthrough. The [acceptance checklist](../docs/mvp/10-acceptance-checklist.md) maps implementation back to scope.

The current public deployment is an operational simulation. Clinical production use still requires the explicit integration, security, validation and pilot gates in the shipping checklist.

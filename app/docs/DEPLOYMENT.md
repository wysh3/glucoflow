# Deployment

The API and the worker are separate processes with separate database roles. The web
client is a static bundle. Nothing in this document was executed against a hosted
provider in this environment; it is the configuration that exists in the repository, and
each item says whether it was exercised.

## 1. Services

| Service | Artifact | Notes |
| --- | --- | --- |
| Web client | `apps/client/dist` (Vercel) | `vercel.json` sets the build command, the SPA rewrite, immutable asset caching and a strict content security policy |
| API | `deploy/api.Dockerfile` | Fastify, port `8787`, non-root user, runs as the API privilege role |
| Worker | `deploy/worker.Dockerfile` | No inbound route; leases jobs from the database. Includes the fonts and native libraries the PDF/OCR stages need |
| Database | Supabase PostgreSQL or any PostgreSQL 16 | Apply `supabase/migrations` in order |
| Storage | Supabase Storage (private buckets) or the local filesystem adapter | `sutra-sources` and `sutra-exports` are private |

`deploy/worker.Dockerfile` is the required native-module smoke test target: build it and
confirm `@napi-rs/canvas`, `sharp` and the Tesseract language data load before trusting
PDF rendering in production. **The images have not been built here** (Docker is not
running in this environment), so they are configuration, not verified artifacts.

## 2. Environment

Copy the names from [`.env.example`](../.env.example). Required in a deployment:

```
APP_ENV=production
DATABASE_URL_API=postgres://<api login>:<secret>@<host>:5432/postgres
DATABASE_URL_WORKER=postgres://<worker login>:<secret>@<host>:5432/postgres
DATABASE_ROLE_API=authenticated          # Supabase; sutra_api on a plain cluster
DATABASE_ROLE_WORKER=sutra_worker
AUTH_MODE=supabase
SUPABASE_URL=...
SUPABASE_JWKS_URL=...
SUPABASE_JWT_ISSUER=...
SUPABASE_JWT_AUDIENCE=authenticated
STORAGE_MODE=supabase
SUPABASE_STORAGE_SERVER_KEY=...
STORAGE_BUCKET_SOURCES=sutra-sources
STORAGE_BUCKET_EXPORTS=sutra-exports
ALLOWED_ORIGINS=https://<web host>,https://localhost
EXTRACTION_PROVIDER=openai-compatible
EXTRACTION_MODEL=...
EXTRACTION_BASE_URL=...
EXTRACTION_API_KEY=...
MAX_DOCUMENT_MODEL_CALLS=12
MAX_DOCUMENT_COST_USD=<positive>
MAX_DOCUMENT_USD_PER_MTOK_INPUT=<number>
MAX_DOCUMENT_USD_PER_MTOK_OUTPUT=<number>
```

Notes that matter:

* `AUTH_MODE=local` is refused when `APP_ENV=production`, so a deployment cannot
  accidentally ship the development sign-in.
* The client's public configuration is bundled at build time: `VITE_API_BASE_URL`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DEMO_LABEL`. Set them before
  `pnpm --filter @glucoflow/client build`.
* `https://localhost` must stay in `ALLOWED_ORIGINS`: that is the origin the Capacitor
  Android WebView uses for bundled assets. Without it every call from the installed app
  fails with `Failed to fetch`.
* A deployed API must be HTTPS. The Android cleartext exception covers only
  `10.0.2.2`, `127.0.0.1` and `localhost`.

## 3. Migrations

```bash
pnpm db:migrate --api-role authenticated     # Supabase
pnpm db:migrate                              # plain PostgreSQL 16
```

Applied files are checksum guarded. Corrections arrive as new migrations; never edit an
applied file. The API role must not have write grants on `approved_facts`,
`approval_batches`, `fact_status_events` or `audit_events`: every mutation goes through a
`SECURITY DEFINER` procedure. `pnpm db:test` asserts exactly that.

## 4. Scheduling

`pnpm maintenance:demo` is the on-demand version of the scheduled cleanup:

```bash
pnpm maintenance:demo -- --dry-run                                  # report only
pnpm maintenance:demo -- --apply --confirm-demo [--clinic <uuid>]    # remove
```

It marks expired upload sessions, removes orphaned upload objects older than three hours,
and deletes completed demonstration content older than 30 days and audit metadata older
than 90 days. It refuses any clinic that is not a demo tenant. In a deployment, run the
same command on a schedule (for example a Railway cron service using the worker image).
Nothing deletes data implicitly.

## 5. Health, caching and limits

| Item | Behaviour |
| --- | --- |
| `GET /health/live` | Process liveness |
| `GET /health/ready` | Database reachability |
| `cache-control: no-store` | Every `/api/v1` response |
| Rate limit | 300 requests per minute per client, applied per route |
| Signed source URLs | 60 second expiry, per object, issued on demand |
| Upload limits | 15 MiB per file, 10 pages per document, 10 images per photo batch |
| Model spend | Per-run call cap plus a cost or token ceiling; the run ledger is committed per call, so a crash cannot reset it |

## 6. Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request with a PostgreSQL 16
service container: install, migrate, typecheck, generate fixtures, run unit and
integration tests, then build the client, API and worker. The workflow has not been
executed on a hosted runner here; it is written to run the same commands that pass
locally.

## 7. Not configured here

| Item | Why |
| --- | --- |
| Vercel / Railway projects | No account or credentials were available |
| Container image builds | Docker is not running in this environment |
| Supabase project, buckets, JWKS | No hosted project |
| Scheduled cleanup service | The command exists; the schedule is a deployment task |
| Push notifications (APNs/FCM) | Out of scope for this milestone, as the build plan states |

# Setup

Everything in this document was executed on the machine that produced `app/reports/`.
Commands are run from `app/` unless stated otherwise.

## 1. Prerequisites

| Requirement | Version used | Notes |
| --- | --- | --- |
| Node.js | 22.23.1 (22.12+ works) | `node --version` |
| pnpm | 12.5.1 | `corepack enable` then `corepack prepare pnpm@12.5.1 --activate` |
| PostgreSQL | 16 (Homebrew `postgresql@16`) | Started by `pnpm db:start` into a private cluster at `app/.local/pgdata` on port 55432 |
| JDK | 21 for the Android build | See [Android](#7-android-build). JDK 17 cannot compile Capacitor 8 |
| Android SDK | platform 36, build-tools 36 | `ANDROID_HOME` or `~/Library/Android/sdk` |
| Docker | optional | Only needed for the container images in `deploy/`. The local flow does not use Docker |

## 2. Install

```bash
cd app
pnpm install
cp .env.example .env      # only if .env does not exist yet
```

`pnpm db:migrate` writes the generated local values it needs into `.env` (database URLs,
storage root, temporary root, base URLs) and creates `.env` if it is missing. Real
credentials are never committed; `.env`, `.local/` and the Android signing files are
ignored by Git.

## 3. Database

```bash
pnpm db:start     # initialises app/.local/pgdata and starts PostgreSQL on port 55432
pnpm db:migrate   # applies supabase/migrations in order and creates the login roles
pnpm db:status    # confirms the server is running
```

`pnpm db:migrate` prints each applied migration. The migrations create:

* the API privilege role `sutra_api` and the worker privilege role `sutra_worker`;
* the login roles `sutra_api_login` and `sutra_worker_login` used by the API and worker
  connection strings;
* every table, constraint, row level security policy and `SECURITY DEFINER` procedure.

`pnpm db:reset` drops and recreates the schema, then reapplies every migration.

Hosted setup differs from this local procedure: Supabase Auth identities must match
`app_users`, backend login roles remain separate, and Supabase's managed `postgres`
role cannot execute every role alteration in the local bootstrap. Follow
[HOSTED.md](HOSTED.md) for the deployed environment. Do not substitute `authenticated`
for the API privilege role or run the local seed/reset commands against hosted data.

## 4. Seed the demonstration tenant

```bash
pnpm fixtures:generate     # 16 synthetic source documents + 2 photos (labelled fixtures)
pnpm fixtures:reference    # independent reference manifest for the development bundles
pnpm seed:demo -- --clinic demo --confirm-demo
```

The seed command:

1. creates the demonstration clinic, the reviewer, clinician-only, patient, second-clinic
   and second-patient accounts;
2. generates random passwords, hashes them with scrypt and writes them **once** to
   `app/.local/demo-credentials.json` (mode 600, Git-ignored);
3. uploads six synthetic documents through the real pipeline (processing job, extraction,
   validation, review batch) and approves all six — 17 approved facts, nothing awaiting
   review. The live review sequence then starts by uploading
   `fixtures/synthetic/sources/2026-09-14_lab_report.pdf` as the patient, so a document
   really moves through the queue during the demonstration;
4. adds one patient note.

It refuses to run without `--confirm-demo` and never touches a non-demo clinic.

```bash
pnpm reset:demo -- --clinic demo --confirm-demo   # back to the seeded state
```

## 5. Run the services

```bash
pnpm dev
```

`pnpm dev` starts the API on <http://127.0.0.1:8787>, the worker and the web client on
<http://127.0.0.1:5173>. Each service can also be started on its own:

```bash
pnpm --filter @glucoflow/api exec tsx src/main.ts
pnpm --filter @glucoflow/worker exec tsx src/main.ts
pnpm --filter @glucoflow/client dev
```

Health endpoints: `GET /health/live` and `GET /health/ready`.

## 6. Verify

```bash
pnpm typecheck            # web + node TypeScript projects
pnpm test                 # unit and integration tests (needs the database)
pnpm db:test              # SQL isolation and constraint checks
pnpm fixtures:corpus      # 30 held-out synthetic histories
pnpm evaluate:extraction  # measured extraction report
pnpm smoke                # authenticated end-to-end API sequence
pnpm e2e                  # browser workflows (Playwright, both viewports)
pnpm build                # client bundle, API bundle, worker bundle
```

`pnpm test` takes a PostgreSQL advisory lock (key `8274119`) for the duration of the run.
A worker that is already running sees it and stops leasing new jobs, so the integration
suites own the jobs they create. The lock is advisory: if the test process dies, the
queue resumes by itself. The same mechanism pauses processing during maintenance.

Each command writes or updates a report under `app/reports/`. See
[`reports/test-results.md`](reports/test-results.md) for the measured outcomes and
[`docs/DEMO.md`](docs/DEMO.md) for the demonstration script.

## 7. Android build

Capacitor 8 compiles against Java 21. If only JDK 17 is installed, fetch a project-local
JDK 21 rather than changing the system Java:

```bash
mkdir -p .local/toolchain && cd .local/toolchain
curl -L -o jdk21.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/mac/aarch64/jdk/hotspot/normal/eclipse"
tar xzf jdk21.tar.gz && rm jdk21.tar.gz
```

Then build a signed release APK:

```bash
pnpm android:keystore                       # creates .local/keystores + android/keystore.properties
export JAVA_HOME="$PWD/.local/toolchain/jdk-21.0.12.1+1/Contents/Home"
pnpm android:apk                            # builds the client, syncs Capacitor, assembles release
```

`pnpm android:apk` writes `apps/client/android/app/build/outputs/apk/release/app-release.apk`.
The keystore and `apps/client/android/keystore.properties` are Git-ignored; a real
distribution keystore must be created and stored by the release owner.

Pointing the app at an API:

* emulator, default loopback mapping: `adb reverse tcp:8787 tcp:8787` and build with the
  default `VITE_API_BASE_URL=http://127.0.0.1:8787`;
* emulator via the host alias: `VITE_API_BASE_URL=http://10.0.2.2:8787 pnpm android:apk`
  (the cleartext exception for `10.0.2.2`, `127.0.0.1` and `localhost` is in
  `apps/client/android/app/src/main/res/xml/network_security_config.xml`);
* physical device on the same network: `VITE_API_BASE_URL=http://<host-lan-ip>:8787`, and
  add that host to the same network security configuration.

The API must allow the WebView origin `https://localhost` in `ALLOWED_ORIGINS`; it is in
the default list.

## 8. Extraction provider

The default `EXTRACTION_PROVIDER=fixture` runs the deterministic rule engine. It is
labelled *Fixture data: deterministic rule engine, not an AI model* everywhere its output
appears.

To run a live model, set all of the following; the worker refuses to start without them
and never falls back to fixture output:

```
EXTRACTION_PROVIDER=openai-compatible
EXTRACTION_MODEL=<model id>
EXTRACTION_BASE_URL=<https endpoint>
EXTRACTION_API_KEY=<key>
MAX_DOCUMENT_MODEL_CALLS=12
MAX_DOCUMENT_COST_USD=<positive number>   # or MAX_RUN_TOKENS=<positive number>
MAX_DOCUMENT_USD_PER_MTOK_INPUT=<number>
MAX_DOCUMENT_USD_PER_MTOK_OUTPUT=<number>
```

GPT-6 Luna has now been exercised against synthetic documents through the production worker and full API flow. See [current evidence](../reports/key-cleanup-and-luna-2026-10-03.md). The protocol-stub checks below verify adapter behaviour separately:

- the request carries the bearer token, the embedded prompt, the worker-supplied evidence
  ids and the rendered page image (`pnpm verify:built-worker`, which runs the **built**
  worker, not the dev tree);
- responses are parsed, repaired once on a schema mismatch, refused on bad output,
  priced from the usage the endpoint reports and capped by the budget ledger
  (`tests/integration/live-provider.test.ts`);
- the evaluation harness measures complete-field accuracy, processing time, provider
  calls and reserved cost per document (`pnpm evaluate:live-rehearsal`).

The examined synthetic corpus reports 0.9091 complete observation fields; this is not clinical accuracy or a fresh holdout claim.

## 9. Hosted authentication and storage

`AUTH_MODE=local` and `STORAGE_MODE=local` are the paths that were executed. The hosted
path (`AUTH_MODE=supabase`, `STORAGE_MODE=supabase`) is implemented — JWKS verification
with issuer, audience and expiry checks; private buckets with short-lived signed URLs —
but it was **not** exercised here because no hosted project was available. `AUTH_MODE=local`
is refused when `APP_ENV=production`.

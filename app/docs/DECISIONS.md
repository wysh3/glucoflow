# Decisions, contradictions and deviations

Every entry below was a real ambiguity in the baseline documents. The resolution is
recorded with its consequence.

## 1. `AGENTS.md` says not to write application code; the direct request says to implement

* **Conflict.** `AGENTS.md` states: *"The user has requested preparation before
  implementation; do not interpret these documents as a request to start application code
  without the user's next instruction."*
* **Resolution.** The user's next instruction is explicit: *"Implement both patient and
  clinic workflows on web and Android, including the API, worker, database, extraction
  pipeline, review, progression, search, patient notes and exports."* That instruction
  supersedes the earlier hold, and `AGENTS.md` also says *"Implement directly in this
  session as previously requested."*
* **Consequence.** Implementation proceeded in this session, with no delegation of
  implementation work.

## 2. `06-build-plan.md` names a skill that does not exist here

* **Conflict.** Task 0 of the build plan says to use the `superpowers:executing-plans`
  skill. That skill is not available in this session's skill catalog.
* **Resolution.** The plan is followed directly, in order, with its checkpoints and
  acceptance mapping preserved.
* **Consequence.** The plan's task numbering is kept in
  [`reports/acceptance.md`](reports/acceptance.md) so a reviewer can follow the same order.

## 3. Repository layout: root documents versus "build under `app/`"

* **Conflict.** `README.md` and `docs/mvp/` sit at the repository root, while the request
  says *"Build under `app/`."*
* **Resolution.** All application code, migrations, scripts, fixtures, tests and reports
  live under `app/`. Root documents stay where the baseline put them.
* **Consequence.** Paths in the plan that read `scripts/…` are `app/scripts/…` here. The
  container recipes live in `deploy/api.Dockerfile` and `deploy/worker.Dockerfile` rather
  than beside each app, so one build context (the repository root) serves both.

## 4. Supabase Auth and Storage are required by the deployment document, but no hosted project exists here

* **Conflict.** `08-deployment.md` specifies Supabase Auth (phone OTP) and Supabase Storage
  (private buckets). Neither can be exercised in this environment: no hosted project and
  Docker is not running.
* **Resolution.** Two explicit modes with no silent fallback:
  `AUTH_MODE=local|supabase` and `STORAGE_MODE=local|supabase`.
  * `local` is a development sign-in with scrypt-hashed passwords and an HS256 token
    signed by the API. It is refused when `APP_ENV=production`.
  * `supabase` verifies signature, issuer, audience and expiry against the project JWKS,
    and uses private buckets with short-lived signed URLs.
* **Consequence.** Everything demonstrated here ran on the `local` modes. The hosted path
  is implemented and unit-tested for its refusal and verification branches, but it is
  **not** verified end to end. This is stated in `SETUP.md`, `HANDOFF.md` and the
  acceptance report rather than presented as working.

## 5. Phone OTP is the specified sign-in, but no SMS provider was available

* **Conflict.** The product document specifies phone OTP.
* **Resolution.** The local mode uses email and password for the seeded demonstration
  accounts because an SMS provider cannot be configured or verified here. The interface
  states *"Local development sign-in. Accounts were created by the seed command; no public
  sign-up exists."*
* **Consequence.** Phone OTP is unimplemented; the account model, membership model and
  capability checks are provider-independent, so adding the Supabase phone provider is a
  configuration change plus the existing JWKS path.

## 6. Seed data must show a live review sequence *and* a stable progression history

* **Conflict.** The progression view needs approved history; the review demonstration needs
  something left to approve.
* **Resolution.** The seed publishes six documents through the real pipeline — the January
  (8.2 %), April (7.9 %) and July (7.5 %) HbA1c reports plus the prescription and the eye
  and foot examinations — and adds one patient note. It leaves **nothing** awaiting review,
  and prints the file to upload for the live review sequence
  (`fixtures/synthetic/sources/2026-09-14_lab_report.pdf`).
* **Why nothing is pre-staged for review.** A document parked in `awaiting review` would sit
  in the queue indefinitely with no reviewer action, and every later run of the smoke or
  browser suites would add another. Uploading one document during the demonstration shows
  the real path — patient upload, worker processing, review, approval — in about a minute,
  and `pnpm exec playwright test tests/e2e/upload-review.spec.ts` automates exactly that.
* **Consequence.** The progression view is stable and the review sequence starts from a real
  upload. `pnpm reset:demo -- --clinic demo --confirm-demo` followed by `pnpm seed:demo`
  restores this state; that is what the reports were produced against.

## 7. Same-day results stay separate

* **Baseline.** `docs/mvp/02-screens-and-design.md`: *"Same-date duplicates stay separate
  unless a reviewer has explicitly resolved them."*
* **Implementation.** `buildSeries` in `packages/domain/src/timeline.ts` pushes every
  plot-eligible observation into its series and only sorts by date; nothing is collapsed,
  averaged or dropped. `buildTableRows` lists each observation with its own document, date
  kind and reference range. The coverage line reports how many results were recorded, and
  the chart footer states *"Lines connect recorded results."*
* **Consequence.** Several results on one day appear as several points at the same date
  position and as several table rows. An earlier draft of this note claimed the chart drew
  one point per (test, date, unit); that was wrong, and the behaviour above is the
  specified one. A reviewer resolves a duplicate by excluding or correcting the entry, not
  by the chart hiding it.

## 8. `:api_role` token in migrations

* **Conflict.** Supabase migrations reference the `authenticated` role, which does not
  exist in a plain PostgreSQL cluster.
* **Resolution.** `scripts/migrate.ts` substitutes `:api_role` at apply time
  (`sutra_api` locally, `authenticated` for Supabase via `--api-role`).
* **Consequence.** One migration set serves both environments. Applied files are checksum
  guarded and are never edited in place; corrections arrive as new migrations
  (`008`–`012` are exactly that).

## 9. Where the fixture engine's honest limits are stated

* **Conflict.** The product must show real extraction status, but this environment runs a
  deterministic rule engine rather than a model.
* **Resolution.** The label *Fixture data: deterministic rule engine, not an AI model*
  appears in the app shell, on the review screen and in every evaluation report. The live
  provider refuses to start without credentials and a positive budget, and never falls
  back to fixture output.
* **Consequence.** Measured extraction numbers are published as fixture-engine numbers
  with the machine-readable and image-only paths separated
  ([`reports/extraction-evaluation.json`](reports/extraction-evaluation.json)).

## 10. Retention and maintenance without a scheduler

* **Conflict.** The deployment document expects scheduled cleanup; no scheduler exists in
  the demonstration environment.
* **Resolution.** `pnpm maintenance:demo -- --dry-run|--apply --confirm-demo` performs the
  same work on demand: expired upload sessions are marked, orphaned upload objects older
  than three hours are removed, completed demonstration content older than 30 days and
  audit metadata older than 90 days are deleted. It refuses non-demo clinics.
* **Consequence.** The same command is the container's cron entry point in a deployment;
  nothing deletes data implicitly.

## 11. Android cleartext HTTP for the local API

* **Conflict.** The app must reach a local HTTP API, and Android blocks cleartext traffic
  by default for the target SDK in use.
* **Resolution.** A network security configuration permits cleartext **only** for
  `10.0.2.2`, `127.0.0.1` and `localhost`, with `base-config cleartextTrafficPermitted="false"`
  for everything else.
* **Consequence.** A deployed API must be HTTPS. The exception cannot silently widen to
  other hosts.

## 12. Capacitor 8 needs JDK 21; the machine has JDK 17

* **Conflict.** The Android build fails with `invalid source release: 21`.
* **Resolution.** A project-local JDK 21 is downloaded into `.local/toolchain/` and used
  through `JAVA_HOME` for the Gradle build, instead of changing the system Java.
* **Consequence.** `pnpm android:apk` documents the exact steps; nothing outside the
  repository is modified.

## 13. Where the plan's wording is narrower than the request

* **Conflict.** `06-build-plan.md` schedules some work (for example the evaluation corpus)
  as optional.
* **Resolution.** It is implemented because the request asks for measured test results.
* **Consequence.** The corpus, the evaluation, the maintenance command and the browser
  suite exist even where the plan treated them as optional.

## Deviations that remain open

| Item | State |
| --- | --- |
| Live extraction provider | Implemented and gated; unexercised (no credentials) |
| Supabase Auth / Storage | Implemented and gated; unexercised (no hosted project) |
| Phone OTP | Not implemented (no SMS provider) |
| Physical Android device pass | Not done; emulator pass recorded |
| APNs/FCM push | Out of scope for this milestone, as the plan states |
| Live ABHA/ABDM | Not implemented, and not claimed in the interface |

## Local completion decisions — 3 October 2026

1. Retain Vite/React, Fastify, PostgreSQL and Capacitor; deployment is deferred by the user.
2. Use the patient-release marker for patient document state instead of expanding review/staff visibility. Historical fact lookup checks current actor authorization and release.
3. Assemble separate bounded timeline cursors and check publication revisions before displaying progression. Preserve every unit variant.
4. Apply corrections to normalization and preserve explicit nulls. Published correction/amendment entry points require reasons and existing revision checks.
5. Reserve cost/tokens before dispatch; store actual input/output transport usage separately. Unknown usage keeps a conservative reservation. Whole-evaluation spend uses MAX_RUN_COST_USD.
6. Ship English OCR data as a pinned package. Use the Capacitor Browser plugin for native source URLs.
7. One managed Supabase session owns refresh and sign-out; hosted/device lifecycle verification remains open.
8. Keep fixture extraction explicitly labelled; the external-layout regression remains 0.24 complete-field accuracy. A live model and fresh independent holdout are required before any improved accuracy claim.

Evidence: ../reports/local-fixes-2026-10-03.md.


## Product rename — 3 October 2026

The product is now Glucoflow. Web branding, Android display name and application ID (`in.glucoflow.demo`), npm workspace scope (`@glucoflow`), export filenames, active specifications and submission materials were renamed. Previous pitch files are archived.

Existing PostgreSQL schema/database/roles, source/export bucket identifiers, local authentication issuer/audience and browser session keys retain their original internal identifiers to preserve stored records and existing sessions. They are compatibility identifiers, not product branding. Historical reports, corpus fixtures, signing certificates and screenshots preserve their original evidence. The extraction prompt and engine now have different hashes; older evaluation results apply to the earlier version. The Android package ID is new, so it installs separately from the previous app.

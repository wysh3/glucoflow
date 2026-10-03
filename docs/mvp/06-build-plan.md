# Glucoflow MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Follow the user's preserved preference for direct implementation; do not create extra agents without authorization.

**Goal:** Deliver a working web application and Android APK supporting patient intake, clinic review and approved progression on a shared backend.

**Architecture:** One React SPA serves both roles and runs inside Capacitor. A Fastify API handles authorized operations, a separate worker processes durable jobs, and Supabase stores identities, records and private files.

**Tech Stack:** Vite, React, TypeScript, shadcn/ui, Lucide Animated, Capacitor, Fastify, PostgreSQL/Supabase, Vitest and Playwright.

**Spec:** Also read [Fixed contracts](09-fixed-contracts.md) and [Acceptance checklist](10-acceptance-checklist.md). [Product](01-product.md), [UX](02-screens-and-design.md), [Architecture](03-architecture.md), [Engine](04-extraction-engine.md), [Data/API](05-data-and-api.md).

## Global constraints

- Both roles work on web and Android; clinic review is functional on mobile.
- Synthetic demonstration records only.
- No diagnosis, clinical interpretation, risk scoring or inferred missing values.
- Use Inter Variable, shadcn/ui and Lucide Animated with the documented style tokens.
- No slogans or heading-plus-promotional-subtitle layouts.
- Source evidence and human approval gate every plotted fact.
- No provider secrets or elevated database credentials in clients.
- File limit 15 MiB, document limit 10 pages, photo batch limit 10 images and 15 MiB total.
- A model provider is selected through the experiment, not assumed in advance.
- Application code begins after the user reviews these documents. This plan is not evidence of a working build.

## Review focus

- Cross-tenant IDs and inactive memberships: denial at API and database boundaries, Task 1.
- Bad scans and ambiguous dates/units: unresolved drafts instead of invented values, Task 4.
- Duplicate jobs and stale reviewers: one publication and a visible conflict, Tasks 3 and 5.
- Android process interruptions and denied camera permission: recover server state and offer file upload, Task 9.
- Corrected reports after export: preserve export revision and supersede facts explicitly, Tasks 5 and 8.

## File and interface rules

All paths are relative to a new `app/` directory inside the project. Keep document artifacts outside `app/`. Shared types live in `packages/contracts/src`. Code cannot import API or worker secrets through a shared barrel export. Each task adds its own workspace scripts when needed. The `pnpm test -- <path>` root script delegates to Vitest; browser checks use `pnpm exec playwright test`.

Initialize Git only in the new app directory at execution time if the user has not supplied a repository. Do not move or commit all historical deck assets. Commit reviewed source changes after each meaningful task; no push is implied.

## Task 1: Authenticated shell and record isolation

Files: `apps/client/src/app.tsx`, `apps/client/src/routes.tsx`, `apps/client/src/auth/session.ts`, `apps/api/src/server.ts`, `apps/api/src/auth/actor.ts`, `packages/contracts/src/actor.ts`, `supabase/migrations/001_identity.sql`, `supabase/tests/isolation.sql`, `tests/e2e/session.spec.ts`.

Interfaces: `resolveActor(token: string): Promise<ActorContext>` returns verified user ID and allowed contexts. `GET /me` returns this context. `ActorContext` contains userId and authorized clinic/patient capabilities, not a client-selected arbitrary role.

- [ ] Create the monorepo manifests, strict TypeScript configuration, client/API skeleton and pinned compatible toolchain.
- [ ] Write isolation tests: clinic A cannot read clinic B; inactive member denied; patient cannot call approve; reusing one pooled connection for two actors leaks no rows. Write session test asserting logout clears previously rendered records.
- [ ] Run database and browser tests and confirm the intended authorization assertions fail before policies/session handling exist.
- [ ] Implement memberships, self-links, token verification, scoped policies and role-aware navigation using the design tokens.
- [ ] Run `supabase test db` and `pnpm exec playwright test tests/e2e/session.spec.ts`; require all cases to pass.
- [ ] Commit the shell and isolation implementation.

## Task 2: Synthetic records and progression

Files: `scripts/seed-demo.ts`, `fixtures/synthetic/manifest.json`, `packages/contracts/src/facts.ts`, `packages/domain/src/timeline.ts`, `apps/api/src/routes/timeline.ts`, `apps/client/src/features/progression/{page,chart,events,table}.tsx`, `tests/e2e/progression.spec.ts`.

Interfaces: `buildTimeline(records: { facts: ApprovedFact[]; notes: PatientNoteDto[] }, query: TimelineQuery): TimelineResult`; `TimelineQuery` has testCodes, from, to and optional cursor as defined in document 09. API route `GET /patients/:id/timeline` returns the same result. Source links are IDs, never signed URLs stored in the record.

- [ ] Seed P0482 with the four source-backed dates and values from the demo spec, but mark September as a fixture upload for the live sequence rather than a pre-approved result in reset state.
- [ ] Write tests asserting the initial chart has three points, uses date spacing, separates incompatible units, preserves report-date labels and exposes the same values in the table. Assert pagination never silently truncates the plotted history and comparison panels never mix units.
- [ ] Run `pnpm test -- packages/domain/src/timeline.test.ts` and confirm missing behavior fails.
- [ ] Implement approved-only queries, test selector, date filter, aligned event context, accessible table and patient/clinic presentations.
- [ ] Run domain tests plus `pnpm exec playwright test tests/e2e/progression.spec.ts`; compare desktop and mobile screenshots manually.
- [ ] Commit the working progression slice.

## Task 3: Upload and durable queue

Files: `apps/api/src/routes/uploads.ts`, `apps/worker/src/{main,queue}.ts`, `packages/data/src/jobs.ts`, `supabase/migrations/002_documents_jobs.sql`, `apps/client/src/features/upload/{page,preview,status}.tsx`, `tests/integration/uploads.test.ts`, `tests/integration/jobs.test.ts`.

Interfaces: `createUpload(actor, input): Promise<UploadSessionDto>`; `completeUpload(actor, sessionId): Promise<{documentId,jobId}>`; `leaseJob(workerId): Promise<LeasedJob|null>`; `LeasedJob` includes leaseToken, targetId, clinicId and stage.

- [ ] Write tests for 15 MiB rejection, wrong magic bytes, expired upload session, repeated completion returning the same job, ordered photo manifests preserving page order, cancelled/expired completion being rejected, and a stale lease token being unable to commit results.
- [ ] Run `pnpm test -- tests/integration/uploads.test.ts tests/integration/jobs.test.ts`; require failures at the intended missing checks.
- [ ] Implement manifest-based upload sessions, provider/application expiry distinction, pending/cancel endpoints, complete transaction, worker leasing/heartbeats, retry limits and observed-stage polling.
- [ ] Test worker termination mid-job and recovery with one durable stage result. Confirm cross-patient checksum lookup reveals no data.
- [ ] Run integration tests and a browser upload with actual synthetic file bytes.
- [ ] Commit upload and queue behavior.

## Task 4: Extraction and evidence

Files: `packages/extraction/src/{provider,prepare,ocr,extract,validate}.ts`, `packages/extraction/src/providers/fixture.ts`, `packages/extraction/src/providers/selected.ts`, `packages/extraction/prompts/extract-v1.txt`, `apps/worker/src/jobs/process-document.ts`, `tests/extraction/engine.test.ts`, `scripts/evaluate-extraction.ts`.

Interfaces: `ExtractionProvider.extract` from document 04; `prepareDocument(source): Promise<PreparedDocument>`; `validateDraft(result, context): ValidatedDraft` with facts, evidence and issues. `source` is an authorized object descriptor, not an arbitrary URL.

- [ ] Write assertions for encrypted/over-page-limit documents and photo batches above 10 images being rejected, for evidence on the correct document/page, unknown unit exclusion from charting, null missing dates, ambiguous decimal review and wrong-patient hold.
- [ ] Run `pnpm test -- tests/extraction/engine.test.ts`; confirm these fail before validation exists.
- [ ] Implement PDF text/OCR routing, page limits and provider abstraction. Fixture adapter must report mode=fixture; runtime UI must display that mode when active.
- [ ] Implement bounded schema extraction, evidence checks, issue codes and stage persistence. Use real provider only after credentials and budget exist.
- [ ] Run the 12-bundle development comparison, record chosen provider/model and freeze the prompt/schema. If unavailable, leave this live-provider gate explicitly incomplete.
- [ ] Run extraction tests and the sealed evaluation once ready. Commit code, synthetic fixtures and measured results without secrets.

## Task 5: Review, approval and amendments

Files: `packages/domain/src/review.ts`, `packages/data/src/publish.ts`, `apps/api/src/routes/review.ts`, `apps/client/src/features/review/{page,source-pane,field-editor,identity-dialog}.tsx`, `supabase/migrations/003_review.sql`, `tests/integration/review.test.ts`, `tests/e2e/review.spec.ts`.

Interfaces: `updateReview(actor, documentId, expectedRevision, changes): ReviewDto`; `publishReview(actor, documentId, expectedRevision): ApprovalDto`. `ApprovalDto` contains patientId, approvalRevision and publishedFactIds.

- [ ] Write tests: unreviewed entries reject publication; unresolved identity blocks whole document; excluded unreadable page appears in coverage; mixed-patient sources are quarantined; differing explicit identity cannot be overridden; patient direct API call denied; second stale reviewer gets 409; repeat publication is idempotent.
- [ ] Run review tests and confirm each missing rule fails.
- [ ] Implement publication as a stored procedure with fixed search_path, membership checks and no direct API-role writes to approved/audit tables. Implement the review transaction and evidence viewer. Desktop uses two panes; mobile uses Source/Fields tabs retaining selection.
- [ ] Implement amendments as new source versions and approval supersession, keeping earlier approved values visible with a pending-amendment label until publication. Require explicit retained/superseded/withdrawn dispositions for affected old facts. Implement reviewer-only review-revision creation for correcting published facts without a new source and test that old snapshots remain unchanged.
- [ ] Run integration tests and `pnpm exec playwright test tests/e2e/review.spec.ts` including 390 px approval and stale revision recovery.
- [ ] Commit the complete approval workflow.

## Task 6: Patient notes and acknowledgement

Files: `apps/api/src/routes/notes.ts`, `apps/client/src/features/notes/{page,form,list}.tsx`, `supabase/migrations/004_notes.sql`, `tests/integration/notes.test.ts`, `tests/e2e/notes.spec.ts`.

Interfaces: `submitNote(actor, patientId, input): PatientNoteDto`; `acknowledgeNote(actor, noteId): PatientNoteDto`. Add `correctNote(actor, noteId, input): PatientNoteDto` for an owning patient to create a new version. No extraction model is involved.

- [ ] Write tests for patient scope, blank/over-1,000-character notes, optional event date, append-only corrections and acknowledgement retaining patient-reported status.
- [ ] Run note tests and confirm failures.
- [ ] Implement form, sent-note history and clinic acknowledgement, displaying submission and reported event dates separately.
- [ ] Run integration/browser tests and verify notes appear in the clinic timeline with the correct reporter label.
- [ ] Commit the patient-note flow.

## Task 7: Queue, record search and source navigation

Files: `apps/api/src/routes/{queue,documents,history,search}.ts`, `apps/client/src/features/search/patient-search.tsx`, `packages/data/src/search.ts`, `apps/client/src/features/queue/page.tsx`, `apps/client/src/features/documents/page.tsx`, `apps/client/src/features/history/page.tsx`, `tests/e2e/queue.spec.ts`.

Interfaces: paginated queue/document/history DTOs and `searchPatientRecords(actor, patientId, query): Promise<RecordSearchResult>` from document 05; source URL issuance always reauthorizes.

- [ ] Write tests for queue filters, retry visibility, patient-specific source access and expired URL refresh. Assert a search for an approved examination finds its source, drafts never appear in snippets, cross-tenant search is denied, and empty results never produce an Overdue label.
- [ ] Run tests and confirm missing behavior fails.
- [ ] Implement patient-list search, patient-scoped record search, queue, document list and revision history with explicit empty/loading/error states. Add the consolidated overview and neutral record-availability labels from the screen specification.
- [ ] Run queue browser tests across desktop and mobile; verify returning from a source preserves the selected patient and test.
- [ ] Commit the navigation completion.

## Task 8: Export snapshots

Files: `apps/api/src/routes/exports.ts`, `apps/worker/src/jobs/export-summary.ts`, `packages/domain/src/export-snapshot.ts`, `tests/integration/exports.test.ts`.

Interfaces: `createExport(actor, patientId, approvalRevision): ExportJobDto`; export captures fact IDs and note versions at request time, stored as an immutable snapshot manifest before rendering.

- [ ] Write tests asserting drafts are absent, dates/units/source references are present, later amendments cannot modify an old snapshot, and unauthorized downloads fail.
- [ ] Run export tests and confirm failures.
- [ ] Implement queued PDF generation, private storage and authorized downloads. Include synthetic watermark for demo tenant and coverage limitations.
- [ ] Run tests; open the generated PDF and inspect long values, multiple pages and source-reference text.
- [ ] Commit export behavior.

## Task 9: Android packaging and device behavior

Files: `apps/client/capacitor.config.ts`, `apps/client/android/`, `apps/client/src/platform/{camera,session-storage,download,back}.ts`, `tests/e2e/mobile.spec.ts`.

Interfaces: `captureReport(): Promise<CapturedPage[]>`; cancellation returns an empty list; session storage conforms to the Auth storage adapter; download handles invoke the platform-appropriate action.

- [ ] Add tests for cancelled capture, denied permission offering file upload, Back closing sheets, dirty-form confirmation and clearing actor caches on logout.
- [ ] Run web/mobile tests and confirm failures before platform handlers exist.
- [ ] Implement Capacitor camera, safe areas, Android Back handling, secure native token storage and lifecycle refetch. Support patient and reviewer workflows on the same APK.
- [ ] Build a signed internal APK from bundled assets; verify it runs with the development server stopped.
- [ ] On a physical device test camera orientation, PDF upload, network interruption, app process restart, keyboard visibility, review approval, source opening and PDF export. Record device/OS and results.
- [ ] Commit Android source/configuration; keep signing keys outside Git.

## Task 10: Deployment, evaluation and video readiness

Files: `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/client/vercel.json`, `scripts/{seed-demo,reset-demo,smoke,maintenance-demo}.ts`, `.github/workflows/ci.yml`, `reports/evaluation.json`, `reports/device-check.md`.

Interfaces: deployment health endpoints and CLI commands defined in document 08. Reset refuses non-demo clinic IDs and requires an explicit demo confirmation flag.

- [ ] Write smoke tests for wrong-role denial, upload-to-approval persistence, worker recovery and exported snapshot consistency against the deployed synthetic environment.
- [ ] Deploy using user-authorized projects, configured limits and private buckets. Run migrations before exposing clients. No billing/account signup is implied by this plan.
- [ ] Implement maintenance dry-run/apply and tests proving non-demo refusal and the 3-hour/30-day/90-day boundaries. Run typecheck, meaningful tests, production builds, DB policy tests and deployed smoke tests. Record results separately from proposed targets.
- [ ] Execute the 30-history evaluation protocol; record failures and actual costs. Keep measured time distinct from time edited out of a video.
- [ ] Rehearse the video with patient Android and clinic web, then show clinic Android review briefly. Capture a disclosed backup recording.
- [ ] Update deck/submission stack and implementation status using verified facts. Commit source and operational documentation.

## Completion definition

A deployed URL, signed installable APK, reproducible seed, working live extraction provider, passing access-control checks, successful phone-to-web-to-phone flow, inspected export and recorded benchmark results. Any unavailable external dependency remains an explicit incomplete item. A UI backed only by fixture responses is not the completed MVP.

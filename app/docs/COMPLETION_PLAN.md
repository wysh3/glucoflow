# Glucoflow completion plan after takeover

Date: 3 October 2026. Authority: current user instruction to take over and complete the existing MVP. Follow the fixed scope in `../../docs/mvp/01-product.md` and contracts in `../../docs/mvp/09-fixed-contracts.md`. Implement directly; do not delegate without authorization. Audit: `../reports/takeover-audit-2026-10-03.md`.

Keep Vite/React/TypeScript, Capacitor, Fastify and PostgreSQL; deploy with Supabase, Vercel and Railway as already specified. Choose the live extraction model through measured evidence, not brand preference. No rewrite, diagnosis, predictive risk, treatment causation, imputation, inferred overdue tests or live ABHA claim.

For each task: reproduce the specific failure, add a meaningful regression test, implement the minimum correction, run the relevant gate and update evidence. Keep migrations additive and authorization narrow. Start version control with existing secrets/build outputs excluded before application changes; do not reset or purge the database as a shortcut.

## Live local status

GPT-6 Luna is configured locally and verified on the production worker, synthetic observation evaluation and API smoke flow. See [current evidence](../reports/key-cleanup-and-luna-2026-10-03.md). Independent holdout, human review measurements, hosted services and latest device walkthrough remain gates.

## Earlier local pass status — 3 October 2026

Tasks 1–4 have local implementations and regression evidence, including ordered photo source navigation, large-history pagination, patient export, review corrections and mobile report cards. Pending-upload recovery finishes bytes already stored on the server; reselecting missing files is still required. Amendment entry points are implemented; a complete amendment publication browser walkthrough remains a follow-up gate.

Task 5 has transactional reservations, actual usage reconciliation, a whole-evaluation dollar cap and labelled stub verification. Live accuracy/cost/latency await the OpenAI key and the user's spending limit. The external-layout fixture baseline remains 0.24 complete-field accuracy.

Task 6 session/CSP/rate-limit/container-script fixes are prepared locally; hosted deployment and service verification are deferred by the user. Task 7 has a fresh signed APK build and desktop/mobile browser evidence; physical-device and productivity tests remain outstanding. Extra synthetic browser/smoke records were preserved.

Fresh evidence is in `../reports/local-fixes-2026-10-03.md`. Items below remain the implementation and release gates, not a blanket claim that every hosted/device gate has passed.

## 1. Correct the patient record projection

Files: `packages/data/src/documents.ts`, `supabase/migrations/`, patient records UI and authorization tests. Acceptance: R01, R02, R08, R15.

- Expose authorized document state through a safe narrow projection. Patients must not gain direct read access to approval/review metadata or staff profiles.
- Preserve clinic-uploaded documents in the patient's authorized list; use a safe uploader display projection.
- After approval, patient sees the same released value and approved state after reload and sign-in.
- Test own-upload and clinic-upload scenarios through the API privilege role; reject another patient's and another clinic's access.

Gate: regression API/RLS tests, patient upload → clinic approval → patient record/status browser check.

## 2. Process and open every image in order

Files: `packages/extraction/src/document-job.ts`, page preparation/pipeline contracts, source route/viewer and worker tests. Acceptance: R06, R07, R13, R14.

- Prepare every photo manifest item; retain a stable document page number, object mapping and evidence ID for each page.
- Extract and validate all pages within existing page/run bounds. Detect identity conflicts on later pages too.
- Source page N must open image N; a multipage PDF remains one object with viewer page selection.
- Verify a two-image batch with distinct facts, second-page mismatched identity and source-page mapping. Do not satisfy this by concatenating unlabelled text.

Gate: worker/storage/API tests and one real browser photo-batch review.

## 3. Load complete histories and expose list pagination

Files: `apps/client/src/lib/queries.ts`, clinic progression/list/search/history/queue pages, patient records and `packages/data/src/timeline.ts`. Acceptance: R04, R05, R10, R15.

- Follow cursors for chart data within the fixed 2,000-point contract; do not draw a supposedly complete line while observations are incomplete.
- Show incomplete/loading/limit state explicitly. Use stable ordering and prevent duplicate/omitted observations across pages.
- Page prescriptions/examinations and patient notes independently; honor the selected date scope without conflating their offsets with observation offsets.
- Add Load more or explicit pagination to patient list, queue, documents, search and history.
- Preserve all selected unit-separated series; never silently discard extra unit variants.
- Regression fixtures: >100 observations, >25 patients/queue items, >50 documents/events, same-day entries and incompatible units.

Gate: date/unit/completeness unit/API tests plus browser pagination at desktop and 390 px.

## 4. Finish reviewer and patient actions

Files: review/documents/history pages, patient records, shared queries/source/export controls and existing API contracts. Acceptance: R05, R09, R10, R12, R13.

- Allow supported date/date-kind and test identification corrections as well as value/unit, with evidence and reason. Verify prescription fields against their existing schema.
- Add normal entry points for post-publication corrections and amendment upload. Preserve retained/superseded/withdrawn snapshots and stale-revision rejection.
- Provide patient authorized original-source access, search and summary export using the existing server capabilities.
- Expose clinician note acknowledgement; patient notes remain self-reported.
- Make pending uploaded sessions actually resumable, or remove the resume promise and record the unmet contract until implemented. Current patient pending UI only offers Cancel.

Gate: mistaken date corrected before publication, later revision with old history retained, stale concurrent reviewer refusal, patient unauthorized draft/source/export refusal.

## 5. Enforce real provider budgets, then evaluate live extraction

Files: provider request/usage contracts, `packages/data/src/worker-ops.ts`, `document-job.ts`, run ledger migrations and evaluation scripts. Acceptance: R07, R14.

- Reserve a conservative request cost/token ceiling transactionally before dispatch. Enforce per-run configured dollars, tokens, calls and deadline cumulatively, including schema repair/retries.
- Bound output tokens and request size. Record actual input/output usage separately; missing usage stays unknown, not a fabricated split.
- Preserve in-flight reservations after timeout/crash and prevent double reconciliation or fresh-budget bypass after restart.
- Test exact boundary acceptance, next-call refusal before dispatch, repair-call refusal, concurrent reservations and recovery through the real worker budget implementation.
- Locally configure provider credentials and an explicit spending ceiling when supplied; never place secrets in reports or invoke paid calls against an undefined budget.
- Freeze engine/prompt/corpus hashes for each comparison. Evaluate complete fields, identity, unsupported output, reviewer corrections, real latency/cost on varied synthetic layouts.
- Treat the already examined external corpus as regression data. Prepare a new independent holdout for any improved generalization claim. Choose a model only after the measured comparison.

Gate: worker budget regressions then bounded live report and human-reviewed failures. No silent fixture fallback.

## 6. Deploy and verify hosted operation

Files: auth/session/storage, `deploy/`, Vercel configuration, setup/deployment docs. Acceptance: R02, R14, R15, R19.

- Implement refresh/sign-out on one managed Supabase session with the existing web/native storage constraints. Verify expiration and background/foreground recovery.
- Apply migrations and account/patient memberships to the hosted project. Verify private buckets, short-lived URLs and cross-tenant refusals against the actual service.
- Make retention runnable from its deployed image and schedule; keep demo-only refusals.
- Enable intended route rate limits; verify production PDF/CSP behavior and native OCR/render dependencies in built containers.
- Deploy web/API/worker, configure allowed origins and HTTPS, and rerun authenticated smoke and both-role browser flows against the hosted build.

Gate: container startup/render/OCR checks, hosted auth/storage/isolation checks and patient upload → review → source → progression → export.

## 7. Finish Android and the demonstration

Acceptance: R01, R03, R16, R17, R18, R20.

- Build signed APK against the hosted API. Verify patient and clinic workflows, actual camera capture, multi-image ordering, keyboard/back navigation, source opening/export downloads and session recovery on a physical device with the owner's authorization.
- Polish existing screens: progression first, dated context nearby, consistent labels, visible mobile actions, no raw UUIDs or repeated paragraphs. Keep Inter Variable, shadcn/Radix and Lucide Animated; no slogans.
- Recreate a known clean synthetic demo only after testing ends; document the single upload that starts the sequence. Record the complete phone → clinic → phone workflow.
- Measure combined staff/doctor task time only with actual participants, separating first and return visits. Do not turn video duration or fixture extraction accuracy into a productivity/patient benefit claim.
- Update deck, submission answers and acceptance mapping from the final evidence. Confirm real team/doctor details and portal limits before submission.

Gate: actual device evidence, replayable hosted demo and every submission claim traced to evidence or explicitly marked pending. Submission is a separate external action.

## Release criteria

No unresolved blocker in tasks 1–6; both roles usable on web and Android; every displayed released fact can reach its correct original source; no silently incomplete progression; human publication and immutable history preserved; real provider budget enforced. Verify typecheck, relevant unit/integration and SQL policy tests, smoke, both-viewport browser flows, production build/containers and device checks. Do not report earlier counts as fresh results. Phone OTP remains an explicit unresolved specification deviation until implemented or the user authorizes changing that requirement.

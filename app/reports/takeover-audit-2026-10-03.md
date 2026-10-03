# Sutra takeover audit — 3 October 2026

This review inspected the client, API, data/policies, worker, extraction and deployment paths, exercised the local browser with separate clinic and patient accounts, and ran fresh verification. It is not a claim that every line, external service or Android device was independently exercised. Previous handoffs are historical evidence; this document and the completion plan describe the current takeover state.

## Decision

Keep the existing implementation and stack. The basic approved-record workflow works. The patient experience, complete-history handling, multi-image intake and live-provider controls need fixes before this is a dependable demonstration. Do not rebuild the app or add clinical interpretation.

## What exists

| Layer | Implemented and observed | Limits |
| --- | --- | --- |
| Clinic web | Patient list, progression plot/table and comparison, queue, identity/source review, approval, source drawer, documents, search, history, export | Pagination and correction actions are incomplete |
| Patient web | Sign-in, approved values, PDF/image upload, visit notes and corrected note versions | Report visibility/status defects; source/search/export actions missing from this interface |
| Backend | Fastify API, PostgreSQL RLS, private source URLs, durable leased jobs, human publication and revision procedures | Some existing API features have no client entry point |
| Extraction | PDF text, OCR, deterministic fixture extraction, validation and live-provider adapter | Default is fixture processing; unfamiliar layouts are weak; actual model accuracy unmeasured |
| Android | Shared Capacitor client, camera integration and prior signed APK/emulator evidence | No fresh APK/device verification in this takeover audit |
| Hosting | Supabase adapters, Vercel configuration and Railway Dockerfiles | External services and container operation not verified |

Manually opened the actual PDF source in the clinic drawer. Patient records and visit notes were inspected in the browser. Local web/API/worker and the existing database were started without resetting the database. Smoke/browser tests added synthetic reports and notes; the tenant is not in its original clean seed state.

## Fresh checks

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Unit/integration tests | 104 passed across 14 files |
| Database policy checks | 12 passed |
| API smoke | 25 passed |
| Client/API/worker build | Passed; client main chunk approximately 1.65 MB before gzip |
| Initial complete browser run | 43 passed, 2 skipped, 1 failed |
| Focused upload/approval after test correction | 2 passed, desktop and mobile |
| Final complete browser rerun | 44 passed, 2 skipped, 0 failed |

The initial browser failure was a test formatting error: the uploaded `6.20` was approved and displayed as numeric `6.2`. The assertion now compares the normalized numeric display exactly. The test also opens the queue item matching its filename instead of the first review link. The final complete rerun passed 44 checks with 2 skipped and no failures, captured in `raw/takeover-e2e-2026-10-03.txt`. Skipped checks are not verified behavior. Passing browser checks do not cover the defects below.

### Extraction evidence

Fresh evaluation on the 12-document hand-authored unfamiliar-layout corpus:

- Complete fields (patient, test, value, unit, date): **0.24**.
- Fact precision: 0.875; fact recall: 0.56.
- Identity-state accuracy: 0.3333; event-date exact: 0.8571.
- Median processing in this run: 54 ms. Fixture engine, zero model calls; this is not live-model latency.
- Engine `ef5435f935f1d803`; corpus hash begins `53d251483d26`.

See `extraction-evaluation-eval-corpus-external.json`. Earlier generator-based perfect scores do not establish robustness to unfamiliar source layouts. The external corpus is now a regression corpus once used to guide fixes; future generalization claims require an independently prepared new holdout.

## Findings to fix

### 1. Patient document visibility and status — high priority

Observed an approved report displayed as "Awaiting review" in the patient account while its newly approved value was already plotted. Reload preserved the inconsistency.

`packages/data/src/documents.ts` computes status using approval/review tables that patient RLS cannot read. Its inner join on uploader `app_users` can also remove clinic-uploaded documents from a patient's list because the patient cannot read staff profiles. Fix the projection without granting patient access to reviewer internals or staff profiles. Patient records currently have no original-source action.

### 2. Multi-photo batches — high priority

`packages/extraction/src/document-job.ts` validates all stored items but processes only `context.items[0]`. `/documents/:id/source` in `apps/api/src/routes/documents.ts` selects the first manifest object regardless of the requested image page. The advertised ordered photo batch therefore loses later pages during extraction and source viewing.

### 3. Pagination and complete progression — high priority

`apps/client/src/lib/queries.ts` reads one page and never follows `nextCursor`: patients/queue default to 25, documents/history to 50, and timeline to 100 observations. Chart rendering does not gate on `observationsComplete`; a longer history can be presented as a complete progression. Timeline events and notes also need their own complete paging/date-scope rules. Multiple incompatible unit series can be silently dropped by client series slicing.

### 4. Live budget and usage ledger — before paid model calls

`document-job.ts` reserves each call with cost zero. `reserveProviderCall` enforces call count and deadline but does not enforce cumulative dollar/token limits. Positive configuration checks are not budget enforcement. `reconcileProviderCall` invents a 70/30 input/output split from total tokens instead of recording actual provider usage. Stub refusal tests do not prove the worker's budget is enforced.

### 5. Reviewer correction and version workflows — before demonstration

The review UI corrects value/unit/reason, but does not expose important date and test-label corrections. Post-publication review-revision and amendment API routes exist without a normal client action to start them. Clinic patient notes display acknowledgement state without an acknowledgement action. Preserve the existing immutable version contracts while making the necessary actions reachable.

### 6. Hosted authentication and operations — before deployment

Supabase sign-in disables session persistence/refresh and retains only the access token. Sign-out creates another empty auth client. Implement and verify the intended secure session lifecycle on web and Android. Phone OTP is absent and must remain an explicit deviation until implemented or scope is changed by the user.

The worker container does not include the maintenance script despite deployment instructions suggesting the same image as a cleanup cron. Fastify registers rate limiting with `global: false` and no route opt-ins were found. Verify production CSP/PDF worker compatibility and native libraries in actual container/browser builds rather than assuming development results transfer.

## Design review

Keep the restrained light theme and typography. Reduce repeated coverage copy and excess vertical cards so progression and dated context are available together. Remove duplicate raw labels such as "Prescription prescription", render note categories as human labels, and replace raw clinic UUIDs with clinic names. Retain source evidence, fixture disclosure and clear publication state. These improvements follow the fixed scope; no new medical claims or autonomous agents are needed.

## Next

Use `../docs/COMPLETION_PLAN.md` in order. Start with patient status/visibility, then ordered image processing and complete timeline loading. Fix local correctness before model evaluation and deployment. Existing tests passing does not supersede the concrete defects above.

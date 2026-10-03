# Local cleanup and GPT-6 Luna verification — 3 October 2026

This report supersedes the earlier credential-dependent status in the local-fixes report. Deployment remains deferred. Credentials are confined to ignored `app/.env` with mode 0600. A model-list request authenticated successfully; the client build, reports and new dev log were checked for the exact secret and contained no copy.

## Cleanup

Removed the stray root `apps/` directory only after byte-comparing its sole Android XML file with the active copy in `app/apps/`. Moved `Sutra_Prebuild_Package.zip` into `archive/2026-10-03-cleanup/`; removed root Finder metadata. Kept the current deliverables, specifications, previous evidence, source storage, database and toolchain.

Removed 1023 generated cache directories older than three hours, reclaiming 88,921,787 bytes. Recent and active-job caches were protected. [Cleanup counts](cleanup-2026-10-03.json).

## Defects fixed

- Maintenance preview was expiring upload sessions, including sessions in other clinics. It now previews without writes and applies expiry only within the selected demo clinic. The regression failed before the fix and passes afterward.
- Live parsing required a model-generated `usage` object absent from the prompt. The parser now supplies transport bookkeeping from API metadata; the model cannot override usage.
- An omnibus normalization object could select the observation union member for medication/examination facts and strip their fields. Context normalization is now selected by fact kind. Regression verified medication name/strength/instructions survive.
- Luna requests use `max_completion_tokens`, low reasoning effort and no sampling parameters. The prompt names exact supported test codes.

## Fresh verification

| Check | Result | Evidence |
|---|---|---|
| Types | both projects pass | [raw](raw/luna-final-types-2026-10-03.txt) |
| Tests | 126 pass across 19 files | [raw](raw/luna-final-tests-2026-10-03.txt) |
| Database policies | 12 pass | [raw](raw/key-cleanup-policies-2026-10-03.txt) |
| Browser flows | 56 pass, zero failures/skips, desktop and 390 px, fixture configuration | [raw](raw/key-cleanup-browser-2026-10-03.txt) |
| Mutation gate | all six job mutations detected | [raw](raw/luna-final-mutations-2026-10-03.txt) |
| Build | client, API and worker bundles pass | [raw](raw/luna-final-build-2026-10-03.txt) |
| Production worker with real Luna | lab, prescription and examination: 3 pass; drafts remain unreleased | [raw](raw/live-worker-luna-2026-10-03.txt), [facts and usage](live-worker-luna-2026-10-03.json) |
| Full API workflow with real Luna | 25/25 including upload, review, approval, source access, export and isolation | [raw](raw/live-luna-smoke-2026-10-03.txt) |

The browser suite preceded the provider switch; it does not establish a Luna browser walkthrough. The local application is now running with `gpt-6-luna` for new uploads. Existing records retain their own fixture/live provenance. The production-worker check used temporary synthetic tenants and removed them afterward. Reproduce after building with `pnpm verify:live-worker --confirm-live` while the development worker is stopped; it makes three bounded model jobs. Smoke left one approved synthetic report in the demo tenant.

## Corrected evaluation protocol

The initial live run reported 0.52 complete fields. Inspection found two evaluator mistakes: it included context references in an observation-only denominator, and it assigned the foreign-patient reference to the identity printed in that document. That score, and its comparison with the old 0.24 fixture score, are superseded.

The corrected protocol scores observation patient/test/value/unit/date fields; reports context counts separately; and uses explicit assigned identifiers. The same 12 document bytes were preserved. Reference assignment metadata changed and its hash is recorded separately. Engine hashing now includes the live adapter, embedded prompt and fact schema. This is examined synthetic regression data, not an independent holdout or clinical validation.

| Metric | Fixture, corrected protocol | Luna, corrected protocol |
|---|---|---|
| Complete observation fields | 0.2727 | 0.9091 |
| Fact precision | 0.8750 | 1.0000 |
| Fact recall | 0.6364 | 1.0000 |
| Identity state accuracy | 0.3333 | 1.0000 |
| Event date exact | 0.8571 | 0.9091 |

Luna: 12 calls, 6700 ms median per document, $0.010239 ledger-priced usage for this successful evaluation. Ledger rates are conservative ($0.125/M input to cover possible cache writes; $0.50/M output), not an account invoice. This figure excludes the earlier failed mini probe, the initial Luna run and worker/smoke checks. Dates remain the measured weakness. Context counts do not establish medication instruction or examination-text accuracy.

[Fixture report](extraction-evaluation-fixture-observation-v2.json) · [Luna report](extraction-evaluation-luna-observation-v2.json) · [raw Luna output](raw/live-luna-observation-v2-2026-10-03.txt).

Official configuration references: [Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-6 compatibility](https://developers.openai.com/api/docs/guides/latest-model), [Chat completion token limits](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

## Remaining gates

Independent holdout with reviewed labels; human correction rate; latest live browser/device walkthrough; hosted Auth/Storage and deployment; physical Android camera/source/session verification; container execution; productivity timing. No real patient documents, diagnosis, treatment recommendations, clinical risk predictions, inferred screening deadlines or live ABHA support were introduced. The existing deck and submission have not been refreshed in this application pass.

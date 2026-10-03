Current local provider verification: [cleanup and Luna evidence](key-cleanup-and-luna-2026-10-03.md). 126 tests, 56 fixture browser checks, 12 policies, 6 mutations and 25 live API checks pass. Earlier counts below are historical.

> Current local pass: read [3 October completion evidence](local-fixes-2026-10-03.md) and [the current handoff](../../HANDOFF.md). The material below is the earlier implementation record; its counts and unresolved-item descriptions are historical. Current results are 120 tests, 12 policy checks, 25 smoke checks and 56 browser checks. External service/device/productivity gates remain open.

# Test results

Measured on the machine described in [`SETUP.md`](../docs/SETUP.md). Every number below
comes from a command that was executed; nothing is estimated. Raw outputs are in
`reports/raw/` and `reports/evidence/`. Each command below can be re-run and compared
with the captured output:

| Raw capture | Command |
| --- | --- |
| `reports/raw/pnpm-test.txt` | `pnpm test` |
| `reports/raw/pnpm-db-test.txt` | `pnpm db:test` |
| `reports/raw/pnpm-smoke.txt` | `pnpm smoke` |
| `reports/raw/pnpm-e2e.txt` | `pnpm e2e` |
| `reports/raw/pnpm-typecheck.txt` | `pnpm typecheck` |
| `reports/raw/pnpm-build.txt` | `pnpm build` |
| `reports/raw/evaluate-extraction.txt` | `pnpm evaluate:extraction` |

| Check | Command | Result |
| --- | --- | --- |
| TypeScript, web project | `pnpm typecheck` | clean |
| TypeScript, node project | `pnpm typecheck` | clean |
| Migrations | `pnpm db:migrate` | 13 of 13 applied (001–013), no errors |
| Reset | `pnpm db:reset` | schema dropped, 13 migrations reapplied |
| Unit tests (domain) | `pnpm test` | 8 passed (`packages/domain/src/timeline.test.ts`) |
| Unit tests (extraction) | `pnpm test` | 13 passed, including real OCR on a photographed page |
| Evaluation metric tests | `pnpm test` | 7 passed (`tests/extraction/evaluation-metrics.test.ts`) |
| Integration tests | `pnpm test` | 76 passed across 11 suites (104 tests in total: 8 domain, 13 extraction, 7 evaluation metrics, 76 integration) |
| Database isolation checks | `pnpm db:test` | 12 of 12 passed |
| Retention maintenance | `pnpm maintenance:demo -- --dry-run` | reports 2 demo tenants, 0 rows and 0 objects pending; the boundary rules are covered by `tests/integration/maintenance.test.ts` |
| Queue pause | advisory lock held during `pnpm test` | worker logs *queue paused by another process; waiting*, then *queue pause released; resuming* |
| Restored job tests | `pnpm verify:job-tests` | all 6 mutations detected; one test that passed for the wrong reason was tightened |
| Authenticated API sequence | `pnpm smoke` | 25 of 25 passed |
| Browser workflows | `pnpm e2e` | 44 passed, 2 skipped, 0 failed (desktop 1440×900 and mobile 390×844) |
| Extraction evaluation | `pnpm evaluate:extraction` | see below (complete-field accuracy 0.8834 on the unseen corpus, 0.2400 on unfamiliar layouts) |
| Built-worker live wiring | `pnpm verify:built-worker` | the **bundled** worker, a live provider and a staged scan: bearer token, prompt, evidence ids and page image all reach the model endpoint (`reports/raw/built-worker-verification.txt`) |
| Web build | `pnpm build` | client bundle built (3.8 MB `dist/`, main chunk 1.65 MB / 381 KB gzip); API bundle 876.8 KB; worker bundle 885.5 KB |
| Production bundles run | `node apps/api/dist/server.mjs`, `node apps/worker/dist/worker.mjs` | both start; `pnpm smoke` passes 25/25 against the bundles, not just the dev servers |
| Android release APK | `pnpm android:apk` | signed APK produced and installed on an emulator |

## Integration suites (`pnpm test`)

| Suite | Tests | What it covers |
| --- | --- | --- |
| `tests/integration/isolation.test.ts` | 7 | cross-clinic isolation, inactive membership, pooled-connection reuse, patient scope, capability refusal |
| `tests/integration/uploads.test.ts` | 9 | server-generated object paths, batch limit, expiry, cancellation, repeated completion, one job per version, page order, byte limit, duplicate detection |
| `tests/integration/jobs.test.ts` | 11 | single lease, stale-writer fencing, durable stage outputs, lease recovery, retry budget, non-retryable failures, page-limit quarantine, call ledger and cost cap, manual retry cap, completion fencing |
| `tests/integration/review.test.ts` | 12 | unreviewed publication refusal, explicit decisions, evidence requirement, identity mismatch hold, missing-identity reason, page exclusion coverage, correction resets review, stale revision, correction draft, amendment dispositions, mixed-identity quarantine |
| `tests/integration/notes.test.ts` | 7 | patient-only authorship, blank and oversized refusal, append-only corrections, acknowledgement without a clinical claim, cross-clinic refusal, patient-reported lane |
| `tests/integration/exports.test.ts` | 5 | frozen manifest, drafts excluded, stale revision refused, cross-clinic refusal, PDF render and immutability after a later amendment |
| `tests/integration/maintenance.test.ts` | 4 | non-demo refusal, refusal without `--confirm-demo`, dry run changes nothing, apply removes exactly the rows outside the 3 hour / 30 day / 90 day windows, expired sessions marked |
| `tests/integration/live-provider.test.ts` | 8 | live adapter against a **protocol stub**: request shape, valid response, schema repair, refusal instead of fixture fallback, 429 vs 400 mapping, budget refusal before dispatch, unreadable output, timeout |
| `tests/integration/hosted-storage.test.ts` | 6 | Supabase storage adapter against a **Storage API stub**: service-key auth, private bucket paths, signed upload/download URLs, metadata, download, delete, path escape refused |
| `apps/api/src/hosted-auth.test.ts` | 5 | Supabase token verification against a **JWKS stub**: signature, issuer, audience, expiry, missing account identifier |
| `tests/integration/worker-scan.test.ts` | 2 | the worker's own job path reads an uploaded scan with **no page-image callback** (the regression an independent review found); rendering off explicitly flags `page_unreadable` with zero facts |

Four further defects were found by the suites below and fixed:

1. `publish_review` declared the disposition loop variable as `record`, so **every
   amendment publication failed** with `operator does not exist: record ->> unknown`
   (migration `013`).
2. Duplicate detection hashed the object path together with the bytes, so an identical
   file uploaded twice was never recognised as an exact duplicate (corrected to an
   ordered content hash).
3. The maintenance dry run and the apply run disagreed about which objects they would
   remove, so the dry run under-reported the work. Both now compute the same list.
4. Six job tests were silently destroyed by a careless scripted edit and the reports kept
   citing the old count. They are restored, and `reports/raw/pnpm-test.txt` now captures
   the per-file counts so a number in a document can be checked against a command.

## Browser workflows (`pnpm e2e`)

Two viewports: `desktop-chromium` at 1440×900 and `mobile-chromium` at 390×844.

| Spec | Covers |
| --- | --- |
| `session.spec.ts` | both roles sign in, patient cannot reach clinic routes, invalid credentials, sign-out clears rendered records, clinician-only account refused the queue |
| `progression.spec.ts` | three seeded points, table parity, labelled lanes, source viewer with signed link, export action, patient-scoped search |
| `review.spec.ts` | queue filters, retry control only for a failed run, review screen identity and fixture label, mobile Source/Fields tabs |
| `notes.spec.ts` | blank note refused, note submitted with a timestamp, upload limits and process-loss notice, session storage disclosure |
| `upload-review.spec.ts` | patient upload → worker processing → reviewer approval → approved value in the progression |

Three browser defects were found and fixed:

1. The API client captured the token from React state, so a request issued immediately
   after sign-in went out unauthenticated and sign-in never completed.
2. Tailwind did not scan `packages/ui`, so dialog positioning, tab and badge utilities
   were missing from the stylesheet: dialogs rendered off-screen below the fold.
3. CORS allowed neither `PUT` (the signed upload method) nor the Supabase `x-upsert`
   header, so a browser upload failed after a successful preflight.

## Authenticated API sequence (`pnpm smoke`)

25 checks, all passing:

```
PASS  API is alive
PASS  Database is reachable
PASS  Patient signs in
PASS  Clinic reviewer signs in
PASS  A second clinic signs in
PASS  Patient sees only their own record
PASS  A second clinic cannot read the patient record
PASS  Signed upload URL is object-specific and expiring
PASS  Wrong file signature is refused
PASS  Bytes reached the private source bucket
PASS  Completion queued exactly one processing job
PASS  Worker processed the document
PASS  Uploaded document appears in the clinic queue
PASS  Reviewer sees every proposed entry with its issues
PASS  Every entry can be explicitly reviewed
PASS  A stale reviewer receives a conflict
PASS  Publication commits one approval revision
PASS  A repeated approval returns the original batch
PASS  Export request queued
PASS  Export rendered
PASS  Export downloads as a PDF
PASS  A second clinic cannot read the export
PASS  Patient timeline reflects the approved update
PASS  Patient sees the review status of their own uploads
PASS  Search retrieves the examination record with its source
PASS  An empty search returns no result and no verdict label
```

## Extraction evaluation (`pnpm evaluate:extraction`)

Provider: **fixture** — `deterministic-rules-v1`, labelled
*Fixture data: deterministic rule engine, not an AI model*. Nothing below is a claim about
a live model; that evaluation still requires credentials and is reported separately.

### The corpus is versioned and frozen

Scores are only comparable when the documents are identical, so the corpus is named,
seeded and hashed, and every report records the hash of the engine that produced it:

| | Frozen development corpus | Fresh unseen corpus |
| --- | --- | --- |
| Directory | `fixtures/synthetic/eval-corpus/` | `fixtures/synthetic/eval-corpus-final/` |
| Version | `v2` | `final-1` |
| Seed | `20261002` | `20261009` |
| Corpus hash | `e1e0b715f71069a1…` | `fd604322282ed62a…` |
| Documents | 30 (20 machine-readable, 6 at 300 dpi, 4 low resolution) | 30 (25 machine-readable, 2 at 300 dpi, 3 low resolution) |
| Engine | `ef5435f935f1d803` | `ef5435f935f1d803` |

The fresh corpus was generated with a different seed **after** the engine was finished and
was never used while developing it. It is the number to trust; the frozen corpus exists so
that a future change can be measured against the same documents.

### Final result on the unseen corpus

| Metric | Value |
| --- | --- |
| Fact precision | 1 |
| Fact recall | 1 |
| **Complete fields** (patient+test+value+unit+date) | **0.8834** |
| Complete fields, ignoring date | 0.9939 |
| Recall, machine-readable | 1 |
| Recall, 300 dpi image-only | 1 |
| Recall, low-resolution image-only | 1 |
| Event date exact | 0.8834 |
| Unit exact | 0.9939 |
| Identity state accuracy | 1 |
| Issue flag rate | 1 |

**A correction to this table.** It previously reported complete-field accuracy as 0.9939.
That number was wrong: the metric counted the unit but not the date, so a wrong date still
scored as a complete field. An independent review found it (`reports/independent-review-2026-10-03.md`,
finding 4). The rules are now explicit and unit-tested against wrong-date, wrong-test and
wrong-identity examples (`tests/extraction/evaluation-metrics.test.ts`), and the honest
figure is **0.8834**: the event date is what keeps a correct value from being a usable
record.

### What each improvement contributes, on identical documents

An earlier version of this report compared `0.2321` on one corpus with `0.9820` on
another. Those numbers came from different documents *and* a different engine, so the
comparison was not sound. The table below replaces it: one frozen corpus, one engine
binary, one feature switched off at a time (`--ablation`).

| Ablation | Precision | Recall | 300 dpi | Low resolution |
| --- | --- | --- | --- | --- |
| `baseline` — bounded render, no tolerance | 0.9877 | 0.9641 | 0.9412 | 0.8182 |
| `no-highres` — 2000 px OCR render | 0.988 | 0.988 | 0.9412 | 1 |
| `no-tolerance` — exact label matching only | 1 | 0.976 | 1 | 0.8182 |
| `no-preprocess` — no OCR upscale | 1 | 1 | 1 | 1 |
| `none` — the shipped engine | 1 | 1 | 1 | 1 |

### What actually caused the improvement, and one correction

The dominant cause was a **defect**, not a tuning choice: `renderPdfPage` compared the page
size in PDF points (842 for A4) against a pixel budget, so the scale was always 1 and OCR
ran on a ~596×842 image — about 72 dpi. The scale is now derived from the point size and
OCR gets its own 2400 px render.

The second cause is the OCR-tolerant matching pass, worth about 1.6 points of overall
recall and 4.5 points on the low-resolution documents.

A third change, **greyscale + contrast normalisation + sharpening before recognition, was
measured worse and has been removed.** On the photographed fixtures it reduced extraction
from 6 facts to 2 and lost the decimal point in values (`8.7` read as `87`); on the frozen
corpus it cost 1.8 points of recall. The earlier report credited it with part of the
improvement; that attribution was wrong. What remains is an upscale for small pages only,
which is neutral on the corpus and correct on one of the two photographs.

### Unfamiliar layouts: the number that matters more

The 1.0000 above is a score on documents from the project's own generator. A second,
hand-authored corpus (`fixtures/synthetic/eval-corpus-external/`, version
`external-1`, hash `53d251483d269468…`) tests the same engine against
**layouts it was never developed on**: HTML rendered by Chromium rather than the generator,
with right-aligned value columns, units in their own column, two-column bodies, identifiers
only in a footer, prose examinations, three dates on one page, a photographed page, a
fax-quality page and a handwritten annotation. Reference labels are written by hand beside
each document.

| Metric | Development corpus (fresh seed) | Unfamiliar layouts |
| --- | --- | --- |
| Fact precision | 1 | 0.875 |
| Fact recall | 1 | 0.56 |
| **Complete fields** (patient+test+value+unit+date) | 0.8834 | **0.24** |
| Complete fields, ignoring date | 0.9939 | 0.24 |
| Event date exact | 0.8834 | 0.8571 |
| Unit exact | 0.9939 | 1 |
| Identity state accuracy | 1 | 0.3333 |
| Processing, median per document | 47 ms | 51 ms |

Complete-field accuracy is the honest headline: a fact counts only when the patient, test,
value, unit and date are all right **together**. On the familiar corpus that is 0.8834; on
unfamiliar layouts it is 0.24 against a fact recall of 0.56. (This table previously showed
0.9939 and 0.28 from the defective metric; identity is now scored as an exact state, which
is why it reads 0.3333 rather than 0.4167.)

Per-document detail is in `reports/extraction-evaluation-eval-corpus-external.json`. Reading
that file, the losses have two causes:

1. **Identity labels.** The matcher recognises `MRN`, `ID` and `hospital number`, so
   `(P0482)`, `Ref: P0482` and a footer line `Patient identifier: P0482` are missed. Eight of
   twelve documents came back `unchecked` with `identity_missing`, which is why identity
   accuracy is 0.3333. The safe behaviour holds — an
   unresolved identity blocks publication — but a real clinic would see those documents stall
   in the queue.
2. **Layout-dependent reading.** Documents whose values sit in a column the matcher does not
   expect (ext-01, ext-02, ext-11) lost facts entirely.

Neither is fixed here. The engine was frozen before this run, and changing it now would
invalidate the comparison; the fixes belong in the next iteration, measured against this
same frozen corpus.

### Independent review, 3 October 2026: five wiring defects, all fixed and verified

An independent review of the source (`reports/independent-review-2026-10-03.md`) found five
defects that the passing suites did not cover. All five are fixed, and each fix carries a
check that fails if it regresses.

1. **Uploaded scans skipped OCR in the worker.** Rendering was gated on a page-image
   callback that the worker never passes, so an uploaded scanned PDF produced **zero
   facts** through the worker while the evaluation — which passes its own callback —
   exercised a different path and scored 1.0000. Reproduced here: the same scan returned
   0 facts through the worker's configuration and 7 through the evaluation's. Rendering
   now depends on what needs the image (OCR, or a multimodal provider), not on a storage
   callback. Regression test: `tests/integration/worker-scan.test.ts` stages a real scan
   and processes it through the worker's job function with no callback (≥7 facts); a
   second case turns rendering off explicitly and asserts the page is flagged
   `page_unreadable` with **no facts** rather than guessed values.

2. **The live request omitted the evidence ids its own prompt requires.** The prompt
   demands worker-supplied evidence ids; the request never carried them, and the protocol
   stubs returned hardcoded ids, hiding the gap. The request now includes an `EVIDENCE
   LINES` block (id, page, quote) per batch, and `tests/integration/live-provider.test.ts`
   asserts the ids appear in the outgoing request.

3. **No page images reached the model.** The worker supplied no image callback and the
   evaluation returned `null` for every image, so the "multimodal" adapter was text-only.
   Rendered pages are now written to the work directory and attached as `image_url`
   content. Verified end to end against a stub: requests now carry ~100–240 KB of page
   image data where they carried ~3.4 KB of text only.

4. **"Complete fields" ignored the date.** The metric counted the unit but not the date, so
   a wrong date scored as complete; an unmapped label could also claim any reference fact
   with the same value, and identity scoring accepted any non-matched state. All three
   rules are now explicit in `scripts/lib/evaluation-metrics.ts` and unit-tested against
   wrong-date, wrong-unit, wrong-identity and unmapped-label examples
   (`tests/extraction/evaluation-metrics.test.ts`). Every figure above has been
   regenerated with the corrected metric.

5. **The bundled worker could not load its prompt.** The prompt was read from a path
   relative to the module, which resolved to `apps/prompts/extract-v1.txt` in the bundle —
   a nonexistent file — so a live run in the built worker failed before calling out.
   Source-level stub tests never saw it because they run unbundled. The prompt is now
   embedded in the module (byte-identical, 2777 bytes, so the recorded prompt hash is
   unaffected), the worker logs its provider identity and prompt hash at startup, and
   `pnpm verify:built-worker` runs the **built** `dist/worker.mjs` against a local stub
   with a real staged scan: it asserts the request carries the bearer token, the prompt,
   the evidence block and a page image, and that the job succeeds with facts written
   (`reports/raw/built-worker-verification.txt`).

None of these fixes touches the extraction rules themselves; the fixture engine's numbers
are unchanged (the engine hash moved because preparation and pipeline code changed). The
freeze record has been refreshed to pin the fixed engine for the live evaluation.

### Live-model evaluation: harness complete, credentials missing

`pnpm evaluate:extraction -- --live` is the path for a real model. Two defects were found and
fixed while preparing it: the script never exposed the extraction keys it checked for, and it
built the provider without the budget fields, so a live run always fell back to the refusal
provider. The frozen record (`reports/frozen-evaluation.json`) pins the engine
(`a201085d83db447f`), the prompt (`c6ac68752ef4…`), the corpus and
every document hash; a later run that differs prints a drift warning rather than being
silently compared with it.

The path is proven end to end against a **protocol stub** (`pnpm evaluate:live-rehearsal`):
the unmodified evaluation runs against a local server speaking the same chat-completions
protocol and reports complete-field accuracy, processing time, provider calls and reserved
cost per document. In that rehearsal the stub's fixed answer scores
0.08 complete fields, 53 ms
median per document, 12 calls and $0.02364 reserved in total.

**Those are stub numbers, not model numbers.** No model has been called. What is established
is that the harness measures the right things; accuracy, real cost and real latency need
credentials and a positive spending limit.

Reviewer corrections are not reported: they need a human reviewer, and the report's field is
deliberately `null` with that explanation rather than an invented rate.

### Remaining limitation

Event dates are the weakest field on image-only pages (0.8834 exact
on the unseen corpus): a printed `07/03/2026` can be read as `07072025`. The engine keeps
the literal reading and flags the ambiguity rather than guessing, and every proposal
carries its quoted source line for the reviewer. A live vision model is the next step for
this field; it is not claimed here.

### What this does and does not establish

A perfect score on a synthetic corpus means the engine handles *these* documents. It says
nothing about unfamiliar real records: different printers, layouts, handwriting, stamps,
fold lines and languages are all outside this benchmark. The next evaluation must run on
real de-identified documents with a clinician-checked reference.

## Build output

| Artifact | Result |
| --- | --- |
| `apps/client/dist` | built; main bundle 1.65 MB (381 KB gzip) before the Tailwind source fix |
| API bundle | built |
| Worker bundle | built |
| `app-release.apk` | 7,892,388 bytes, signed; SHA-256 `4e4d9325ca2e4a7150e3a6d5367420f6f5b3a58faf7e335ece1d460831385bd5` (see `reports/device-check.md`) |

## Not verified here

| Item | Why |
| --- | --- |
| Live model extraction **accuracy** | No credentials. The adapter's protocol behaviour is tested against a stub; no accuracy claim is made about any model |
| Supabase Auth and Storage against a real project | No hosted project. Both adapters are tested against local protocol stubs; the hosted service itself is unexercised |
| Phone OTP | No SMS provider |
| Physical Android device | Emulator pass only; see [`device-check.md`](device-check.md) |
| Push notifications | Out of scope for this milestone |

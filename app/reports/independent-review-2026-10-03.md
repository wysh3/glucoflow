# Independent implementation review — 3 October 2026

Reviewed source code, current report files, deployment recipes and saved desktop/Android screenshots. Opened the running sign-in screen. Re-ran typecheck, tests, DB policies, smoke, browser tests, build and the unfamiliar-layout fixture evaluation. No real model or hosted service was called; no phone installation was performed. Application source was not modified.

## Fresh checks

- Typecheck: passed.
- Tests: 95 passed across 12 files.
- DB policies: 12 passed.
- API smoke: 25 passed against running local services.
- Browser: 42 passed, 4 skipped. The skipped review-state/Source-Fields checks should seed their own required state rather than depend on queue availability.
- Build: client, API and worker built; main client chunk about 381 KB gzip.
- Unfamiliar-layout fixture evaluation: precision 0.875, recall 0.56, date exact 0.8571, reported identity-state accuracy 0.4167. Printed complete-field score 0.28 is not valid as a full-field metric because of the implementation defect below.

## Findings

### P1 — worker disables rendering and OCR for scanned PDFs

`packages/extraction/src/document-job.ts:290` calls the pipeline without onPageImage. `pipeline.ts:135` sets renderPages to Boolean(onPageImage), therefore false. `prepare.ts:401` skips OCR when there is no rendered page. Evaluation uses onPageImage and exercises a different preparation path.

Reproduction: `.local/independent-review.mts` runs the same eval-11_E3010.pdf through both options. Without callback: zero OCR pages and zero facts, with an explicit rendering-disabled note. With callback: OCR runs and returns facts. Fix image preparation independently of whether a viewer/storage callback exists; test through an uploaded scan and the real worker.

### P1 — live request omits evidence IDs

`packages/extraction/src/providers/openai-compatible.ts:217` sends page text and optional images, but never serializes page.evidence. The prompt requires worker-supplied evidence IDs that the model is not given. Current stubs return hardcoded IDs, hiding this missing interface. Include the page/evidence-ID/quote mapping and assert it appears in outgoing requests.

### P1 — live images are absent in worker and evaluation

The worker supplies no image callback. Evaluation (`scripts/evaluate-extraction.ts:300`) renders but returns null for every image reference. The live adapter only sends image_url when page.imageRef exists. Both paths therefore fail to supply document images to the multimodal model. Fix and verify the actual outgoing request before spending on accuracy evaluation.

### P1 — complete-field metric ignores dates

`scripts/evaluate-extraction.ts:353` computes dateOk, but line 359 counts only unitOk and line 386 copies that count into complete fields when identity state passes. Wrong dates therefore count as complete. In addition, unknown test aliases can match any reference fact with the same value (line 345), and identity scoring accepts any non-matched state for a non-matched expectation (line 379). Define exact fields and identity states explicitly, then test wrong-date, wrong-test and wrong-identity examples before regenerating reports. Current complete-field claims should not be used.

### P1 — live prompt file path is incompatible with bundled worker

The provider loads ../../prompts/extract-v1.txt relative to import.meta.url. In source this is packages/extraction/prompts; bundled into apps/worker/dist/worker.mjs it resolves to apps/prompts/extract-v1.txt, which does not exist. The build does not copy an asset to that location. Source-level live stub tests and fixture bundle smoke do not exercise this. Embed the prompt or package it at an explicit verified runtime path; instantiate a live provider from the built worker with a local stub.

## Remaining observations

The interface follows the intended restrained medical theme, but repeats coverage wording and gives filename/status metadata a large share of mobile review space. These are secondary to the functional findings.

SETUP.md still describes five approved documents and one awaiting review, and says live tests cover refusal only. The current implementation and tests differ. The checked-in decision to require human approval remains sound, and the observed local role/isolation tests pass. Green tests do not cover the missing live/scan paths identified here.

The reproduction lives under .local and is not shipped application code. Smoke/browser checks exercised synthetic data and changed the demo state; do not assume the initial clean queue remains.

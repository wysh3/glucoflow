# glucoflow

A result accountability ledger for Indian hospitals and clinics.

Every incoming lab report gets a named clinician, a clock and a receipt. The lab's own flag is the source of criticality. The ledger does not diagnose, score risk, triage or recommend treatment.

**Validation status:** the problem is a stronger hypothesis than the pre-visit delta, but demand and willingness to pay are **not yet validated**. No buyer interview, paid pilot or purchase order has been completed. The evidence, unknowns and kill criteria are in [the decision memo](../../docs/research/2026-11-04-decision/README.md).

## Start here

- Product home: https://glucoflow.vercel.app/
- One-click clinic demo: https://glucoflow.vercel.app/sign-in
- Clinic result ledger after sign-in: `/clinic/results`

The sign-in cards prefill a synthetic account and sign in automatically. The API enforces the role. No real patient data is used.

## What the product does

1. A report arrives from a lab on WhatsApp, as a PDF, as a paper slip or through a portal.
2. The report is matched to a patient. An ambiguous match is held for a human.
3. A named clinician is assigned and a clock starts. Critical lab flags get 15 minutes by default.
4. The clinician acknowledges the receipt.
5. The clinic records how the patient was told: call, WhatsApp, SMS, in person, letter or other.
6. The receipt is closed with a note.
7. Every step is appended to `sutra.result_events`. The register exports as CSV.

The dashboard measures open results, unowned results, overdue results, median time to acknowledgement, critical results still open and the share of acknowledged results where the patient was informed.

## What is real in this build

- A server-backed result ledger and receipt state machine.
- Named-owner assignment, due clocks, escalation, acknowledgement, patient communication and close.
- Append-only audit events. The API has no direct insert or update grant on the event table.
- A clinic-level inbox at `/clinic/results`, now the clinic landing page.
- Twelve synthetic receipts in the demo seed.
- A real CSV export of the register.
- A result ingestion endpoint. Rows can also be created through `sutra.create_result`.

## What is not real

- WhatsApp, paper, portal and lab-feed ingestion are not connected. The demo rows are seeded or created through the API.
- No live clinical interpretation. The lab flag is copied from the report.
- No ABDM integration, no ABHA claim, no automatic patient message.
- No buyer has used it. There is no measured demand, price or renewal.
- The pre-visit delta remains inside a patient record as a secondary module. It is not the lead product.

## Run the MVP

Prerequisites: Node 22, pnpm 12, PostgreSQL 16.

```bash
cd app
pnpm install
pnpm db:start
pnpm db:reset
pnpm db:migrate
pnpm seed:demo -- --clinic demo --confirm-demo
pnpm dev
```

Then open `http://127.0.0.1:5173/sign-in`, choose **Clinic team**, and the result ledger opens. `pnpm seed:demo` loads the twelve synthetic receipts from `supabase/seed/results-demo.sql`.

Do not point `db:reset` or `db:migrate` at production.

## Migrations and API

- `app/supabase/migrations/021_result_ledger.sql`: tables, RLS, state-machine functions and grants.
- `app/supabase/migrations/022_result_event_guard.sql`: revokes direct execution of the internal event writer.
- `app/supabase/migrations/024_result_read_back.sql` and `025_result_critical_read_back.sql`: critical-result read-back fields and enforcement.
- `app/supabase/migrations/026_result_receipt_proof.sql` to `030_result_event_delete_guard.sql`: receipt codes, hash-chained events, public verification and the append-only guard.
- `app/apps/client/src/features/verify/page.tsx`: the public receipt verifier.
- `app/apps/api/src/routes/results.ts`: list, stats, export, detail, match, assign, acknowledge, patient-informed, escalate and close.
- `app/apps/client/src/features/clinic/results/page.tsx`: the inbox and receipt drawer.
- `app/packages/data/src/results.ts`: reads and command wrappers.
- `app/packages/contracts/src/results.ts`: DTOs, labels and input schemas.

API revision: `glucoflow-service--0000011`, image `20261104-moat`.

## Regulatory position

- The clinic is the data fiduciary; the product is its processor.
- The design target is the DPDP Act 2023 and the DPDP Rules 2025, not HIPAA.
- NABL and NABH already require a critical-alert register with identifiers, time, person informed, read-back and signature. The export is shaped for that record.
- The product stays administrative. It does not derive criticality. The lab flag is the source.
- A legal review of the consent text, processor contract and device boundary is still required before a pilot contract.
- ABDM is out of scope until an integration is actually onboarded.

## Verification

Run in `app/`:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test tests/e2e/results.spec.ts --project=desktop-chromium
pnpm exec playwright test tests/e2e/landing.spec.ts --project=desktop-chromium
```

Measured on 4 November 2026:

- Typecheck passed.
- Unit tests: 184 of 184.
- Production client build passed.
- Result-ledger and landing browser tests: 12 of 12 passed across desktop and mobile.
- New result-ledger tests cover the verified chain and the public verifier.
- Full pivot browser suite: 79 of 82 passed in one parallel run. The three failures were the live-guide wording check (desktop and mobile) and one upload-completion wait. All three passed when rerun alone on the same build. The live guide is a model response and this check is not deterministic under parallel load; it is not counted as a green gate.
- Lintapple: 0 findings on the landing, sign-in and result ledger at 1440 and 390 widths, including the receipt drawer.
- Hosted result ledger: critical alert, stats, list, receipt drawer and CSV export worked with no console errors.
- The hosted API exposes the result routes and public receipt verifier on revision `0000011`.
- The critical read-back is enforced on the server. A critical result cannot be marked patient-informed without it.
- The public verifier returned `Receipt chain intact` for a seeded receipt with no patient data.
- The live demo recording is 47 seconds, 1920 by 1080, with captions and no clinical interpretation.
- The receipt proof is SHA-256 hash-chained. The public code returns only the event count, chain head and validity.
- The current brief is exactly two A4 pages and the current deck is exactly eight slides.

## The validation still owed

The hardest business assumptions are not tested:

1. A quality head, medical superintendent or lab manager will pay to close the result loop.
2. At least 30% of abnormal results lack a documented acknowledgement or patient communication at the target sites.
3. A two-week concierge receipt changes behaviour without the founder.
4. A named clinician accepts the clock and the escalation.
5. A site signs a paid continuation after the pilot.

The test design and kill criteria are in [the decision memo](../../docs/research/2026-11-04-decision/README.md). Do not claim validation before those tests produce a decision.

## Deliverables and status

| File | Status |
|---|---|
| [brag/glucoflow-brag.mp4](brag/glucoflow-brag.mp4) | Current. 20-second result-ledger launch cut, including the public verifier. |
| [Result_Ledger_Demo.mp4](Result_Ledger_Demo.mp4) | 47-second captioned screen demo of the live receipt and proof. |
| [Result_Ledger_Brief.pdf](Result_Ledger_Brief.pdf) | Current. Two A4 pages, result-ledger thesis. |
| [Result_Ledger_Brief.docx](Result_Ledger_Brief.docx) | Editable source for the brief. |
| [Result_Ledger_Deck.pdf](Result_Ledger_Deck.pdf) | Current. Eight 16:9 slides. |
| [Result_Ledger_Deck.pptx](Result_Ledger_Deck.pptx) | Editable source for the deck. |
| [Result_Ledger_Submission_Answers.md](Result_Ledger_Submission_Answers.md) | Current written submission answers. |
| [Result_Ledger_Demo_Script.md](Result_Ledger_Demo_Script.md) | Three-minute live demo script. |
| [Result_Ledger_Judge_QA.md](Result_Ledger_Judge_QA.md) | Judge Q&A and competitor replies. |
| [Result_Ledger_Submission_Checklist.md](Result_Ledger_Submission_Checklist.md) | Deadline and demo checklist. |
| [screens/](screens) | Product screens. Replace the pre-pivot shots with the result-ledger captures before submission. |
| [Delta_Solution_Brief.pdf](Delta_Solution_Brief.pdf) | Historical pre-pivot brief. Do not submit as the result thesis. |
| [Delta_Final_Presentation.pdf](Delta_Final_Presentation.pdf) | Historical pre-pivot deck. Do not submit as the result thesis. |
| [Delta_Product_Cut.mp4](Delta_Product_Cut.mp4) | Historical pre-pivot product cut. Do not submit as the result thesis. |
| [Delta_Demo_Video_Script.md](Delta_Demo_Video_Script.md) | Historical pre-pivot script. |

The current two-page brief and eight-slide deck have not been rebuilt around the result ledger yet. That is deliberate: the product has a tested workflow, not tested demand. A deck that sells an unvalidated buyer is the next thing to avoid.

# Result ledger submission answers

## 1. The exact problem

A hospital receives lab reports from several labs and channels. The lab finishes when it delivers. The hospital is supposed to prove a named clinician saw the result, that a clock existed, that a critical result was read back and that the patient was told. In most hospitals that proof is a paper diary, a WhatsApp gallery or nothing.

The failure is invisible until an audit, a complaint or a missed critical value exposes it.

## 2. What changes if it is solved

Every result has one administrative receipt with a named owner, a due clock, an acknowledgement, a patient communication record, a read-back for critical results and an append-only audit chain. A quality head can export the register and verify the chain. A lab can prove delivery. A patient can verify that a receipt exists without exposing clinical data.

The measurable change is median time to acknowledgement, the share of abnormal results with a completed receipt and the share of critical results with a documented read-back.

## 3. What we are building

A result accountability ledger for hospitals and clinics.

- Ingest a report from WhatsApp, PDF, paper or a portal. The lab flag is copied, never calculated.
- Match the patient. Ambiguity stops for a human.
- Assign a named clinician and a due clock. Critical reports get 15 minutes by default.
- Acknowledge, record patient communication, capture the read-back and close.
- Hash-chain every event. Publish a receipt code that verifies the chain without patient data.
- Export a survey pack and a CSV register for the accreditation file.

The current build includes the clinic result ledger, receipt drawer, proof panel, public verifier, CSV register and a synthetic inbound button. It is live at https://glucoflow.vercel.app.

## 4. Why this team

The build has a working clinical record pipeline, a doctor-facing review workflow, a server-enforced audit layer and a hosted deployment. The team roles are clinical lead, engineering lead and design product. The clinical lead owns the pilot sites and sign-off. The engineering lead owns the receipt chain, API and instrumentation. Design and product owns the receipt and the survey pack.

No team names are printed here. Add the real names before submission.

## 5. Whether any part already exists

The existing product already extracts lab reports, binds evidence, holds human review and publishes approved facts. The result ledger reuses the same identity, authorization, source and audit foundations. The new part is the receipt state machine, the hash chain, the public verifier and the accreditation pack.

## 6. Evidence and validation status

The problem evidence is secondary, not a customer study:

- 64.61% of 1,187 critical values in an Indian tertiary hospital were notified 30 to 120 minutes after the sample arrived (PMC4310845).
- 6.8% to 62% of abnormal ambulatory results were not followed up in a systematic review (J Gen Intern Med 2012).
- NABL 112A and NABH already require a critical-alert register with read-back.

No buyer interview, paid pilot or purchase order has been completed. The next gate is 10 buyer interviews and 3 de-identified audits of 100 reports. The kill criteria are in the brief and the decision memo. Do not claim validated demand.

## 7. The demo

1. Open https://glucoflow.vercel.app/sign-in and choose Clinic team.
2. The result ledger opens with a critical alert, ten open results, three unowned and a median acknowledgement time.
3. Press Receive sample. A critical potassium receipt arrives on WhatsApp.
4. Assign it, acknowledge it, tick the read-back and record the patient conversation.
5. Open Receipt proof. The chain is verified and all four controls are met.
6. Open the receipt code in the public verifier. It returns the event count and chain head with no patient data.
7. Export the CSV register and the survey pack.

## 8. Ask

Three sites. 100 consecutive reports each. Eight weeks. A baseline audit, then a concierge receipt, then a paid continuation. One signed continuation is the proof that the buyer exists.

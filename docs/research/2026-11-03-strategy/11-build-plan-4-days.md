# Four-day build plan: the demo slice

> **First-pass build plan for the follow-up thesis.** The revised result-loop slice is in [13-revised-recommendation-result-loop.md](13-revised-recommendation-result-loop.md). The reuse rules and the cut list carry over.

The final submission is due 7 November 23:59 IST. The goal is a running vertical slice that proves the new job, not a new product. Reuse the existing app; add one module.

## What to build

A `followup` module with five screens and one ledger:

1. **Reachability audit.** Import a synthetic cohort of 120 patients (CSV or a photo/CSV pair). Show due, reachable, unreachable, and why.
2. **Loop board.** Columns: Due, Contacted, Replied, Booked, Attended, Unreached, Closed. Every patient in exactly one column; no move to Closed without a disposition.
3. **Patient conversation.** A simulated WhatsApp thread in Roman Hindi and English, with a consent receipt, three questions, a barrier selection, and a booking confirmation. Label it "simulated" in the UI.
4. **Morning brief.** Five numbers, three escalations, the barrier map, the unreached list.
5. **Field worklist.** A short ASHA/clerk list: name, phone, language, barrier, best time, one action, a "visited/booked/refused" disposition.

## Data model (new tables or a JSONB ledger)

Keep it small and auditable.

| Table | Fields |
|---|---|
| `followup_patient` | id, clinic_id, display_name, phone, alt_phone, address, language, condition, last_visit, due_date, source_document_id, consent_id |
| `followup_consent` | id, patient_id, version, language, channel, accepted_at, withdrawn_at, notice_hash |
| `followup_attempt` | id, patient_id, channel, direction, template_id, sent_at, delivered_at, replied_at, outcome, actor |
| `followup_reply` | id, attempt_id, raw_text, language, barrier_code, red_flag, created_at |
| `followup_disposition` | id, patient_id, state, reason_code, owner_id, resolution_type, resolution_ref, closed_at, actor |
| `followup_task` | id, patient_id, assignee, kind (call/visit/lab/teleconsult), due_at, status, notes |
| `followup_audit` | id, patient_id, event, actor, at, payload_hash |

The existing auth, RLS, audit and export patterns can carry this. The clinic is the tenant; the patient is a contact record, not a clinical record.

## Screens and routes

| Route | What it shows | Reuse |
|---|---|---|
| `/clinic/followup/import` | CSV/photo import, column mapping, dedupe, reachability audit | Upload, OCR, validation |
| `/clinic/followup/board` | Loop board with lanes and dispositions | Clinic shell, design system |
| `/clinic/followup/brief` | Morning brief | Existing cards, charts |
| `/clinic/followup/field` | ASHA/clerk worklist | Mobile layout |
| `/patient/followup` | Simulated WhatsApp thread + consent receipt | Patient shell |
| `/clinic/followup/ledger/:id` | Patient ledger: attempts, reply, barrier, disposition, audit | Source viewer pattern |

## Synthetic cohort

Generate 120 patients with a realistic distribution:

- 46 with a contact problem: 22 missing a phone, 14 invalid, 10 duplicate or family records.
- The audit repairs 34; 12 remain unreachable.
- 108 reachable; 96 contacted; 12 do not answer after three attempts.
- 24 unreached in total, each with a named owner; 0 without a disposition.
- 74 booked; 68 attended; 6 no-show.
- 18 distance, 9 cost, 6 no attender, 4 no symptoms, 3 other barriers.
- 10 teleconsult, 8 ASHA visits, 7 closed with a reason.

Store the cohort as a JSON fixture and a CSV. Label every screen "Synthetic demo".

## Day-by-day

### Day 1 (4 November): data and audit

- Migration for the follow-up tables.
- CSV import and the synthetic cohort.
- Reachability rules: phone validation, duplicate detection, missing fields.
- The audit screen with the 120-patient summary.
- Unit tests for the reachability and dedupe logic.

### Day 2 (5 November): board and dispositions

- The loop board with lanes and state transitions.
- The disposition form and the "cannot close without a reason" rule.
- The morning brief with the five numbers and the three escalations.
- API tests and one browser flow.

### Day 3 (6 November): conversation and field

- The simulated WhatsApp thread with the consent receipt, three questions, barrier selection and booking.
- The barrier taxonomy and the red-flag administrative escalation.
- The field worklist with the ASHA dispositions.
- The ledger detail with the audit trail.
- The export (CSV/PDF) with the "no patient without a disposition" line.

### Day 4 (7 November): 3D, demo, deck

- The 3D loop (React Three Fiber or CSS 3D) with a 2D fallback.
- The 3-minute demo script and a timed rehearsal.
- The seven-slide deck.
- The five-viewer comprehension test.
- Submit.

## What to cut

- Real WhatsApp Business API or telephony. Use a clearly labelled simulation; integrate a sandbox only if it works in one hour.
- Real OCR on arbitrary Indian paper. Use a synthetic register photo and a CSV; the OCR path is an existing capability, not the demo.
- More than two languages. Hindi/Roman Hindi and English are enough for the demo; the architecture is language-pack based.
- A native ASHA app. Use the mobile web worklist.
- Multi-clinic administration. One demo clinic + one government facility is enough.
- A real 3D engine if it risks the demo. A CSS/SVG 3D-style loop with a few animated nodes is enough; the story matters more than the polygons.

## Verification

- `pnpm typecheck`
- `pnpm test` (new unit tests for reachability, dedupe, barrier, disposition)
- `pnpm build`
- A Playwright flow: import → audit → board → conversation → disposition → brief → export.
- A timing check: the demo runs in under 3 minutes on the demo laptop.
- A data check: the ledger has 120 rows, 0 without a disposition, 24 unreached with an owner.
- A claim check: no clinical advice, no risk score, no "HIPAA", no "ABDM integrated", no measured outcome claim.

## The demo's proof line

> **120 due · 96 contacted · 74 booked · 24 unreached with a named owner · 0 without a disposition.**

That line is the product. Everything else is setup.

## What to say about the AI

The AI reads the register, normalises the contact fields, runs the multilingual conversation, classifies the barrier and routes it. It does not decide who is clinically urgent, does not interpret a symptom, and does not write a clinical recommendation. Every escalation is a human task. That is the boundary that keeps the product an administrative workflow, not a medical device.

## The one thing not to do

Do not rebuild the records app. It is the proof layer, not the demo. The new module is a thin slice on top of the existing auth, upload, audit and design system.

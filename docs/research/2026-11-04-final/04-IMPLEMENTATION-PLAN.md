# Implementation plan: Closure v2

**Scope.** This is the plan to turn the existing result ledger into the product the panel would score 95+: role-separated closure, one-tap doctor confirmation, print-first operation, a lab channel, and a measured replay. It is written against the actual repository, not a greenfield.

**Constraint.** No feature work starts before the baseline audit in `06-VALIDATION-PROTOCOL.md` is under way. The plan below is sequenced so that the audit and the build run in parallel.

---

## 0. The one-paragraph diagnosis

The current build proves the right idea with the wrong interaction model. Every receipt action is gated on `canClinical`, so the doctor is the clerk: 14–16 fields and 4 clicks per critical result, about 2.5–3.5 minutes, 25–35 minutes a day at ten abnormal reports. A doctor with a 6.5-hour OPD will not do that, and on the days she does not, someone shares her login and the audit trail becomes fiction. The product must separate **custody**, **clinical review** and **patient communication**, give the doctor a one-tap surface, suspend the clock on handover, and print the register. That single change is worth more than every other feature in this document.

---

## 1. Product definition

### 1.1 The unit

An **obligation**: a clinical intention that must be closed by a named human before a deadline, with a proof.

Three obligation types ship in this plan:

| Type | Trigger | Deadline (critical) | Deadline (abnormal) | Closer |
|---|---|---|---|---|
| `result` | A report with an abnormal or critical lab flag | 1 hour clinician review, 1 hour patient communication | 24 hours review, 72 hours communication | Clinician + nurse |
| `recheck` | A clinician sets a recheck date at the visit | — | Due date + 7 days | Desk |
| `referral` | A clinician writes a referral | — | 30 days | Desk / nurse |

Only `result` is built to demo quality in the next three weeks. `recheck` and `referral` share the same state machine and are the expansion.

### 1.2 The four roles

| Role | Owns | Interaction budget |
|---|---|---|
| Desk / clerk | Intake, identity hold resolution, assignment, recheck calls | ≤ 30 seconds per report |
| Nurse | Patient communication, read-back, escalation calls, after-hours acknowledgement | ≤ 3 taps per call |
| Doctor | Clinical review only | ≤ 2 taps / 15 s per abnormal; ≤ 3 taps / 30 s per critical |
| Quality head | Register, overdue review, export, survey pack | Weekly, not daily |

### 1.3 The three clocks

```
received ──custody_due──▶ accepted ──review_due──▶ seen ──communication_due──▶ informed ──▶ closed
   │                         │                        │
   └── escalate to desk      └── escalate to nurse    └── escalate to nurse
       on breach                 on breach                on breach
```

- **Custody clock:** 15 minutes for critical, 4 hours for abnormal. Owner: desk.
- **Review clock:** 60 minutes for critical, 24 hours for abnormal. Owner: the clinician who accepted custody. **Paused** outside that clinician's declared availability and while custody is unaccepted. (v1 used a single 15-minute clock for the whole critical path; that is unrealistic for a doctor in theatre, and it is why the demo line now reads "22 min to breach" rather than "38 min". The 15 minutes now applies to custody, where the desk can meet it.)
- **Communication clock:** 1 hour for critical, 24 hours for abnormal. Owner: nurse.
- **Escalation:** one level per breach. Desk → nurse → doctor → quality head. After two breaches, the obligation appears in the quality head's morning list and in the register's exception column.

### 1.4 The artefacts

1. **The doctor's line.** One line per obligation, before patient one:
   `K 6.2 · flagged 08:47 · 22 min to breach · Sunita Sharma, 58 · [Seen]`
2. **The nurse's call sheet.** Name, phone, language, script, value (only if the clinic permits), read-back field, outcome buttons.
3. **The printed register.** A4, one row per obligation, all NABH fields, printable when the network is down.
4. **The receipt.** A QR and a short code; public verification without PHI.
5. **The lab code.** A QR printed on the lab's own report that creates the obligation on scan.

### 1.5 The refusals

- No diagnosis, no treatment recommendation, no risk score, no triage.
- The lab flag is copied, never computed.
- No automatic patient message without a human action.
- No ABDM/ABHA claim.
- No inference of a missed test from absence of data.

---

## 2. What to keep

The existing build is the foundation. Do not rewrite it.

| Asset | File | Keep |
|---|---|---|
| Result state machine and RLS | `app/supabase/migrations/021_result_ledger.sql` | Yes, extend |
| Event guard | `022_result_event_guard.sql` | Yes |
| Critical read-back enforcement | `024_result_read_back.sql`, `025_result_critical_read_back.sql` | Yes |
| Hash-chained proof and public verifier | `026_result_receipt_proof.sql` … `030_result_event_delete_guard.sql` | Yes |
| Result API | `app/apps/api/src/routes/results.ts` | Yes, add endpoints |
| Data layer | `app/packages/data/src/results.ts` | Yes |
| Contracts | `app/packages/contracts/src/results.ts` | Yes |
| Receipt drawer | `app/apps/client/src/features/clinic/results/page.tsx` | Rework the interaction, keep the data |
| Certificate, patient slip, QR | `certificate.tsx`, `patient-slip.tsx`, `qr.tsx` | Yes |
| Public verifier | `app/apps/client/src/features/verify/page.tsx` | Yes |
| CSV register export | `results.ts` export route | Yes, add print view |
| Tests | `app/tests/e2e/results.spec.ts`, `app/tests/integration` | Yes, extend |

**The proof layer is the moat's technical half. Do not touch the chain semantics.**

---

## 3. What to change

### 3.0 Fix the seven defects the technical judge found (blocking, before any new feature)

These are not enhancements. They are correctness bugs in the current build, found by reading `021`–`033` and running `tests/integration/result-closure.test.ts`. Each one can lose the finale in a single judge question.

| # | Defect | Evidence | Fix | Test |
|---|---|---|---|---|
| D1 | **A mis-extracted `lab_flag` can never be acknowledged.** `032` makes the flag immutable, and `031`'s `acknowledge_result` requires the clinician to echo the stored flag. A lab critical stored as `abnormal` is therefore unacknowledgeable and escalates every 10 minutes forever | `031_result_closure.sql` (acknowledge), `032_result_integrity.sql` (immutability) | Keep the lab's flag immutable as *evidence*, and add a `flag_disputed` decision with a reason, a corrected value and an auditor event. The register shows both: `lab: critical · clinician: disputed (reason)` | A result with a disputed flag can close; both flags appear in the register; the original is unchanged |
| D2 | **The obligation stops at "patient contacted".** `next_step_due_at` is never escalated and `close_result` does not require the next step | `031:569–630` | Escalate `next_step_due_at`; `close_result` requires either completion or an explicit disposition (`declined`, `moved`, `under another doctor`) | A result with an open next step cannot close; the next step appears in the nurse worklist |
| D3 | **The clock is authored by the client.** `lab_released_at`, `report_received_at` and `attempted_at` are caller-supplied with no skew bound, then frozen. A clinic can improve its own median contact time by editing one field | `contracts/results.ts:338–339`, `:310` | Store `claimed_*` (client) and `server_*` (server `clock_timestamp()`) separately; compute every KPI on the server value; reject a client time outside ±15 minutes | A forged early `report_received_at` does not change the KPI; the skew is recorded |
| D4 | **The demo seed fabricates its audit trail.** `seed/results-demo.sql:173–231` inserts `result_events` directly with backdated timestamps, bypassing every procedure | `supabase/seed/results-demo.sql` | Keep the bulk seed for the list, but create the three staged finale receipts through the real procedures, so their chains are produced by the workflow | The staged receipts' events match the procedure output; a judge can compare |
| D5 | **The chain's anchor is inside its own trust domain.** The DB owner or service role can rewrite events and `chain_head` and recompute a valid chain; `030` removed the delete guard; tombstones have no delete guard | `030`, `032` | Restore the delete guard; add a daily signed digest to the quality head (or an RFC 3161 anchor); state the threat model on the certificate | Tamper, tail-truncation and tombstone-deletion tests |
| D6 | **The export and the list do not scale.** `resultExport` selects the whole clinic with five joins, no date range, no pagination; the list caps at 100 with no cursor; `percentile_cont` runs on every dashboard load; the escalation timer runs globally every 60 seconds on every replica | `results.ts` export/stats/list, `server.ts:112–124` | Date-range export with streaming; cursor pagination; a covering index for the stats; a batched escalation with `skip locked` and a per-run cap; a single elected timer | Export of 10,000 rows completes under 5 s; the next page returns with a cursor; the timer runs once per cluster |
| D7 | **No `Idempotency-Key` on result creation**, and every route pins the caller to `clinicIds[0]` | `routes/results.ts:43` | Reuse `withIdempotency`; add an explicit clinic selector that validates membership | A retry does not duplicate; a two-clinic user can switch |

D1 and D2 are the two that a technical judge will find in four minutes. Fix them first.

### 3.0b The honesty defect the red team found: an unreachable patient must never look "closed"

The current demo closes a receipt while the patient was never told. On stage that turns the headline claim ("nothing closes without a recorded patient communication") into a contradiction. The fix is a state, not a footnote:

| State | Meaning | What the receipt says | Where it appears |
|---|---|---|---|
| `informed` | A named person told the patient, with a read-back for criticals | "Patient informed at 09:31 by Nurse A" | Closed register |
| `closed_unreachable` | Two documented attempts on different days, no contact | "Not informed. Two attempts documented. Owner: Nurse A. Escalated to quality head." | **Exception register, not the closed register** |
| `declined` | The patient refused | "Patient declined on 12 Nov; documented" | Exception register |
| `moved` | The patient is under another provider | "Care transferred to X; documented" | Exception register |

Rules:

- `close_result` with `informed = false` requires at least two attempts on different calendar days, a reason, and a named owner. It writes `closed_unreachable`, not `closed`.
- The dashboard's "informed share" counts only `informed`; the exception count is a separate number, and it is shown, not hidden.
- The printed register has an exception section with the same fields.
- The public verifier returns `informed` or `not informed`, never a bare "valid".

This is better than the current design on three counts: the claim becomes true, the quality head sees the patients the clinic could not reach (which is the actual quality problem), and the demo gains a refusal rather than losing one.

### 3.1 Schema: migration `034_closure_roles.sql`

Add to `sutra.results`:

```sql
alter table sutra.results
  add column if not exists obligation_type text not null default 'result'
    check (obligation_type in ('result', 'recheck', 'referral')),
  add column if not exists custody_state text not null default 'received'
    check (custody_state in ('received', 'accepted', 'assigned')),
  add column if not exists review_state text not null default 'pending'
    check (review_state in ('pending', 'seen', 'confirmed')),
  add column if not exists communication_state text not null default 'pending'
    check (communication_state in ('pending', 'in_progress', 'informed', 'declined', 'unreachable')),
  add column if not exists custody_actor_id uuid references sutra.app_users (id),
  add column if not exists review_actor_id uuid references sutra.app_users (id),
  add column if not exists communication_actor_id uuid references sutra.app_users (id),
  add column if not exists custody_due_at timestamptz,
  add column if not exists review_due_at timestamptz,
  add column if not exists communication_due_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_seconds integer not null default 0,
  add column if not exists pause_reason text,
  add column if not exists source_span jsonb,
  add column if not exists match_confidence numeric(5,4),
  add column if not exists household_id uuid,
  add column if not exists lab_id uuid,
  add column if not exists lab_receipt_code text,
  add column if not exists print_batch_id uuid;
```

Add tables:

- `sutra.households (id, clinic_id, label, created_at)`
- `sutra.household_members (household_id, patient_id, confidence, source)`
- `sutra.identity_reviews (id, result_id, candidates jsonb, posterior numeric, decision text, decided_by, decided_at)`
- `sutra.escalation_attempts (id, result_id, channel, actor_id, actor_role, attempted_at, outcome, hazard_features jsonb)`
- `sutra.print_batches (id, clinic_id, kind, created_by, created_at, row_count, hash)`

Add indexes: `(clinic_id, review_state, review_due_at)`, `(clinic_id, communication_state, communication_due_at)`, `(clinic_id, obligation_type, status)`.

**Migration rules.** Additive only. No destructive change. A backfill sets `custody_state = 'accepted'` and `review_state` from `status` for existing rows so the demo seed remains valid.

### 3.2 State machine: `sutra.closure_transition`

Replace the single linear transition with three guarded sub-transitions:

```
accept_custody(result, actor)      -- received → accepted; sets review clock
see(result, actor, value_confirmed, corrected_value?)
                                    -- pending → seen; stops review clock; one tap
confirm(result, actor)             -- seen → confirmed (optional second step)
communicate(result, actor, channel, recipient, readback, teachback, next_step)
                                    -- pending → informed; stops communication clock
pause(result, actor, reason)       -- suspends the active clock
resume(result, actor)
escalate(result, level, reason)
close(result, actor, disposition)
```

Each transition writes an event with `actor_role`, `source_span_hash` and `prev_hash`. The existing `result_events` table gains `actor_role` and `source_span_hash` columns.

**Clock arithmetic.** `due_at` is computed at transition time. On pause, store `paused_at`; on resume, add `now() - paused_at` to all open due dates and to `paused_seconds`. This is a pure function and must be unit-tested for idempotency.

### 3.3 API surface

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/results/:id/accept-custody` | desk, nurse | Accept the obligation; start the review clock |
| POST | `/results/:id/see` | clinician | One-tap clinical review; body `{value_confirmed, corrected_value?}` |
| POST | `/results/:id/confirm` | clinician | Optional second confirmation with a note |
| POST | `/results/:id/communicate` | nurse | Record the patient communication and read-back |
| POST | `/results/:id/pause` | any owner | Pause with a reason |
| POST | `/results/:id/resume` | any owner | Resume |
| GET | `/results/worklist/:role` | role | The role's list, ordered by the scheduler |
| GET | `/results/:id/timeline` | clinic | Full event timeline with actors |
| GET | `/results/print-register` | clinic | A4 print payload |
| POST | `/results/:id/span` | clinic | Verify a source span |
| POST | `/identity/:id/decision` | desk | Match or reject a candidate |
| GET | `/scheduler/next` | clinic | Next N obligations for a capacity |
| POST | `/ingest/lab/:token` | public | Lab QR intake |

All routes keep the existing auth, idempotency and RLS patterns. `canClinical` gates only the clinical acts (`see`, `confirm`); custody and communication are gated by role, not by clinician status.

### 3.4 UI

**A. Doctor — "Before patient one" (`/clinic/results?view=line`)**

One card per obligation, maximum five. Each card:

```
K 6.2   ⚠ critical   flagged 08:47   22 min left
Sunita Sharma, 58   Dr Mehta's patient
[ Seen ]   [ Correct value ]   [ Ask nurse to call ]
```

No drawer. No fields. The tap writes `see`. If the value is wrong, `Correct value` opens a two-field sheet.

**B. Nurse — call sheet (`/clinic/results?view=calls`)**

A table: patient, phone, language, value (clinic-configurable), script, read-back input, outcome buttons (`Informed`, `No answer`, `Wrong number`, `Declined`, `Will come`), next step. One tap per outcome; the read-back is a single input for criticals.

**C. Desk — intake (`/clinic/results?view=intake`)**

Camera, file, WhatsApp forward. After upload: candidate matches with posterior; `Match`, `Not this patient`, `New patient`. A hold is a first-class state, not an error.

**D. Quality head — register (`/clinic/results?view=register`)**

Filters (date, flag, role, state), exception column, export CSV, print A4, and a "survey pack" that bundles the last three months.

**E. Public verifier (`/verify/:code`)**

Unchanged. Returns validity, roles, and times only.

**F. Replay (`/clinic/results?view=replay`)**

The demo screen: baseline vs intervention, one chart, three numbers.

### 3.5 Print

A server-rendered A4 register with:

```
Closure Register · <Clinic> · <Month>
| Sl | Patient | Test | Value | Flag | Received | Clinician seen | Informed by | Time | Read-back | Status |
```

Server-side PDF (the worker already has a job runner; add a `register_pdf` job). Print CSS for browser printing. The print route must work when the API is reachable and the client is not.

### 3.6 Ingestion

Three channels, in order of value:

1. **WhatsApp Business API webhook.** Meta Cloud API, `messages` webhook, media download, OCR. Utility template ₹0.115–0.13 per message. Consent is captured by the clinic before the first message (DPDP).
2. **Photo/PDF upload.** Already exists; add the span extractor.
3. **Lab QR.** A lab prints `https://app/ingest/lab/<token>?report=<id>` on its report. On scan, the clinic creates an obligation with the lab's flag and the lab gets a delivery event. This is the network primitive and the lab-channel demo.

### 3.7 On-premise option

A single `docker compose` with Postgres, API, worker, client and a local object store. No external call required except the optional WhatsApp gateway. Target: a district hospital with one box and no internet. This is not a hackathon deliverable; it is a 90-day deliverable that the government judge named as the difference between a deal and a dead file.

---

## 4. The technical modules

Four new packages, each with a narrow interface and its own evaluation.

### 4.1 `packages/closure-extract` — obligation extraction with source binding

**Input:** a document (PDF/image) and a clinic.
**Output:** a list of `ObligationDraft` with `{test, value, unit, ref_range, lab_flag, collected_at, reported_at, patient_name_raw, patient_identifier_raw, source_span}`.

Pipeline:

1. Layout-aware OCR with bounding boxes.
2. Table row/column segmentation.
3. Schema-constrained extraction (LLM) with a span requirement.
4. **Independent verifier:** re-read the numeric span, normalize units via UCUM, check that the value parses and that the flag is consistent with the reference range.
5. **Risk-controlled acceptance:** choose a threshold τ per obligation class so that the empirical false-extraction rate on a calibration set is ≤ α (default α = 0.01), using a Learn-then-Test fixed-sequence procedure over classes. Anything below τ goes to the desk with the source span highlighted.
6. **Abstention reason:** every rejection carries a reason (`low_ocr`, `unit_ambiguous`, `flag_mismatch`, `span_missing`, `identity_hold`).

**Evaluation:** 100 real de-identified reports from the partner site, plus the existing synthetic corpus. Metrics: field precision/recall, complete-field rate, abstention rate at α, time-to-complete for the desk. Report the honest number (the current unfamiliar-layout complete-field rate is 0.24).

### 4.2 `packages/closure-identity` — household-aware matching

**Model:** Fellegi–Sunter with an Indic phonetic key.

- Name: normalize to a phonetic key (collapse aspirates, s/sh, v/w, drop vowels), then Jaro–Winkler.
- Year of birth, sex, address tokens, lab patient ID.
- Phone: **household-discounted**. Estimate `k(p)` = distinct persons per phone from the clinic graph with shrinkage; replace the phone likelihood ratio with the mixture
  `L(agree) = (1/k)·m + (1 − 1/k)·u`.
- Posterior via log-odds sum; calibrate with Platt scaling on a held-out set.
- **Abstention region** derived from the cost of a wrong closure: accept if `P ≥ 1 − α_auto`; reject if `P ≤ α_reject`; else review. Set `α_auto` so that the expected number of wrong closures per 10,000 is below 1.
- **Review queue** ordered by expected information gain: which field, if verified, most reduces the posterior entropy.

**Evaluation:** a synthetic namesake set (same name, different person, shared phone), plus 200 real de-identified registrations. Metrics: precision at the auto-accept threshold, review rate, wrong-closure count (target zero), time per review.

### 4.3 `packages/closure-schedule` — capacity-constrained escalation

**Model.** Each obligation is a restless arm with state `(attempts a, slots remaining T)`. Hazards `h(a)` are estimated per `(obligation class, channel, hour bucket)` with a hierarchical Beta-Binomial (partial pooling), so a new clinic inherits a prior.

**Index.** For the two-state case (`p` constant, `T` slots), the Whittle index has the closed form
`λ(T) = p·(1 − V(T−1))`, `V(0) = 0`,
which is decreasing in `T` (higher urgency nearer the deadline). For the multi-attempt case, compute the index by dynamic programming over `(a, T)`.

**Allocation.** Each epoch (15 minutes), give the top-`C` indices to the nurse, where `C` is the available capacity. Re-plan on any resolution. Guarantee: if all hazards are equal, the policy reduces to earliest-deadline-first, which is optimal for deterministic deadlines.

**Evaluation.** A simulator with 500 obligations/day, heterogeneous hazards, 3 nurses; compare FIFO, EDF, criticality-first and the index policy on weighted on-time closure. Report the lift and the sensitivity to hazard misspecification. Ship v1 as EDF + criticality preemption; enable the index policy behind a flag.

### 4.4 `packages/closure-proof` — receipts

Keep the existing SHA-256 chain. Add:

- `capability receipt`: an Ed25519-signed projection `{obligation_id, roles, times, chain_head}` with no clinical value.
- `TSA anchor`: an RFC 3161 timestamp of the daily chain head (stub in the demo; real in production).
- `offline QR`: the signed projection, verifiable without a network call.

**Threat model, stated in the pitch:** protects against silent edits and deletes by an insider or the vendor; does not protect against a compromised signing key, collusion at creation, or an event that was never recorded.

---

## 5. The measured replay (the winning evidence)

This is the most important deliverable after the one-tap interaction. RAD-SMART won its track by replaying 55 recorded department days and reporting a measured delta. The equivalent here is a replay of consecutive reports.

### 5.1 Data

Preferred: 300 consecutive reports from the partner clinic, de-identified (name replaced by a token, phone hashed, dates shifted by a constant). Acceptable: 300 reports from two clinics. Fallback: a calibrated synthetic corpus, labelled synthetic in every slide.

### 5.2 Baseline

For each report: received time, acknowledgement time (or none), communication time (or none), outpatient flag, flag severity, identity ambiguity. Compute:

- % without a documented clinician acknowledgement within SLA.
- Median handoff lag.
- Outpatient vs inpatient gap.
- Identity-hold rate.
- % of criticals with a read-back.

### 5.3 Intervention simulation

Replay the same 300 reports through the Closure v2 state machine with the observed staff capacity. Compute:

- Closure rate within SLA.
- Median handoff lag.
- Nurse attempts per closure.
- Doctor seconds per obligation (from the interaction budget: 2 taps, 15 s).
- Escalations per day.

### 5.4 What goes on stage

One slide, three numbers:

```
300 consecutive reports, one clinic, September–October 2026
Baseline:   34% without a documented acknowledgement · median lag 9h 20m · 63% of outpatient criticals unacknowledged
With Closure: 91% closed within SLA · median lag 22 min · 0 unowned criticals at 08:00
```

If the numbers are worse, show the worse numbers. A judge discounts a perfect number and remembers an honest one.

---

## 6. The three-week build to the finale

Assumes the final submission is 7–8 November and the finale is 28 November.

### Week 1 (5–11 Nov): the interaction fix

| Day | Work | Definition of done |
|---|---|---|
| 1 | Freeze submission; migrate `034`; backfill; unit tests for clock arithmetic | Migration green; existing 184 tests still pass |
| 2 | `accept-custody`, `see`, `communicate` endpoints; role guards | Integration tests for each transition |
| 3 | Doctor "before patient one" view; one-tap `see` | E2E: a critical is seen in ≤3 taps |
| 4 | Nurse call sheet; read-back input | E2E: a critical is communicated with read-back |
| 5 | Print register (PDF + CSS); desk intake view | Printed A4 contains every NABH field |
| 6 | Baseline audit at site 1; 3 interviews | Baseline number for 100 reports |
| 7 | Buffer; fix; deploy | Hosted demo updated |

### Week 2 (12–18 Nov): the trust layer

| Day | Work | Definition of done |
|---|---|---|
| 8 | Identity review queue; household discount v1 | Two Sunita Sharmas held, not merged |
| 9 | Source-span extraction + verifier + abstention | Every accepted obligation opens its span |
| 10 | Scheduler v1 (EDF + criticality) and the worklist order | Call sheet ordered by deadline |
| 11 | Replay harness: load 300 reports, compute baseline | Baseline chart renders |
| 12 | Replay simulation through the state machine | Intervention numbers |
| 13 | Lab QR prototype; ingest route | Scan creates an obligation with the lab flag |
| 14 | Baseline audit at site 2; 3 interviews; provisional patent draft | Two sites audited |

### Week 3 (19–27 Nov): the proof and the stage

| Day | Work | Definition of done |
|---|---|---|
| 15 | Baseline audit at site 3; concierge day 1 | Three-site baseline |
| 16 | Polish: doctor line, nurse sheet, print, verifier | Design review |
| 17 | Demo script; record the 7-minute video | Video cut |
| 18 | Deck rebuild around the result ledger (the current deck is pre-pivot) | Eight slides, one idea each |
| 19 | Rehearse with the doctor partner; Q&A drill | Two full runs under 7:30 |
| 20 | Replay with real data if available; otherwise label synthetic | Final numbers frozen |
| 21 | Submit the finale package; backup video; fresh-device test | Package complete |
| 22 | Buffer | — |

**Critical path:** the baseline audit. It is free, it takes a week, and without it the pitch is a hypothesis.

---

## 7. Acceptance criteria

### Doctor surface

- A critical result can be seen in ≤ 3 taps and ≤ 30 seconds.
- An abnormal result can be seen in ≤ 2 taps and ≤ 15 seconds.
- The doctor never enters a patient-side field.
- The clock never marks a doctor overdue for a report received outside their availability.

### Nurse surface

- A call outcome is recorded in ≤ 3 taps.
- A critical read-back is a single input.
- The script is in the patient's language (Hindi + English at launch).

### Desk surface

- A report is uploaded and matched in ≤ 30 seconds.
- An ambiguous match is held, not forced.
- A held match shows the candidate evidence.

### Quality surface

- The register prints with patient, test, value, flag, received time, clinician, informed-by, time, read-back, status.
- The CSV export matches the print.
- The public verifier returns validity, roles and times, and no clinical value.

### System

- 200+ tests passing; the existing 184 remain green.
- RLS isolation checks pass for a second clinic.
- The chain detects a tampered event in a property-based test.
- The replay runs 300 reports in under 60 seconds.
- The demo works on a fresh phone and a fresh laptop.

---

## 8. What we will not build (and will say so)

- No diagnosis, treatment recommendation, risk score, triage or early warning.
- No automatic patient message without a human action.
- No ABDM/ABHA integration claim.
- No EMR replacement.
- No clinical outcome claim.
- No model-derived criticality.
- No inference that a test was not done from the absence of a record.

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The doctors still find it too much work | Medium | Fatal | One-tap surface; measured in the concierge week; kill the extra fields |
| The baseline audit shows a low unowned rate | Medium | Fatal to the wedge | Narrow to criticals; re-test; if critical rate is also low, kill |
| No buyer will pay | Medium | Fatal to the company | 10 interviews + 3 paid offers before scaling |
| Extraction at 0.24 complete-field makes the desk too slow | High | Serious | Design for completion, not automation; measure clerk seconds; abstain loudly |
| A lab will not co-sell | Medium | Narrows to facility SaaS | Test H5 in week 2; price the facility product to stand alone |
| A team in the same programme ships a better care-loop demo | Medium | Loses the finale | Differentiate on the receipt + the measured replay + the one-tap doctor surface |
| The public repo has already disclosed the patentable core | High | Limits IP | File a provisional on the undisclosed mechanisms; do not publish them |
| The deck and video are still pre-pivot | High | Loses on presentation | Rebuild in week 3; this is the most likely avoidable failure |

---

## 10. The one-sentence definition of done

**A doctor opens one line before patient one, taps once, and the clinic can prove — to a surveyor, a lab, a patient and a court — that a named human saw the result and told the patient, in less time than it takes to find the paper.**

# The win plan

**How to win Health-a-thon 2026, diabetes track, from the judges' side of the table.**

This is not another strategy memo. It is the build order, the demo choreography, the submission checklist and the kill list. It assumes the thesis in `03-WINNING-THESIS.md` and the defects in `04-IMPLEMENTATION-PLAN.md`.

The short version: **win the two doctors with one tap and one printed page; win the technologist with one measured number and one refusal; lose nothing by being the only team that can prove its claim.**

---

## 1. The judges' scorecard, reverse-engineered

| Judge | What they are actually scoring | The moment that wins them | The thing that loses them |
|---|---|---|---|
| **Doctor 1 — clinician** | "Does this give me back time and protect my name?" | One line before patient one, one tap, done | A 14-field drawer; a dashboard; "AI" |
| **Doctor 2 — public health / district** | "Is it safe, does it work without an EMR, and will the surveyor accept it?" | A printed A4 register handed to them; a nurse who can answer the assessor | Cloud-only; a clinical claim; a patient smartphone requirement |
| **Technologist** | "Is this a system or a wrapper?" | A refusal with a calibrated threshold; a state machine; a measured replay | A mock; a seeded demo presented as ingestion; "our model" with no evaluation |

**The coalition rule.** Two doctors outvote one technologist. The product must win both doctors *without* losing the technologist. That is exactly what the closure ledger does: the doctors get recognition and trust, the technologist gets a system.

**The memory rule.** The room remembers one moment and one sentence. Choose them deliberately:

- **Moment:** the machine refuses to merge two Sunita Sharmas, then prints "not informed" for a patient nobody could reach.
- **Sentence:** "Every result gets a receipt."

---

## 2. The winning configuration

Six things must be visible in seven minutes. Nothing else matters.

| # | The thing | Why it wins | Where it lives |
|---|---|---|---|
| 1 | **The one line, one tap** | The clinician recognises her own morning | `/clinic/results?view=line` |
| 2 | **The refusal** | The machine knows its limits; the doctors trust it, the technologist respects it | `/clinic/results?view=intake` (two same-name patients) |
| 3 | **The printed register** | The district doctor can file it; the surveyor accepts it | `/clinic/results?view=register` + A4 print |
| 4 | **The receipt + public verifier** | An artefact a judge can check on their own phone | `/verify/<code>` |
| 5 | **The exception** | "Not informed. Two attempts. Owner: Nurse A." — the honesty beat | Register exception section |
| 6 | **The measured replay** | The RAD-SMART bar: a before/after on real reports | `/clinic/results?view=replay` |

Everything else — recheck, referral, ABDM, Android, 3D, new AI — is cut. Each one is a way to lose focus.

---

## 3. The build: five sprints with gates

Durations are suggestions; the gate is the rule. Do not start a sprint until the previous gate is green.

### Sprint 0 — Truth (3 days, runs in parallel with Sprint 1)

**Goal:** replace the hypothesis with one number.

- Send the baseline audit request to the doctor partner: 100 consecutive reports, three fields (received time, documented acknowledgement, documented patient communication).
- Run the 10 buyer interviews (`06-VALIDATION-PROTOCOL.md` §3).
- Freeze the thesis in one paragraph. No more pivots.

**Gate:** the unowned rate and the median handoff lag for at least one site. If the unowned rate is under 20% and the critical-only rate is under 50%, stop and re-scope.

**Files:** `docs/research/2026-11-04-final/audit/` (new: request letter, extraction sheet, analysis script).

### Sprint 1 — Foundation (3 days)

**Goal:** the state machine the demo needs, and the bugs that would humiliate us in Q&A.

| Task | File | Test |
|---|---|---|
| Migration 034: `obligation_type`, `custody_state`, `review_state`, `communication_state`, actors, due dates, pause fields, `source_span`, `match_confidence`, `household_id` | `app/supabase/migrations/034_closure_roles.sql` | `pnpm db:test` |
| Migration 035: `flag_disputed` decision (keep the lab flag immutable, add the clinician's correction with a reason and an audit event) | `035_flag_dispute.sql` | A disputed flag can close; both flags print |
| Migration 036: server-authored timestamps (`server_received_at`, `server_attempted_at`), client times stored separately, ±15 min skew bound | `036_server_clock.sql` | A forged early time does not change the KPI |
| Endpoints: `/accept-custody`, `/see`, `/communicate`, `/exception`, `/print-register` | `app/apps/api/src/routes/results.ts` | Integration tests per transition |
| Contracts and data layer | `app/packages/contracts/src/results.ts`, `app/packages/data/src/results.ts` | Typecheck |
| Fix the demo seed to create the three staged receipts through the procedures, not direct inserts | `app/supabase/seed/results-demo.sql` | The staged chains match procedure output |

**Gate:** a critical can be seen through the API in one call; a disputed flag closes; a forged timestamp is rejected or recorded; all existing tests pass.

**Cut if behind:** the `next_step_due_at` escalation (D2). Keep D1 and D3.

### Sprint 2 — Surface (4 days)

**Goal:** the three screens the demo uses.

| Screen | What it must do | File |
|---|---|---|
| **Doctor — "Before patient one"** | One line per obligation: test, value, flag, time flagged, time to breach, patient, [Seen] [Correct value] [Ask nurse]. No drawer. | `app/apps/client/src/features/clinic/results/line-view.tsx` (new) |
| **Nurse — call sheet** | Patient, phone, language, script, read-back input, outcome buttons. One tap per outcome. | `call-sheet.tsx` (new) |
| **Register + print** | Filters, exception column, CSV, A4 print with every NABH field | `register-view.tsx` (new), print CSS, server PDF job |
| **Exception** | `closed_unreachable` after two attempts on different days; named owner; reason; appears in the exception section | `exception-sheet.tsx` (new) |

**Gate:** Playwright test — a critical is seen in ≤3 taps and ≤30 seconds; the nurse records the read-back; the obligation closes; the register prints; the exception appears in the exception section.

**Cut if behind:** the CSV export polish. The print matters more.

### Sprint 3 — Trust (3 days)

**Goal:** the two moments that make the room believe.

- **Identity hold + refusal:** two candidates, posterior, "below the safe threshold", [This one] [The other] [New patient]. Use the existing match route; surface the evidence. Do not claim calibration you have not done — label it "candidate evidence" and "human decision required".
- **Escalation order:** v1 is earliest-deadline-first with criticality preemption; surface it as "next three calls" on the nurse sheet. The Whittle index is a later sprint, not a demo dependency.
- **Verifier copy:** return `informed / not informed / closed_unreachable`, never a bare "valid".

**Gate:** the two-Sunita scenario holds; the verifier returns "not informed" for the exception; the nurse's next three calls are ordered and explainable.

### Sprint 4 — Proof (4 days)

**Goal:** the number that wins the technologist.

- Build the replay script: load 300 consecutive reports (real de-identified, or the calibrated synthetic fallback), compute the baseline (unowned %, median lag, outpatient gap, identity holds), run the same reports through the state machine with the observed staff capacity, compute the intervention.
- The replay screen: one chart, three numbers, the sample definition, the date range, the synthetic label if applicable.

**Gate:** 300 reports process in under 60 seconds; the three numbers render; the baseline is reproducible from the raw sheet.

**If the real data is not available:** use the synthetic corpus, label it synthetic on the slide, and say so out loud. Do not dress it as real.

### Sprint 5 — Stage (3 days)

**Goal:** the submission and the room.

- Rebuild the deck (8 slides, `07-PITCH-AND-DEMO.md` §5).
- Rebuild the 2-page brief to the organiser's template.
- Record the 7-minute video: cold open, the failure, the insight, the demo, the proof, the business, the ask.
- Rehearse twice with the doctor partner. Drill the five hard questions first.
- Fresh-device test: a phone that has never opened the app, a laptop that has never signed in.
- Backup: a video file offline, a printed register in a folder, a deck PDF on a USB.

**Gate:** two runs under 7:30; the demo works on a fresh device; the printed register is in hand.

---

## 4. The demo choreography (7:00)

| Time | What happens | What the judge feels |
|---|---|---|
| 0:00 | The 08:50 potassium. The receptionist. The slip. The doctor at 18:42. | Recognition |
| 0:40 | The numbers: 64.61% notified 30–120 min; 25.77% to a clinician; 90.21% of the never-notified were outpatients. | "That is my hospital" |
| 1:20 | 09:25. The doctor's line. She taps **Seen**. | Relief |
| 1:50 | The nurse's call sheet. Read-back. **Informed**. | "My sister could do that" |
| 2:30 | The QR. A judge scans it. "Valid. Seen 09:26. Informed 09:31. No clinical value." | Trust |
| 3:10 | Two Sunita Sharmas, one phone. The system refuses. | Respect |
| 3:40 | The printed register handed to the judge. | Credibility |
| 4:00 | The exception: "Not informed. Two attempts. Owner: Nurse A." | Honesty |
| 4:30 | The replay: 34% unacknowledged → 91% closed within SLA. | Substance |
| 5:30 | Who pays: quality head, lab, district. | Commercial sense |
| 6:15 | The ask: three sites, one lab, eight weeks. | A concrete next step |

**Stagecraft rules:**

- Hand the phone to a judge for the QR. Hand the print to the other doctor.
- Never say "dashboard". Say "the doctor's line" and "the register".
- Say "synthetic" once, clearly, when the data is synthetic.
- If the network dies, switch to the video without apologising twice.
- The doctor partner says the clinical lines; the technical lead says the system lines; the presenter holds the story.

---

## 5. The five questions that decide it

| Question | The answer, in three sentences |
|---|---|
| **"Isn't this the quality officer's job?"** | The quality officer signs the cheque; the doctor carries the risk. That is why the doctor's surface is one tap and the receipt is her alibi. The register is the by-product. |
| **"Won't this add work to my day?"** | The doctor taps once per result. The nurse makes the call that was already happening and records the read-back. If it adds a minute, we cut the field. |
| **"How is this different from the LIS critical alert?"** | The LIS stops at delivery, inside one lab. We prove the clinic acknowledged across five labs, and the patient was told. The lab cannot issue that attestation alone; the EMR cannot be neutral. |
| **"What if the AI is wrong?"** | It refuses when unsure, shows the source span for every accepted field, and never derives the criticality — the lab's flag is copied. A wrong patient is held, not closed. |
| **"Who pays?"** | The hospital quality head for the register and the liability; the lab for proof of delivery at ₹0.25–0.50 a sample; the district for NQAS evidence. The doctor is the user, not the payer. |

**The kill question to rehearse:** *"Show me a receipt that closed patient-unreachable. Did that patient get told?"* Answer: it does not close; it becomes an exception with two attempts, a named owner and a line the quality head sees. That is the honest measure of reach.

---

## 6. Differentiation, against the actual field

| The judge says | We say |
|---|---|
| "RetinaX does the care loop." | RetinaX tracks an eye-screening journey in one department. We close any abnormal result across labs, with a receipt a lab and a court can verify. Different unit, different buyer. |
| "Liv2care does the liver pathway." | Liv2care is a clickable five-role prototype. We are a working system with a state machine, a proof chain and a printed register. |
| "UC2 does the early warning." | UC2's silent risk detector is clinical risk scoring, which this programme excludes. We are an administrative receipt: no interpretation, no score. |
| "Cara does the same thing for mothers." | Cara is the closest architecture, in maternal care. It has a worklist and an audit trail; it does not have the receipt, the identity abstention, the print or the measured replay. |
| "RAD-SMART measured its results." | So will we. That is why we are asking for 300 reports, not for a compliment. |
| "Eka will bundle it." | Eka owns the record and the visit. A lab will not accept a delivery receipt from a competing clinic's EMR. The neutral attestation is the one thing the incumbent cannot be. |

---

## 7. The submission (7–8 November)

Submit the working build you have, with honest claims. Do not wait for the finale version.

| Item | Status to submit | Rule |
|---|---|---|
| Prototype link | The hosted ledger with the line view, the call sheet, the register and the verifier | Works on a fresh device |
| Video | 6–7 minutes, the choreography above | Captions, no cursor wander |
| Brief | Two pages, organiser template | Every number sourced or labelled "to be measured" |
| Deck | Eight slides | One idea per slide |
| Answers | The five questions + the kill question | No invented traction |
| Repo | Public, with an honest README | The 0.24 complete-field number stays in |

**What to say about what is not built:** "Structured entry and a deterministic parser today; live lab ingestion is the pilot." That sentence is worth more than a fake ingestion demo.

---

## 8. The kill list

Do not do any of these before the finale:

- A new dashboard, a new chart, a new stat tile.
- Recheck or referral obligations (they are the expansion, not the demo).
- ABDM/ABHA, Android parity, 3D, a new AI model.
- A TAM slide. Say the ₹203 crore SAM and the 53 hospitals.
- A synthetic 1.00 extraction score. Use 0.875 / 0.56 / 0.24.
- A customer logo you do not have.
- A "risk score", "triage", "early warning" or "improves outcomes" claim.

---

## 9. The three shortcuts that would lose

"At any cost" does not mean "fake it". With two doctors and a technologist, three shortcuts are fatal:

1. **A fake metric.** A judge who catches one invented number discounts the rest. Show the 34% even if it is ugly.
2. **A fake AI.** Do not show extraction when no model has been called. Say "deterministic parser" and win the honesty point.
3. **A fake customer.** No logo, no "pilot with Apollo", no LOI you cannot produce. Say "we are asking for the first three sites" — that is a stronger sentence.

The winning posture is: **the only team that can prove its claim, including its own 24% and its own bugs.**

---

## 10. Definition of done

The finale package is done when all of these are true:

- [ ] A critical result is seen in ≤3 taps and ≤30 seconds.
- [ ] The doctor never enters a patient-side field.
- [ ] The clock does not mark a doctor overdue for a report received outside availability.
- [ ] An unreachable patient prints as an exception, not a closure.
- [ ] The register prints with patient, test, value, flag, received, clinician, informed-by, time, read-back, status.
- [ ] The verifier returns roles and times, never a value.
- [ ] A disputed lab flag can close, with both flags on the record.
- [ ] 300 reports replay in under 60 seconds; three numbers render.
- [ ] Two rehearsals under 7:30; fresh-device test passed.
- [ ] The printed register is in the folder; the backup video is offline.

If any box is unchecked, fix that box. Do not add a feature.

---

## 11. Who does what

| Role | Owns | Speaks on |
|---|---|---|
| Doctor partner | Clinical plausibility, the question set, the on-camera "I would use this" | The 08:50 story, the read-back, the safety boundary |
| Technical lead | Sprints 1–4, the replay, the demo reliability | The state machine, the receipt, the refusal |
| Presenter | The story, the deck, the timing, the Q&A | The opening, the business, the ask |
| Designer | The line view, the call sheet, the print, the deck | Nothing on stage; everything in the room |

---

## 12. The one thing

If the team does only one thing, do this: **the one-tap doctor line with the printed register behind it.**

That single change converts the clinician from sceptic to user, the district doctor from doubter to buyer, and the technologist from "wrapper" to "system". Everything else in this plan is support for that moment.

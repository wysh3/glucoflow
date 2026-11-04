# Executive answer

**4 November 2026 · Health-a-thon 2026, diabetes track (RSSDI), IIT Bombay**

The final submission closes on **7–8 November**; the finale is **28 November** at IIT Bombay. This plan is sequenced to that clock: the submission freezes the thesis, and the three weeks to the finale are for the one-tap surface, the measured replay and the deck.

You asked for one thing: a plan that converges on the single best startup, judged by a room that would vouch for it, and strong enough to win. This is the answer. The evidence is in the documents beside it.

---

## 1. The answer

> **Every abnormal result in Indian diabetes care is a promise. Today nobody can prove the promise was kept. We make the promise a receipt.**

**The product.** Every abnormal lab result becomes an **obligation**: a named owner, a three-part clock, and a tamper-evident receipt. The doctor sees one line before patient one and taps once. The nurse makes the call that was already happening and records the read-back. The desk resolves identity holds. The quality head prints the register. The lab prints a code on its own report.

**The unit.** Not the record. Not the visit. The obligation.

**The buyers.** The hospital quality head (accreditation and liability), the laboratory (proof of delivery), the government facility (NQAS evidence). The doctor is the user, not the payer.

**The proof.** A replay of 300 consecutive reports against their own baseline, then a 12-facility stepped-wedge pilot. The KPI is **critical-result handoff lag** and **closure rate within SLA**.

**The ask.** Three sites, one lab, eight weeks.

---

## 2. The panel's verdict

Eight seats were convened — a YC partner, two doctors (Tier 1 private and Tier 3 government), a health-tech CTO, a Zero-to-One analyst, regulatory counsel, a red team and a hackathon jury chair. **Seven independent scorecards were completed**; the regulatory seat was stopped and replaced by a synthesis clearance review that is not counted in the mean. Every judge scored the same five theses out of 100.

| Thesis | Mean (7 judges complete) | Verdict |
|---|---|---|
| **T1 Closure Ledger** | **75.1** | **Winner in all seven** |
| T2 90-Day Recheck | 67.3 | Best evidence, most crowded, free competitors |
| T3 Annual Review Pack | 61.1 | Needs providers who are not customers |
| T5 Identity Firewall | 59.2 | Best technology, no screen, buyer not in the room |
| T4 Bag Reconciliation | 52.3 | Extraction is the product; 24% complete-field |

The winner leads by 7.9 points, and the rank order is identical in every judge. The spread is the story: the doctors scored it 76–81 because they recognise the failure; the red team scored it 66 because no buyer has been interviewed; the CTO scored it 68 as stated (76 after normalising his 0–10 scale) and found two correctness bugs in the built code.

**The panel's one-sentence verdict:** *"Award the Closure Ledger — the only thesis where the room watches a machine refuse a doctor, a clinic admit it could not reach a patient, and a certificate print anyway."*

---

## 3. Why this wins the room

Three judges, three different reasons, one product:

- **The clinician** recognises the scar. A missed recheck has no date; a potassium that reached a receptionist does. The surface is one tap, and the clock never blames her for a report that arrived in theatre.
- **The public-health doctor** recognises the duty. NABH requires the register and the read-back; NQAS covers 68,564 facilities; the register prints when the network is down.
- **The technologist** sees a system: a state machine enforced in the database, an append-only event table, a hash-chained receipt, and a refusal that is visible on stage.

No other thesis gets two of the three without splitting the pitch.

---

## 4. Why this can be a company

- **The secret.** The record is not the bottleneck; the proof is. Indian healthcare has digitised the decision and left the closure on paper. Nobody is paid to close a loop — every rupee is earned opening an obligation, none discharging it.
- **The monopoly.** Not the register — the **neutral attestation**. A hospital EMR cannot issue it (a lab will not accept a receipt from a competitor's EMR), and a lab cannot issue it alone (the clinic's acknowledgement is the missing half). Neutrality is a position an incumbent structurally cannot take.
- **The market.** A ₹203 crore serviceable market: 14,000 hospitals, 60,000 chronic clinics, 68,564 NQAS facilities, 400 million organised lab samples.
- **The asymmetric channel.** Dr Lal PathLabs alone processes 94.5 million samples a year. At ₹0.30 a sample, one lab contract is ₹2.8 crore. The lab pays for proof of delivery, and the lab prints the code that distributes the product.
- **The moat.** Accepted authority as the neutral issuer, the communication-act archive, the response-hazard dataset, the lab network, and a regulatory lane that a clinical-AI competitor cannot enter without becoming a device.
- **Default alive.** ₹5.25 lakh a month: 53 hospitals at ₹10,000, or 27 at ₹20,000. Against ~4,000 NABH-accredited hospitals, that is 1.3%.

The honest fork: a facility-only business is a ₹15–30 crore niche SaaS with good margins. The lab channel is the venture path. The pilot is designed to find out which one this is within 90 days.

---

## 5. What the panel changed

The built product is not yet the winning product. The judges found four things that must change before 28 November:

1. **Take the typing off the doctor.** The current drawer is 14–16 interactions and 4 clicks for a critical result (2.5–3.5 minutes), and about 90 seconds for an abnormal. At ten abnormal reports a day that is 25–35 minutes — roughly 10% of a 6.5-hour OPD. The v2 surface is one line and one tap; the nurse owns the call and the read-back.
2. **Take the blame off the doctor.** The clock attaches to custody, pauses outside availability, and never marks a clinician overdue for a report that arrived in theatre.
3. **Never let an unreachable patient look "closed".** After two documented attempts, the obligation becomes a `closed_unreachable` **exception** with a named owner — not a closure receipt. The verifier says "not informed". The quality head sees the exception count.
4. **Print the register.** A district hospital does not accept "it is on the cloud". The A4 page is the survey answer, the legal file and the photograph the room remembers.

And the correctness bugs the CTO found, which must be fixed before any demo:

- A mis-extracted `lab_flag` is immutable while acknowledgement requires echoing it, so a wrong flag can never be acknowledged. Fix: a `flag_disputed` decision with a reason and an auditor event.
- The obligation stops at "patient contacted": `next_step_due_at` is never escalated and close does not require it. Fix: escalate the next step and require a disposition.
- The clock is authored by the client. Fix: store claimed and server times separately; compute every KPI on the server value.

---

## 6. What the team must do next (10 days)

| Days | Work | Why it decides the outcome |
|---|---|---|
| 1–2 | File the final submission; freeze the thesis; fix D1 and D2 (flag dispute, next-step escalation) | A demo that cannot acknowledge a wrong flag is a failed demo |
| 2–4 | One-tap doctor surface; nurse call sheet; `closed_unreachable` exception | The single highest-value product change |
| 3–6 | **Baseline audit: 300 consecutive reports at three sites** | One real number beats the entire deck |
| 4–7 | 10 buyer interviews and 3 paid offers | The YC judge's only condition |
| 5–9 | Print register; measured replay; lab countersignature ask | The artefact and the proof |
| 8–10 | Rebuild the deck and the 7-minute video around the ledger | The current deck is pre-pivot; this is the most likely avoidable loss |

The baseline audit is free, takes a week, and is the difference between a hypothesis and a proof. Do it before anything else.

---

## 7. The honest risks

| Risk | What it would mean | The test |
|---|---|---|
| The baseline unowned rate is below 20% | There is no problem worth a company | 300-report audit |
| No quality head will pay | The buyer is a lab or a district, not a hospital | 10 interviews, 3 paid offers |
| The doctor will not accept even one tap | The product is a compliance chore | Time-and-motion on 10 criticals |
| Extraction at 24% complete-field makes the desk slower than paper | The intake is the bottleneck | Clerk seconds per report |
| A lab will not print the code | The venture path collapses to a niche SaaS | 2 lab conversations |
| The deck and video stay pre-pivot | The most likely avoidable loss | Rebuild in week 3 |

If the first two fail, stop. The honest fallback is a services-led records workflow — a good business, not a venture-scale one.

---

## 8. The one-sentence answer to the three hardest questions

**"Why won't Eka do this?"**
Because Eka owns the record and the visit; the cross-lab closure is a different unit, a different buyer and a different channel, and the lab that prints the code is not Eka's customer.

**"Why will a doctor use it?"**
Because it is one line and one tap, and it protects her name.

**"Why will anyone pay?"**
Because a missed critical already costs ₹20 lakh, and the register is already mandatory.

---

## 9. The documents

| File | What it is |
|---|---|
| `PANEL_BRIEF.md` | The shared fact pack the panel read |
| `01-RESEARCH-REPORT.md` | The full research: problem, evidence, market, competition, technical core, regulation, falsifiers |
| `02-PANEL-JUDGMENT.md` | The seven scorecards, the disagreement map, the eight modifications, the methods audit |
| `03-WINNING-THESIS.md` | The converged startup: secret, monopoly, product, business, moat, sequencing |
| `04-IMPLEMENTATION-PLAN.md` | The A–Z build: the defects, the schema, the API, the UI, the four technical modules, the three-week timeline |
| `05-PATENT-DOSSIER.md` | What is patentable, what the public repo already disclosed, what to file and when |
| `06-VALIDATION-PROTOCOL.md` | The 30-day kill protocol, the buyer tests, the stepped-wedge pilot, the pre-registration |
| `07-PITCH-AND-DEMO.md` | The seven-minute script, the slide deck, the two-page brief, the 25-question Q&A |
| `panel/*.md` | Seven independent judge memos and the regulatory clearance review |

---

## 10. The one thing to remember

> **The doctor has two minutes. We give back the first sixty seconds — and we give the clinic a receipt.**

That sentence is the product, the pitch and the company. If the team can say it, show the one tap, show the refusal, and show one measured number from one real clinic, the panel's 75.1 becomes a formality.

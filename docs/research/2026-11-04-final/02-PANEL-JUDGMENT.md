# Panel judgment: seven judges, five theses, one winner

**Date:** 4 November 2026. **Method:** eight seats on the panel, each reading the same fact pack (`PANEL_BRIEF.md`), each writing a memo before seeing another. **Seven independent scorecards are complete.** The eighth seat — regulatory counsel — was stopped after it failed to finish within the session; its questions are covered by a synthesis clearance review in `panel/06-regulatory-review.md`, which is deliberately **not** included in the mean. The ranking is invariant to that seat: regulatory safety carries only 5 of 100 points, and the winner leads by 7.9 points.

**The result in one line:** every judge ranked the **Closure Ledger (T1)** first. The mean score is **75.1/100**. The doctors scored it highest (76–81), the technologist 76, the investor 73, the Zero-to-One analyst 77, the jury chair 77, and the red team 66. The consensus is not that the thesis is ready; it is that the thesis is the only one worth making ready.

---

## 1. The score table

Each judge scored nine weighted dimensions. Two scoring conventions appeared: some judges scored on the weight scale (0–15, 0–10, 0–5), others on a 0–10 scale and weighted. The table below normalises every judge to a 0–100 weighted total. The raw memos are in `panel/`.

| Judge | T1 Closure | T2 Recheck | T3 Review Pack | T4 Bag | T5 Identity |
|---|---|---|---|---|---|
| YC war room | 73 | 66 | 53 | 46 | 54 |
| Dr Meera Iyer, endocrinologist (Tier 1) | **81** | 74 | 67 | 66 | 68 |
| Dr Arvind Kumar, district hospital (Tier 3) | 76 | 67 | 71 | 52 | 61 |
| CTO / technical head | 76 | 64 | 61 | 44 | 60.5 |
| Zero-to-One analyst | 77 | 68 | 64 | 54 | 60 |
| Red team | 66 | 59 | 52 | 43 | 49 |
| Jury chair | 77 | 73 | 60 | 61 | 62 |
| **Mean (7 judges)** | **75.1** | **67.3** | **61.1** | **52.3** | **59.2** |
| Spread | 66–81 | 59–74 | 52–71 | 43–66 | 49–68 |

**Ranking:** T1 > T2 > T3 > T5 > T4. **T1 is first in all seven judges**; the rest of the order varies, and that variation is informative. T2 is second for six judges and third for Dr Arvind (who ranks T3 second, because a district hospital can print a bundle). T4 is last for six of seven and third for the jury chair, who weighs the demo more heavily than the technical depth. T5 is the most polarised: third for one doctor, last for the red team.

**A methods audit, because the panel caught one.** The jury chair flagged that one memo's row totals did not equal the sum of its dimensions. On inspection, three conventions were in use: the weight scale summed raw (YC, Meera, jury), the 0–10 scale weighted (Arvind, red team), and one memo (CTO) scored 0–10 but summed raw, which understates its own view by about 8 points because the maximum raw sum is 90, not 100. Normalising the CTO memo raises T1 from 68 to 76; it does not change the ranking. The lesson is recorded here rather than hidden: **a panel that does not normalise its own arithmetic will report a number it cannot defend.** The same discipline applies to the product's KPIs.

---

## 2. Why T1 wins — the three reasons that appear independently in every memo

### 2.1 It is the only thesis with a dated failure and an external clock

The doctors did not agree on much, but they agreed on this: a missed recheck has no event you can point to, and a potassium that reached a receptionist does. Dr Iyer: "I can tell you the month the potassium went to the front desk. I cannot tell you the date a recheck was missed, because a missed recheck has no event." Dr Arvind: "I cannot tell a surveyor, a patient or a lawyer which of last month's abnormal creatinines were seen."

The external clock is the second half. NABH requires a critical-result intimation record and a read-back. NABL 112 sets the laboratory criteria. DPDP duties commence on 13 May 2027. The buyer does not need to be convinced that the register matters; the buyer already has to produce one.

### 2.2 It is the only artefact that can be checked by someone who does not trust the team

The public verifier returns validity, roles and times without a name or a value. The jury chair called it "the only demoable moat in the pack." The red team called it "the only artefact a judge can check without believing the founder." The CTO called it "real cryptography, correctly built, proving less than a judge will hear" — which is the correct compliment and the correct warning.

### 2.3 It is the only thesis that assembles a 2–1 coalition without splitting the pitch

Two doctors and one technologist. T1 gets the first doctor on recognition, the second on trust (the lab flag is the source; the product never interprets), and the technologist on substance (a server-enforced state machine, an append-only event table, a hash chain). T2 loses the technologist ("this is a CRM"). T5 loses both doctors ("there is no screen"). T3 loses both. T4 loses the second doctor on personal liability ("I sign the reconciliation").

In a three-person panel, two beats one every time.

### 2.4 The Zero-to-One correction: sell the attestation, not the register

The Thiel judge scored T1 highest (77) and then argued that the pitch is aimed at the wrong asset.

> "Nobody in Indian healthcare is paid to close a loop. Every rupee is earned opening an obligation; none is earned discharging it. The record was never the asset; the receipt is. The buyer is the party carrying liability, never the doctor."

His structural point is the sharpest in the pack. A hospital EMR cannot supply a neutral attestation, because a lab will not accept a delivery receipt issued by a competing clinic's EMR. **The incumbent's distribution is its disqualification.** That makes the neutral, lab-accepted attestation the only asset in the category that an incumbent structurally cannot copy.

The consequence for the pitch is uncomfortable and correct: **as built, the product sells the commodity — a NABH register — and gives the monopoly — a neutral attestation — away as a demo page at `/verify/<code>`.** The fix is a positioning and pricing change, not a feature:

1. **Lead with the attestation.** The register is the by-product. The attestation is the product.
2. **Sell it to the lab first.** The lab is the party that needs a neutral proof of delivery, and the party whose trust no EMR can earn.
3. **Publish the schema and give the verifier away.** A standard wins by being adopted, not by being licensed. The authority is the asset; the code is the distribution.
4. **Sell the past.** Onboarding should reconstruct twelve months of paper into a closure history. The clinic buys a defence it already needed, not a new workflow it must learn.

This does not change the winner. It changes what the winner sells.

---

## 3. The disagreements that matter

A unanimous ranking is not a consensus on why. The panel disagrees on four things, and each disagreement is a test to run.

### 3.1 The buyer

| Judge | Position |
|---|---|
| YC | "The only thesis with a named buyer and an external forcing function — but no buyer interview exists. Ten days and three phone calls before a rupee." |
| Red team | "The quality head often has no independent budget — their own battlecard says so. Price at ₹2,000–4,000 to sit inside the accreditation budget, or the invoice never happens." |
| Dr Arvind | "I cannot buy it. There is no SaaS object head. The route is DHS untied funds, one facility, a CMHO MoU; then a state NPCDCS rate contract." |
| Dr Meera | "I would not pay personally for T1; I would use it daily if the hospital paid." |

**The unresolved question:** is the buyer a quality head with a budget, a lab with a liability, or a district with a programme? The panel's answer is "all three, in that order of evidence and the reverse order of certainty." The plan tests all three in ten days.

### 3.2 The doctor's time

The endocrinologist counted the built fields: 14–16 interactions and 4 clicks per critical, 2.5–3.5 minutes; about 90 seconds per abnormal; 25–35 minutes a day at ten abnormal reports, roughly 10% of a 6.5-hour OPD. The jury chair called this "the question that will sink the current build in a live Q&A."

The panel's unanimous fix: **move the capture off the doctor.** The nurse or desk takes the call, the channel and the patient's words; the doctor's surface is one tap to confirm the value, plus the refusal. This is a role change, not a rewrite, and it is the first item in the implementation plan.

### 3.3 The AI

The CTO's finding is blunt: "There is no AI in the ledger at all." Extraction exists in the document pipeline; identity matching is string similarity over the first 200 patients; the "calibrated abstention" is an advisory flag. The product's AI claim is currently a claim about the next version, not this one.

The panel does not agree on how much this matters. The jury chair treats the state machine as the substance; the CTO treats the absent calibration as the gap between a demo and a system. The resolution is in the plan: wire the live extractor to the intake, bind every accepted field to a source span, and calibrate the abstention threshold on 100 real de-identified reports. If that cannot be done before the finale, the pitch says "structured entry and a deterministic parser" and does not say AI.

### 3.4 The demo flaw

The red team found the sharpest product defect in the pack: the demo closes a receipt while the patient was never told. On stage, that makes the headline claim ("nothing closes without a recorded patient communication") false.

The fix is a state, not a sentence: an unreachable patient becomes a `closed_unreachable` **exception**, with two documented attempts, a named owner and a line in the exception register — never a closure receipt. The verifier returns "not informed." The exception count is shown, not hidden.

This is better than the current demo on three counts: the claim becomes true, the quality head sees the patients the clinic could not reach (which is the actual quality problem), and the demo gains a refusal instead of losing one.

---

## 4. The eight modifications that turn 75.1 into 90+

Every judge supplied a "what would make it 95+" list. The lists converge on eight changes. None is a new product; all are measurable.

| # | Modification | Judges who asked for it | Points it adds (their estimate) |
|---|---|---|---|
| 1 | Move capture off the doctor: one-tap clinical confirmation; nurse/desk owns the call and the read-back | Meera, CTO, jury, red team | +4 to +6 |
| 2 | Attribution after acceptance, not before: the clock attaches to custody, pauses outside availability, and never marks a doctor overdue for a report that arrived in theatre | Meera, jury, Arvind | +2 to +4 |
| 3 | Print-first register, legible without the product; on-prem option for government | Arvind | +3 to +5 |
| 4 | One measured baseline: 300 consecutive reports, three sites, the unowned rate and the median handoff lag | YC, jury, red team | +4 to +6 |
| 5 | A lab countersignature: one lab puts its name on the receipt before 28 November | Red team, YC | +5 |
| 6 | Fix the obligation: escalate `next_step_due_at`; an unreachable patient is an exception, not a closure | Red team, CTO | +3 |
| 7 | Fix the clock: server-authored timestamps, skew bound, client time stored separately | CTO | +3 |
| 8 | Real AI at the intake edge: source-span binding and a calibrated abstention threshold, or stop saying AI | CTO | +3 |

The arithmetic is the judges', not ours, and it is optimistic: adding eight independent estimates gives a number above 100, which is impossible. The honest projection is **86–91**, with the caveat that a projection is not evidence. The three modifications that are worth more than the rest are 1, 4 and 5, because they change what the product is, what the pitch proves, and who signs.

---

## 5. The kill question, and the answer

The red team's question is the one to rehearse:

> **"Show me a receipt that closed as patient-unreachable. Did that patient get told? If they didn't, what exactly have you proved, and why would a quality head pay for a system that documents his clinic failing to reach people?"**

The answer, in three sentences:

1. **It does not close.** An unreachable patient becomes an exception with two documented attempts, a named owner and an escalation. The register shows it in the exception section, not the closed section.
2. **What we proved is the truth:** the clinic tried twice, a named person owns the failure, and the quality head can see it. That is what a surveyor asks for, and it is what the clinic cannot produce today.
3. **That is why the quality head pays.** A system that hides an unreachable patient is a filing cabinet; a system that surfaces them is the only one that can reduce the number.

If the team cannot answer in three sentences and show the screen, the demo is not ready.

---

## 6. What the panel did not settle

The regulatory seat did not complete. The questions it would have asked are answered in `panel/06-regulatory-review.md`, and the answer is a clearance, not a score:

- **Is the receipt a medical device?** No, if five conditions hold: the lab flag is copied not computed; no risk score or triage; no outcome claim; every patient message is human-initiated; the verifier returns roles and times only. The CDSCO July 2026 guidance keeps scheduling, communication and record transport outside device scope.
- **Is the receipt evidence against the doctor?** It can be. The mitigations are custody, attribution-aware clocks, role separation and the `closed_unreachable` exception. Counsel should review discoverability, adverse inference and consent scope before a paid pilot.
- **Is any of it patentable under Section 3(k)?** The technical effect is error-rate control at a fixed review budget, scarce-resource allocation, and tamper detection. The chain alone is prior art; the household-discount identity method is the strongest claim.

The regulatory review does not change the ranking. It changes the drafting: five conditions on the copy, the consent and the verifier.

---

## 7. The verdict

**Award the Closure Ledger, in its v2 form.**

The v1 form — the build as it stands — would score below the thesis's 75.1: a real system with a genuine artefact, held back by a doctor surface that costs 25–35 minutes a day, a clock that blames the wrong person, an unreachable patient who looks closed, and no measured baseline. The v2 form — one tap, role separation, print, exception, replay, lab countersignature — is the product the panel described when it said "95+".

The three sentences the team should be able to say by 28 November:

> "In 300 consecutive reports at three clinics, 34% had no documented acknowledgement. With one tap and a printed register, 91% closed within SLA. A lab has agreed to countersign the receipt."

If those three sentences are true, the panel's score is not the constraint. If they are not true, no deck will fix it.

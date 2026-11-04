# Validation plan: kill the idea quickly, or earn the right to build it

> **First-pass plan for the follow-up thesis.** The revised result-loop validation is in [13-revised-recommendation-result-loop.md](13-revised-recommendation-result-loop.md). The principles here, including the founder-free week, the clerk test and the kill criteria, carry over.

The plan tests the assumptions that can kill the thesis, in the order that wastes the least time. It separates what the product does from what the founder does by hand. It measures behaviour, not intent. It has explicit kill criteria and a fallback.

The target is not "validation" in the sense of a survey that agrees with us. It is a decision: build, narrow, or stop.

## The seven assumptions, ordered by risk

| # | Assumption | Why it can kill the thesis | Cheapest test |
|---|---|---|---|
| 1 | Clinics feel the unreached patient as a top-three operational pain and will act on it | If they do not, this is a nice-to-have and no amount of AI helps | 10 structured interviews, 3 register audits |
| 2 | The register can be repaired enough to reach most due patients | If only 20% are reachable after cleaning, the product cannot move the KPI | 3 register audits with a cleaning time trial |
| 3 | The clinic will work the list daily and record dispositions | If the clerk does not use it, the ledger is fiction | 8-week pilot with server-side instrumentation |
| 4 | Recall completion lifts by at least 10 percentage points | If the lift is small, the clinic does not renew | Stepped-wedge or within-clinic comparison |
| 5 | Recovered visits exceed six per clinic per month and the clinic pays | Below six, the clinic cancels; below a paid continuation, the business is a service | Pilot revenue log and a priced continuation offer |
| 6 | The system, not the founder, runs the loop | A founder-driven pilot proves service quality, not product value | Founder-free week; autonomy ratio; clerk test |
| 7 | Consent and trust are good enough for outreach | A high opt-out or a low consent rate makes the channel unviable | Consent rate, opt-out rate, patient comprehension |

## Stage 0: the four-day sprint (3 to 7 November 2026)

The final submission is due on 7 November. Stage 0 is designed to produce a defensible pitch and a go/no-go for the new thesis, not a full pilot.

### Day 1: ten interviews, no pitch

Recruit through the doctor partner, RSSDI/FOGSI/NCG contacts, and two clinic visits. Target mix:

- 5 private clinics in one Tier 2 cluster (solo or 2 to 5 doctors).
- 3 government facilities (CHC, district hospital NCD clinic, PHC).
- 2 hospital or chain operators (for the expansion view).

Ask, in this order. Do not show the app. Do not describe the product until the end.

1. "Walk me through the last patient who was supposed to come back and did not. What happened?"
2. "How do you know who is due? Show me the list."
3. "How many patients are on it? How many can you actually reach?"
4. "What do you do when the phone number does not work?"
5. "Why do patients tell you they did not come?"
6. "Who calls them? How long does it take? What else does that person do?"
7. "What have you tried that failed?"
8. "If a patient comes back because of something you did, what is that visit worth to you?"
9. "Who decides to buy a tool like this, and what budget does it come from?"
10. "Would you give us an anonymised copy of the due list for a two-week test?"

Capture exact phrases. Count how many can name a specific lost patient, how many have a due list, and how many will share an anonymised register.

**Gate 0a:** at least 6 of 10 can name a specific lost patient and describe the current workaround; at least 3 will share an anonymised register or agree to a two-week test. If not, the pain is not acute enough. Do not pivot the pitch.

### Day 2: three register audits

For each clinic that shares a register:

- Take a photo or a CSV of 100 to 300 due patients.
- Measure: missing phone, invalid phone, duplicate record, incomplete address, no alternate contact, family-folder ambiguity.
- Time how long it takes two people to clean 100 records with the product's intake flow.
- Estimate the reachable share after cleaning.
- Ask the clerk to mark the 10 patients they would call first and why.

**Gate 0b:** after cleaning, at least 60% of due patients have a working phone or a reachable alternate. If the best clinic is below 60%, the reachability thesis is weak; the product becomes an ASHA/home-visit product, not a phone-first product.

### Day 3: the demo slice

Build a synthetic cohort of 120 patients with a realistic distribution:

- 46 with a contact problem: 22 missing a phone, 14 invalid, 10 duplicate or family records.
- The audit repairs 34; 12 remain unreachable.
- 108 reachable; 96 contacted; 12 do not answer after three attempts.
- 24 unreached in total: 12 unreachable plus 12 no-answer, each with a named owner.
- 74 booked; 68 attended; 6 no-show.
- 18 distance, 9 cost, 6 no attender, 4 no symptoms, 3 other barriers.
- 10 teleconsult, 8 ASHA visits, 7 closed with a reason.

The demo has four screens:

1. **Reachability audit:** 120 due, 46 with a contact problem, 108 reachable after repair, 12 still unreachable; the reasons.
2. **Loop board:** due, contacted, replied, booked, attended, unreached, escalated, closed.
3. **Patient conversation:** a Hindi/Roman-Hindi WhatsApp exchange; the agent asks why, records "no one to bring me", offers a teleconsult or a nearby lab, books it.
4. **Morning brief:** five numbers, three escalations, the barrier map, and a "no patient without a disposition" line.

Test the demo with five viewers (two doctors, one clinic clerk, two non-clinicians). Ask them to explain it back in one sentence. Count how many mention "the unreachable patient" or "who is not coming" rather than "AI" or "records".

**Gate 0c:** at least 3 of 5 explain it back as a follow-up/reachability product, not a records product. If not, the story is still a CRM.

### Day 4: the paid-pilot ask

Write a one-page offer:

> "Eight weeks. We audit your due list, run the outreach with your staff, and give you a ledger. You pay ₹X for the pilot; if recall completion does not improve, we refund it. At the end, you decide whether to continue at ₹Y per month plus ₹Z per recovered visit."

Ask three clinics for a signature or a purchase order, not a verbal yes. Test three price points across the three clinics (₹2,000, ₹4,000, ₹6,000 base; value fee ₹50 to 100 per recovered visit). Record the objection.

**Gate 0d:** at least 1 of 3 signs or pays a deposit. If none, the willingness to pay is unproven; the pitch should say "we will test willingness to pay", not "clinics will pay".

### The Stage 0 decision

| Result | Decision |
|---|---|
| Gates 0a, 0b, 0c, 0d pass | Submit the new thesis; run the pilot. |
| 0a and 0c pass, 0b or 0d fail | Submit the new thesis with a narrower claim: reachability/ASHA-first, or a free pilot; do not claim WTP. |
| 0a fails | Do not pivot. Submit the existing records product with an honest label, or the PreVisit concept; the follow-up thesis is not validated. |
| 0c fails | The demo is a records demo. Fix the story before the finale or keep the old product. |

## Stage 1: the eight-week pilot (10 November 2026 - 5 January 2027)

### Design

- **Sites:** 3 private clinics in one Tier 2 cluster + 1 government CHC/NCD clinic.
- **Patients:** 500 to 800 due patients across the sites.
- **Arms:** a stepped-wedge by site. Each site starts the intervention at a different week (weeks 1, 3, 5, 7). Each site's pre-intervention due cohort is the comparison. This is weaker than randomisation but feasible in real clinics; state the confounding honestly.
- **Alternative if the clinic insists:** within-clinic alternating assignment by patient (even/odd registration number) for the first 4 weeks, then everyone gets the intervention. This isolates the product effect better but raises fairness concerns; use only with the clinic's ethics approval.
- **Baseline:** 4 weeks of usual care, measured prospectively from the register, not recalled.
- **Intervention:** the reachability audit, the outreach, the barrier conversation, the resolution routing, the ledger and the morning brief.

### Primary outcome

**Recall completion within 30 days of the due date**: the patient attended a visit or a teleconsult, or the clinic recorded a documented clinical alternative. This is the KPI the programme names and the clinic understands.

### Secondary outcomes

- Reachability rate: due patients with a working phone or a reachable alternate.
- Contact rate: due patients reached at least once.
- Barrier resolution rate: patients with a barrier who were routed to a resolution and completed it.
- Unreached rate: due patients with no contact after the protocol's attempts.
- Time to first contact.
- Staff minutes per due patient (time-motion, sampled).
- Opt-out rate and complaints.
- Patient comprehension: can the patient say why the clinic contacted them? (short call-back survey, n=30)
- Clinic revenue from recovered visits.
- No-show rate for booked visits.

### Instrumentation

The ledger is the dataset. Every row has:

- Patient ID, clinic, due date, due reason (clinician-configured interval), source.
- Reachability status and the contact fields used.
- Every attempt: timestamp, channel, language, outcome.
- Every reply: barrier code, free text (minimised), red-flag flag.
- Every disposition: booked, teleconsult, nearby lab, ASHA visit, declined, moved, unreachable, closed.
- Every outcome: attended, no-show, rescheduled, completed test, lost.
- Staff ID and minutes (sampled).
- Consent version and timestamp.

No self-reported spreadsheets. The server writes the events. Export a CSV weekly for the analysis.

### The founder-effort audit

This is the difference between a product and a service.

- Log every founder hour per clinic per week.
- Count manual touches: calls, WhatsApp messages, data cleaning, follow-ups.
- Compute the **autonomy ratio** = actions taken by the product or clinic staff / total actions.
- Target: **above 70% by week 6**.
- Run a **founder-free week** in week 5: the founder does not contact the clinic, does not call patients, does not fix data. Measure whether the list is worked.
- Run a **clerk test** in week 6: a clinic clerk with a one-page script works 50 due patients without the product; compare contact rate, barrier capture and booking rate to the product arm. If the clerk is as good, the AI is not the value; the workflow is.

### The willingness-to-pay test

At week 6, make a written offer to each site:

- Option A: ₹2,000/month base + ₹50 per recovered visit.
- Option B: ₹4,000/month base + ₹75 per recovered visit.
- Option C: ₹6,000/month base + ₹100 per recovered visit.

Ask for a purchase order, a UPI mandate, or a signed pilot continuation. Do not ask "would you pay". Record the objection and the decision-maker.

### The analysis

- Pre-register the primary outcome and the analysis plan before the pilot starts.
- Intention-to-treat; report the baseline and the delta with confidence intervals.
- Report the negative results and the confounders.
- Do not compare across sites with different case mixes without adjustment.
- Publish a one-page result, including the failures.

### Stage 1 kill criteria

| Criterion | Threshold | What it means |
|---|---|---|
| Recall completion lift | < 10 percentage points | The product does not move the KPI; kill or redesign |
| Reachability after cleaning | < 50% | The phone channel is not viable; pivot to ASHA/home-visit |
| Disposition completeness | < 50% of due patients after 4 weeks | The clinic does not work the list; the ledger is fiction |
| Staff time | > 3 minutes per due patient | The product adds work; redesign the clerk flow |
| Paid continuation | < 2 of 3 private clinics | WTP is unproven; the business is a service or a grant |
| Opt-out / complaints | > 5% opt-out or a serious complaint | The trust design failed; stop and fix |
| Consent rate | < 60% | The channel is not lawful or not trusted; stop |
| Autonomy ratio | < 50% by week 6 | The founder is the product; do not scale |
| Recovered visits | < 6 per clinic per month | The clinic's ROI is negative; it will churn |

If two or more of the first four criteria fail, **kill A** and move to the fallback.

## Stage 2: the repeatability test (January-March 2027)

Only if Stage 1 passes.

- 10 clinics in 2 cities + 1 government district (5 to 10 facilities).
- 12 weeks, same instrumentation.
- Measure CAC, payback, churn, win rate against the incumbent, and the government payment cycle.
- Test the second loop (results accountability) in 3 clinics.
- Test the value-based pricing at scale.

### Stage 2 kill criteria

| Criterion | Threshold |
|---|---|
| CAC payback | > 12 months |
| Monthly churn | > 3% |
| Win rate against incumbent | < 30% |
| Government payment | > 12 months without a bridge |
| Gross margin | < 50% after support |
| Second-loop attach | < 20% of clinics |

## The fallback if A dies

1. **B: closed-loop results.** The competitor research found the white space: a per-result owner, a deadline and an escalation clock. It has a patient-safety KPI and a hospital buyer. It reuses the extraction and audit layer. The Indian baseline is weak, so the pilot must measure it.
2. **C: referral receipt.** High severity, government-heavy, two-sided. It needs institutional agreements; it is a longer build.
3. **Stop pitching novelty.** If none of the three passes, the honest move is to run the records product as a B2B workflow business, target the paper-first segment, and stop entering novelty competitions.

## The interview script (one page)

**Opening.** "I am trying to understand how follow-up actually works in your clinic. I am not selling anything today. I will not ask for patient names. Can I ask about the last patient who did not come back?"

**The last case.** "Who was it? When were they due? What happened? Who was supposed to call them? What did they say? What did you do next?"

**The list.** "Show me how you know who is due. How many are on it? How many can you reach on the phone? What do you do when the number does not work? Who owns the list?"

**The barrier.** "When a patient says they cannot come, what do they say? What do you do about it? What have you tried that did not work?"

**The money.** "What is a return visit worth to you? Who pays for a tool like this? What budget? What would make you cancel?"

**The test.** "Would you give us an anonymised copy of the due list for a two-week test? If it works, would you pay ₹X for the pilot?"

**Close.** "Is there anything I should have asked and did not?"

## The pilot SOP (one page)

1. **Consent.** The clinic's data fiduciary notice; separate WhatsApp consent; the patient's language; a one-tap stop.
2. **Register intake.** Photo or CSV; a 100-record sample; the reachability audit in 10 minutes.
3. **Due rule.** The clinician configures the interval per condition; the product never infers a screening deadline.
4. **Outreach.** Three attempts across two channels; the patient's language; clinic-branded; no clinical values in the message.
5. **Barrier conversation.** A fixed question set; a fixed barrier taxonomy; no clinical advice; red-flag phrases create a human callback, not an AI decision.
6. **Resolution.** Only the options the clinic can deliver; otherwise mark "no resolution available" and escalate.
7. **Disposition.** Every due patient has one; the unreached have a named human owner.
8. **Morning brief.** Five numbers and the escalations; printed if needed.
9. **Weekly review.** 30 minutes with the clinic; the barrier map; the top three fixes.
10. **Audit.** Export the ledger; no patient data in the deck; the pilot report is anonymised.

## What "genuine product value" looks like

- The clinic works the list when the founder is not there.
- The clerk can use it after a 10-minute training.
- The unreached rate falls, not because the list shrank, but because more patients are reached.
- The barrier map changes what the clinic does (a camp, a teleconsult slot, a lab partner).
- The clinic pays without a discount.
- The product, not the founder, produces the morning brief and the ledger.

If those six are true, the thesis has earned the right to scale. If not, the honest answer is that this is a service business dressed as software, and the team should stop or narrow.

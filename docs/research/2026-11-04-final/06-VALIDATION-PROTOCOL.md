# Validation protocol: how to kill this in 30 days, and what would make it undeniable

**Purpose.** The panel's harshest finding is not that the thesis is wrong. It is that the team has built the product and skipped the two tests that cost nothing: a buyer conversation and a baseline measurement. This protocol fixes that. It is designed to kill the thesis quickly if the evidence does not support it, and to produce the three numbers that make the finale undeniable if it does.

**Rule.** No feature work until the first three tests are complete. The product is already good enough to test. More software is procrastination.

---

## 1. The five assumptions, ordered by how cheaply they can be killed

| # | Assumption | If false | Test | Cost | Time |
|---|---|---|---|---|---|
| H1 | The baseline is bad: at least 30% of abnormal results lack a documented acknowledgement or patient communication | There is no problem to solve; kill the thesis | Audit 100 consecutive reports at 3 sites | ₹0 + 2 days per site | 7 days |
| H2 | A quality head or medical superintendent will pay to close the loop, not just ask for a report | There is no buyer; the product is a free utility | 10 interviews + 3 paid offers | ₹0 | 10 days |
| H3 | The loop changes behaviour without the founder in the room | The pilot is a consultancy, not a product | 2-week concierge, then a founder-free week | ₹0 | 21 days |
| H4 | A named clinician will accept the clock and the escalation | The doctors route around it; the audit is fiction | Time-and-motion on 10 criticals + 30 abnormals; 5 doctor interviews | ₹0 | 7 days |
| H5 | A lab will co-sell or pay for proof of delivery | The venture path collapses to a niche SaaS | 2 lab conversations; 1 co-sell ask | ₹0 | 14 days |

The order matters. H1 and H2 are the cheapest and the most decisive. Do them first. Do not run H3 before H1 and H2 pass.

---

## 2. H1 — the baseline audit

### Design

At three sites (two private, one government), take **100 consecutive reports** received in the last 90 days. For each, record:

- Report receipt date and time (from WhatsApp timestamp, lab portal, or the paper file).
- Whether a named clinician acknowledgement is documented (signature, initial, WhatsApp reply, EMR note, paper register line).
- Time from receipt to that acknowledgement.
- Whether patient communication is documented, and by whom (doctor, nurse, clerk, nobody).
- Whether a read-back is documented for critical values.
- Whether the report is an outpatient report.
- Whether the patient identity was ambiguous (name-only, shared phone, missing DOB).

### Analysis

- **Primary baseline:** proportion of abnormal results with no documented acknowledgement within 24 hours, and no documented patient communication within 72 hours.
- **Secondary:** median handoff lag; proportion of criticals acknowledged by a clinician (not a clerk) within 1 hour; outpatient vs inpatient gap; identity-hold rate.
- Report with a 95% Wilson interval. With n=100, a 30% proportion has a 95% CI of roughly 21–40%. That is wide; if the observed rate is near the threshold, extend to 200.

### Decision rule

- If the combined rate is **below 20%**, the thesis is weak. Narrow to the critical-only segment and re-test, or kill.
- If it is **20–30%**, the thesis survives only if the critical-only rate is above 50%.
- If it is **above 30%**, proceed to H2.
- If a site cannot produce a report register and a named quality owner, that site is not a buyer and is removed from the count. If fewer than 2 of 3 sites can, the thesis is in trouble.

### What the audit produces for the finale

One number: **"In 300 consecutive reports across three clinics, 34% of abnormal results had no documented acknowledgement and 41% had no documented patient communication. Median handoff lag: 9 hours 20 minutes."** That single slide is worth more than the entire deck.

---

## 3. H2 — the buyer test

### 10 interviews

Recruit: 4 quality heads or medical superintendents (private, NABH-accredited or aspiring), 3 lab managers or lab quality heads, 2 clinic owners, 1 district NOD/CMHO.

**Do not show the app.** Ask:

1. "Tell me about the last critical result that went wrong in this facility. What happened?"
2. "Show me your critical-alert register for last month." (Ask them to open it, not describe it.)
3. "What did your last NABH/NABL survey say about critical results or medical records?"
4. "Who is accountable when a report is not acknowledged?"
5. "What do you do today to prove a patient was told?"
6. "What have you bought in the last two years to fix a quality or audit problem? What did it cost?"
7. "If I could show you, for every report, who saw it and when — what would that be worth per month?"
8. "Who else would have to approve this?"
9. "What would make you say no?"
10. "Will you run a two-week pilot on 50 reports? I need one person and 30 minutes."

### The paid offer (the only real test)

At the end of each interview, make a concrete offer:

- **₹5,000/month** for a 50–200 bed site, or **₹10,000**, or **₹20,000** (ask which tier they would choose).
- Ask for a **purchase order or a deposit**, not a verbal yes. A signed LOI is a maybe; a ₹1 deposit is a yes.
- Offer a two-week free pilot with a paid continuation at the end. The continuation signature is the test.

### Decision rule

- **0 of 10** interviews produce a pilot request: the problem is not urgent enough. Kill or re-scope.
- **1–2 of 10** produce a pilot request and **0** produce a deposit: the product is interesting but not bought. Re-scope the buyer (lab vs hospital) before building.
- **3+** produce a pilot request and **at least 1** produces a deposit or PO: proceed.
- The YC judge's standard: **three signed invoices at ₹10,000+ in one city**, not LOIs.

---

## 4. H3 — the concierge and the founder-free week

Run the receipt **by hand** on 50 reports at one site for two weeks:

- The founder (or a trained clerk) does the upload, the match, the assignment and the call log.
- The doctor gets a WhatsApp message with one line per critical and a daily 6-line list.
- Every touch is logged with a timestamp.

Then run **one founder-free week**: a clinic staff member operates it with only a one-page SOP.

### Measures

- **Autonomy ratio:** actions handled without the founder / total actions. Target ≥ 50% by week 3, ≥ 80% by week 6.
- **Time per obligation** for the clerk and the doctor (median, IQR).
- **Closure rate** within SLA.
- **Doctor interaction count** per obligation. Target ≤ 2 taps for a normal abnormal, ≤ 3 for a critical.
- **Routing-around events:** the sister logging in as the doctor, the doctor ignoring the list, the register not updated. Count them. Each one is a product failure.

### Decision rule

- If the doctor takes more than 60 seconds per abnormal, redesign the interaction before scaling.
- If the autonomy ratio is below 50% at week 4, the product is a service. Do not claim product value.
- If the founder is still doing the chasing in week 5, kill the current motion and re-scope.

---

## 5. H4 — the clock and the attribution

The doctor judges' fatal flaw is the clock. Test it directly.

### Time-and-motion (10 criticals, 30 abnormals)

Measure, with a stopwatch and a screen recording:

- Clicks and fields to acknowledge.
- Seconds to acknowledge.
- Seconds to record patient communication.
- Whether the doctor completes it during a consultation or defers it.

### The attribution experiment

Show two versions of the same screen to 5 doctors:

- **A:** the clock starts when the report arrives; the doctor is marked overdue.
- **B:** the clock starts when custody is accepted; it pauses outside the doctor's availability window; the doctor confirms with one tap and the nurse records the patient communication.

Ask which one they would keep using after a bad week. The hypothesis is B, strongly. If B is not preferred, the audit-trail design is wrong.

### Decision rule

- If the median doctor interaction for an abnormal is above 30 seconds, the design fails. Redesign.
- If fewer than 4 of 5 doctors prefer B, the attribution model is wrong.
- If any doctor says "I would ask the sister to log in as me", the role separation is insufficient.

---

## 6. H5 — the lab channel

Two conversations, one ask:

1. "What does a missed critical value cost you today — in calls, repeats, complaints, legal?"
2. "Would a verifiable delivery receipt help you win or keep a corporate/insurer contract?"
3. "Would you print a verification code on your reports and pay ₹0.25–0.50 per sample for proof of delivery?"
4. "Will you co-sell to five of your clinic customers?"

### Decision rule

- If both labs say the liability is real but neither will pay, the channel is a partnership, not a revenue line. Re-price.
- If one lab will run a pilot, the venture path is alive.
- If both say their LIS already does this, kill the lab channel and re-scope to hospitals.

---

## 7. The pilot (after the finale, if H1–H3 pass)

### Design: stepped-wedge cluster randomised trial

- **Units:** 12 facilities (8 private, 4 government), one district cluster.
- **Periods:** 4 periods of 4 weeks; 3 facilities cross over at each step, in random order.
- **Population:** all abnormal results in the facility during the period; criticals analysed separately.
- **Primary outcome:** proportion of abnormal results with a documented clinician acknowledgement and a documented patient communication within 72 hours (the "closure rate").
- **Secondary:** median handoff lag; critical closure within 1 hour; outpatient closure rate; nurse attempts per closure; doctor seconds per obligation; register completeness; patient-reported "was told" (a 10% random sample).
- **Blinding:** outcome ascertainment from the register, extracted by someone blind to period; the intervention cannot be blinded to staff.

### Analysis

Mixed-effects logistic regression:

`logit P(closure_ij) = β0 + β1·intervention_j + β2·period_j + u_i + ε_ij`

with a facility random intercept `u_i` and cluster-robust standard errors. Pre-register the model, the primary outcome and the analysis population before the first period.

### Power

Assume a baseline closure rate of 50%, an ICC of 0.05, 12 clusters, and ~200 abnormal results per facility per period. The design effect is approximately `1 + (m−1)ρ = 1 + 199×0.05 = 10.95`; the effective sample is ~219 per arm. The minimum detectable difference at 80% power is roughly **13–15 percentage points**. A 15-point improvement (50% → 65%) is the target. If the baseline is worse (30%), the same absolute improvement is easier to detect.

This is an estimate. A statistician should confirm it before the protocol is frozen.

### Kill criteria (pre-registered)

Kill or narrow if any of these hold after the pilot:

- Fewer than 2 of 3 audit sites can produce a register and a named quality owner.
- The baseline unowned rate is below 20% and the critical-only rate is below 50%.
- Median handoff lag does not improve by at least 25%.
- The closure rate does not improve by at least 10 absolute points.
- The unowned rate stays above 10% after four weeks.
- The founder is still doing the chasing in week 5.
- No site signs a paid continuation or deposit.
- A hospital asks for clinical interpretation or risk scoring as a condition of purchase. Decline; it is a different, regulated product.
- A lab or HIS incumbent already provides the exact cross-lab receipt and accreditation export at the pilot site.

---

## 8. What counts as demand (and what does not)

| Signal | Counts? | Why |
|---|---|---|
| "This is very useful, send me a proposal" | No | Politeness |
| A signed LOI with no money | Weak | Intent, not commitment |
| A pilot with a named owner and a start date | Yes | Operational commitment |
| A purchase order | Yes | Budget commitment |
| A deposit, even ₹1 | Yes | The strongest cheap signal |
| A renewal after 90 days | Yes | Value realisation |
| A lab agreeing to print the code | Yes | Distribution commitment |
| A doctor saying "I would use it" | No | The panel's own warning |

The founder-free week is the single best test of product versus service. If the clinic cannot run it without the founder, the company is a consultancy with software attached.

---

## 9. The one-page pre-registration (fill before the pilot)

```
Hypothesis:        The closure layer increases the proportion of abnormal results
                   with a documented clinician acknowledgement and patient
                   communication within 72 hours, by at least 15 absolute points.
Primary outcome:   Closure rate at 72 hours, per abnormal result.
Secondary:         Median handoff lag; critical closure at 1 hour; outpatient
                   closure; doctor seconds per obligation; register completeness.
Design:            12-facility stepped-wedge cluster RCT, 4 periods of 4 weeks.
Randomisation:     Facility crossover order, sealed envelope, statistician-held.
Analysis:          Mixed-effects logistic regression, facility random intercept,
                   period fixed effect, cluster-robust SEs.
Exclusions:        Reports with unresolvable identity after 7 days; duplicates.
Stopping rule:     Interim review after period 2; stop if closure rate falls.
Kill criteria:     As in section 7.
Registration:      OSF or Clinical Trials Registry – India (CTRI), before period 1.
```

---

## 10. The 30-day calendar (assuming the finale is 28 November)

| Window | Work | Output |
|---|---|---|
| 5–7 Nov | Final submission; freeze the thesis; no new features | Submitted package |
| 8–14 Nov | H1 audits at 3 sites; 10 interviews; H4 time-and-motion | Baseline number; buyer map |
| 15–21 Nov | H3 concierge week 1; H5 lab conversations; provisional patent filing | First closure data; lab signal |
| 22–27 Nov | Finale build: one-tap closure, role separation, replay mode, print register; rehearse | Demo-ready product |
| 28 Nov | Finale | Score |
| 29 Nov–15 Dec | Founder-free week; paid offers; pilot contracts | Demand evidence |
| Jan–Mar | Stepped-wedge pilot | Causal estimate |

The critical path is the baseline audit. It is free, it takes a week, and it is the difference between a pitch and a proof.

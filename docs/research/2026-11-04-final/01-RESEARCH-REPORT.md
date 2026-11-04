# The unowned obligation: a research report on diabetes workflow failure in India

**Version 1.0 · 4 November 2026 · Health-a-thon 2026, diabetes track (RSSDI)**

This report answers one question: *what genuinely unsolved, non-clinical operational problem should a small team solve to win this programme and build a defensible company?* It is written to be attacked. Every number carries a source grade. Every claim that is unmeasured is labelled as such.

The answer, developed across sections 2–8 and tested by an eight-judge panel in `02-PANEL-JUDGMENT.md`, is a single thesis:

> **Indian diabetes care does not fail because doctors do not know what to do. It fails because a clinical intention has no operational owner, no clock, and no proof. We turn every abnormal result into an obligation with a named owner, a deadline, and a receipt that a clinic can defend and a patient can verify.**

---

## 1. Method

### 1.1 How the theses were generated

The search started from the programme's 13 official use cases and the published design bar, then worked backwards from failure, not forwards from technology. Four filters were applied to every candidate:

1. **Non-clinical by construction.** No diagnosis, no treatment recommendation, no risk score, no interpretation. This is both a programme rule and a CDSCO device boundary.
2. **A named operational owner and a measurable clock.** If the problem cannot be expressed as "X must happen by time T, and today nobody can prove it did", it was rejected.
3. **Works without an EMR and without a patient smartphone.** Otherwise it fails in Tier 2/3 and government settings, which are half the market and most of the need.
4. **A unit that can become a standard.** A screen can be copied. A receipt format, a register, or a scheduling policy can become the thing others conform to.

Five theses survived: the Closure Ledger (T1), the 90-Day Recheck Loop (T2), the Annual Review Pack (T3), the Bag Reconciliation (T4), and the Identity and Report Integrity Firewall (T5). They are specified in `PANEL_BRIEF.md` §6.

Four candidate theses were rejected before scoring: ambient documentation, records timelines, a chatbot over records, and diabetic retinopathy screening AI. The reasons are documented in §4.4 and in `PANEL_BRIEF.md` §7.

### 1.2 Evidence grading

| Grade | Meaning |
|---|---|
| A | A primary measurement or an official statistic, read at source |
| B | An official document, standard, or published price |
| C | A vendor claim or secondary reporting |
| E | Our own estimate, with assumptions shown |
| Gap | No usable Indian measurement was found |

The report uses `Gap` deliberately. A startup that knows what it does not know is more credible than one that fills every hole with a number.

### 1.3 The judging method

Seven independent judges scored all five theses on a 100-point rubric; an eighth seat (regulatory counsel) was replaced by a synthesis clearance review that is not counted in the mean: problem reality (15), failure cost (10), buyer and willingness to pay (15), defensibility (15), technical depth and honest AI (10), programme fit (15), India scale (10), regulatory safety (5), demo-ability (5). The judges were a YC partner, a Tier 1 endocrinologist, a Tier 3 government medical officer, a health-tech CTO, a Zero-to-One analyst, a red team, and a hackathon jury chair. Each wrote an independent memo before seeing the others. The scores and the disagreement map are in `02-PANEL-JUDGMENT.md`.

### 1.4 The pre-registered decision rule

Before the scores were read, the rule was fixed:

- The winner is the thesis with the highest mean weighted total.
- A thesis is disqualified if any judge identifies a fatal regulatory flaw that cannot be fixed by positioning alone.
- A thesis is disqualified if its buyer cannot be named as a role with a budget line.
- A tie is broken by buyer clarity, then by defensibility.
- The winner must survive the red team's strongest single argument. If it does not, the second-ranked thesis is tested.

This rule exists so the decision cannot be rationalised after the fact.

---

## 2. The problem

### 2.1 The four leaks

An Indian diabetes OPD runs on a repeating rhythm: measure, decide, tell the patient, book the next test, repeat. The rhythm leaks in four places.

**Leak 1 — the result.** A report comes back. It reaches a WhatsApp number, a paper pile, or a portal. Nobody can prove that a named clinician saw it, or that the patient was told. Critical values are the extreme case; abnormal HbA1c, eGFR, urine albumin-to-creatinine ratio, potassium and lipids are the everyday case.

**Leak 2 — the recheck.** The doctor says "come back in three months". Nobody owns the return. The patient feels fine, lives 40 km away, has no attender, or is simply never called.

**Leak 3 — the referral.** The patient is sent to an ophthalmologist, a nephrologist or a foot clinic. The referral is written. Completion is unknown.

**Leak 4 — the bundle.** The annual complication review — eye, foot, renal, lipids, blood pressure — is standard of care and is almost never assembled in one place for one patient.

All four have the same shape: **a clinical intention with no operational owner, no clock, and no proof.**

### 2.2 The evidence

The Indian evidence is thin in places and damning in others. It is strongest exactly where the thesis needs it: critical-result communication, outpatient failure, and the complete absence of a follow-up owner.

| Finding | Setting | Grade | Source |
|---|---|---|---|
| Of 1,187 critical values, 64.61% were notified 30–120 minutes after the sample arrived; only 25.77% reached a clinician, 52.90% went to nursing staff and the rest to clerks or attendants; only 37.21% of outpatient critical values were notified; 92 critical values were never notified at all, and 83 of those were outpatients | Tertiary hospital, Delhi, 25 months, 478,980 tests | A | Agarwal et al., *Ind J Clin Biochem* 2015, [PMC4310845](https://pmc.ncbi.nlm.nih.gov/articles/PMC4310845/) |
| 86.8% of critical results notified within 1 hour; 10.7% unsuccessful notification | Tertiary biochemistry lab | A | Thieme 2023 |
| 6.8%–62% of abnormal laboratory results were not followed up | Systematic review, 20 studies | B | *J Gen Intern Med* 2012 |
| Among 4,522 known diabetics aged 50+, **only 6.3% had a retinal examination in the past year and 89.9% had never had one at all**; diabetic retinopathy prevalence 16.9% | National survey 2015–19 | A | *Indian J Ophthalmol* 2021, [PMC8725073](https://pmc.ncbi.nlm.nih.gov/articles/PMC8725073/) |
| 50.5% delayed eye care because "my eyes were okay"; 41.0% had no attender; 38.6% cited cost; 26% progressed to vision-threatening disease during the delay | Puducherry, n=500 | A | *Indian J Ophthalmol* 2017 |
| 50–60% missed scheduled follow-up; reasons were no symptoms (24.8%), distance (22.3%), no instructions (15.3%), acute illness (8.3%), waiting time (7%) | Punjab public facilities, n=300 | A | *J Clin Hypertens* 2021 |
| Only 60.4% had a legible phone number, 16.4% a complete address, and 11.2% were trackable by both; missing contact was associated with loss to follow-up (OR 4.5) | Chennai, 3,696 patients | A | *BMC Infect Dis* 2018 |
| Missed visits fell from 66% to 22% in nine months using ASHA home visits and record triangulation, with no app | District Hospital Seoni | A | *BMJ Open Quality* 2025 |
| 101.3 million people with diabetes and 136 million with prediabetes | National | A | ICMR-INDIAB-17, *Lancet Diabetes & Endocrinology* 2023 |
| No Indian measurement of ordered tests never reviewed; no national loss-to-follow-up rate with a numerator and denominator | — | Gap | Research memo, 3 Nov 2026 |

Two numbers deserve emphasis because they define the product.

**Only 25.77% of critical results reached a clinician.** In the one Indian study that measured it, three out of four critical values were communicated to a nurse, a clerk or an attendant. A receipt that proves *a human was informed* is not the same as a receipt that proves *the clinician was informed*. The product must name the role, not just the event.

**Only 37.21% of outpatient critical results were notified.** The failure is not random. It concentrates exactly where the diabetes clinic lives: the outpatient who has gone home.

### 2.3 Why existing systems do not solve it

| System | What it does | Why the leak survives |
|---|---|---|
| Laboratory information system (LIMS) | Flags critical values inside the lab; logs the call | The lab's job ends at delivery. It cannot prove the clinic acknowledged, or that the patient was told |
| Hospital information system (HIS) | Results inbox for inpatients | Outpatient reports arrive by WhatsApp, paper or a portal; the HIS never sees them |
| EMR (Eka, Practo, HealthPlix) | Stores the record, sends reminders | Assumes the report is already in the EMR and the patient is reachable. Neither is true at the margin |
| Clinic CRM (Clinizy, Lifemaan) | Recall lists, WhatsApp reminders | Tracks what the clinic sent, not who was never reached or never acknowledged |
| Paper register | The NABH/NABL critical-alert log | Incomplete by construction; no clock, no escalation, no verification |
| WhatsApp | The real channel | No structure, no identity, no audit, no proof |

The gap is structural: **every existing system owns a fragment of the loop, and no system owns the closure.**

### 2.4 The Indian specificity

A product designed in Boston or Berlin fails here for five reasons, and each one is a design constraint:

1. **The outpatient is the failure point.** Inpatient results have a bed, a nurse and a ward. Outpatients have a phone number that may be wrong. Any design that centres the ward misses the majority of the harm.
2. **The phone is shared.** A household of five may share one number. A phone match is weak evidence of identity, unlike in Western record linkage. Identity resolution must discount shared identifiers and abstain.
3. **The report arrives as a photograph.** PDFs from five labs, WhatsApp images, printed slips, handwritten corrections. Extraction must be layout-agnostic and must show its source.
4. **The doctor is not at a desk.** The acknowledgement happens between patients, on a phone. The interaction budget is one tap, not a form.
5. **The quality standard already exists.** NABH requires a critical-result intimation record and a read-back; NABL 112 sets laboratory criteria; NQAS covers 68,564 public facilities. The buyer does not need to be convinced that the register matters. They need a register that is true.

---

## 3. Market

### 3.1 The size of the obligation

India has 101.3 million people with diabetes. A conservative rhythm of two lab episodes a year, three reportable analytes per episode, produces roughly **600 million diabetes-related result obligations a year**. Add prediabetes, hypertension and general outpatient testing, and the number is larger. The unit is not scarce. The ownership is.

### 3.2 Bottom-up market model

Estimates are marked E. The model is deliberately conservative: it applies a serviceable fraction to each segment rather than claiming the whole market.

| Channel | Population | Serviceable fraction | Annual price | SAM (₹ Cr) | Basis |
|---|---|---|---|---|---|
| Private hospitals and nursing homes with a quality function | ~14,000 (4,000 NABH-accredited + ~10,000 aspirants) | 30% | ₹1.44 lakh | 60.5 | NABH/CGHS directories; Times of India, Jan 2026 |
| Private chronic-care clinics | ~60,000 with a meaningful diabetes panel | 10% | ₹36,000 | 21.6 | Practo 50,000+ and HealthPlix 14,000+ doctors; E |
| Government facilities with NQAS certification | 68,564 | 2% | ₹1.5 lakh | 20.6 | MoHFW/Sansad, 24 Jul 2026 |
| Organised diagnostic laboratories | ~400 million samples/year | 50% | ₹0.50/sample | 100.0 | Dr Lal PathLabs 94.5M samples FY25-26; E for the sector |
| **Total SAM** | | | | **~₹203 Cr (US$24M)** | E |

The TAM, if every facility and every lab is counted, is roughly ₹1,400 Cr (US$170M). It is not a useful number and is not used in the pitch. The SAM is the honest one, and it is consistent with the earlier independent estimate of ₹200–400 Cr for the flat-price clinic model.

**The uncomfortable arithmetic.** A facility-only business at ₹3,000–12,000 a month needs 10,000 facilities to reach ₹100 Cr ARR. That is a five-to-seven-year grind and it is not the venture path. **The venture path is the laboratory channel**, because the unit is a sample, not a seat.

### 3.3 The laboratory channel is the asymmetric one

Dr Lal PathLabs alone processed **94.5 million samples from 30.3 million patients in FY25-26**. The top ten organised labs together plausibly process 300–400 million samples a year.

| Lab channel economics | Value |
|---|---|
| Samples per large lab per year | 50–95 million |
| Price per sample for proof of delivery | ₹0.25–0.50 |
| Annual contract value, one large lab | ₹1.25–4.75 Cr |
| Cost to serve (messaging, cloud, integration) | 5–10% of revenue |
| Gross margin | 90%+ |
| What the lab buys | Liability defence, a differentiated B2B/insurer offering, fewer repeat calls |

A single lab contract is worth more than 500 clinic subscriptions. The lab also solves distribution: the lab pushes the receipt to the clinic, and the clinic's acknowledgement is the data the lab needs. That is a two-sided network with a paying side that already has the customer relationship.

This is the strategic insight the facility-only version misses: **the buyer with the most to lose is not the clinic, it is the lab that delivered a critical value to a receptionist.**

### 3.4 Unit economics

**Hospital (100 beds, ~2,000 reports/month, ~500 obligations/month)**

| Line | Value |
|---|---|
| Price | ₹12,000/month |
| Messaging (750 utility messages at ₹0.13) | ₹98 |
| Cloud and storage | ₹500 |
| Support allocation | ₹2,000 |
| Cost to serve | ~₹2,600 |
| Gross margin | 78% |
| CAC (one rep, 3 months, 6 closes) | ₹60,000 |
| Payback | ~6.4 months |
| 3-year LTV at 90% retention | ~₹3.1 lakh |
| LTV/CAC | ~5.2 |

**Clinic (solo or two-doctor, ~300 reports/month)**

| Line | Value |
|---|---|
| Price | ₹3,000/month |
| Cost to serve | ~₹900 |
| Gross margin | 70% |
| CAC | ~₹8,000 |
| Payback | ~4 months |

**Lab (50 million samples/year)**

| Line | Value |
|---|---|
| Price at ₹0.30/sample | ₹1.5 Cr/year |
| Cost to serve | ~₹15 lakh/year |
| Gross margin | 90% |
| CAC | ₹20–30 lakh (enterprise sale) |
| Payback | 2–3 months |

### 3.5 Willingness to pay: what the buyer already spends

The product does not need to create a budget. It needs to redirect one.

- **Liability.** A Delhi consumer commission ordered ₹20 lakh against a path lab for a "technical glitch". A patient is a consumer under the Consumer Protection Act 2019 (*IMA v. V.P. Shantha*, 1995). A single missed critical result that reaches a consumer forum costs more than a decade of subscriptions.
- **Accreditation.** NABH requires a critical-result intimation record and a read-back. NABL 112 sets laboratory criteria. NQAS covers 68,564 public facilities. The register is already mandatory; the product makes it true.
- **Recovered revenue.** A private clinic that recovers 22 visits a month at ₹550 each gains ₹12,100. A ₹3,000 subscription is 25% of the gain.
- **Lab differentiation.** Labs compete for corporate and insurer contracts on turnaround and quality. A verifiable delivery receipt is a sales asset, not a cost.

Price anchors: Clinizy lists ₹1,499/month, CliniKite ₹2,499/month. Eka Care is free. A closure product priced at ₹3,000 for a clinic must justify itself against free, and the justification is liability and proof, not features.

### 3.6 The three-year path

| Year | Facilities | Labs | Government | ARR (₹ Cr) |
|---|---|---|---|---|
| 1 (pilot) | 15 | 1 pilot | 1 district MoU | 0.6 |
| 2 | 120 | 2 | 3 districts | 4.2 |
| 3 | 350 | 4 | 8 districts | 13.5 |
| 5 (plan) | 2,000 | 10 | 25 districts | ~95 |

The plan is credible only if the lab channel converts. If it does not, the business is a ₹15–30 Cr niche SaaS with good margins and no venture outcome. That is the honest fork, and the validation protocol in `06-VALIDATION-PROTOCOL.md` is designed to find out within 90 days.

---

## 4. Competition

### 4.1 Teams in this same programme

A GitHub scan on 4 November 2026 found 67 repositories matching `healthathon` and a further set matching `Health-a-thon 2026`. The relevant ones:

| Team / repo | Track | What it is | Honest assessment |
|---|---|---|---|
| `psraghothamrao8/RAD-SMART` | Cancer | Radiotherapy scheduling with hard-rule planning, digital twin, live Azure deployment, Sarvam AI messaging. **Replayed 55 recorded department days: long wait 109 → 70 minutes (−35%), patients >1 hour late 22% → 6%** | **The benchmark.** Real department, real constraint, measured before/after on recorded data, doctor partner on the team, live link. This is what a winning entry looks like |
| `santhoshh005/Rounds_AI` | Cancer | Inpatient oncology copilot: on-device Whisper, Gemini Vision OCR, CTCAE v5.0 grading | Strong multimodal engineering; CTCAE grading is clinical decision support and a scope risk |
| `hannielvinu/Setu` | Cancer | Follow-up agent: find overdue patients, learn the barrier in their language, resolve it | Well-positioned, doctor-led team, live prototype. Directly occupies the follow-up thesis (T2) |
| `harsh-d58/careweave` | Cancer | Scattered records → chronological source-linked timeline | Clean; occupies the records-summary thesis |
| `SachinBudania781/oncobrief` | Cancer | One-page cited patient-journey brief | Occupies the "delta brief" thesis |
| `bhavyajain17/ONCOmitra` | Cancer | Screening → referral → treatment → follow-up, closed-loop referrals | Uses the closure language in cancer |
| **`Shrestha-ijarwal/RetinaX_Healthathon`** | **Diabetes** | **Diabetic retinopathy screening follow-up and care-loop completion; ASHA re-engagement; bilingual reminders; audit log; 12 synthetic patients** | **The closest competitor.** Explicitly non-clinical, well-aligned to the rubric. But: Flask + vanilla JS, local only, no real ingestion, no AI, reminders "not actually sent", no measured outcome |
| `devesh1905/liv2care-prototype` | Diabetes | Liver-care pathway coordination for type 2 diabetes | Clickable prototype |
| `zahidali-jannat/Health-a-thon-Project` | Diabetes | Diabetes consultation readiness | Small; the original thesis of this repo |

**What this means.** The obvious diabetes ideas are taken, and taken by multiple teams: records timeline, follow-up agent, care-loop dashboard. A better-executed version of a taken idea does not win; it confirms the judges' sense that the category is crowded. The winning entry must be *recognisably different in unit and artefact*, not merely better in execution.

RAD-SMART also sets the evidentiary bar: a measured before/after on recorded operational data. Any entry that shows only a seeded demo will look weaker by comparison.

### 4.2 Incumbents

| Player | Position | Threat level | Why |
|---|---|---|---|
| Eka Care | Free EMR, ABDM rails, EkaScribe voice, patient engagement, $19.5M raised | High | Can bundle recall and documentation; free tier compresses price |
| HealthPlix | 14,000–15,000 doctors, H.A.L.O. ambient voice-to-prescription in ~20 languages, CDS | High | Voice documentation already shipped; large installed base |
| Practo Ray | 50,000+ doctors, appointments, EMR | High | Distribution |
| Clinizy | Clinic OS with recall, billing, pharmacy, lab at ₹1,499/month | Medium | Recall is commoditised at the low end |
| CliniKite | Order → sample → report → reviewed → shared status at ₹2,499/month | Medium | Already sells a report-status loop, but inside one lab's flow |
| Lifemaan | Hospital CRM, WhatsApp reminders, recall and referral tracking, 576+ hospitals claimed | Medium | Recall/referral in CRM form |
| Yuktii | Free diabetes clinic software with structured recalls | Medium | Free tier kills flat recall pricing |
| Vitaloop | AI voice recall for lapsed lab patients, pay-on-return | Medium | Validates lab-funded recall; potential partner or competitor |
| Healthray, OneCity, Delpheon | LIMS with critical alerts, NABL/ISO 15189 workflows | Medium | Critical alerts exist inside the lab; no cross-source clinic closure |
| SaathiMed | "Closed loop" clinical intelligence for Indian primary care | Low–Medium | Same language, early stage |
| Global: Epic/Cerner results inbox, Navina, Abridge, Suki, Phreesia, Klara | Category proof | Low in India | Not built for paper, WhatsApp or shared phones |

### 4.3 The white space, stated precisely

Critical-value alerting exists **inside a laboratory**. Recall exists **inside a clinic CRM**. Neither owns the space between them.

> **No one owns the cross-source, clinic-side proof that a specific abnormal result was seen by a named clinician and communicated to a specific patient, with an artefact the clinic can defend and the patient can verify.**

Three properties make that space defensible rather than merely empty:

1. **It is a standard, not a screen.** If labs issue the receipt and clinics acknowledge it, the format becomes the thing both sides conform to. Standards have switching costs.
2. **It compounds.** Every acknowledgement teaches the escalation model which patients respond, on which channel, at which hour. That hazard model is not in any EMR.
3. **It is bought by the party with the liability.** The lab and the hospital quality head have a budget line for risk. The doctor has a budget line for time. Both are addressed by one artefact.

### 4.4 Why the rejected theses were rejected

| Rejected thesis | Reason |
|---|---|
| Ambient clinical documentation | Already shipped by HealthPlix H.A.L.O. (~20 languages) and Eka EkaScribe; open-source Vaidya exists. Model quality is owned by Sarvam and the EMRs. No defensible wedge for a five-person team |
| Records timeline / cited brief | Built by CareWeave and oncobrief in this same programme. Extraction is commoditising; the artefact is a summary, not an obligation |
| Chatbot over records | Demo-friendly, low willingness to pay, high hallucination risk, and clinical interpretation is out of scope |
| Diabetic retinopathy screening AI | Clinical interpretation, device risk, crowded; RetinaX already owns the operational slice |
| Risk scoring / triage / deterioration prediction | Explicitly out of scope; CDSCO device risk; ethically fraught |
| Full EMR / clinic OS | Practo, Eka, HealthPlix and Clinizy own it |
| Patient consumer app | Low retention, low willingness to pay, wrong buyer |

### 4.5 Why now

1. **Volume.** 101.3 million diabetics, 136 million prediabetics, and a complication burden that is measured in decades.
2. **The quality standard is already enforceable.** NABH's critical-result register requirement and NABL 112 are live. NQAS covers 68,564 public facilities. The buyer does not need a new rule; they need a true register.
3. **The liability clock has started.** Consumer commissions are awarding against labs and hospitals for communication failures; a ₹20 lakh order for a "technical glitch" is a public data point.
4. **The regulatory lane is clear.** The CDSCO Medical Device Software guidance (Circular F.No. MED-16028/2/2025-eOffice, 21 July 2026) keeps scheduling, communication and record transport outside device scope, while a risk score or triage flips it. That is a design constraint and a moat against clinical-AI competitors.
5. **The DPDP clock is running.** The DPDP Rules 2025 were notified on 13 November 2025; substantive duties commence 13 May 2027. Consent, notice, retention and audit become mandatory. A product that produces audit as a by-product is easier to adopt than a bolt-on.
6. **The channel is cheap.** WhatsApp utility messages cost ₹0.115–0.13; Sarvam Samvaad runs voice agents in 11 Indian languages and is being deployed by state governments. Escalation in the patient's language is now affordable at the margin.
7. **The incumbents are EMR-first.** They are optimising the record and the front door. The unowned obligation is not their centre of gravity.

---

## 5. What the product must be (requirements derived from the evidence)

The evidence constrains the design more than any framework does. Nine requirements follow directly:

1. **Ingest the artefact the clinic actually has** — a PDF, a photo, a WhatsApp forward, a printed slip, or a lab feed. Not an HL7 interface that does not exist.
2. **Name the role, not just the event.** "Informed" must mean a named clinician, a named nurse, or a named clerk, with a read-back for criticals.
3. **Clock the outpatient.** The failure concentrates after the patient leaves. The clock must run out of hours, and the escalation must be able to reach a person who is not in the building.
4. **Abstain on identity.** A wrong-patient closure is worse than no closure. The system must hold ambiguous matches for a human and say why.
5. **Prove it without exposing it.** The receipt must be verifiable by a third party (a lab, an insurer, a patient) without revealing the clinical value.
6. **Escalate under scarcity.** A clinic has one nurse, not a call centre. The order of calls is a resource-allocation problem, not a list.
7. **Work on a shared phone.** One device, multiple staff, shift changes. The audit must survive a handover.
8. **Produce the register as a by-product.** The NABH/NABL export must be a button, not a project.
9. **Never interpret.** The lab's flag is the only source of criticality. No score, no triage, no advice.

Requirements 2, 4, 6 and 7 are where the technical depth lives, and they are the basis of the patent analysis in `05-PATENT-DOSSIER.md`.

---

## 6. The technical core

The product is not a chatbot and not a model call. It is a system with five mechanisms, each of which has a measurable property. This section states them precisely; the build plan is in `04-IMPLEMENTATION-PLAN.md` and the IP position in `05-PATENT-DOSSIER.md`.

### 6.1 Obligation extraction with risk-controlled abstention

**Problem.** A lab report is a photograph, a PDF from one of five labs, or a printed slip. Extraction will be wrong. The product must decide, per field, whether it is safe to create an obligation automatically.

**Method.** For each obligation class *c* (critical, abnormal, normal) and field *j*, the extractor produces a confidence score `s_j`. Choose a threshold `τ_c` on a calibration set so that the empirical false-extraction rate `R_c(τ)` is controlled at a level `α_c` with a finite-sample guarantee. The guarantee is obtained by a fixed-sequence testing procedure over classes (Learn-then-Test; Angelopoulos et al., 2021), which is valid under exchangeability and does not require a parametric model.

**The risk weighting is the novel part.** A uniform `α` is wrong, because a missed potassium and a misread lipid do not carry the same harm. Define a harm weight `H(c)` and a total risk budget `B`. Choose `{α_c}` to minimise the expected abstention rate subject to

```
Σ_c  H(c) · R_c(α_c)  ≤  B
```

The optimum allocates the risk budget to the classes where an additional unit of risk buys the largest reduction in abstention; with a monotone risk curve, that implies tighter thresholds for high-harm classes, and the simple approximation `α_c ∝ 1/H(c)` is a useful starting point rather than an exact Lagrangian solution. In practice, a greedy allocation over classes ordered by harm is simpler and auditable. The consequence is a system that abstains aggressively on critical analytes and accepts more on routine ones — the opposite of a uniform confidence threshold.

**Why it matters.** At the current unfamiliar-layout complete-field rate of 0.24, a product that pretends to automate is a liability. A product that abstains and hands the desk a highlighted span is honest, and its abstention rate is a number the buyer can see.

### 6.2 Household-aware identity resolution

**Problem.** In India a phone number is often shared by a household. Standard record linkage treats a phone agreement as strong evidence. In a household of five, it is weak, and a wrong-patient closure is catastrophic.

**Method.** A Fellegi–Sunter model over name (Indic phonetic key), year of birth, sex, address tokens and phone. For a phone shared by `k` persons, the non-match agreement probability is not `u` but approximately `k·u`, so the agreement weight becomes

```
w_phone = log(m / (k·u)) = log(m/u) − log k
```

**The phone's evidential weight is discounted by the log of the household size.** This is a one-line result with a large consequence: it is the difference between merging a family's records and asking a human.

The posterior is `P = σ(w_0 + Σ_j w_j)`. Abstain when `P ∈ (p_low, p_high)`, with `p_high` chosen so that the expected number of false accepts per 10,000 bindings is below one, and `p_low` chosen so that false rejects are rare. The review queue is ordered by expected information gain: which field, if verified, most reduces the posterior entropy per second of review.

**Evaluation.** A synthetic namesake set (same name, different person, shared phone) plus 200 real de-identified registrations. Metrics: precision at the auto-accept threshold; review rate; wrong closures (target zero); seconds per review.

### 6.3 Capacity-constrained escalation

**Problem.** A clinic has one nurse and forty open obligations. Which call first? FIFO and criticality-first ignore the fact that patients differ in how likely they are to answer, and that an attempt changes the state of the obligation.

**Model.** Each obligation is a restless arm with state `(a, T)`: `a` attempts made, `T` slots remaining to the deadline. The hazard `h(a)` is the probability of a response on attempt `a+1`, estimated from censored outreach data with a hierarchical Beta-Binomial over `(obligation class, channel, hour bucket)`, so a new clinic inherits a prior and refines it.

**Index.** For the two-state case with constant per-play success probability `p` and `T` slots:

```
V(0) = 0
V(T) = max{ p + (1−p)·V(T−1) − λ ,  V(T−1) }
λ*(T) = p·(1 − V(T−1))
```

`λ*(T)` is decreasing in `T`: the index rises as the deadline approaches, which is the correct urgency ordering. The policy is indexable in this case, and when all hazards are equal it reduces to earliest-deadline-first, which is optimal for deterministic deadlines.

For the multi-attempt case, compute the index by dynamic programming over `(a, T)`:

```
V(a,0) = 0
V(a,T) = max{ h(a+1) + (1−h(a+1))·V(a+1,T−1) − λ ,  V(a,T−1) }
```

and solve for the `λ` at which the two branches are equal. Indexability for the multi-attempt case is conjectured under a monotone-hazard condition and will be checked by simulation before it is claimed in a paper. The honest statement for the pitch is: **the two-state case is proved; the multi-attempt case is a well-founded heuristic with a simulation.**

**Allocation.** Each epoch (15 minutes), sort by index and assign the top `C` to the available capacity. Re-plan on any resolution.

**Evaluation.** A simulator with 500 obligations/day, heterogeneous hazards and three nurses, comparing FIFO, EDF, criticality-first and the index policy on weighted on-time closure. Report the lift and the sensitivity to hazard misspecification.

### 6.4 Tamper-evident receipt

**Method.** A per-obligation hash chain over canonical event payloads:

```
h_j = SHA-256( h_{j−1} ‖ canonical_json(p_j) )
```

The head is anchored daily to an external timestamp (RFC 3161 TSA, or a signed digest mailed to the quality head). A **capability receipt** is an Ed25519-signed projection `{obligation_id, roles, times, h_n}` that a third party can verify without learning the analyte or the value.

**Threat model, stated honestly.** The chain detects silent edits and deletes by an insider, an application bug or the vendor. It does **not** detect a compromised signing key, collusion at creation, or an event that was never recorded. The anchor is what turns "tamper-evident against an application bug" into "tamper-evident against the database owner". Without it, the claim is weaker than a judge will assume, and the pitch must say so.

### 6.5 Causal evaluation

The pilot is a 12-facility stepped-wedge cluster randomised trial, four periods of four weeks, with the primary outcome being the closure rate at 72 hours. The analysis is a mixed-effects logistic regression with a facility random intercept and a period fixed effect, cluster-robust standard errors, pre-registered on CTRI. The power calculation, the kill criteria and the pre-registration template are in `06-VALIDATION-PROTOCOL.md`.

### 6.6 What we deliberately do not model

- No diagnosis, no treatment selection, no risk score, no deterioration prediction, no triage.
- No inference that a test was not done from the absence of a record.
- No model-derived criticality; the lab's flag is copied.
- No patient-level clinical advice in any message.

These are not only regulatory constraints. They are what makes the system auditable: every claim is a fact about a document, a person, a role or a time.

---

## 7. Regulatory position

The full map is in the repository's `docs/research/2026-11-03-strategy/07-india-regulatory-map.md`; this section states the position the product must be able to defend.

| Instrument | What it requires | What the product does |
|---|---|---|
| **DPDP Act 2023 and DPDP Rules 2025** (notified 13 Nov 2025; substantive duties 13 May 2027) | Consent or legitimate use; itemised notice; purpose limitation; retention of at least one year; breach reporting; grievance within 90 days; processor contract | The clinic is the fiduciary, the product is the processor. Consent is captured per patient with version, language and channel. The public verifier reveals only roles and times. Logs are retained for at least one year |
| **CDSCO Medical Device Software guidance** (Circular F.No. MED-16028/2/2025-eOffice, 21 July 2026; Doc CDSCO/MD/GD/MDSW/01/2026) | Software with a medical purpose is a device; scheduling, communication, record transport are outside | No diagnosis, no risk score, no triage, no treatment recommendation. The lab flag is copied, never computed. The pitch never claims an outcome |
| **NABH hospital standards** | Critical-result intimation record; read-back to confirm understanding | The register and the read-back are produced as by-products |
| **NABL 112 / ISO 15189** | Laboratory critical-value reporting criteria | The lab-side code and the delivery receipt support the lab's own obligation |
| **NMC Telemedicine Guidelines 2020** | Clinical advice by a registered practitioner under conditions | No clinical advice is generated; a red-flag phrase creates an administrative callback task |
| **IT Act s.43A, SPDI Rules, CERT-In directions** | Reasonable security; 6-hour incident reporting; 180-day logs in India | Incident playbook; India-resident logs |
| **Consumer Protection Act 2019** | A patient is a consumer; a communication failure can be negligence | The receipt is the clinic's evidence; a ₹20 lakh award against a lab for non-delivery of a report is the public data point |

### 7.1 The liability paradox

The doctors' panel raised the sharpest objection in the pack: an append-only record that shows a critical flagged at 08:50 and acknowledged at 18:42 is a plaintiff's exhibit, and the doctor's tap is an admission that she saw it. A product that makes the institution safer can make the individual doctor more exposed.

The design answer is threefold:

1. **The clock belongs to the institution until a human accepts custody.** It does not start against a named doctor because a report landed while she was in theatre.
2. **The receipt records the review as a clinical act, not a confession of delay.** It shows when the clinician was presented, when she saw it, and why any pause occurred. The pause reason is part of the record, not an exception to it.
3. **The nurse can acknowledge receipt and record the communication on the clinician's behalf.** The clinician's confirmation attaches only when she confirms she has seen the value.

A product that marks a doctor overdue for a report she never received is a noose, and she will route around it. A product that gives her a timestamp she can defend is a shield, and she will ask for it.

### 7.2 The evidence question

A tamper-evident receipt is evidence. Evidence can cut both ways. Before a pilot contract, counsel should confirm:

- Whether the receipt is discoverable, and in what form.
- Whether the pause-reason field creates an adverse inference if it is empty.
- Whether the public verifier's "valid" response could be read as a clinical assurance.
- Whether the clinic's consent notice covers the audit trail and the lab's access.

This is a 2–3 hour legal review, not a programme.

---

## 8. What would change the conclusion

The thesis is falsifiable, and the falsifiers are cheap.

| If this is true | Then | Test |
|---|---|---|
| The baseline unowned rate is below 20% and the critical-only rate is below 50% | There is no problem worth a company | 300-report audit |
| No quality head will pay, and no lab will print the code | There is no buyer and no channel | 10 interviews, 3 paid offers, 2 lab conversations |
| The doctor will not accept even a one-tap surface | The product is a compliance chore, not a clinical tool | Time-and-motion on 10 criticals |
| Extraction at 0.24 complete-field makes the desk slower than the paper | The intake is the bottleneck, not the closure | Clerk seconds per report |
| An incumbent already sells the exact cross-lab receipt at the pilot site | The white space is closed | 2 lab/HIS conversations |
| The audit trail increases the doctor's liability more than it protects her | The product is rejected by its own user | 5 doctor interviews on the attribution model |

If the first two fail, stop. Do not build more software. The honest fallback is a services-led records workflow, which is a good business and not a venture-scale one.

---

## 9. Summary

The evidence supports one narrow, non-obvious, non-clinical problem with a real market and a defensible artefact:

> **A clinical intention in Indian diabetes care has no operational owner, no clock and no proof. The result is the highest-frequency instance. The receipt is the artefact. The lab is the channel. The doctor is the user. The quality head is the buyer.**

The product is not an EMR, not a chatbot and not a diagnostic. It is the proof layer that sits over the records the clinic already has. It wins the programme because it is assistive, measurable, multilingual, print-first, human-overridden and auditable by construction. It can become a company because the artefact can become a standard, and the standard is bought by the party with the liability.

The next document is the panel's judgment. It is deliberately harsh.

---

## Appendix: sources

**Critical results and follow-up**

- Agarwal R, Chhillar N, Tripathi CB. Evaluation of the effectiveness of critical result notification protocol of biochemistry laboratory at a tertiary care hospital. *Indian J Clin Biochem.* 2015;30(1):89–93. [PMC4310845](https://pmc.ncbi.nlm.nih.gov/articles/PMC4310845/) — 1,187 critical values; 64.61% notified 30–120 min; 25.77% to a clinician; 52.90% to nursing staff; 92 never notified, 83 of them outpatients (90.21%); only 37.21% of outpatient criticals notified.
- Callen J, et al. Failure of a web-based patient safety reporting system. *J Gen Intern Med.* 2012. DOI [10.1007/s11606-011-1949-5](https://doi.org/10.1007/s11606-011-1949-5) — systematic review: 6.8%–62% of abnormal ambulatory results not followed up.
- Thieme. Evaluation of the effectiveness of critical result notification protocol. 2023. [PDF](https://www.thieme-connect.de/products/ejournals/pdf/10.1055/s-0043-1775573.pdf) — 86.8% notified within 1 hour; 10.7% unsuccessful.

**Diabetes burden and complications**

- Anjana RM, et al. Metabolic non-communicable disease health report of India: the ICMR-INDIAB national cross-sectional study. *Lancet Diabetes Endocrinol.* 2023. PMID 37301218 — 101.3 million with diabetes; 136 million with prediabetes.
- Prevalence of diabetic retinopathy in India: National Survey 2015–19. *Indian J Ophthalmol.* 2021. [PMC8725073](https://pmc.ncbi.nlm.nih.gov/articles/PMC8725073/) — 4,522 known diabetics aged 50+; 6.3% had a retinal examination in the past year; 89.9% had never had one; DR prevalence 16.9%.
- Puducherry diabetic retinopathy follow-up cohort. *Indian J Ophthalmol.* 2017. [PMC5565887](https://pmc.ncbi.nlm.nih.gov/articles/PMC5565887/) — 50.5% "eyes okay", 41.0% no attender, 38.6% cost; 26% progressed to vision-threatening disease.

**Follow-up and reachability**

- Chennai RNTCP contact audit. *BMC Infect Dis.* 2018. [PMC5872574](https://pmc.ncbi.nlm.nih.gov/articles/PMC5872574/) — 60.4% legible phone; 16.4% complete address; 11.2% trackable by both; OR 4.5 for loss to follow-up with missing contact.
- Punjab public hypertension follow-up study. *J Clin Hypertens.* 2021. PMID 33458931 — 50–60% missed scheduled follow-up; reasons no symptoms 24.8%, distance 22.3%, no instructions 15.3%.
- Seoni district hospital quality-improvement study. *BMJ Open Quality.* 2025. [PMC11831276](https://pmc.ncbi.nlm.nih.gov/articles/PMC11831276/) — missed visits 66% → 22% in nine months with ASHA home visits and record triangulation, no app.

**Regulation**

- Digital Personal Data Protection Act 2023 and DPDP Rules 2025, G.S.R. 846(E), 13 November 2025. Substantive duties 13 May 2027.
- CDSCO Guidance Document on Medical Device Software, Doc No. CDSCO/MD/GD/MDSW/01/2026, Circular F.No. MED-16028/2/2025-eOffice, 21 July 2026.
- NABH Hospital Infection Control / terminology guide: critical-result intimation record and read-back. [NABH](https://nabh.co/wp-content/uploads/2025/01/B.-HIB_GUIDE-03_List-of-Terminologies.pdf).
- NABL 112: Specific Criteria for Accreditation of Medical Laboratories. [NABL](https://www.nabl-india.org/).
- NMC Telemedicine Practice Guidelines, 25 March 2020.
- CERT-In Directions, 28 April 2022; IT Act 2000 s.43A; SPDI Rules 2011.

**Market and institutions**

- Ministry of Health and Family Welfare, Rajya Sabha reply, 24 July 2026: 68,564 public health facilities NQAS-certified, including 452 district hospitals and 383 sub-district hospitals. [Sansad](https://sansad.in/getFile/annex/271/AU2679_PHr6Sk.pdf).
- NABH-accredited CGHS-empanelled facilities: 1,324 in 89 cities, including 837 hospitals, 72 diagnostic centres, 258 eye centres. [CGHS directory](https://cghshospitals.com/accreditation/nabh).
- Times of India, January 2026: ~80,000 hospitals in India, ~4,000 fully NABH-accredited. [TOI](https://timesofindia.indiatimes.com/city/hyderabad/effective-ppps-can-bridge-gaps-in-healthcare-delivery-nabh/articleshow/127808434.cms).
- Rural Health Statistics 2022–23: 31,882 PHCs, 6,359 CHCs, 1,340 SDHs, 714 district hospitals.
- Lok Sabha reply, November 2024: 13.6 lakh registered allopathic doctors.
- Dr Lal PathLabs FY25-26: 94.5 million samples, 30.3 million patients. [Annual report](https://www.bseindia.com/xml-data/corpfiling/AttachHis/c5a19268-920d-4aea-ab34-1f70d8f0a847.pdf).
- India diagnostics market ~US$10B FY21; ~3% of labs NABL-accredited; 46% unorganised standalone labs. Industry reports, grade C.

**Liability**

- Delhi State Consumer Disputes Redressal Commission: ₹20 lakh against a path lab for non-delivery of a report attributed to a "technical glitch". [IML India](https://imlindia.com/blog/inr-twenty-lakh-fined-for-a-technical-glitch).
- *Indian Medical Association v. V.P. Shantha* (1995): a patient is a consumer under the Consumer Protection Act.

**Technology references**

- Fellegi IP, Sunter AB. A theory for record linkage. *JASA.* 1969.
- Whittle P. Restless bandits: activity allocation in a changing world. *J Appl Probab.* 1988.
- Weber RR, Weiss G. On the indexability of restless bandits. *Ann Appl Probab.* 1990.
- Angelopoulos AN, Bates S, et al. Learn then test: calibrating predictive algorithms to achieve risk control. arXiv:2110.01052, 2021.
- Vovk V, Gammerman A, Shafer G. *Algorithmic Learning in a Random World.* Springer, 2005.
- Hussey MA, Hughes JP. Design and analysis of stepped wedge cluster randomized trials. *Contemp Clin Trials.* 2007.

**Programme**

- Health-a-thon 2026, Koita Foundation and KCDH, IIT Bombay: [healthathon.reskilll.com](https://healthathon.reskilll.com/); tracks, scope, design bar and dates extracted 3 November 2026.

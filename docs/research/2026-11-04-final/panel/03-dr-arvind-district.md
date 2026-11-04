# Dr. Arvind Kumar — scorecard

**Judge profile.** Medical Officer, NCD clinic, 100-bed district hospital, Tier 3, central India. NQAS-certified; preparing for NABH entry-level. Two NCD clinic days per week, 60–90 diabetic patients per day, one staff nurse, two block ASHA coordinators, a paper register, one shared department WhatsApp number, a lab that sends PDFs or a printed sheet. No EMR. My clinic counts below come from my own register, not from a study.

## Stance (one line)

T1 wins, and it is the only one of the five I would fight to get into my hospital — but only if it is built to be fed by a photograph and printed on paper, and only if its night-time escalation is by a ringing phone and not by a login; as currently described it would be quietly abandoned in six weeks.

## Scores

| Thesis | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | TOTAL |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 Closure Ledger | 9 | 9 | 6 | 7 | 7 | 8 | 7 | 9 | 7 | 76 |
| T2 90-Day Recheck | 8 | 7 | 6 | 4 | 5 | 9 | 7 | 8 | 7 | 67 |
| T3 Annual Review Pack | 9 | 9 | 6 | 6 | 6 | 7 | 7 | 8 | 6 | 71 |
| T4 Bag Reconciliation | 6 | 6 | 4 | 3 | 8 | 5 | 6 | 6 | 4 | 52 |
| T5 Identity Firewall | 7 | 7 | 4 | 6 | 8 | 6 | 5 | 9 | 4 | 61 |

Dimension keys: 1 problem reality/frequency (15) · 2 failure cost/urgency (10) · 3 buyer and willingness to pay (15) · 4 defensibility (15) · 5 technical depth and honest AI (10) · 6 programme rubric fit (15) · 7 India scale, Tier 1/2/3/rural (10) · 8 regulatory and ethical safety (5) · 9 demo-ability (5).

Where I scored hard and why: dimension 3 is 6 or below for four theses because **I cannot buy software**. My hospital has no SaaS budget line, no signing authority for a cloud data-processing agreement, and no procurement route for a ₹5,000/month subscription that does not go through a sanction or a tender. A thesis that scores high on 3 is selling to a private clinic owner, not to me. Dimension 7 is where T1 loses most: the product is EMR-free, but it still needs an *uploader*.

## Why the winner wins (top 3 reasons, evidence-backed)

**1. It is the only thesis whose unit is literally my stated fear, and the frequency is not theoretical.**
My NCD register carries about 2,300 patients and my clinic generates roughly 130 lab reports a week — around 5–8 arriving on any working day, 25–30 on a clinic day, because patients bring old reports for review. They arrive as `REPORT(3).pdf` or `IMG-20261014-WA0012.jpg` on a shared department phone with no patient thread. Brief §5 #3 and #4 say the notification failure is real even where someone is trying: 10.7% of critical notifications unsuccessful in a tertiary biochemistry lab, and 64.61% of critical values notified 30–120 minutes after sample arrival with **outpatient notification the weak point**. #5 puts abnormal-result non-follow-up at 6.8%–62%. My own version of that number is not measured, and that is the point: I cannot tell a surveyor, a patient or a lawyer which of last month's abnormal creatinines were seen. T1 is the only thesis whose output answers that question by name.

**2. It produces my next accreditation evidence as a by-product, and it replaces work rather than adding it.**
Brief #10 states NABH requires a critical-result intimation record and a read-back to confirm understanding; the regulatory map in this repo notes that for an accredited facility "the product's audit trail becomes survey evidence". I am already paying for that evidence in staff time and in surveyor findings. T1's CSV register export and closure receipt are the same artefact the survey samples — but only if they print. A register that exists only behind a vendor login is worth nothing in a district hospital survey; a printed page in a file is worth everything. This is the single cheapest reason to prefer T1 over T3: T3 also produces programme evidence, but it needs other providers to stamp it, and my ophthalmologist comes once a week.

**3. It is the only thesis that survives my constraints without new staff, an EMR or a patient smartphone.**
Input is a photograph of a printed sheet. Output is a printed register and a paper slip. The patient's phone is optional — which matters, because #6 says only 60.4% of patients have a legible phone number and 16.4% a complete address, so 4 in 10 of my patients cannot be reached by any channel the other four theses assume. The doctor's interaction is a six-name list, not a dashboard. T1 also absorbs T5's identity work as a feature, which is the right place for it: I would never buy identity resolution separately, but I need it every single day.

## Fatal flaw of each thesis (one line each)

- **T1 — Closure Ledger.** The upload step has no owner in a hospital where nobody has a spare 30 minutes, and the "named clinician is assigned" model is wrong at 2 a.m., when the doctor on call is not the doctor who ordered the test; if the input is manual and the night path needs a login, it becomes a compliance register nobody feeds.
- **T2 — 90-Day Recheck.** It needs a caller I do not have — two block ASHA coordinators supervise ASHAs, they do not sit in my OPD and cannot absorb 300 calls — and #8 shows the intervention that actually worked in a district hospital (Seoni, 66%→22% missed visits) was ASHA home visits plus record triangulation *with no app*, so software here is optional overhead unless it is the ledger behind that visit, not a new channel.
- **T3 — Annual Review Pack.** It requires many providers to stamp a pack, and in my district the ophthalmologist visits weekly at best and the nephrologist is 120 km away, so the completion path is broken exactly where the bundle (#2: 89.9% of diabetics who knew their diagnosis had never had a retinal exam) matters most.
- **T4 — Bag Reconciliation.** It asks for 60 seconds from a doctor who has four minutes per patient, and it mis-identifies the artefact — in a public hospital the longitudinal record is the dog-eared OPD card in the medical records room, not a plastic bag — and one bad OCR moment in front of a patient destroys trust permanently, which is a cost the rubric does not price.
- **T5 — Identity Firewall.** It is invisible and unbuyable from my chair: no budget, no IT department, no felt pain at the point of purchase, and its best asset (identity under shared family phones) is worth more inside T1 than as a standalone company.

## The seven questions, answered as the government doctor

### 1. Which of these survives a district hospital — no EMR, patchy internet, one shared phone, staff turnover, months-long procurement?

**T1, and only T1, and only in a specific build.** The test I apply is: what does this need that I do not have?

| Constraint | What it actually looks like here | Which thesis survives |
|---|---|---|
| No EMR | My record is a paper OPD card and a register; there is no patient list to integrate with | T1 (photo in, print out), T3 (paper pack). T5 needs an integration footprint I do not have |
| Patchy internet | The router is not always on the generator circuit; the lab's own analyser PC is the only reliable machine | Only an offline-capable, print-first build of T1 or T3 |
| One shared phone | One number for the department; it goes home with whoever closes the room | None as designed — all five assume a notification reaches a named person |
| Staff turnover | The NCD clerk is on contract and gets transferred; the new one gets no training | Only a build whose output any clerk can read on paper. The register survives transfers; a login does not |
| Procurement | No budget line. A subscription is not a permissible object head | None, until it is sold to the state or the DHS, not to me |

T2 dies on the caller. T4 dies on doctor time. T5 dies on the missing integration. T3 survives the constraints but not the specialist. T1 survives if and only if the upload is a photograph taken by the person who already files the paper reports, and the output is a printed page.

### 2. Who in my hospital actually does the work, and do they have the time?

The honest staffing table, and the time each person actually has:

| Person | Real availability | Marginal minutes per patient | Can they absorb a new step? |
|---|---|---|---|
| Me (NCD MO) | 2 days/week, 4 min/patient | ~0 | Only a 60-second list at the start of clinic. Nothing per-patient |
| Staff nurse (one, shared with dressing and injection room) | Already does BP, weight, sugar for every patient | ~0 | Only the "did you tell the patient" tick, at the end of a visit already happening |
| NCD clerk / statistical clerk (contract, often shared) | Register line per patient, files paper reports | ~1–2 min | **This is the only person who can own upload.** 30 s/report × 30 reports on a clinic day = ~15 min. Feasible |
| Two block ASHA coordinators | Not in my OPD. They supervise ASHAs across the block | ~0 | A short monthly worklist only. Not a daily call queue, not 300 patients |
| Lab technician (1–2) | Runs the analyser, prints, hands over | ~0 | Can *send*, cannot chase. And the lab is a separate fiefdom with its own NABL register |
| Quality manager (additional charge, senior nurse or MO) | A few hours a week, and owns the NABH file | n/a | **This is the real internal champion and the export owner** |
| Medical Superintendent / CMHO | Signs, does not operate | n/a | Approval only |

Two consequences. First, **T1's only viable operator is the clerk plus the quality manager**, and the doctor's entire interaction must fit in 60 seconds at the start of clinic. Second, **T2 has no operator at all in a government hospital** — there is no front desk, no dedicated caller, and the ASHA coordinators are block-level supervisors, not a call centre. T3's operator is the nurse at the annual visit, which is plausible for the checklist but not for the stamps. T4's operator is me, and I have nothing to give.

### 3. What does the NQAS/NABH survey actually ask for, and which product produces that evidence as a by-product?

I have been through assessments twice, so I will describe what the assessor does rather than cite clause numbers, which I cannot verify. The survey is three things: **documents for the last three months, observation, and interviews.** The assessor samples five to ten cases and says "show me the record". For laboratory and critical-value requirements, what is asked is a documented policy, a register with patient name, value, date, time, who was informed and who received it, and evidence of read-back. For the NCD clinic, it is registers, referral records and follow-up records. NABH entry-level asks the same question in a lighter form: is there a documented process, and is it followed.

Two things follow that a product team usually misses:

- **The staff interview matters as much as the file.** The assessor asks my nurse, not me, "what do you do if a potassium comes back at 6.8?" If she cannot answer, the file does not save me. A product that puts a one-page script on the wall and makes the nurse able to answer is worth as much as the dashboard.
- **The artefact must be printable and must exist when the software is down.** A district hospital surveyor accepts a printed register in a file. "Sir, it is on the cloud, the login is with the vendor" is a finding.

So: **T1 produces the critical-alert and read-back register by-product, and only T1 produces the staff-script by-product at the same time.** T3 produces NCD/programme bundle evidence, which is real but is sampled more lightly. T2 produces a follow-up register, also real but lighter. T4 and T5 produce nothing the surveyor asks for — T5's audit trail is valuable to the lab's NABL file, not to my hospital file.

### 4. Would I buy it, or ask the state to buy it? What is the realistic route?

**I cannot buy it.** Not "would prefer not to" — I have no route. There is no software object head in a district hospital budget, a recurring subscription needs a sanction, and anything above a small quotation goes to a tender I do not control. I also cannot sign a cloud data-processing agreement on my own; with the DPDP Rules substantive duties from 13 May 2027 (brief #12) that goes to the state legal and IT cell, which adds months.

The realistic routes, in order of speed:

1. **District Health Society untied funds, one facility, one page.** The CMHO signs a short MoU, the quality manager is the named owner, the pilot runs 60–90 days on a defined KPI. Fastest referenceable customer; annual and non-renewable, and it dies if the champion is transferred. This is where a 5-person team should start.
2. **State NHM / NPCDCS programme budget.** The state NCD officer is the buyer, priced per facility per year, eventually a rate contract. This is the only path to 452 district hospitals. It also means a tender, L1 pricing against a spec written around an incumbent, and a payment cycle the strategy note itself puts at 3–12 months, with the vendor floating the cost.
3. **The lab pays, not the clinic.** Under NABL the lab carries its own critical-value obligation. A private lab network will pay for delivery proof if a clinic chain demands it. That is the honest commercial wedge, and it does not require me to have a budget.
4. **CSR or a foundation grant** to the district for a named programme. Real money, not a business.

What I will not do, and what will kill a Tier 1 sales motion here: put patient identifiers on a vendor server without state IT sign-off. **An on-premise single-box deployment option is not a nice-to-have — for a government facility it is the difference between a deal and a dead file in the IT cell.**

### 5. What happens at 2 a.m. when the doctor on call is not the doctor who ordered the test?

Concretely: a potassium of 6.8 comes back at 1:50 a.m. from a sample drawn in my clinic the previous morning — delayed because the analyser was down or the report was printed and never collected. The single night-duty lab technician is also running casualty samples. He calls the ward extension. If nobody picks up within a minute he writes it in his register and goes back to work. The duty medical officer is a contractual MBBS on a three-night rotation, has never met this patient, and does not know the NCD register exists. My name is on the order and I am asleep 40 km away with the phone on silent.

This is the sharpest test in the whole brief, and the honest verdict is: **T1 is the only thesis that can even be built to pass it, and its current design fails it.** "A named clinician is assigned" is exactly the wrong primitive at night. The requirements I would impose:

1. **Role-based on-call at night, not named-clinician.** The obligation reassigns to whoever holds the on-call role, with the ordering doctor notified asynchronously.
2. **A ringing phone with IVR acknowledgement ("press 1"), not a push notification and not a login.** Nobody at 2 a.m. is going to find a password.
3. **A time-stamped sequential escalation:** on-call MO → nurse-in-charge → ordering doctor at 8 a.m. — each with who was called and when.
4. **An "unowned after hours" bucket that appears on my 8 a.m. list.** The genuinely dangerous case is the result that lands after the clinic closes and belongs to nobody. That bucket is the product's real safety property.
5. **It must never sit in front of the lab technician's existing phone call.** A product that adds a step at 2 a.m. is bypassed the first night and abandoned the first month.

T5 fails at 2 a.m. for a different reason: an abstention queue has no night-shift owner, so "we correctly declined to match" becomes silence. T2, T3 and T4 are simply irrelevant at that hour, which is honest but is also why they do not answer my fear.

### 6. What is the rural/Tier 3 failure mode a Tier 1 product team will miss?

The ones I would bet money on, in order:

1. **The shared phone *is* the identity, and it goes home at night.** One number, one handset, no per-user login anyone will use. A notification "reaches the department" and is read by whoever holds the phone — or by nobody, because it is charging in someone's bag. Any design that assumes notification equals acknowledgement is wrong from the first day.
2. **The report is a photograph of a printed sheet, often a multi-patient sheet cut with scissors.** No text layer, no patient ID, no useful filename, sometimes a fading dot-matrix ribbon, shot at an angle under tube light with a hand shadow across the reference range. The internal audit's 0.24 complete-field on an unfamiliar layout is closer to my reality than the 0.88 on the synthetic corpus, and a human will key three fields from most sheets.
3. **Identity is name + father's name + village.** No DOB, no unique ID, and the phone belongs to the husband or the brother. A 20–30% identity-hold rate is normal, not an exception, and the hold queue needs a person and a rule.
4. **The output must be legible without the product.** The paper register survives a clerk transfer because any clerk can read it. A hash-chained receipt that only the vendor's app can render is not a register. This is the single biggest thing a Tier 1 team will get wrong: they will build a beautiful verification page and forget that the surveyor, the CMHO and the lawyer all want paper.
5. **Every new step is unpaid work, and the skipping is invisible.** Add 40 seconds per patient and it gets skipped by week two — while the register still *looks* complete, because a human ticks boxes. Design for under 30 seconds a report or do not ship.
6. **Alert fatigue, then abandonment.** If every abnormal HbA1c becomes an obligation I get 40 a day and I stop reading them within a fortnight. Severity-tier it and cap my daily list at something one doctor can clear in 60 seconds.
7. **The specialist who must close the loop is not in the building.** Eye once a week, nephrology 120 km away. Any design with a specialist stamp in the critical path has no completion path.
8. **Language and register, not just translation.** My clerk reads Hindi, my patients say "sugar ki jaanch", not "glycaemic control". An English UI is not a localisation gap, it is a staffing gap.

### 7. Which thesis would I vote for, knowing the other judges are a private endocrinologist and a technologist?

**T1, and I would argue for it rather than settle for it.** The private endocrinologist will recognise the result leak immediately, because he has the same WhatsApp inbox and the same missing read-back; what will decide his vote is whether the product makes *his* staff do one more thing. So the pitch to him must lead with the six-name list and one named patient — not with accreditation and not with the word "obligation". The technologist will vote on whether it is a system or a wrapper, and T1 is the only one of the five with a server-enforced state machine, an append-only event table, a hash chain and calibrated abstention; T4's extraction and T5's linkage are technically interesting but T1 is the only one where the hard engineering serves a KPI a judge can see within 60 seconds.

The risk I would flag to both of them: T1 is the admin-flavoured thesis, and a doctor judge can dismiss it as "the quality officer's problem". That is a presentation problem, and it is fixable — but if the team leads with the compliance register, they will lose the endocrinologist's vote and the technologist alone cannot carry the panel.

## What would make the winner 95+

1. **A 30-second photo-to-register path operated by the clerk, with a human confirm on three fields, and a printed register page at 8 a.m.** Not an export button — a print that happens on a schedule, on the printer the hospital already has.
2. **A night-ownership rule that passes the 2 a.m. test:** role-based reassignment, a ringing phone with IVR acknowledgement, time-stamped escalation, and an "unowned after hours" bucket on the morning list. No login on the critical path, ever.
3. **One real 60–90 day pilot in one district hospital, with the quality manager as named owner, publishing two numbers even if they are bad:** median minutes from report received to named acknowledgement, and share of criticals with a documented patient communication. An honest baseline beats a claimed lift.
4. **Hindi/Devanagari interface, a patient message in local script that contains no clinical detail, and a one-page SOP on the wall** so my nurse can answer the assessor's question without me.
5. **An on-premise single-box deployment option**, so the state IT cell can approve it without a cloud agreement.
6. **A daily obligation cap with severity tiers**, so it survives week three.

## The one question I would ask at the finale

"Show me a potassium of 6.8 that comes back at 2 a.m. Tell me exactly whose phone rings, what that person sees on the screen without logging in, and what happens if they do not answer."

## Verdict (one sentence)

T1 wins at 76 because it is the only thesis that turns my private, unprovable fear into a dated printed record I can hand a surveyor, a patient or a lawyer — but it is a 76 and not a 95 until it is fed by a photograph, read on paper, and rung at 2 a.m. by a person who is actually on duty.

## Confidence and what I could not verify

**High confidence (my own operational experience):** the staffing and time table in question 2; the absence of a software budget line and my inability to sign a cloud agreement; that reports arrive as photographs of printed sheets on a shared number; that the paper OPD card, not the patient's bag, is the longitudinal record in a public hospital; that a printed register is what a surveyor accepts.

**Medium confidence:** the exact NQAS and NABH entry-level checkpoint wording and sampling method. I described what the assessor does, not clause numbers, and I have deliberately not invented clause identifiers. The brief's #10 (critical-result intimation and read-back, Grade B) supports the substance.

**What I could not verify, and marked nowhere as fact:** the size of a district hospital's software budget, because I do not believe one exists and I have no source for a number; the L1 tender dynamics of a state NPCDMS/NPCDCS rate contract; whether extraction accuracy on photographs of real dot-matrix sheets is anywhere near the 0.88 synthetic figure (my strong suspicion, `unverified`, is that it is closer to the 0.24 internal-audit figure); and the true share of post-clinic results that currently have no owner at all, which is the number I would most want measured first.

**What would change my score:** a working photograph-to-register path demonstrated on a real cut multi-patient sheet, or a night-escalation demo that passes the 2 a.m. script without a login, would move T1 to the mid-80s on my sheet immediately. A pilot that shows the upload step being skipped in a real clinic would move it below T3.

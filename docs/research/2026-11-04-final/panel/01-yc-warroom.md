# YC War Room (mock group partner) — scorecard

Judged 4 November 2026 against PANEL_BRIEF.md §6–§10. I have backed 60+ companies, a lot of them in health. I score as an investor deciding whether to write a cheque and then stand behind the team on a stage. I do not give points for effort, honesty, test counts or a hosted demo. Honesty about having no evidence is table stakes; it is not evidence.

## Stance (one line)

**T1 is the only thesis here that is a company rather than a feature, and it still has zero evidence of demand — so I would fund it small, conditional, and only after a ten-day concierge test that costs nothing.**

## Scores

| Thesis | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | TOTAL |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 Closure Ledger | 12 | 8 | 7 | 8 | 8 | 13 | 8 | 5 | 4 | **73** |
| T2 90-Day Recheck | 13 | 7 | 7 | 5 | 5 | 13 | 9 | 4 | 3 | **66** |
| T3 Annual Review Pack | 10 | 6 | 5 | 5 | 4 | 10 | 6 | 4 | 3 | **53** |
| T4 Bag Reconciliation | 10 | 5 | 3 | 4 | 5 | 6 | 6 | 3 | 4 | **46** |
| T5 Identity Firewall | 8 | 7 | 6 | 8 | 9 | 5 | 5 | 4 | 2 | **54** |

Dimension key: 1 problem reality/frequency (15) · 2 failure cost/urgency (10) · 3 buyer/WTP (15) · 4 defensibility (15) · 5 technical depth/honest AI (10) · 6 programme fit (15) · 7 India scale (10) · 8 regulatory safety (5) · 9 demo/narrative (5).

**Read the shape, not just the total.** T2 beats T1 on the problem (13 vs 12) and on India scale (9 vs 8) and ties it on programme fit. T1 wins on everything that turns a problem into a business: buyer, moat, technical core, safety. T5 has the best technology in the pack (9) and the worst demo (2) — it is the one thesis where "is this a company" and "should this win this competition" give opposite answers.

---

## The eight questions

### 1. What is the hair-on-fire problem, in the founder's own words? Vitamin or painkiller?

The founder's line, as currently written, is not a founder's line. "A report arrives, and no one can prove a named clinician saw it" is passive voice with no names, no dates and no patient. That is a consultant's sentence. It is the sentence of someone who has read the studies and not sat in the room.

The line a founder would actually say is: *"A potassium came back at 6.8 on a Friday afternoon. The PDF landed in the clinic WhatsApp group. The doctor was in OT. On Monday the patient was in the ICU. Nobody in that hospital can tell you who was supposed to look at that report, and nobody's job is to find out."*

Now the verdict, and it is uncomfortable: **this is a painkiller for the patient and a vitamin for the buyer.** The pain is severe, common and real — 64.61% of critical values notified 30–120 minutes after sample arrival, 6.8–62% of abnormal results never followed up, 10.7% of notifications unsuccessful. But it is distributed to the three people who never sign cheques: the patient who is harmed, the doctor who never sees the result they didn't see, and the lab whose liability ends at delivery.

The person who *does* sign, the quality head, feels this once per accreditation cycle. Everything in a quality head's life is a survey. So the honest answer is: painkiller, misaddressed. The product is not wrong; the buyer is one abstraction away from the pain. That gap is the whole company.

### 2. Who is the buyer, what budget line, and what do they stop paying for?

**Buyer:** quality head or medical superintendent of a 50–200 bed NABH-accredited or NABH-aspiring private hospital; secondary, a standalone lab's owner/quality manager. Not the doctor. The brief is right about this and it is the single best structural decision in T1.

**Budget line:** not IT capex and not the doctor's income. It comes from one of exactly three places:
1. **The accreditation consultant.** Real line, ₹50k–2L per survey cycle plus retainer, renewed at every survey. This is the best target because it is a renewal event with a date.
2. **The LIMS renewal.** CliniKite is ₹2,499/month, Healthray/OneCity/Delpheon sell critical alerts *inside* the lab. You would be displacing a module, and the incumbent will bundle it free to keep the account. Expect to lose this fight for 18 months.
3. **Quality/MRD staff time.** It will not replace a person in year one.

**What they stop paying for: nothing, yet.** And I want the founder to say that out loud, because it is the most useful thing they can tell a panel. There is no "result closure" line in an Indian hospital P&L. The first sale is a *reallocation* from the consultant or the LIMS, not new budget. That means the first 10 sales are a fight against an incumbent's discount and a consultant's relationship, not a greenfield.

T2 has a cleaner budget line and should be credited for it: recovered visits are revenue, so the money comes out of patient acquisition, and the clinic can do the ROI arithmetic itself. Its problem is different — the buyer believes the clerk already does this.

### 3. Why now, specifically? What changed in the last 24 months?

Four dated things, and only one of them is a buying trigger:

- **13 Nov 2025 — DPDP Rules notified.** Substantive duties 13 May 2027; consent managers 13 Nov 2026 (nine days away). Every clinic now needs consent, notice, retention and audit for patient outreach. A product that bakes consent into the workflow wins at the deadline; a bolt-on loses.
- **21 July 2026 — CDSCO software guidance.** Scheduling, communication and storage are outside device scope; risk scoring and triage flip it. This is the licence to build T1 and T5 and the reason to refuse T4's "flag duplicate therapy" step.
- **24 July 2026 — 68,564 NQAS-certified facilities, 452 district hospitals.** The public accreditation surface became a market.
- **Oct 2026 — 89.9% of Indians who knew they had diabetes had never had a retinal exam.** The strongest single number in the pack for T2/T3.

**The real "why now" is one sentence: in the same 24 months, the accreditor and the regulator both started asking for proof in writing.** NABH wants a read-back signature; DPDP wants an audit trail. A paper diary satisfies neither credibly. That is a forced purchase, which is rarer and more valuable than a new pain.

**But be honest about the timing.** 13 May 2027 is eighteen months away, and Indian SMB compliance buying happens in the last 90 days. So the deadline is not your sales force this quarter — the *survey date* is. Which means the opening line of every sales call is "when is your next NABH survey?", and that line appears nowhere in the strategy documents. Fix that.

### 4. What is the wedge, and what is the expansion?

T1's stated wedge — "every abnormal diabetes result" — is the wrong size. It is too wide for four people to own and too narrow to be infrastructure. It sits in the dead middle.

**The wedge should be: the critical-result read-back register, for one lab→hospital pair, in one city.** Not all abnormals. Criticals only: the ones NABH already demands a signed record for, the ones where the lab already runs a 15-minute clock, the ones where the failure is a sentinel event and a ₹20 lakh consumer-court order. One register, replacing one paper diary, with one public verifier.

Small enough to dominate: 53 facilities in one metro is ~10% of that metro's accredited hospitals, and you can write all their names on one page. Big enough to matter: at ₹10,000/facility that is ₹63.6L ARR — a real company, not a venture outcome.

**Expansion, in order, same receipt primitive and same audit table:** critical → all abnormal → recheck due → referral completion → annual bundle. Four revenue steps per account with no new logo. That is the correct expansion because it is cross-sell into an installed base, not a new market.

**Where it actually becomes big is the lab, not the hospital.** A hospital at ₹10k/month is a grind to ₹6 crore. A lab group processing 5,000 reports a day, buying proof of delivery per report, is a different order of magnitude — and it is also the moat, because if the receipt becomes the artefact a lab hands over, both sides verify and you own a standard. Sell the hospital to learn, sell the lab to matter. Do not say that on stage; it is a distraction at a doctor-judged finale.

### 5. Do things that don't scale — the first 10-customer concierge version

Ten days, four sites, zero code, and it produces the only number the pitch depends on:

1. Get three 50–200 bed NABH hospitals and one lab in one city.
2. Sit in the quality office. Take **100 consecutive reports** per site — paper, PDF, WhatsApp screenshot, whatever exists.
3. Hand-match each to a patient. Write the obligation on a printed A4 sheet. Walk it to the named doctor. Get a signature. Where it is critical, stand there until it is signed.
4. Call the patient yourself from the clinic's phone. Write the read-back in a Google Sheet. File the sheet in the accreditation folder.
5. Charge **₹5,000** for the two weeks. A real invoice with a GST number, not a pilot MoU. The invoice is the experiment; the software is not.
6. Week three: hand the sheet to the quality officer and leave. Do not call. See whether it runs.

**What it proves:** (a) the baseline — % of abnormal results with no documented acknowledgement in 24h, and if that is under 30% the problem is already solved by the diary and there is no company; (b) whether a named doctor accepts being timed and chased, which is a question about status, not technology, and cannot be answered by any amount of engineering; (c) whether the artefact survives contact with a real surveyor; (d) whether the quality officer works it without you.

**What it does not prove:** WTP at scale, retention, or lab-feed ingestion. Say so.

There is no excuse for this not being done before 28 November. It costs nothing and it is the difference between a demo and a company.

### 6. What is the default-alive math?

Assumptions are mine and marked: 4 people at ₹42L/year all-in (2 eng, 1 part-time doctor, 1 ops) ≈ **₹3.5L/month**, plus ₹70k infra, telephony, legal and DPDP paperwork ≈ **₹4.2L/month burn**. Gross margin ~80% after hosting and support, so revenue needed to break even ≈ **₹5.25L/month**. *[estimate — the pack contains no cost data]*

| Price per facility/month | Facilities to break even |
|---|---|
| ₹5,000 (T1 low end) | **105** |
| ₹10,000 (T1 mid) | **53** |
| ₹20,000 (T1 high end) | **27** |

Now the only market check that matters, using the pack's own number: **~4,000 fully NABH-accredited hospitals** exist (§5, #15). Fifty-three facilities is **1.3% of them**. This is the strongest commercial fact in the entire pack and it appears in no document: *you do not need a market, you need 53 hospitals out of 4,000, and those are the only hospitals in India that already pay real money for accreditation.*

That is a walkable business. It is not a venture-scale one, and the founder should say both halves of that sentence.

**T2 fails its own arithmetic, and this is the sharpest number in the pack.** T2's own kill criterion says a clinic cancels below **six recovered visits/month**. At exactly six, the value fee is 6 × ₹75 = ₹450, plus the ₹3,000 base = **₹3,450/clinic/month**. To cover ₹5.25L you need **152 clinics** — at the *survival threshold*, where every clinic is one bad month from churning. The pricing model's floor is its own ceiling. T2 is default-dead unless the base fee triples or the clinics are government contracts, and government pays in 3–12 months through GeM, which a four-person team cannot bridge.

T4 has no institutional budget at all, so there is no default-alive number to compute — which is the answer. T5 needs 10–20 lab chains at ₹1–3L/year, which is a two-year enterprise sales cycle and the wrong shape for this team today. T3's per-patient-year unit has no price discovery at all.

### 7. The single assumption that, if false, kills the company

Not "will a doctor use it." Not "will AI extract accurately." Those degrade the product. This one kills it:

**That critical-result closure is a budgeted problem rather than a compliance chore — i.e. that some hospital has ever been punished for getting it wrong.**

If a hospital's paper diary has passed every survey for nine years, then the diary is *the correct product*, you are selling a nicer form, and the buyer will tell you so politely and never sign.

**Cheapest possible test this month: read the last NABH survey report's non-conformity list at three hospitals.** Ask one question — "what were your observations last cycle?" — and get the PDF. If "critical result register" or "read-back" appears in any of them, the accreditor is doing your selling for you and the company is real. If it appears in none, no one has ever paid a price for this failure, and you are selling preventative medicine to a market that buys cures.

Cost: three phone calls and three PDFs. Timeline: two days. No code, no pilot, no ethics approval. This is the single highest-information-per-rupee action available and it has not been taken.

Runner-up, and it kills the *user* rather than the *problem*: whether a named clinician accepts a clock and an escalation. If doctors refuse to be timed, T1 degrades from "accountability" to "a register the quality officer maintains," which is a smaller, cheaper, worse business — but still a business.

### 8. Which would I fund, and which would I pass on?

**Fund: T1.** A small cheque, milestone-gated on the concierge test and the survey-report read. Reasons in the next section.

**Pass on T2 — but it is a good business and a bad venture bet, and those are different verdicts.** 50–60% miss follow-up; 11.2% trackable by both phone and address; 26% progress to vision-threatening disease. The problem is the best-evidenced in the pack. But recall is ₹1,499 at Clinizy, free at Yuktii, bundled at Eka, and shipped as voice AI by Vitaloop. "We start with the unreachable" is an operating discipline a competitor copies in a quarter, and at the survival threshold you need 152 clinics. This is a ₹5 crore/year company run by someone who loves clinic ops. It is not a venture return, and the brief is admirably honest about that already.

**Pass on T3.** The value depends on providers who are not your customers stamping your pack. You cannot deliver your own promise. "Insurer, later" is TAM theatre — the word "later" in a buyer list is a confession.

**Pass on T4.** It is a feature wearing a company's clothes. The buyer is the doctor's time, which is the rubric's own definition of a 1–3. Extraction is the product and extraction is commoditising — HealthPlix H.A.L.O. is in 20 languages, Eka ships EkaScribe, Gemini Vision is free. The measured numbers are the tell: complete-field 0.24 on an unfamiliar layout. That is the product failing at its only job, and a bad OCR moment in front of two doctor judges is not a risk, it is a scheduled event.

**Pass on T5 — and this is the one that hurts.** It has the deepest technology (entity resolution under Indian naming, household-phone graphs, calibrated abstention, expected-information-gain ordering) and a genuine compounding dataset. But: no doctor in the buying room, invisible in a demo, an OEM/integration sales cycle, and it is infrastructure — which needs years and capital a four-person team does not have. I would pass on the company and try to hire the team. I would fund T5 in 2029 with a bigger team, once someone is already paying for linkage.

---

## Will the winner actually win on 28 November? Probably not.

I would fund T1. I would not bet it wins the finale, and the team needs to hear the difference.

Two of three judges are doctors. T1's buyer is a quality officer they do not identify with, and its hero screen is a list of things that are overdue — which reads to a clinician as someone else's filing problem. T2 and T4 are more visceral. T4 in particular has the best 40-second moment in the pack, and will lose on the merits anyway.

**The fix is one reframe, and it is free: the receipt is the doctor's alibi, not the quality officer's register.**

Say it in the first twenty seconds: *"When a critical potassium goes missing, the first question the medical superintendent asks is your name. This is the thing that answers it in four seconds."* That converts the doctor judge from a sceptic into a user, keeps the quality head as the payer, and costs no engineering. It is the highest-leverage change available before the finale and it is not in any document.

## Why the winner wins (top 3 reasons, evidence-backed)

1. **It has the only named buyer with an external forcing function and a date.** NABH/NABL require a critical-alert register with identifiers, person informed, time and read-back (§5 #10, #11); DPDP requires consent and audit by 13 May 2027 (#12); CDSCO's July 2026 guidance keeps it out of device scope (#13). Those are three external parties, not the founder, creating the purchase. No other thesis has one.
2. **It is the only non-commoditised artefact in the field.** The scan in §4 is decisive: critical alerts exist inside LIMS (Healthray, OneCity, Delpheon), recall exists inside CRMs (Clinizy ₹1,499, Lifemaan 576+ hospitals, Yuktii free). Nobody owns the cross-source, clinic-side proof that a specific abnormal result was seen by a named clinician and communicated to a specific patient, with something a clinic can defend and a patient can verify. That gap survived a real scan, and T1 is the only thesis standing in it.
3. **The build is real and the AI is scoped honestly.** Server-enforced state machine, append-only `result_events`, hash-chained receipts, a public verifier, critical read-back enforced server-side, 184 unit tests, 12 SQL isolation checks, NABH-shaped CSV export. AI does exactly two jobs — extraction and patient matching — and the criticality comes from the lab's own flag, never from the model. That is the correct and rare discipline, and it is also the reason the regulatory score is a 5.

## Fatal flaw of each thesis (one line each)

- **T1 —** The pain belongs to the patient and the payer signs for the survey; if a paper diary has passed nine years of accreditation, you are selling a better form to someone who is not in pain.
- **T2 —** At the six-recovered-visit survival threshold the revenue per clinic is ₹3,450, so you need 152 clinics to break even, against a competitor selling recall for ₹1,499 and another giving it away.
- **T3 —** You cannot deliver your own promise without providers who are not your customers, and "insurer, later" is a confession, not a buyer.
- **T4 —** It is extraction wearing a company's clothes — complete-field 0.24 on an unfamiliar layout — sold to a doctor's time budget, which is the rubric's own definition of a 1–3.
- **T5 —** Excellent technology, invisible in a demo, sold to IT/OEM in a two-year cycle to a four-person team that has no doctor in the buying room.

## What would make the winner 95+

- Three signed invoices at ₹10,000+ in one city (not LOIs, not pilots): **+6 on buyer.**
- A measured baseline across 300 consecutive reports showing ≥30% without a documented acknowledgement: **+4 on problem reality.**
- The last survey report's non-conformity list naming the critical-result register at 2 of 3 sites: **+3 on urgency**, because the accreditor becomes the sales force.
- ≥80% of criticals acknowledged inside the clock with no escalation to the medical superintendent, measured over four weeks: **+3 on buyer and moat.**
- One lab agreeing to co-sell or to print the verifier QR on its own report: **+3 on defensibility.** This is the first edge of the network and the only event that turns a facility product into a standard.
- One quality officer running the loop for a full week with zero founder contact: **+3 on product vs service.**

That is 73 → 95. Every item is a measurement, none is a feature. Nobody should add a screen.

## The one question I would ask at the finale

**"Give me the name and phone number of one quality head who has agreed to be timed by this — not interested, agreed. Can I call them tonight?"**

Everything else at a hackathon can be answered by a good demo. That question can only be answered by a customer.

## Verdict (one sentence)

**Fund T1 small and conditional, because it is the only thesis with a named payer, an external forcing function and a defensible artefact — but the team has built the product and skipped the only two tests that cost nothing, so I would give them ten days and three phone calls before I give them a rupee.**

## Confidence and what I could not verify

- **Could not verify, and it decides everything:** whether any Indian hospital has ever been penalised at survey for a critical-result register gap. No survey report, no non-conformity list, no buyer interview exists in this pack. My confidence in T1 is conditional on that being yes; if it is no, T1 drops to roughly 55 and T2 becomes the least-bad option.
- **Could not verify:** willingness to pay at any price. Zero interviews, zero purchase orders, zero deposits across all five theses. Every ₹ figure in §6 is either the brief's own band or my estimate, and the ₹4.2L burn and 80% GM are mine, labelled. If burn is ₹2L the default-alive counts halve; if GM is 60% they rise by a third.
- **Could not verify:** the duplicate suppression rate. `sutra.create_result` and the ingestion endpoint exist, but WhatsApp, paper, portal and lab-feed ingestion are not connected and demo rows are seeded. The 1.00/1.00 on the synthetic corpus (§3) is circular — the model was validated on a corpus shaped like its own training data — and must never be quoted to a panel. The honest number is precision 0.875, recall 0.56, complete-field 0.24 on an unfamiliar layout, and that is the load-bearing engineering risk in T1: at 0.24 complete-field, one in four reports needs a human to finish it, which is the difference between a 60-second list and a 5-minute list.
- **Could not verify:** the competitor scan is the public tip of each team (§10). RetinaX in particular could be further along than its repo shows.
- **A process observation, not a score:** this project has changed thesis three times in three days — pre-visit delta → follow-up loop → result ledger — and `14-winning-plan-doctor-side.md` still argues for the first one. Churn before PMF is healthy and the reasoning each time was honest. Churn *after* 28 November is fatal. Pick one and stop.
- **A delivery observation:** `deliverables/final/README.md` states the current brief and deck "have not been rebuilt around the result ledger yet," and the screens folder still holds pre-pivot shots. Twenty-four days out, that is the most likely way T1 loses a competition it should win.
- **My bias, stated:** I weight a named buyer and a measurable KPI above a better demo, which systematically favours T1 over T2 and T4. A panel weighting narrative and clinical recognition would invert that. The brief's own §8 weights buyer at 15 and demo at 5, so my scoring follows the published rubric — but the room on 28 November may not.

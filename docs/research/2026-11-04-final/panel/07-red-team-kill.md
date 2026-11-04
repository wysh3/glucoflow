# Red team — kill scorecard

Judge: adversarial panel member. Mandate: kill all five theses before a public judge does. Not scoring to be fair; scoring survival probability. Every number below is from the PANEL_BRIEF of 4 November 2026 unless marked `unverified`.

## Stance (one line)

Four of the five theses are features wearing a company's coat; the fifth (T1) is a small compliance business wearing a platform's coat, and it is the only one whose clock is set by an external body rather than by the team's own optimism.

---

## Scores

Each dimension is read as *probability this survives contact with reality*, 0–10. Weighted total = Σ(weight × score) / 10.

| Thesis | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | TOTAL |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 Closure Ledger | 7 | 8 | 4 | 4 | 8 | 8 | 8 | 8 | 7 | **66** |
| T2 90-Day Recheck | 8 | 6 | 4 | 3 | 5 | 8 | 8 | 7 | 4 | **59** |
| T3 Annual Review Pack | 7 | 6 | 3 | 3 | 4 | 6 | 8 | 8 | 3 | **52** |
| T4 Bag Reconciliation | 6 | 5 | 3 | 2 | 6 | 3 | 7 | 3 | 5 | **43** |
| T5 Identity Firewall | 6 | 7 | 3 | 5 | 8 | 3 | 4 | 7 | 2 | **49** |

Weights: 15/10/15/15/10/15/10/5/5.

### The rubric is a finale-fit instrument, not a company instrument

These totals rank how well a thesis survives a 7-minute public defence. They do not rank whether a company exists in 2027. The divergence is the finding:

| Thesis | Rubric (survives the panel) | Company in 3 years | Inflation |
|---|---|---|---|
| T1 | 66 | 28 | 2.4× |
| T2 | 59 | 22 | 2.7× |
| T3 | 52 | 12 | 4.3× |
| T4 | 43 | 7 | 6.1× |
| T5 | 49 | 11 | 4.5× |

The rubric gives 30 points to problem reality and programme fit — both of which the team can *write down* without a customer. It gives only 15 to the buyer. That is structurally the wrong way round for a company decision, and it is exactly why T1 scores 66 with zero buyer conversations.

---

## Per-thesis kill analysis

### T1 — The Closure Ledger (66)

**1. Strongest commercial kill: the buyer either has no budget or has a cheaper alternative, and both branches kill it.**
The thesis needs a quality head or medical superintendent to sign at ₹5,000–20,000/facility/month (§6 T1). The team's own battlecard concedes "the quality head often has no independent budget" (`Result_Ledger_Judge_QA.md`, "Why not sell directly to hospitals?"). The buyer with actual budget — the clinic owner — is being sold the adjacent function at ₹1,499/month (Clinizy, clinic OS *including* recall, billing, pharmacy, lab) and ₹2,499/month (CliniKite, order → sample → report → reviewed → shared status), and free (Yuktii, diabetes clinic software with structured recalls) (§4.2). A ₹5,000–20,000 ask is 3.3× to 13.3× a product that already sells the report-status loop. The decision memo itself concludes "A clinic alone is the weakest buyer and should not be the first sales target" (§Market). So the only viable buyer is the one with no independent budget. That is not a pricing problem; it is the company.

**2. Strongest finale kill: a doctor judge relabels it in one sentence — "this is my quality officer's register."**
The hero screen is an "unclosed list": three results unseen, two overdue, one identity hold (§6 T1). That is a to-do list. The emotional peak of the demo is a *system refusing an action* — the value echo, the read-back block, the two-attempt rule — which a busy clinician reads as friction, not relief. §6 states the weakness plainly: "Admin-flavoured… It risks being seen as a compliance register." With two doctors on the panel and T1's KPI being median acknowledge time (a quality metric, not a clinical one), the judge's honest reaction is "correct, and not mine."

**3. The assumption the team is lying to itself about: that "closure" means the patient knows.**
The one-line thesis is "nothing closes without a human acknowledgement and a recorded patient communication" (§6 T1). The product does not do that. The demo contains a named segment, 1:35–2:20, titled **"The honest unreachable"**, where a receipt *closes* as "Closed, patient unreachable" with the line "the patient is not marked informed" (`Result_Ledger_Demo_Script.md` lines 44–52). The seeded hero screen already advertises "1 documented unreachable" out of 12 receipts. So the guaranteed product is a *documented disposition*, not a closure, and roughly one in twelve of their own receipts is a proof that the patient was never told. The team has confused "the clinic can defend itself" with "the loop closed." The first is a filing product; the second is the company they are pitching.

**4. Cheap test that exposes the lie in 7 days.**
Run the receipt by hand on 100 consecutive reports at two sites, no software. Measure one ratio: **unreachable closes ÷ total closes**. If more than half of closed receipts end as "unreachable after two attempts," then the product's own headline KPI (informed share) prints below 50%, and the buyer is paying ₹10,000/month for a system that documents that they failed to reach patients. Simultaneously ask the quality head for a ₹10,000/month order that day. "Yes, after the pilot" is a no. Cost: two days of one person, two clinics, zero code.

**5. Survival probability: 28% as a company; 45% as a niche compliance-evidence business.**
What raises it: (a) get one lab to countersign the certificate so the receipt is bilateral and an EMR cannot unilaterally issue it; (b) price at ₹2,000–4,000/facility/month to sit *inside* the accreditation budget instead of 13× above the clinic OS; (c) change the headline KPI from "closure" to "median time to acknowledgement," which they already measure and which does not require the patient to answer a phone.

### T2 — The 90-Day Recheck Loop (59)

**1. Strongest commercial kill: the market has already priced this function at zero.**
Yuktii gives diabetes clinic software with structured recalls free. Clinizy bundles recall at ₹1,499/month. Vitaloop sells AI voice recall with ₹0 upfront and a share of recovered revenue (§4.2). A clinic owner offered ₹4,000/month flat against 0-upfront-pay-on-return picks the second every time. The team's own model is fatal: a Tier 3 clinic's net gain is ₹3,300/quarter and the model "fails below ~6 recovered visits/month" (`docs/research/2026-11-03-strategy/12-evidence-ledger.md`), with revenue per visit at ₹400 in Tier 3. There is no price at which this is both affordable to the clinic and survivable for the vendor, because the competitor's price is a percentage of an outcome the clinic cannot verify.

**2. Strongest finale kill: the judges have already seen this deck.**
§1 says it directly: the "follow-up/recall agent" is being built by multiple teams in this same programme. §4.1 lists `hannielvinu/Setu` (assistive follow-up agent, barrier removal in local language) and `Shrestha-ijarwal/RetinaX_Healthathon` (diabetes track, incomplete care journeys, ASHA re-engagement, bilingual reminders, care-loop dashboard, audit log). A judge who walked the floor before lunch has seen the care-loop dashboard twice. And §6 T2 concedes the differentiation is "hard to demo in 7 minutes and easy for a judge to read as a CRM."

**3. The assumption the team is lying to itself about: that "we start with the unreachable" is a moat.**
The reachability audit is a CSV import of a register the clinic already owns. There is no proprietary data in it — only the parts of it that are wrong. Evidence #6 (Chennai, n=3,696) says only 60.4% of phones are legible and 11.2% are trackable by both phone and address. That is a *problem statement*, not an asset: every competitor sees the same garbage register, and the clinic can hand the same file to any vendor tomorrow.

**4. Cheap test that exposes the lie in 7 days.**
Take one clinic's due list (n≈300). Attempt contact on 100 patients by WhatsApp and voice, two attempts, log outcomes. If fewer than 45% are reachable, the recovered-visit revenue model has no denominator — the ₹36,000/quarter projection is arithmetic on patients who cannot be phoned. Cost: one person, one week, one clinic's register.

**5. Survival probability: 22% as software; 35% as a services desk.**
What raises it: charge only per recovered visit (aligns with Vitaloop instead of losing to it), staff the desk with their own people for eight weeks so the buyer sees recovered cash rather than a dashboard, and sell one district NCD programme instead of fifty clinics.

### T3 — The Annual Review Pack (52)

**1. Strongest commercial kill: no buyer with a 60–90 day trigger, and the product needs many providers to stamp before it has any value.**
§6 T3 names the buyers as "hospital quality head, district NCD programme, insurer (later)." The insurer is later. District NCD procurement is a 12–24 month cycle, not the 60–90 day proof the programme demands (§1 design bar). The quality head cannot unilaterally buy a *multi-provider* pack. And the pack is worthless until an ophthalmologist and a nephrologist who are not the customer also stamp it — a two-sided standard with zero sides installed. Neither of the other startups in §4.1 has solved two-sided adoption; RetinaX solves it by covering eye only.

**2. Strongest finale kill: the judge asks "show me one completed pack," and completion is not in the room.**
The demo is a checklist with empty boxes; every closed box belongs to a provider outside the building. §6 T3 concedes "Bundle is a quality-team word, not a doctor word." A panel with two doctors will not recognise "bundle-completion rate" as their problem; it is an NQAS/NPCDCS indicator, and the judges are not the district programme.

**3. The assumption the team is lying to itself about: that "patient-owned" is a feature.**
This is the population where a patient-owned carrier is least likely to be carried. Evidence #6: 16.4% complete address, 11.2% trackable by both phone and address. Evidence #9 (Puducherry, n=500): 41.0% delayed eye care for want of an attender, 38.6% for cost. The pack assumes an attender, a wallet and a phone. The thesis calls that "patient-owned"; the field calls it "another thing that does not come back."

**4. Cheap test that exposes the lie in 7 days.**
At one OPD, hand five real patients a QR pack and ask them to get one outside stamp (a retinal exam or a urine ACR) and return the pack within the week. Count returns. Fewer than two of five means the pack has no carrier, and the entire bundle-completion dataset — the claimed moat — never accumulates.

**5. Survival probability: 12%.**
What raises it: make the pack clinic-owned and provider-agnostic, and sell a single district a paid 90-day bundle audit as a service, not a product. That is a ₹10–20 lakh engagement, not a company, but it is real revenue.

### T4 — The Bag Reconciliation (43)

**1. Strongest commercial kill: the buyer is the doctor, and this team has already killed the doctor-buyer thesis in writing.**
The decision memo's verdict on the pre-visit delta applies verbatim to T4: "The buyer is usually the doctor. The queue owner, quality head and lab manager are not in the buying conversation." That is the same product shape with a camera attached. Worse, extraction *is* the product, and their measured extraction on an unfamiliar layout is precision 0.875, recall 0.56, **complete-field 0.24** (§3, internal audit 3 Oct 2026). A tool that fully reads 24% of unfamiliar documents cannot be sold per doctor, and the 100% figure on the unseen synthetic corpus (§3) is synthetic — it is not evidence about Indian handwriting or packaging.

**2. Strongest finale kill: a judge hands over a real bag.**
§6 T4 states it: "High demo risk (a bad OCR moment kills the pitch)." At a live finale with a practising doctor on the panel, someone will produce a handwritten prescription. The demo's single point of failure is the one artefact the audience can improvise.

**3. The assumption the team is lying to itself about: that "the doctor's edits are training data" is a moat.**
Edits from a handful of doctors in one city do not generalise across Indian packaging, and the incumbents ingest at a scale this team cannot reach: HealthPlix ships H.A.L.O. voice-to-prescription in ~20 languages to 14,000–15,000 doctors, and Eka ships EkaScribe (§4.2). "We will learn from corrections" is what every extraction vendor says before losing to the one with distribution.

**4. Cheap test that exposes the lie in 7 days.**
Photograph 20 real bags on a clinic phone — not a scanner, not a curated corpus — and measure complete-field extraction with no human repair. Below 0.6, stop. Above 0.6, still check whether a doctor will pay anything, because the last doctor-buyer thesis did not survive that question.

**5. Survival probability: 8%.**
What raises it: nothing commercial in a week. The only honest raise is to abandon the general bag and read one lab's own report format — at which point the thesis has become T1.

### T5 — The Identity and Report Integrity Firewall (49)

**1. Strongest commercial kill: it is a component sold as a company, to a buyer with a 12–24 month cycle.**
Every HIS and LIMS ships a master patient index; the deliverable is a *better* one, not a new category. The buyer is "lab chains, hospital IT, HIS vendors (OEM)" (§6 T5) — an OEM integration sale with a procurement cycle longer than this team's runway, requiring engineering a five-person team cannot staff in parallel with selling. §4.2 already lists Healthray, OneCity and Delpheon shipping critical alerts with NABL/ISO 15189 workflows *inside* the lab (evidence exists to sell against), and SaathiMed using the same "closed loop" language. The one thing this thesis has that T1 does not is a moat; the one thing it lacks is any path to a first invoice this year.

**2. Strongest finale kill: it is invisible.**
§6 T5 says it: "Invisible in a demo. Lowest 'judge recognition' score of the five." There is no 40-second moment in a match-probability threshold. Two doctors on the panel will not recognise a wrong-patient match as their problem until it has already happened, and the technology judge will recognise it as an ETL feature. On a programme whose published bar is "usable in a busy clinic," a component with no user interface is a category error.

**3. The assumption the team is lying to itself about: that "calibrated abstention" is a product.**
Calibration is a published result, not a business. And the claimed moat — the household-phone graph — requires data this team cannot obtain without exactly the integration it is trying to sell. That is a circular dependency, not a flywheel.

**4. Cheap test that exposes the lie in 7 days.**
Pull 500 real reports from three labs and measure the actual wrong-patient and duplicate rate as it stands today. If the baseline error rate is below 1%, there is no problem worth a firewall and the product is a nice-to-have. Note that no Indian measurement of this rate exists in the pack — it would be `unverified` until this test.

**5. Survival probability: 11%.**
What raises it: fold it into T1 as the identity-hold step it already is in T1's flow, and stop calling it a company.

---

## Why the winner wins (top 3 reasons, evidence-backed)

T1 wins the rubric — and the reasons are why it is also the only one with a path to existing, at a small scale.

1. **Its KPI is a state, not an outcome, so it produces a number on day one.** Median acknowledge time, unowned count and informed share are computable from the first ten receipts. Every other thesis needs weeks of follow-up before it can print a result: T2 needs a recheck window, T3 needs a patient-year, T4 needs a corpus, T5 needs an integration. Against a 60–90 day proof bar (§1), T1 is the only thesis that can be measured before the pilot ends.
2. **Its artefact can be verified by someone who does not trust the team.** The `/verify/<code>` page returns stage and chain validity with no name and no value. That converts "trust us" into "check it," and it is the only demoable moat in the pack — the incumbents in §4.2 sell dashboards, not attestations.
3. **Its clock is external and annual.** NABH requires a critical-result intimation record and a read-back (evidence #10, grade B), and NABL 112 sets the lab criteria (#11). A purchase driven by a survey cycle does not depend on the doctor's enthusiasm or on the team's ability to prove revenue lift — which is why T2's revenue story and T4's convenience story both need a champion the team does not have.

Honest limit: this makes T1 a compliance-evidence business with a realistic ceiling of ₹3–8 crore ARR. It does not make it a platform, and no slide should say otherwise.

## Fatal flaw of each thesis (one line each)

- **T1 Closure Ledger:** its own demo shows a receipt closing with the patient never told, so "nothing closes without a recorded patient communication" is false on stage — it sells a documented disposition, and the buyer who needs that has no independent budget.
- **T2 90-Day Recheck:** the market has already priced this exact function at ₹0 (Yuktii free, Clinizy ₹1,499, Vitaloop 0-upfront), so it wins the room on the strongest Indian evidence in the pack and then loses the invoice.
- **T3 Annual Review Pack:** it is a two-sided standard with zero sides installed, sold to a district procurement cycle that is 4× longer than the proof window it must demonstrate.
- **T4 Bag Reconciliation:** extraction is the product, complete-field is 0.24 on unfamiliar layouts, and the buyer is the doctor this team already documented as a non-buyer.
- **T5 Identity Firewall:** a genuinely hard component sold as a company to an OEM buyer with a longer cycle than the company will survive, and nothing a judge can see.

## What would make the winner 95+

Three things, none of which exist, in ascending order of difficulty:

1. **A countersigned receipt.** One lab puts its name on the closure certificate. That single act makes the artefact bilateral, breaks the EMR-bundling threat (an EMR cannot countersign a competing lab's delivery), and turns a filing cabinet into a standard. Today the hash chain is self-anchored — the team's own battlecard concedes "It is in your database."
2. **A baseline audit at ≥30%.** Three sites, 100 consecutive reports, measuring the share of abnormal results with no documented acknowledgement or patient communication. The decision memo sets 30% as the kill threshold; nothing has been measured. Below 30%, the product solves a rounding error.
3. **One paid order at ₹60,000 for 90 days** from a 50–200 bed NABH-aspirant hospital or a lab chain — a PO or deposit, not a verbal yes. The Q&A already commits to this number; nothing behind it exists.

Ceiling today without these: the thesis is a 66, not higher, because every one of the 34 missing points is a question only the market can answer.

## The one question I would ask at the finale

> "Show me a receipt that closed as *patient unreachable*. Now tell me — did that patient get told? If they didn't, what exactly have you proved, and why would a quality head pay for a system that documents his clinic failing to reach people?"

It uses their own demo beat, their own seeded data ("1 documented unreachable"), and their own headline claim, and it cannot be answered with a feature.

## Verdict (one sentence)

T1 survives as a small compliance-evidence business and nothing else in the pack survives at all, and it survives only if a lab countersigns the receipt before 28 November — otherwise the panel is choosing between a filing cabinet, a free CRM, a checklist nobody carries, a camera that reads 24% of a bag, and a feature with no screen.

## Confidence and what I could not verify

Confident: the state of the build (§3 is unusually candid and matches the repo, the migration list and the test counts I sampled); the competitive pricing anchors (vendor-published, grade B, but public and checkable in 30 seconds by any judge); the internal contradictions in T1's own demo script and battlecard, which I read in full.

Could not verify, and neither can the team:

- **Willingness to pay at any price.** Zero interviews, zero POs, zero deposits (§3, §10). Every number in the buyer dimension is an assumption with a currency sign.
- **The baseline.** No Indian measurement of ordered tests never reviewed exists (evidence #21, Gap), and no national loss-to-follow-up rate with a numerator and denominator exists (#22, Gap). So the size of the leak is unknown in India, and both T1 and T2 are built on the assumption that it is large.
- **Whether a LIMS already ships a clinic-side receipt.** §4.2 confirms critical alerts exist *inside* the lab, not whether a vendor already pushes a clinic-side acknowledgement. If one does, T1's distribution wedge is gone and its score falls to the low 50s.
- **Whether any lab will co-sell.** The lab channel is T1's entire go-to-market and is untested.
- I did not run the application; I read the brief, the decision memo, the deliverable README, the demo script and the battlecard. Extraction figures are the team's own audit, not my measurement. Competitor repos are public tips only (§10).

The one claim in the team's own material that I could not reconcile with the brief: the stage opener's "only 25.8% of critical values reached the treating clinician" (`Result_Ledger_Submission_Answers.md`, PMC4310845) is **not in the panel fact pack**, whose own reading of the same paper is "86.8% of critical results notified within 1 hour; 10.7% unsuccessful notification" (#3). Both can be true — notified to *someone* (52.9% to nursing staff) versus reached the *treating clinician* — but a judge holding the pack will hear a number they do not have and a reassurance they do. That is the single most dangerous sentence in the team's material, and it is scripted as the opening line.

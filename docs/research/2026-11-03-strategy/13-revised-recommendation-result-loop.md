# Revised recommendation: the result nobody owns

3 November 2026. This memo supersedes the follow-up thesis in `05-recommended-thesis.md`. I re-checked the first answer against the "genuinely unsolved" test and it did not hold up. The follow-up category is crowded, and the reachability and barrier mechanism is a thin differentiation against Clinizy, Eka and Vitaloop. The stronger answer is the result accountability loop.

## Why I changed my mind

The first answer said the unsolved job was the clinic's follow-up list. The evidence for the pain was strong. The evidence for the white space was not.

- Clinizy sells recall inside a ₹1,499/month clinic OS.
- Eka ships automated follow-up reminders inside a free EMR.
- Vitaloop runs AI voice calls to lapsed lab patients on a pay-on-return model.
- Lifemaan sells recall and referral tracking to 576+ hospitals.

A judge can reasonably say "this is a reminder app with a reachability audit". The reachability audit is a real mechanism, but it is a feature an incumbent can add in a quarter. That fails the Zero to One test.

The result loop is different. Every clinic receives lab and imaging reports. The lab's job ends when it delivers the report. The clinic's job begins, and no one assigns an owner, sets a clock, or proves the patient was told. The failure is invisible, and the Indian evidence shows it.

## The problem

**Every clinic receives reports it cannot account for.**

The report arrives on WhatsApp, as a paper slip, as a PDF from a lab portal, or as a photograph the patient brings. It may be for the right patient or a namesake. It may be a duplicate. It may sit in a phone gallery or on a desk. The doctor may see it at the next visit, or never. The patient may be told by a receptionist, or not.

The evidence:

- In an Indian tertiary care hospital, 1,187 critical values were analysed over 25 months. **64.61% were notified between 30 and 120 minutes after the sample was received.** Outpatient notification was a major weak point. The study names illegible or incomplete requisitions, missing treating-physician details, and difficulty contacting the responsible caregiver as the main causes. (Indian J Clin Biochem 2015, PMC4310845)
- A systematic review of ambulatory test follow-up found that **6.8% to 62% of abnormal laboratory results were not followed up**. (J Gen Intern Med 2012)
- A qualitative study across 12 US VA facilities found the same implementation gaps that an Indian clinic would recognise: no one owns secondary findings, alerts are not tracked, patient and provider contact details are outdated, referrals break responsibility, and results pending at discharge fall through. (J Gen Intern Med 2021, PMC8739406)
- NABL and NABH require a critical alert register with patient identifiers, test, value, the person informed, the time of testing, the time of reporting, a read-back and a signature, retained for at least one year. In most Indian clinics, that register is paper or does not exist. (NABL 112A / NABH critical alert guidance)

The last point is the commercial opening. The compliance requirement already exists. The clinic has to prove the loop closed. Most cannot.

## The product

**The result accountability ledger.**

Four jobs:

1. **Ingest every report.** WhatsApp, paper, PDF, lab portal, email, or a photo. The product reads the patient name, identifier, phone, test, date and the lab's own flag. It does not interpret the result.
2. **Match it to the right patient.** Use name, phone, identifier, date of birth and prior records. If the match is ambiguous, hold it for a human. This is the same identity discipline the existing product already has.
3. **Assign an owner and a clock.** Every result gets a named clinician, a due time, and an escalation path. Routine results get the clinic's configured target, for example 48 hours. A lab-flagged critical result gets an immediate human call and a read-back. If the owner does not acknowledge, the result escalates to the next person at 24, 48 or 72 hours.
4. **Prove the patient was told.** Record the communication channel, time, language and the patient's response. If the patient cannot be reached, create a field task for the front desk, the ANM or the ASHA. The result is not closed until there is a disposition.

The ledger is the product. It answers four questions for every report:

- Who owns it?
- By when should it be acknowledged?
- Was it acknowledged, by whom, and when?
- Was the patient told, and how?

If any answer is missing, the result is open and visible. The clinic cannot say "we think someone saw it".

## What is new

The lab side is crowded. The lab information systems (Drlogy, ClinikPe at ₹2,999/month, Healthray, MyLabReport, MyPathologic) manage sample to report. The hospital HIS (Healthray, Bharathims, Lifemaan, NuvertOS) has a result module, but it assumes digital orders and lab integration. The clinic CRMs do not own the external report.

The white space is the **clinic-side external report inbox**:

| Player | What they do | Why this is different |
|---|---|---|
| Lab LIMS (Drlogy, ClinikPe, Healthray) | Sample to report inside the lab; WhatsApp PDF delivery | The lab's job ends at delivery. The product starts when the report arrives and ends when a human acknowledges it and the patient is told. |
| Hospital HIS (Healthray, Bharathims, Lifemaan) | Result module inside the hospital, with lab integration | Assumes the lab is inside the same system. Most Indian clinics receive reports from many external labs, on paper and WhatsApp. |
| Clinic CRM (Clinizy, Eka, Practo) | Appointment, EMR, reminders | A reminder is not an acknowledgment. A CRM records what was sent, not who owns the result. |
| Global (Epic, Cerner, Artera) | Results inbox and care-gap closure | Not available to Indian small clinics and hospitals, and not built for WhatsApp and paper. |
| NABL/NABH register | Paper or LIS critical alert register | The product digitises the proof and extends it to every result, not only the critical ones. |

The one-line differentiation:

> **The lab delivers a report. We prove a human saw it and the patient was told.**

The second line, for a judge who says "this is a lab feature":

> **The lab owns the test. The clinic owns the result. We are the clinic's receipt.**

## The market, honestly

The result loop has a larger per-site value than recall, because every report is a unit and hospitals receive thousands a month.

- A private clinic receives 300 to 1,000 reports a month.
- A 100-bed hospital receives 5,000 to 15,000.
- A district hospital receives reports from multiple public labs and private labs.
- The buyer is the clinic or hospital quality and operations head, not the solo doctor. The doctor is the owner. The lab can be a channel partner, because a lab that closes the loop with referring doctors retains them.

A value-based price is natural: ₹2 to ₹10 per report, or ₹5,000 to ₹50,000 per site per month depending on volume. A hospital with 10,000 reports at ₹5 is ₹50,000 a month. A clinic with 500 at ₹5 is ₹2,500.

The flat-price market research put the results-loop SAM at about **US$44 million** at ₹1,800 per doctor per month. That is a floor for the clinic segment. The hospital and lab segment is larger, and the per-report model scales with volume. The pilot must prove the WTP; the market memo's warning still applies. A flat clinic subscription is a small business. The path to a larger one is hospitals, labs, government districts, and the per-report fee.

The two things the pilot must prove:

1. At least 30% of reports currently have no documented acknowledgment or patient communication.
2. A clinic or hospital will pay for the ledger after a paid pilot, at a per-report or per-site price.

If both fail, the honest outcome is a niche quality tool, not a venture-scale company.

## Private and government, Tier 1 to rural

The result loop is more portable across settings than recall, because every setting receives reports.

- **Private Tier 1 hospital:** digital labs, high volume, NABH accreditation, a quality team, a budget. The first beachhead for revenue and evidence.
- **Private Tier 2/3 clinic:** paper and WhatsApp reports, no EMR, one clerk. The product works on a phone. The owner-doctor sees the unopened results.
- **Government district hospital/CHC:** reports from district labs and private labs; the medical officer is the owner; the ANM/ASHA can deliver the patient message. The district can buy per facility.
- **Rural PHC/HWC:** the report arrives on paper or WhatsApp; the product logs it and assigns the ANM; the patient message is a call or a home visit.

The Tier 2/3 design constraints are the same as the follow-up product: offline-tolerant, phone-first, local language, clinic-branded, no EMR integration. The difference is the unit: a report, not a due patient.

## Regulation

The result loop has a stronger compliance story than recall, and a sharper device boundary.

- **NABL 112A / NABH critical alert requirements:** the register, the read-back, the time of notification and the retention are already mandated for accredited labs and hospitals. The product produces the evidence.
- **DPDP Act 2023 and DPDP Rules 2025:** the clinic is the data fiduciary, the product is the processor. Consent, notice, purpose, retention and audit apply. The product sees health data, so data minimisation and access control matter more than in the follow-up product.
- **CDSCO device rules and the July 2026 software guidance:** the product must not interpret the result, compute a critical range, or recommend action. It uses the lab's own flag and routes it to a human. The words "critical", "abnormal" and "urgent" must come from the lab, not the product. That keeps it an administrative communication and documentation tool, not a medical device.
- **NMC Telemedicine Guidelines 2020:** the product does not give clinical advice. If a patient asks "what does this mean", the agent routes to the clinic. It does not answer.
- **IT Act, SPDI Rules, CERT-In:** the same incident clock and India-resident logs.
- **NABH Digital Health Standards:** the audit trail is survey evidence.

The product's regulatory sentence:

> **We do not interpret the result. We prove a named human saw it, and the patient was told.**

## The AI, and where it stops

The AI does four things:

1. Read the report, including a photograph or a WhatsApp PDF, and extract the patient identifiers, test, date and the lab's flag.
2. Match the report to the right patient and detect duplicates, namesakes and family records.
3. Route the result to the right owner and draft the patient message in the patient's language.
4. Transcribe and structure the read-back and the acknowledgment, and flag missing fields in the register.

It does not:

- Decide whether a value is critical or abnormal.
- Interpret what the result means.
- Recommend a treatment, a repeat test or a referral.
- Tell the patient anything clinical.
- Close a result without a human acknowledgment.

The AI is essential because the reports are unstructured, multilingual and arrive on many channels. It is not the moat. The ledger, the matching graph and the audit trail are.

## The competition, and why this is defensible

The lab software is a commodity. The hospital HIS is an incumbent. The clinic CRM is a bundle. The defensible asset is the **cross-lab, cross-channel result graph** for a clinic:

- Every report, from every lab, in one ledger.
- Every patient match, with the evidence.
- Every acknowledgment, with the owner and the time.
- Every patient communication, with the channel and the response.
- The compliance export for NABL/NABH and the insurer or the court.

A competitor can copy a screen. Copying the graph, the audit history and the clinic's trust takes longer. The network effect is the lab and clinic relationships: a lab that joins gets a closed loop with its referring doctors; a clinic that joins gets every lab in one inbox.

## The validation plan

The hardest assumptions, in order:

1. Clinics and hospitals cannot currently prove that every result was acknowledged and communicated. If they can, the problem is solved.
2. The report volume and the missing-acknowledgment rate are high enough to matter. Target: at least 30% of reports have no documented acknowledgment or patient communication.
3. A clinic or hospital will pay for the ledger. Target: at least 2 of 3 paid continuations.
4. The AI can match reports to patients at an acceptable precision. Target: at least 95% precision on a 100-report audit, with a human hold for ambiguity.
5. The acknowledgment is real, not a rubber stamp. Target: a spot audit shows the clinician can name the result and the action.
6. The product, not the founder, runs the loop. Target: autonomy ratio above 70% by week 6.

### Stage 0: four days

- 10 interviews: 4 hospital quality/ops heads, 3 clinic owners, 2 lab managers, 1 government medical officer.
- 3 report audits: the last 100 reports at each site. Count unmatched, unacknowledged after 48 hours, no patient communication, no owner, duplicate. Time how long it takes the staff to find the answer today.
- 3 paid-pilot asks: a written offer, a price, a purchase order or deposit.
- A 80-report synthetic demo: 12 unmatched, 9 unacknowledged at 48 hours, 4 lab-flagged critical, 6 patients unreachable. The ledger, the clock, the escalation, the patient message.
- Kill: if fewer than 6 of 10 sites can name a specific report that was missed, or fewer than 3 will share an anonymised sample, do not pivot.

### Stage 1: eight weeks

- 3 sites: one private hospital, one private clinic, one government district hospital.
- 1,000 reports, baseline 4 weeks, intervention 4 weeks.
- Primary KPI: percentage of reports acknowledged within the clinic's target time.
- Secondary: time-to-acknowledge, percentage of results with a documented patient communication, unreviewed results at 7 days, unmatched rate, staff minutes per report, patient reachability.
- Kill: under 20 percentage points of improvement, under 70% of reports with an owner, over 3 minutes of staff time per report, fewer than 2 of 3 paid continuations, or a rubber-stamp rate above 20% in the spot audit.

### Stage 2: repeatability

- 10 sites across 2 cities and one district.
- Measure CAC, payback, churn, win rate against the HIS incumbent.
- Test the per-report price and the lab partnership.

## The four-day demo

A synthetic cohort of 80 reports from three labs:

- 12 unmatched or ambiguous.
- 9 unacknowledged after 48 hours.
- 4 lab-flagged critical, with a read-back.
- 6 patients unreachable after three attempts.
- 0 without a disposition.

The screens:

1. **Result inbox:** every report, matched or held, with the owner and the clock.
2. **Result ledger:** the four questions for one report.
3. **Critical alert:** the lab's flag, the call, the read-back, the register entry.
4. **Morning brief:** open results, overdue acknowledgments, unmatched, unreached patients, escalations.

The demo line:

> **80 reports. 12 unmatched. 9 unacknowledged at 48 hours. 4 critical. 6 patients unreached. 0 without a disposition.**

## The pitch

The title:

> **The report nobody opened.**

The one sentence:

> **Every clinic receives reports it cannot account for. We give every report an owner, a clock and a receipt.**

The 30-second version:

> "A clinic receives hundreds of lab reports a month, from many labs, on WhatsApp and paper. The lab's job ends at delivery. No one can prove a named clinician saw the result or that the patient was told. In an Indian tertiary hospital study, 64.61% of critical values were notified 30 to 120 minutes after the sample arrived, and outpatient notification was the weak point. NABL and NABH already require a critical alert register with a read-back. Most clinics keep it on paper, or not at all. We are the result accountability layer. Every report gets an owner, a clock and a receipt. We do not interpret the result. We prove a human saw it and the patient was told."

## The honest risks

- The buyer may be the lab, not the clinic. The lab already has a LIS. The clinic-side buyer is the quality or operations head, and the lab is a channel partner.
- The Indian baseline is limited. The pilot must create it.
- Acknowledgment can be rubber-stamped. The spot audit and the time-to-acknowledge are the guardrails.
- The product can drift into clinical interpretation and device territory. The lab's flag is the only source of criticality.
- The hospital HIS incumbents can add a result inbox. The differentiation is the cross-lab, cross-channel graph and the compliance evidence.
- The market at flat clinic pricing is small. The hospital, lab and government segments are the larger path.

## The decision

Build the result accountability ledger. Keep the follow-up loop as the second loop, because it reuses the same ledger and the same patient relationship. The follow-up product is not wasted; it becomes the next module after the result inbox is trusted.

The one thing not to do is build another records dashboard. The record is the evidence. The result loop is the job.

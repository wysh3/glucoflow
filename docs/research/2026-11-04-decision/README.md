# Decision note: the result nobody owns

4 November 2026. This is an audit of the product thesis, not a claim that the market has been validated. It records what the evidence supports, what it does not, and the build that follows from the stronger problem.

## Verdict

**The pre-visit delta does not pass the genuinely-unsolved test.** It is a well-built record feature. It helps a doctor read a record, but it does not own an operational failure that a budget holder already has to fix. It is also easy for an EMR incumbent to add, and the buyer is the doctor rather than the person who owns the queue, the accreditation file or the lab relationship.

**The stronger candidate is the unowned result.** Every clinic receives reports from several labs and channels. The lab finishes when it delivers. The clinic is supposed to assign a clinician, set a clock, confirm the clinician saw it and confirm the patient was told. In practice that loop is paper, a phone gallery or nothing. NABL and NABH already require a critical alert register with the person informed, the time and a read-back.

The rest of this note treats the result ledger as the lead hypothesis. It is **not validated**. No buyer interview, no paid pilot and no willingness-to-pay test has been completed. The build is a workflow prototype and an instrument for the next test.

## What the current product does

The shipped product is a pre-visit brief. It extracts reports, holds a human review, keeps approved facts, shows a delta, and supports a result-style source view. It is useful. It is not a company:

- The job is convenience, not an unowned operational failure.
- The buyer is usually the doctor. The queue owner, quality head and lab manager are not in the buying conversation.
- The differentiation is a summary over a record. Eka, Practo, HealthPlix, Navis and hospital HIS products can add summaries.
- The product is not tied to a recurring compliance or payment event.
- A clinical summary creates interpretation risk without creating a durable workflow advantage.

The pivot is not a rebrand. It changes the unit of work from a document summary to a **result receipt**.

## The problem

**A report arrives, and no one can prove a named clinician saw it or that the patient was told.**

The failure is ordinary, not exotic:

- A lab sends a PDF to a clinic WhatsApp number. It sits in a gallery.
- A paper slip is handed to the front desk while the doctor is in another room.
- A report has the right name but the wrong identifier.
- A critical value is telephoned to a receptionist who cannot read it back.
- A patient is called once, does not answer, and no one owns the second attempt.
- A quality survey asks for the critical alert register. The clinic has a paper diary with gaps.

The Indian evidence is thin but directionally consistent. A tertiary hospital study of 1,187 critical values found 64.61% were notified 30 to 120 minutes after the sample arrived, with outpatient notification as a weak point. A systematic review of ambulatory test follow-up found 6.8% to 62% of abnormal laboratory results were not followed up. NABL 112A and NABH critical-alert guidance require a register with the patient identifiers, test, value, person informed, time of testing, time of reporting, read-back and signature.

The evidence does not include an Indian multi-site measurement of ordered tests never reviewed. That is a gap, not a proof. The pilot must measure it.

## Why this is a better company shape

**The buyer exists before the product.** A 50 to 200 bed private hospital or nursing home with NABH aspiration has a quality head, a medical superintendent and an accreditation file. A district hospital has a medical officer and a quality programme. A lab has a delivery liability and wants to prove receipt. The buyer is not the doctor alone, but the doctor is the user whose acknowledgement is the receipt.

**The product fits private and government settings.** Private hospitals pay for accreditation and risk. Public districts pay for a programme KPI and audit evidence. Both accept paper, WhatsApp and PDF. Neither needs an ABDM integration on day one.

**The same core survives Tier 2, Tier 3 and rural.** The intake is a photo, a PDF or a forwarding number. The receipt works on a shared clinic phone. The escalation can be a call, not an app. The buyer is a facility, not an individual patient.

**The regulatory clock is already running.** NABL and NABH require the register now. DPDP makes consent, purpose, retention and audit explicit by May 2027. A ledger that proves who saw what, when, is aligned with both, provided it does not interpret the result.

**AI has one honest job.** Extraction and patient matching. The lab flag is copied from the report. The product does not diagnose, risk-score, triage or recommend treatment. If the extraction is wrong, the receipt is wrong, so every match and every critical flag needs a human confirmation.

## Market, with the limits stated

- India has about 54,000 hospitals and 1.3 million beds in one 2024 industry estimate. The count is secondary and inconsistent across sources.
- NABH accreditation is concentrated. One 2026 directory lists 1,324 NABH-accredited CGHS-empanelled facilities, including 837 hospitals. Another vendor blog claims more than 4,200 accredited hospitals; that number is not usable without the primary NABH list.
- The beachhead is 500 to 2,000 hospitals with a quality function and a lab relationship, not every clinic.
- A per-facility price of ₹2,000 to ₹10,000 per month produces a small initial market. The larger path is a hospital or lab contract, not a flat clinic seat.
- A lab channel can pay for proof of delivery. A hospital can pay for accreditation evidence. A clinic alone is the weakest buyer and should not be the first sales target.

These are estimates, not a validated TAM. The pilot should replace them with contract values.

## Regulatory boundary

The product is an **administrative receipt**, not a medical device.

- The lab flag is the only source of criticality.
- No function derives a score, a triage decision, a diagnosis or a treatment.
- Acknowledgement and patient communication are human actions.
- The audit trail is append-only.
- The clinic is the data fiduciary; the product is its processor.
- The design target is DPDP 2023 and the DPDP Rules 2025, not HIPAA.
- ABDM claims are out of scope until onboarding.

A legal review is still required before a pilot contract, especially on the device boundary and the consent text.

## What the build now contains

- A clinic-level **Result ledger** at `/clinic/results`, now the clinic landing screen.
- Twelve synthetic receipts with a mix of critical, abnormal, unowned, acknowledged, informed and closed.
- A receipt drawer with source, lab flag, owner, clock, acknowledgement, patient communication, escalation and close.
- A server-enforced state machine and append-only `result_events` audit trail.
- A measured dashboard: open, unowned, overdue, median acknowledge time and informed share.
- A CSV register export for the accreditation file.
- No clinical interpretation and no automatic patient message.

The ingestion pipeline is not wired to WhatsApp, paper or a live lab feed in this slice. The rows are seeded or created through the server procedure. That is the next engineering task, not a claim.

## The validation that has not happened

The hardest assumptions, in order:

1. A quality head or medical superintendent will pay to close the result loop, not just ask for a report.
2. The baseline is bad enough to matter: at least 30% of abnormal results lack a documented acknowledgement or patient communication.
3. A two-week concierge receipt changes behaviour without the founder in the room.
4. A named clinician will accept the clock and the escalation.
5. A lab or hospital will sign a paid continuation after the pilot.

The cheapest tests:

- **10 buyer interviews.** Quality heads, medical superintendents, lab managers. Ask for the last critical result that went wrong, the current register, and the last accreditation survey finding. Do not show the app.
- **3 result audits.** 100 consecutive reports per site. Measure unowned, time to acknowledge, patient communication, critical read-back and duplicate or namesake holds.
- **2-week concierge.** Run the receipt by hand on 50 reports. Log every touch. Then run a founder-free week.
- **Paid offer.** ₹5,000, ₹10,000 and ₹20,000 per month for a 50 to 200 bed site, plus a per-report or per-bed option. Ask for a purchase order or a deposit, not a verbal yes.
- **Lab channel test.** Ask two labs whether a receipt improves their delivery liability and whether they will co-sell.

## Kill criteria

Kill or narrow the result thesis if any of these hold after the tests:

- Fewer than 2 of 3 sites can produce a report register and a named quality owner.
- Fewer than 30% of abnormal results in the baseline lack a documented acknowledgement or patient communication.
- The median time to acknowledge does not improve by at least 25% in the pilot.
- The unowned rate stays above 10% after four weeks.
- The founder is still doing the chasing in week five.
- No site signs a paid continuation or deposit after the pilot.
- A hospital asks for clinical interpretation, risk scoring or a diagnosis as a condition of purchase. That is a different, regulated product and should be declined.
- A lab or HIS incumbent already provides the exact cross-lab receipt and accreditation export at the pilot site.

If the first two fail, stop the result thesis and do not build more software. The honest fallback is a services-led records workflow, not a new AI feature.

## What changed in the product, and what did not

Changed:

- The clinic landing route and the public home now lead with the result ledger.
- The clinic rail has Results first.
- The result receipt is server-backed, not a mock.
- The audit trail is append-only and the export is real.
- The demo seed creates twelve synthetic receipts.

Not changed:

- The existing pre-visit delta remains available inside a patient record. It is no longer the lead story.
- No real WhatsApp ingestion, lab feed, ABDM integration or patient messaging is claimed.
- No customer, price or willingness-to-pay claim is made.

## The one-sentence answer

**We found a better problem than the one the product was built around, built the narrow receipt for it, and still have to prove that a quality buyer will pay and that the loop changes behaviour without the founder.**

## Sources

- Critical-value notification in an Indian tertiary hospital: [PMC4310845](https://pmc.ncbi.nlm.nih.gov/articles/PMC4310845/).
- Ambulatory test follow-up review: [J Gen Intern Med 2012](https://doi.org/10.1007/s11606-011-1949-5).
- NABH accredited-hospital directory: [NABH portal](https://portal.nabh.co/frmViewAccreditedHosp.aspx/index.aspx).
- NABH-accredited CGHS-empanelled facility directory: [CGHS directory](https://cghshospitals.com/accreditation/nabh).
- NABL accreditation information: [NABL India](https://nabl-india.org/).
- DPDP Act 2023 and DPDP Rules 2025: [MeitY](https://www.meity.gov.in/).
- Hospital and bed count, treated as a secondary industry estimate: [J Neonatal Surg citation of the 2024 report](https://www.jneonatalsurg.com/index.php/jns/article/download/2825/2539/13854).

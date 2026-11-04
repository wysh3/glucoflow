# Result ledger validation script

This is the next gate. No code is built until the first two stages produce a decision.

## Stage 0: ten buyer interviews

Recruit quality heads, medical superintendents, lab managers and clinic owners from private hospitals, district hospitals and independent labs. Use one Tier 2 cluster first. Do not show the product until the last five minutes.

### Questions

1. "Walk me through the last critical lab result that went wrong in this hospital. What happened?"
2. "Show me the critical alert register you keep today. Who writes in it? Who checks it?"
3. "When a report arrives from an outside lab, how does it reach the doctor? What happens if the doctor is on leave?"
4. "How do you know a result was acknowledged? How do you know the patient was told?"
5. "What did your last NABH or NABL survey ask for on critical results? What did they find?"
6. "Who owns the result inbox? Is it a role, a person or nobody?"
7. "How many reports arrive on WhatsApp or paper in a week? Who opens them?"
8. "What happens when the patient's phone number is wrong or the report has the wrong identifier?"
9. "What have you tried? An LIS inbox, a WhatsApp group, a paper register, a quality project?"
10. "Who signs a purchase order for a quality or accreditation tool? What budget line?"
11. "What would make you cancel after two months?"
12. "May I audit 100 consecutive reports with the names removed, and shadow the result inbox for one day?"

### Record

- Whether the person can name a specific failure in the last six months.
- Whether a register exists and who maintains it.
- The last survey finding, in their words.
- The budget owner and the approval path.
- A yes or no to the audit and the shadow day. A verbal "interesting" is not a yes.

### Gate 0

- At least 6 of 10 name a specific failure.
- At least 3 of 10 have a register and will share 100 de-identified reports.
- At least 2 of 10 can name the budget owner and the approval path.
- If these fail, stop. The result problem is not acute enough in this sample.

## Stage 1: result audit

For each site, take 100 consecutive reports. Measure:

| Field | Definition |
|---|---|
| Unowned | No named clinician is recorded against the result |
| Overdue | The site's own clock has passed without acknowledgement |
| Acknowledged | A named clinician is recorded as having seen it |
| Patient informed | A channel and time are recorded |
| Critical read-back | A critical result has a documented read-back and the person informed |
| Namesake or duplicate | A report that could not be safely matched |
| Time to acknowledge | Report received to named acknowledgement |

No patient identifiers leave the site. Aggregate only.

### Gate 1

- At least 30% of abnormal results lack a documented acknowledgement or patient communication.
- At least one critical result in the sample lacks a complete read-back or a named owner.
- If both fail, the pain is not large enough to justify the product.

## Stage 2: two-week concierge receipt

Run the receipt by hand at two sites. No product automation beyond the ledger.

- Every report gets an owner and a clock.
- Every acknowledgement, patient call and escalation is logged with a timestamp.
- The founder may train, but must not chase after day three.
- In week two, the site runs the loop without the founder for five consecutive working days.

### Measures

- Percentage of reports with a named owner within one hour.
- Median time to acknowledgement, compared with the audit baseline.
- Percentage of acknowledged results with a patient communication receipt.
- Escalations per 100 reports.
- Staff minutes per report, sampled.
- Founder touches per day. Target: zero in the founder-free week.
- Number of reports that could not be matched safely.

### Gate 2

- Median acknowledgement improves by at least 25% over baseline.
- Unowned results fall below 10%.
- At least 90% of critical results are acknowledged within the site's target.
- Founder touches are zero in the founder-free week.
- If any fail, the workflow is not yet a product.

## Stage 3: paid continuation

Offer three prices to three sites:

- ₹5,000 per month for a 50-bed site.
- ₹10,000 per month for a 100-bed site.
- ₹20,000 per month for a 200-bed site.
- Alternative: ₹50 per report, capped at the monthly price.

Ask for a purchase order, a deposit or a signed pilot continuation. A verbal yes is not a sale.

### Gate 3

- At least 1 of 3 sites pays or signs.
- The objection is recorded.
- If none pay, the problem may be real but the buyer or the price is wrong. Do not scale.

## Kill criteria

Stop the result thesis if any of these hold:

- Fewer than 2 of 3 sites have a quality owner and a result register.
- Fewer than 30% of abnormal results lack a receipt in the audit.
- Median acknowledgement does not improve by 25%.
- The founder is still chasing in the founder-free week.
- No site pays after the pilot.
- The buyer requires diagnosis, risk scoring or triage. That is a regulated clinical product, not this one.

## What must not be claimed

- "Validated" before Stage 3.
- "Clinically proven" at any point.
- "ABDM integrated" without onboarding.
- "AI triage" or "risk score".
- A measured time saving from a founder-run demo.

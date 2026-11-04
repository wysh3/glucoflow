# Glucoflow submission answers

**Track:** Diabetes care
**Product:** A patient-closure ledger for abnormal and critical diabetes results.
**Demo:** https://glucoflow.vercel.app/sign-in
**Public receipt check:** https://glucoflow.vercel.app/verify

> Before submitting, replace the three bracketed team fields in section 4 with the real names and the practising-doctor qualification. The portal requires a clinical lead and a technical lead. The current receipt data is synthetic.

## 1. The exact problem

The lab is finished when it delivers the report. The clinic is not finished when a doctor clicks acknowledge. For a diabetes patient, the result that changes the next step is often an abnormal or critical potassium, eGFR, uACR or HbA1c. It arrives on WhatsApp, as a PDF or on paper. The clinic still has to prove four things: a named clinician saw the printed value, the lab caller and read-back were recorded where critical, the patient or caregiver was actually reached, and the next administrative step happened.

In an Indian tertiary hospital with a written critical-call policy, a log book and a read-back rule, only 25.8% of 1,187 critical values reached the treating clinician; 52.9% went to nursing staff and 90% of never-notified values were outpatients (Agarwal et al., Indian J Clin Biochem 2015, PMC4310845). In an Indian secondary-care setting, 14% of positive results never returned (NMJI 2015). A systematic review found 6.8% to 62% of abnormal ambulatory results were not followed up (J Gen Intern Med 2012).

The market has tools that stop at clinician acknowledgement. It does not have a patient-side closure record that says: reached, or tried twice and failed; informed, or declined; next step booked, or completed. That last mile is the problem.

## 2. What changes if it is solved

Every abnormal or critical diabetes result gets one administrative receipt:

- A named clinician echoes the printed value and selects the printed flag. A wrong value is refused.
- For a critical result, the lab caller, their role and the value read back are recorded.
- The front desk records who was reached, the channel, the language and the next administrative step.
- A failed contact is a first-class row. After two attempts, the receipt can close as unreachable, never as a false "informed".
- The quality team gets a closure certificate with the event timeline and evidence present. The patient gets a receipt slip and a no-PHI public stage check.

The measurable change is closure rate within 7 days, median time from lab release to patient contact, the share of results with documented attempts, teach-back and next-step completion.

## 3. What we are building

A patient-closure ledger for diabetes clinics and hospitals, with a lab channel.

- Import a lab feed from CSV, PDF or paper. The lab flag is copied, never calculated.
- Match the report to a patient using the printed name and clinic ID. Ambiguity is shown as a candidate list and held for a human.
- Assign a named clinician. The due clock starts at lab release, not when the PDF reached a WhatsApp folder.
- The clinician marks the result seen with one tap. The nurse records the read-back before an informed outcome.
- Record patient or caregiver contact, language and the next step. Log every failed attempt.
- Escalate overdue receipts on a timer and queue a notification. The current delivery adapter is in-app; SMS and WhatsApp are the next gate.
- Anchor the audit chain with a stored event count and head. Publish a public stage page with no patient name, test value or clinical decision.
- Print a closure certificate with a section 63(4) draft and a patient receipt slip with a QR code.

The current build includes twenty synthetic diabetes receipts across ten patients and four labs, four role homes on one obligation state machine, a one-tap clinician line, a nurse read-back sheet, a desk intake hold, a quality register with exceptions and A4 print, a labelled replay and a public receipt. The code is at github.com/wysh3/glucoflow. The hosted alias serves the earlier ledger until the deployment is refreshed.

The first protocol is the check a diabetes drug makes necessary: start or titrate an ACE inhibitor or ARB, then potassium and eGFR at two to four weeks. The same receipt covers SGLT2i, MRA, annual uACR/eGFR, a critical potassium or an abnormal HbA1c. The clinician sets the protocol. The lab flag sets criticality. The product never infers a screening deadline or a clinical action.

## 4. Why this team

**Clinical lead:** [practising doctor name], [qualification and registration or institution]. Owns the protocol, the pilot sites and clinical sign-off.

**Technical lead:** [name]. Owns the receipt state machine, anchored audit chain, API, matching and instrumentation.

**Product and design:** [name]. Owns the closure certificate, patient slip and the three-minute demo.

The team has shipped a working clinical record pipeline, human review, source binding, server authorization and a hosted deployment. The current build adds the obligation lifecycle tests, the assign-before-match guard, the 20-hour exception interval, the stage-clock escalation and the anchored receipt chain.

## 5. Whether any part already exists

Yes, the clinician-side alert is commoditised in India. PathLab Software sells critical-value auto-call, WhatsApp delivery and an acknowledgement log. OneCity records clinician read-back. CrelioHealth shipped a critical callout in October 2026. Hospital HIS and LIS products bundle a result inbox. We do not claim that the alert, the read-back or the audit log is novel.

The unclaimed part is the patient side after clinician acknowledgement. The existing tools generally stop at the doctor. Our receipt records who was reached, the language, the failed attempts, the unreachable disposition and the next step, and it gives the quality team a closure certificate. The network is the expansion thesis, not the current product. Today this is one lab feed and one clinic ledger.

The AI is identity resolution, not diagnosis. The matching layer scores the printed name against the clinic ID and shows its reasons. It never guesses an ambiguous patient. There is no extraction model in this slice; the lab feed is a CSV adapter. We do not claim live AI extraction.

## 6. Evidence and validation status

The problem evidence is secondary, not a customer study:

- Only 25.8% of 1,187 critical values reached the treating clinician; 52.9% went to nursing staff; 90% of never-notified values were outpatients (PMC4310845).
- 14% of positive results never returned in an Indian secondary-care setting (NMJI 2015).
- 6.8% to 62% of abnormal ambulatory results were not followed up (J Gen Intern Med 2012).
- 101 million people in India live with diabetes (ICMR-INDIAB-17, 2023).

What we ran: 212 unit and integration tests across 33 files, including the obligation lifecycle; 19 browser checks across four specs; 12 database isolation checks; a production build; and a seeded demo with 20 receipts.

What we have not validated: no buyer interview, baseline audit, paid pilot, purchase order or LOI; no live LIS, HL7/FHIR or WhatsApp send; no consent capture, DPA or retention runbook; no external chain anchor; no clinical validation; no NABL or NABH certification. The receipt data is synthetic. Do not claim otherwise.

The next gate is one lab or OPD sponsor, one practising clinical lead and 100 de-identified reports per site. The kill criteria are in the brief and the decision memo.

## 7. The demo

1. Open https://glucoflow.vercel.app/sign-in and choose the clinic team.
2. On a 300-report synthetic cohort, the modelled closed-within-SLA share is 37.7% at baseline and 86.7% with the loop. The page labels the cohort synthetic, and the closed share tracks the 86% reachability assumption.
3. Press Import lab feed. The synthetic CSV creates a critical potassium and an unmatched sodium report.
4. Open the sodium report. The candidate list shows the printed name and clinic ID; the namesake is held for a human.
5. Open the owned potassium report. Type 5.9, select critical, enter the lab caller and read back 5.9. A wrong value is refused by the server.
6. Record two unreachable attempts. Close the receipt as unreachable. It never becomes "informed".
7. Open the closure certificate. The evidence is present, the timeline is complete, the QR opens the public stage page and the section 63(4) draft is ready for signature.

The demo is synthetic. It is a product and validation demo, not clinical advice.

## 8. Ask

One lab chain or diabetes OPD sponsor. One practising clinical lead. 100 consecutive abnormal or critical diabetes reports per site for eight weeks. A baseline audit, then the closure workflow, then a paid continuation.

Pilot price hypothesis: ₹60,000 for 90 days, one lab, one diabetes OPD and one ward. The continuation is a signed decision, not a survey answer. If the baseline gap is under 30%, or a false informed row appears, we stop.

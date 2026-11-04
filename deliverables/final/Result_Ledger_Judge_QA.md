# Judge Q&A battlecard

Use short answers. Name the evidence, then stop. Do not claim a pilot, a customer, a payment or a live lab connection that has not happened.

## "What is actually new? Labs already send alerts."

The alert is not new. The patient-side closure is. Indian lab tools stop at clinician acknowledgement: PathLab logs the call, OneCity records read-back, Crelio shipped a critical callout. None of them gives the clinic a first-class "unreachable after two attempts" disposition, a recorded next administrative step and a closure certificate the quality team can file. We are the last mile after the lab's job ends.

## "This is just another result inbox."

An inbox stores a report. This is a state machine with server-enforced controls: the clinician must type the printed value; a critical result needs the lab caller and the value read back; two attempts are required before an unreachable close; every attempt is an event; the chain is anchored by a stored count and head. The demo shows the refusal, not just the happy path.

## "Can the receipt be gamed? A doctor can click without reading."

Yes, a determined clicker can still lie. We do not claim the receipt proves clinical judgement. We reduce the cheapest lie: the nurse cannot record an informed outcome without the read-back, and an unmatched report cannot be assigned to a clinician. The certificate is an administrative attestation. The next gate is a sampled audit against phone records; a row that says informed without a corroborating call is the failure we test for.

## "What is the AI?"

Identity resolution. Reports arrive with name variants, transliterations, shared family phones and incomplete identifiers. The matcher scores the printed name against the clinic ID and shows its reasons. Ambiguity is held for a human. There is no diagnosis, triage, risk score or treatment advice. The current slice uses a CSV lab feed, not a live extraction model. We do not claim otherwise.

## "Why would a lab pay?"

Report delivery is commoditised. A lab competes on turnaround, accuracy and referring-doctor loyalty. Proof that the last mile closed is a differentiator, and the lab already owns the report and the patient contact. The pilot is ₹60,000 for 90 days with one lab, one diabetes OPD and one ward. The continuation is a signed decision, not a survey answer.

## "Why not sell directly to hospitals?"

The hospital quality head is the champion and the clinical lead is the user. Direct hospital sales are slow and the quality head often has no independent budget. The lab chain is the distribution wedge: one sale, many referring clinics. A hospital group quality cell is the second channel. We will test both, starting with one lab or OPD sponsor.

## "Does this meet NABL 112A or NABH?"

No. We do not certify compliance. The certificate is an evidence map: lab release, the clinician's one tap, the nurse read-back, patient contact or documented attempts, next step and the anchored chain. The assessor decides what the evidence proves. The current register is not a full NABL register: it does not yet carry a lab accreditation number, a signature image or an amended-report path. Do not claim certification.

## "What about DPDP and patient privacy?"

The demo is synthetic. Before real patient data, the clinic needs a notice and consent capture, a processor agreement with DPDP section 8 terms, retention and erasure, a grievance path and a breach runbook. The public stage page returns only the stage and chain validity; it never returns a name, test value, diagnosis or clinical decision. The receipt can be revoked after a lawful erasure. Legal review is a pilot gate, not a claim.

## "The hash chain is not real proof. It is in your database."

Correct. It is tamper-evident inside one administrative domain, not an external timestamp. The chain stores an event count and head, so tail truncation and row edits are detectable. A daily signed anchor to the quality head is the next step. We do not claim a third-party trust anchor today.

## "What have you actually validated?"

The workflow is built and tested. Demand is not. We have no buyer interview, baseline audit, paid pilot, purchase order or LOI. We have 212 unit and integration tests across 33 files, 19 browser checks across four specs, 12 database isolation checks, a production build and a seeded demo. The next gate is one lab or OPD sponsor, one clinical lead and 100 de-identified reports. If the baseline gap is under 30%, we stop.

## "Why diabetes?"

101 million people in India live with diabetes. The first protocol is the check a diabetes drug makes necessary: potassium and eGFR at two to four weeks after starting or titrating an ACE inhibitor or ARB. The same receipt covers SGLT2i, MRA, annual uACR/eGFR, a critical potassium or an abnormal HbA1c. The clinician sets the protocol; the lab flag sets criticality; the product never infers a screening deadline or a clinical action.

## "What if an incumbent copies it?"

They can copy the inbox. The patient-side closure, the unreachable disposition and the installed certificate are a workflow and a record, not a screen. The lab channel and the installed audit history are the defensibility. The network is the expansion thesis, not the current product.

## "What is the three-minute story?"

Open on the 25.8%: only one in four critical values reached the treating clinician. Show the receipt: one tap, nurse read-back, patient contact or documented attempts, the register exception, the certificate and the public stage. Close on the ask: one lab, one clinical lead, 100 reports, eight weeks. Do not spend the three minutes on architecture.

## "Who is on the team?"

The clinical lead, technical lead and product lead are named in the submission form. Replace the bracketed fields before submitting. The portal requires a practising doctor or a final-year medical student as the clinical lead and a separate technical lead.

## "What should we not claim?"

Do not claim validated demand, a pilot, a customer, a payment, a live LIS or WhatsApp connection, ABDM integration, NABL or NABH certification, clinical validation, or an external chain anchor. Do not claim the public page proves a clinical decision. It proves an administrative stage and the integrity of the recorded chain.

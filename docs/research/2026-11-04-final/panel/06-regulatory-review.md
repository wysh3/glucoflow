# Regulatory review (synthesis)

**Status: a synthesis review prepared from the repository's regulatory map, the CDSCO guidance and the DPDP Rules. It is not an independent judge's scorecard and is not included in the panel mean.** It exists because the eighth judge (regulatory counsel) did not complete in time, and the ranking should not be presented without a clearance view.

**Verdict in one line:** T1 is clearable with five drafting conditions; T4 is clearable only if reframed; T2, T3 and T5 are clear but not recommended on other grounds.

---

## 1. Clearance table

| Thesis | Device risk under CDSCO July 2026 | DPDP burden | Clearance |
|---|---|---|---|
| **T1 Closure Ledger** | **Low.** Administrative receipt: ingest, identity match, assignment, acknowledgement, communication, audit. No diagnosis, no risk score, no triage, no treatment recommendation | Medium: consent, notice, retention, processor contract, grievance | **Clear with conditions** |
| T2 90-Day Recheck | Low: scheduling and communication | Medium–high: outreach consent, opt-out, language, no clinical content in the message | Clear with conditions |
| T3 Annual Review Pack | Low–medium: "annual review" can read as a clinical assessment if it interprets results | Medium | Clear only as a checklist of *documented* tests with no interpretation |
| T4 Bag Reconciliation | **Medium.** "Detect stopped drugs and impossible dates" edges into treatment recommendation and clinical interpretation | Medium | **Reframe or refuse** |
| T5 Identity Firewall | Low: data integrity and linkage | Medium | Clear |

---

## 2. The five conditions on T1

1. **The lab flag is copied, never computed.** No function may derive criticality, a score, a priority or a "likely to deteriorate" signal. The register may sort by the lab's flag; it may not create one.
2. **No outcome claim.** The pitch and the product say "administrative receipt", not "improves outcomes", "reduces harm" or "saves lives". The measured KPI is a workflow state, not a clinical endpoint.
3. **Every patient message is human-initiated.** No autonomous clinical advice. A red-flag phrase in a patient reply creates an administrative callback task for a human; it does not become a triage decision.
4. **Consent is real, not a policy PDF.** The clinic is the fiduciary; the product is the processor. Per-patient consent record with version, language and channel; itemised notice; one-tap stop; at least one year of retention; a named grievance officer with a 90-day clock; a processor contract with every vendor, including the messaging provider and the model provider.
5. **The receipt must not read as a clinical assurance.** The public verifier returns roles and times only. The certificate carries the line: "Administrative receipt. Not a clinical opinion. The lab's flag is reproduced, not interpreted." The patient slip says the same in the patient's language.

---

## 3. The liability paradox

The doctors' panel raised the sharpest objection in the pack: an append-only record that shows a critical flagged at 08:50 and acknowledged at 18:42 is a plaintiff's exhibit, and the doctor's tap is an admission that she saw it.

The design answer is threefold and must be built before a pilot contract:

1. **The clock belongs to the institution until a human accepts custody.** It does not start against a named doctor because a report landed while she was in theatre.
2. **The receipt records the review as a clinical act, not a confession of delay.** It shows when the clinician was presented, when she saw it, and why any pause occurred. The pause reason is part of the record.
3. **The nurse can acknowledge receipt and record the communication on the clinician's behalf.** The clinician's confirmation attaches only when she confirms she has seen the value.

Before a paid pilot, counsel should confirm:

- Whether the receipt is discoverable, and in what form.
- Whether an empty pause-reason field creates an adverse inference.
- Whether the verifier's "valid" response could be read as a clinical assurance.
- Whether the clinic's consent notice covers the audit trail and the lab's access.

This is a 2–3 hour review, not a programme.

---

## 4. Patent position

- **Section 3(k)** excludes a computer programme per se. The fileable technical effect is error-rate control at a fixed human-review budget (identity abstention), allocation of a scarce physical resource under deadlines (escalation), and tamper detection (receipt).
- **The hash chain alone is prior art.** Do not file it as the invention.
- **The strongest claim** is the household-discount identity method with harm-calibrated abstention and expected-information-gain review ordering. It has a measurable technical effect and no close prior art in the clinical setting.
- **The disclosure problem.** The repository is publicly readable. Anything already published is probably not patentable now. File a provisional on the undisclosed mechanisms before any further public disclosure, and record the first public disclosure date. Details in `05-PATENT-DOSSIER.md`.

---

## 5. What the pitch must not say

- "HIPAA-compliant." Wrong jurisdiction.
- "ABDM-integrated." No integration exists.
- "AI triage", "risk score", "early warning", "predicts deterioration".
- "Improves outcomes", "saves lives", "reduces complications".
- "Clinical decision support".
- "The AI reads the report and decides what is critical." It does not; the lab decides.

## 6. What the pitch should say

- "Administrative receipt, not a clinical opinion."
- "The lab's flag is reproduced, not interpreted."
- "The clinic is the data fiduciary; we are its processor."
- "Designed for the DPDP Rules 2025, with consent, notice, retention and audit in the product."
- "Every escalation ends at a named human. The system never gives clinical advice."

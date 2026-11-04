# Indian regulatory map for a non-clinical follow-up product

Prepared 3 November 2026. This is a product and operations memo, not legal advice. The regulatory research memo is the source for the dates and citations; the official texts should be checked before a pilot contract. The key correction for the reviewer: **HIPAA is a United States statute. It does not apply to an Indian clinic treating Indian patients.** India's applicable stack is different, and the most important date is 13 May 2027.

## The short answer

| Question | Answer |
|---|---|
| Does HIPAA apply? | No. HIPAA (45 CFR 160 and 164) binds US covered entities and their business associates. An Indian clinic and its Indian software vendor are neither. If the product ever touches a US covered entity's data, HIPAA can reach the vendor by contract, not by Indian law. |
| What applies today? | The DPDP Act 2023 and the DPDP Rules 2025 are enacted; the substantive duties commence **13 May 2027**. The DPDP Rules' security, notice and processor duties are the design spec now. The IT Act s.43A and the SPDI Rules 2011, the CERT-In directions (28 April 2022), the NMC Telemedicine Guidelines 2020, the CDSCO device rules and guidance, the ICMR AI ethics guidance, NABH standards where accredited, and state clinical-establishment law also apply. |
| What is the single most important compliance date? | **13 May 2027** for the substantive DPDP obligations (consent, notice, rights, security, breach, grievance, children). The consent-manager rule starts 13 November 2026. Build to the 2027 spec now. |
| Who is the data fiduciary? | The clinic. The product is its **data processor**. The consent notice, purpose, withdrawal and grievance path belong to the clinic; the product must make them easy and auditable. |
| Is the product a medical device? | Not if it stays a scheduling, reminder, communication and record-transport tool. The CDSCO software guidance (July 2026) excludes hospital and clinic information systems used for admission, scheduling, billing, communication and storage. A risk score, triage, early warning, behaviour-change programme or "improves outcomes" claim can flip it into a medical device. |

## The instruments that matter

| Instrument | Status and date | Who it binds | What it requires | Product implication |
|---|---|---|---|---|
| **DPDP Act 2023** (Act 22 of 2023) | Enacted 11 August 2023; substantive sections 4 to 16 commence 13 May 2027 | Every data fiduciary processing digital personal data in India | Consent or a legitimate use; notice; purpose limitation; erasure; children's data; significant-data-fiduciary duties; data-principal rights | The clinic is the fiduciary, the product is the processor. Build consent, notice, purpose, erasure and rights into the workflow. |
| **DPDP Rules 2025** (G.S.R. 846(E), 13 November 2025) | Rules 1, 2, 17 to 21 in force 13 November 2025; consent managers 13 November 2026; rules 3, 5 to 16, 22 to 23 on 13 May 2027 | Fiduciaries and processors | Standalone itemised notice; encryption, access control, logs, backups, processor contract; keep logs and personal data at least one year; breach to principals without delay and to the Board within 72 hours; erasure with 48-hour warning; published contact; verifiable parental consent; annual DPIA and audit for significant fiduciaries; grievance reply within 90 days; cross-border transfer open unless restricted | The product needs a consent record (timestamp, version, language), field-level purpose map, one-year retention, audit logs, a breach playbook, a grievance owner, and a processor contract. |
| **Data Protection Board** | Established 13 November 2025; chairperson and members advertised June 2026, still unappointed as of the October 2026 reporting | Adjudicator | Complaints, inquiries, penalties | No enforcement capacity today. Do not rely on that lasting; the 2027 date is the real deadline. |
| **ABDM Health Data Management Policy** | The public text is the 2020 policy; a revision has been pending since 2022 | ABDM participants (HIP, HIU, consent managers) | Consent artefact per request, federated storage, purpose-bound access, audit | The product can be "ABDM-shaped" (FHIR, consent, audit) but cannot claim ABHA or ABDM integration without onboarding. Say "ABDM-shaped, not connected". |
| **NMC Telemedicine Practice Guidelines 2020** | In force; NMC clarified remote digital signing in October 2026 | Registered medical practitioners and the platforms they use | Practitioner identity, informed consent, consultation record, no Schedule X or narcotics, first-consult limits | A reminder, a scheduling message or a logistic question is not telemedicine. Clinical advice, triage or a dose change is. Keep the agent out of clinical advice; route red-flag phrases to a human callback. |
| **EHR Standards for India 2016** | Voluntary; no licence gate; the MoHFW page was unreachable from the research host, so the current status is unconfirmed | Anyone claiming EHR conformance | SNOMED CT, LOINC, ICD-10, FHIR exchange profiles | Adopt FHIR and LOINC for lab data, SNOMED for problems. Never write "EHR Standards certified". |
| **MDR 2017 and CDSCO software guidance CDSCO/MD/GD/MDSW/01/2026** | In force; guidance final July 2026 | Makers of software with a medical purpose | A device if intended for diagnosis, prevention, monitoring, treatment or alleviation; licence, QMS, clinical evidence by class | Stay in the scheduling, reminder, communication and record-transport lane. No risk score, triage, early warning, behaviour-change programme or outcome claim. |
| **ICMR Ethical Guidelines for AI in Biomedical Research and Healthcare 2023** | Guidance, not statute | Researchers, institutions, deployers | Accountability, human oversight, transparency, privacy, bias testing, documentation | Document intended use, the human review step, the data provenance and a bias check before a pilot. |
| **NABH hospital and Digital Health Standards** | Live; Digital Health Standards Gold certifications in 2026 | Accredited facilities | Medical record content and retention, critical-result communication, audit trail, access control | If the clinic is accredited, the product's audit trail becomes survey evidence. That is a selling point. |
| **IT Act 2000 s.43A, SPDI Rules 2011, CERT-In Directions (28 April 2022)** | Still in force; the DPDP Act does not expressly repeal them | Body corporates handling sensitive personal data, including health | Consent, reasonable security, cyber-incident reporting to CERT-In within 6 hours, 180-day logs in India | The product needs an incident clock and India-resident logs regardless of the DPDP timeline. |
| **Clinical Establishments (Registration and Regulation) Act 2010** | In force where the state has adopted it; adoption varies | Clinical establishments | Registration, record keeping, staff norms | Check the pilot state's adoption before promising a government deployment. |
| **Aadhaar Act 2016, Consumer Protection Act 2019, IRDAI, Drugs and Cosmetics Act** | In force | Varies | No Aadhaar demand for service unless authorised; no misleading claims; separate licences for insurance and pharmacy | Do not build Aadhaar-only onboarding. Keep claims operational. |

## The device boundary is the biggest product risk

The CDSCO guidance is the fastest way to void a pilot. A follow-up product is on the safe side when it does:

- Scheduling, reminding, rescheduling and confirming attendance.
- Communicating logistics: where, when, what to bring, who to call.
- Transporting a record or a document between the clinic and the patient.
- Capturing the patient's own reason for not attending.
- Assigning a human task and auditing the outcome.

It is on the unsafe side when it does any of these:

- Calculates a risk score, a priority score or a "likely to deteriorate" score.
- Triages symptoms or tells the patient what the symptom means.
- Recommends or changes a treatment, dose or test.
- Claims to improve clinical outcomes, survival or control.
- Runs a behaviour-change or digital-therapeutic programme for a disease.

The product's language must reflect this. "Barrier" is a patient-reported logistic reason, not a clinical assessment. "Escalation" is an administrative handoff to a human, not a triage decision. "Priority" is a worklist order, not a clinical risk score. The pitch should say: "We do not interpret the patient's health. We find out what is stopping them from coming and who can help."

## Consent and trust design for the patient

The patient is asked to share a phone number and a reason for not attending. That is a small ask, but it is health-adjacent and it arrives on WhatsApp, where spam is common. The design must make the ask legible:

1. **Clinic-branded, not startup-branded.** The message says "This is [Clinic]. We are checking whether you can come for your follow-up." The product's name appears only in a footer or a privacy link.
2. **A standalone, itemised notice** in the patient's language, before the first message: what data is used, why, who processes it, where it is stored, how to withdraw, how to complain.
3. **Separate consent for WhatsApp**, naming Meta as a processor and the storage country. Do not bury it in the clinic's general terms.
4. **Consent capture** with timestamp, version, language and channel. Store it per patient, not per clinic.
5. **Data minimisation.** Do not send clinical values, diagnoses or test results in the message. The message says "your follow-up is due", not "your HbA1c is 9.2".
6. **A one-tap stop.** "Stop messages" works immediately and is recorded. The clinic can still call the patient; the product cannot message them.
7. **A human escape hatch.** "Call the clinic" is always visible. The agent never traps the patient in a bot.
8. **A grievance path.** A named person, a phone number and a 90-day response clock, published on the clinic's page and in the message footer.

## The 12-item pilot checklist

1. Standalone, itemised consent notice; withdrawal link; Board complaint link.
2. Separate WhatsApp consent naming Meta as processor and the storage country.
3. Consent record with timestamp, version and language, per patient.
4. Paediatric rule: the Fourth Schedule Part A exemption for clinical establishments and health professionals covers health-service processing; rely on it in writing and keep product analytics and marketing outside it.
5. Field-level data map with a purpose per field; delete fields with no purpose.
6. Retention schedule: at least one year for logs and data; erase the rest when the purpose ends, with a 48-hour warning.
7. Encryption at rest and in transit; access control; per-user audit logs.
8. Breach playbook: principals without delay, Board within 72 hours, CERT-In within 6 hours.
9. Named grievance officer with a published 90-day clock.
10. Processor contracts with the clinic and every vendor, including WhatsApp and the model provider.
11. India storage, or a documented cross-border basis; a DPIA if notified as a significant data fiduciary.
12. Lawyer sign-off on the consent text, the processor contract and the device-scope question.

## What this means for the pitch

Do not say:

- "HIPAA-compliant." It is wrong for India and a judge may know it.
- "ABDM-integrated." There is no integration.
- "AI triage." That is a clinical function and a device risk.
- "Risk score." Same.
- "Improves outcomes." Unmeasured and device-adjacent.

Say:

- "Designed for the DPDP Rules 2025, with consent, notice, retention and audit built in."
- "ABDM-shaped: FHIR, consent and audit, without an integration claim."
- "Administrative follow-up, not clinical advice."
- "Every message and every disposition is logged; a human owns every escalation."
- "The clinic is the data fiduciary; we are its processor."

## The one-sentence answer to the reviewer

**HIPAA is US law and does not apply here; India's law is the DPDP Act 2023 and the DPDP Rules 2025, whose substantive duties start on 13 May 2027, plus the IT Act, the NMC telemedicine guidelines, the CDSCO device rules and NABH where accredited. We have designed the product as an administrative follow-up processor, not a clinical device, and the consent, notice, retention and audit are in the product, not in a policy PDF.**

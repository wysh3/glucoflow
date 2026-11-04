# Panel brief: Health-a-thon 2026, diabetes track

**Prepared 4 November 2026 for an independent judging panel.** This file is the shared fact pack. Every judge reads this first, then gives an independent score. Nothing here is a recommendation; the recommendation is the panel's job.

**Rules for judges**

1. Do not invent numbers. Use the numbers in this pack, or label a new claim `unverified`.
2. Be willing to kill. A polite score is a useless score.
3. Separate what is built from what is claimed. Section 3 says which is which.
4. Judge the *startup*, not the deck.
5. Write your memo to your assigned file. Do not modify product code.

---

## 1. The competition

| Item | Fact |
|---|---|
| Programme | Health-a-thon 2026, Koita Foundation + Koita Centre for Digital Health (KCDH), IIT Bombay |
| Platform | Reskilll |
| Clinical partners | National Cancer Grid (NCG), RSSDI (diabetes), FOGSI (maternal) |
| Technology partner | Sarvam AI |
| Tracks | Cancer, diabetes (RSSDI), maternal and child (FOGSI) |
| Prize pool | ₹54+ lakh, split across the three tracks; every finalist is awarded |
| Finale | 28 November 2026, IIT Bombay, Powai, in person, live demonstration |
| Team | 2–5 people, one practising doctor and one technical lead |
| Data rule | Fake or fully anonymised data only |
| Stated scope | "Assistive, not diagnostic." Workflow, operations, continuity, engagement, administration |
| Verbatim out of scope | "Clinical AI solutions involving diagnosis, treatment recommendations, clinical decision support, clinical risk scoring, interpretation of medical data or autonomous clinical advice" |
| Published design bar | Real workflow pain; existing AI capabilities; light integration; usable in a busy clinic and by low-digital-fluency users; multilingual and caregiver-friendly; human override and audit trail; a named operational KPI; demonstrable results in 60–90 days; low-cost channels; a credible pilot path in 2–3 months |
| Named KPI examples | recall completion, time-to-note, no-show rate, handoff lag |
| Official use cases (13) | follow-up and continuity; consultation readiness; registry and population health; clinic flow; doctor productivity; patient education; practice growth; care-journey companion; long-term engagement; caregiver support; navigation; financial/admin; patient progress |
| Evaluation | No public weights. Jury and organisers decide. Design bar is the only published proxy. |
| Judge profile (inferred from programme) | Two doctors and one technology expert on the final panel |

**The scoring reality.** At the finale the judges see many teams. The three obvious diabetes ideas — a records timeline, a follow-up/recall agent, an ambient scribe — are all being built by other teams in this same programme (see §4). Differentiation is not a nice-to-have; it is the entry ticket.

---

## 2. The problem space the judges will recognise

An Indian diabetes OPD, Tier 1 or Tier 3, public or private, runs on a repeating rhythm: measure, decide, tell the patient, book the next test, repeat. Four things leak in that rhythm:

1. **The result leak.** A report comes back. It reaches a WhatsApp number, a paper pile or a portal. Nobody can prove a named clinician saw it, or that the patient was told. Critical values are the extreme case, but abnormal HbA1c, eGFR, urine ACR, potassium and lipids are the everyday case.
2. **The recheck leak.** The doctor says "come back in three months". Nobody owns the return. The patient feels fine, lives 40 km away, has no attender, or simply is not called.
3. **The referral leak.** The patient is sent to an ophthalmologist, a nephrologist or a foot clinic. The referral is written. Completion is unknown.
4. **The bundle leak.** The annual complication review — eye, foot, renal, lipids, BP — is standard of care and is never assembled in one place for one patient.

Every leak has the same shape: **a clinical intention with no operational owner, no clock, and no proof.**

---

## 3. The current asset (what actually exists)

**Product.** Glucoflow, a TypeScript monorepo: Fastify API, PostgreSQL with row-level security, a React client shipped to web and Android via Capacitor, a background worker, Supabase auth and private storage. Hosted demo on Vercel + Azure Container Apps + Supabase.

**The current lead product is a clinic-level result ledger** at `/clinic/results`, now the clinic landing page. A lab report arrives; it is matched to a patient; a named clinician is assigned; a clock starts (15 minutes for the lab's own critical flag); the clinician acknowledges; the clinic records how the patient was told; the receipt closes. Every step is appended to an event table.

**What is genuinely built and measured (4 November 2026)**

- Server-enforced receipt state machine and append-only `result_events` audit trail.
- SHA-256 hash-chained receipt proof, a public verifier page (`/verify/<code>`), a QR code, a patient slip and a closure certificate.
- Critical read-back enforced server-side: a critical result cannot be marked patient-informed without a read-back.
- Clinic dashboard: open, unowned, overdue, median acknowledge time, critical still open, informed share.
- CSV register export shaped for the NABH/NABL critical-alert register.
- 12 synthetic receipts in the demo seed.
- Tests: 184 unit tests passing, 12 SQL isolation checks, 79/82 browser checks in one parallel run (3 flaky, pass alone), typecheck and production build passing.
- An ingestion endpoint and a `sutra.create_result` procedure.
- A pre-visit "delta" module remains inside a patient record as a secondary feature. The clinic workspace, patient workspace, review queue, progression charts and source viewer also exist.

**What is not real (do not claim it)**

- No WhatsApp, paper, portal or live lab-feed ingestion. Demo rows are seeded or created through the API.
- No customer, no buyer interview, no pilot, no willingness-to-pay test, no purchase order, no renewal.
- No measured clinical or operational outcome in a real clinic.
- No ABDM/ABHA integration.
- No automatic patient messaging.
- Extraction accuracy on an unfamiliar layout: precision 0.875, recall 0.56, complete-field 0.24 (internal audit, 3 Oct 2026). On the final unseen synthetic corpus: precision 1.00, recall 1.00, complete-field 0.8834 (synthetic; not clinical validation).

**Team assets.** Working backend, multi-tenant auth, RLS, audit, review/revision model, evidence binding, a signed Android APK, a hosted demo, and a documented discipline of not over-claiming.

---

## 4. Competitor scan (verified 4 November 2026)

### 4.1 Teams in this same programme, public on GitHub

| Repo | Track | What it is | Strength | Weakness |
|---|---|---|---|---|
| `psraghothamrao8/RAD-SMART` | Cancer | AI radiotherapy scheduling: predicts session times, plans the machine day with hard rules, re-plans breakdowns, Sarvam AI patient messaging, live on Azure Docker | Operations research + optimisation + live deployment + Indian languages. 125 MB repo, updated 3 Nov | Cancer track, not diabetes |
| `santhoshh005/Rounds_AI` | Cancer | Inpatient oncology ward copilot: on-device Whisper, Gemini Vision OCR, CTCAE v5.0 grading | Real multimodal stack | Adjacent to clinical interpretation |
| `SachinBudania781/oncobrief` | Cancer | One-page cited patient-journey brief for oncologists | Clear artefact | Records-summary category |
| `hannielvinu/Setu` | Cancer | Assistive AI follow-up agent: overdue patients, why they dropped out, barrier removal in local language | Same follow-up thesis, cancer track | Agent-centric |
| `harsh-d58/careweave` | Cancer | Scattered records → chronological source-linked timeline | Clean positioning | Records-summary category |
| `bhavyajain17/ONCOmitra` | Cancer | Oral cancer screening→referral→treatment→follow-up, closed-loop referrals | Closed-loop language | Cancer, screening-led |
| **`Shrestha-ijarwal/RetinaX_Healthathon`** | **Diabetes** | **Diabetic retinopathy screening follow-up: incomplete eye-care journeys, specialist review, follow-up tracking, ASHA re-engagement, bilingual reminders, care-loop dashboard** | **Directly on the "care loop" narrative. Explicit scope alignment, 12 synthetic patients, audit log** | **Flask + vanilla JS, local only, no real ingestion, no AI, reminders are "not actually sent"** |
| `devesh1905/liv2care-prototype` | Diabetes | Liver-care pathway coordination for type 2 diabetes, clickable prototype | Niche | Prototype only |
| `zahidali-jannat/Health-a-thon-Project` | Diabetes | Diabetes consultation readiness | On-thesis | Small |

**Reading of the field.** The "records timeline", "follow-up agent", "care-loop dashboard" and "ambient documentation" ideas are each being built by multiple teams. A better-executed version of a taken idea loses on novelty and wins nothing on differentiation. The remaining white space is not a new dashboard; it is a **new unit of accountability and a new artefact**.

### 4.2 Incumbent market players

| Player | What it does | Why it matters |
|---|---|---|
| Eka Care | Free EMR, ABDM rails, EkaScribe voice documentation, patient engagement | Owns the digital front door; can bundle recall and scribe |
| HealthPlix | 14,000–15,000 doctors, H.A.L.O. ambient voice-to-prescription in ~20 languages, CDS | Voice documentation is already a shipped product, not a gap |
| Practo Ray | 50,000+ doctors, appointments, EMR | Distribution incumbent |
| Clinizy | Clinic OS with recall, billing, pharmacy, lab; ₹1,499/month | Recall is commoditised at the low end |
| CliniKite | Order → sample → report → reviewed → shared status; ₹2,499/month | Already sells the report-status loop |
| Lifemaan | Hospital CRM, WhatsApp reminders, recall and referral tracking; 576+ hospitals claimed | Recall/referral tracking exists in CRM form |
| Yuktii | Free diabetes clinic software with structured recalls | Free tier kills flat recall pricing |
| Vitaloop | AI voice recall for lapsed lab patients, pay-on-return | Validates lab-funded recall |
| Healthray, OneCity, Delpheon | LIMS with critical alerts, NABL/ISO 15189 workflows | Critical alerts exist *inside* the lab |
| SaathiMed | "Closed loop" clinical intelligence for Indian primary care | Uses the same language |
| Global | Epic/Cerner results inbox, Navina, Abridge, Suki, Phreesia, Klara | Proof the categories are real and funded elsewhere |

**The gap that survives this scan.** Critical-value alerting exists inside a lab's LIMS. Recall exists inside a clinic's CRM. But **no one owns the cross-source, clinic-side proof that a specific abnormal result was seen by a named clinician and communicated to a specific patient, with an artefact the clinic can defend and the patient can verify.** The lab's job ends at delivery. The clinic's job has no system.

---

## 5. Evidence ledger

Grade A = primary measurement or official statistic. B = official document or published price. C = vendor or secondary claim. E = estimate. `Gap` = no usable Indian measurement found.

| # | Claim | Source | Grade |
|---|---|---|---|
| 1 | 101.3M people with diabetes, 136M with prediabetes in India | ICMR-INDIAB-17, Lancet Diabetes & Endocrinology 2023 | A |
| 2 | 16.9% diabetic retinopathy prevalence in Indians 50+; **89.9% of those who knew they had diabetes had never had a retinal examination** | National survey reported Oct 2026 | A |
| 3 | 86.8% of critical results notified within 1 hour; 10.7% unsuccessful notification | Tertiary biochemistry lab, Thieme 2023 | A |
| 4 | 64.61% of 1,187 critical values notified 30–120 min after sample arrival; outpatient notification is the weak point | Indian tertiary hospital, PMC4310845 | A |
| 5 | 6.8%–62% of abnormal laboratory results not followed up | Systematic review, J Gen Intern Med 2012 | B |
| 6 | Only 60.4% legible phone, 16.4% complete address, 11.2% trackable by both; missing contact OR 4.5 for loss to follow-up | Chennai, 3,696 patients, BMC Infect Dis 2018 | A |
| 7 | 50–60% missed scheduled follow-up; reasons: no symptoms 24.8%, distance 22.3%, no instructions 15.3%, acute illness 8.3%, wait 7% | Punjab public facilities, n=300, J Clin Hypertens 2021 | A |
| 8 | Missed visits 66% → 22% in 9 months using ASHA home visits + record triangulation, no app | District Hospital Seoni, BMJ Open Quality 2025 | A |
| 9 | 50.5% delayed eye care because "eyes were okay", 41.0% no attender, 38.6% cost; 26% progressed to vision-threatening disease | Puducherry, n=500, Indian J Ophthalmol 2017 | A |
| 10 | NABH requires a critical-result intimation record and a read-back to confirm understanding | NABH HIB guide, list of terminologies | B |
| 11 | NABL 112 sets specific accreditation criteria for medical laboratories | NABL 112 | B |
| 12 | DPDP Rules 2025 notified 13 Nov 2025; substantive duties commence 13 May 2027; consent managers 13 Nov 2026 | G.S.R. 846(E) | A |
| 13 | CDSCO Medical Device Software guidance, Circular F.No. MED-16028/2/2025-eOffice, 21 July 2026, Doc CDSCO/MD/GD/MDSW/01/2026; clinic scheduling/communication/storage software is outside device scope; risk scoring/triage can flip it | CDSCO | A |
| 14 | 68,564 public health facilities NQAS-certified, including 452 district hospitals (as of 24 July 2026) | MoHFW / Sansad | A |
| 15 | ~80,000 hospitals in India, ~4,000 fully NABH-accredited; 1,324 NABH-accredited CGHS-empanelled facilities (837 hospitals, 72 diagnostic centres) | NABH / Times of India / CGHS directory | B |
| 16 | India diagnostics ~US$10B in FY21; only ~3% of labs NABL-accredited; 46% unorganised standalone labs | Industry reports | C/E |
| 17 | ₹20 lakh compensation ordered against a path lab for a "technical glitch"; patient is a consumer under the Consumer Protection Act 2019 (IMA v. V.P. Shantha, 1995) | Delhi consumer commission; IML India | A/B |
| 18 | 13.6 lakh registered allopathic doctors; ~10.9 lakh active at 80% availability | Lok Sabha reply, Nov 2024 | A |
| 19 | 31,882 PHCs, 6,359 CHCs, 714 district hospitals, 1,340 sub-district hospitals | Rural Health Statistics 2022–23 | A |
| 20 | ABDM has linked 100 crore+ health records | Government, May 2026 | A |
| 21 | An Indian measurement of ordered tests never reviewed does not exist | Research memo | Gap |
| 22 | A national NPCDCS loss-to-follow-up rate with numerator/denominator does not exist | Research memo | Gap |

---

## 6. The five theses to score

Each thesis is a *company*, not a feature. Score each as if you were deciding to fund it and to back it at the finale.

### T1 — The Closure Ledger (current build, extended)

**One line.** Every abnormal diabetes result becomes an obligation with a named owner, a clock, and a tamper-evident receipt; nothing closes without a human acknowledgement and a recorded patient communication.

**Unit.** The obligation (a result to be seen, a recheck due, a referral to complete).

**Product.** Report in (PDF/photo/WhatsApp/lab feed) → identity match with abstention → obligation created with the lab's own flag and a guideline clock → named clinician → acknowledgement → patient communication with read-back for criticals → recheck date → escalation to a nurse/ASHA call list when the clock slips → closure receipt (QR, verifiable) → NABH/NABL-shaped register export.

**Hero screen.** The doctor's 60-second "unclosed" list: three results unseen, two overdue, one identity hold. Not a dashboard.

**Buyer.** Hospital quality head / medical superintendent (accreditation + liability), clinic owner (liability + patient trust), lab (proof of delivery). Price: ₹5,000–20,000/facility/month, or per-report.

**Moat.** The receipt standard (labs and clinics both verify), the audit history, the escalation playbook, the cross-lab normalisation, the liability narrative.

**Technical depth available.** Obligation extraction with source-span binding and calibrated abstention; identity resolution under shared household phones; capacity-constrained escalation scheduling; tamper-evident receipts; causal evaluation.

**Honest weakness.** Admin-flavoured. A doctor judge may say "this is the quality officer's problem, not mine". The buyer is not the doctor. It risks being seen as a compliance register.

### T2 — The 90-Day Recheck Loop

**One line.** The clinic owns the return visit: after any diabetes consultation, a recheck date is set, and no patient is silently dropped.

**Unit.** The due patient with a disposition.

**Product.** Register import and reachability audit → contact on WhatsApp/voice/SMS in the patient's language → ask why they are not coming → classify the barrier → route to teleconsult, nearby lab, ASHA visit, scheme, or a documented discharge → ledger of every due patient → morning brief for the doctor.

**Buyer.** Clinic owner (recovered visits = revenue), district health society (coverage KPI).

**Moat.** Reachability data, barrier playbook, field worklist, language assets.

**Honest weakness.** Most crowded thesis. Clinizy, Yuktii (free), Lifemaan, Eka, Vitaloop all sit here. The differentiation ("we start with the unreachable") is real but hard to demo in 7 minutes and easy for a judge to read as a CRM.

### T3 — The Annual Review Pack

**One line.** The diabetes annual complication review — eye, foot, renal, lipids, BP — assembled as one patient-owned pack, with every gap visible and every completion proved.

**Unit.** The patient-year.

**Product.** A guideline-shaped checklist per patient-year; the clinic issues the pack; the patient carries it (paper/QR/phone); labs and specialists stamp completion; the clinic sees bundle-completion rate; the district sees coverage; the government gets NQAS/NPCDCS evidence.

**Buyer.** Hospital quality head, district NCD programme, insurer (later).

**Moat.** The patient-owned pack as a standard; the bundle-completion dataset.

**Honest weakness.** Closest to RetinaX (eye only) and to government registers. "Bundle" is a quality-team word, not a doctor word. Requires many providers to stamp.

### T4 — The Bag Reconciliation

**One line.** The patient's plastic bag — old reports, strips, boxes, handwritten prescriptions — is the real longitudinal record. We read the bag in 60 seconds and hand the doctor a reconciled regimen and history.

**Unit.** The visit's bag.

**Product.** Photograph the bag's contents; extract documents and drug packaging; reconstruct the actual regimen (what was prescribed vs what is in the bag); detect duplicates, stopped drugs, and impossible dates; produce a one-page reconciliation the doctor edits and signs.

**Buyer.** Doctor (time), clinic (throughput). Price: per doctor.

**Moat.** Multimodal extraction for Indian packaging and handwriting; the reconciliation rubric; the doctor's edits as training data.

**Honest weakness.** Extraction is the product, and extraction is commoditising. No operational KPI that a judge can verify in 60–90 days. High demo risk (a bad OCR moment kills the pitch). Hard to defend against Eka/HealthPlix.

### T5 — The Identity and Report Integrity Firewall

**One line.** Before any clinical decision, prove the report belongs to this patient and the numbers are internally possible; abstain when they are not.

**Unit.** The document-to-patient binding.

**Product.** Cross-lab patient matching under Indian naming, transliteration, missing DOB and shared family phones; unit and reference-range normalisation; duplicate and wrong-patient detection; impossible-value and delta checks; a calibrated abstention queue with expected-information-gain ordering.

**Buyer.** Lab chains (liability, NABL), hospital IT, HIS vendors (OEM).

**Moat.** The linkage model and the household-phone graph; the abstention calibration; the integration footprint.

**Honest weakness.** Not doctor-facing; buyer is IT/quality, not the panel's doctors. Invisible in a demo. Lowest "judge recognition" score of the five.

---

## 7. Considered and rejected (do not re-propose without new evidence)

| Idea | Why rejected |
|---|---|
| Ambient clinical documentation / voice-to-prescription | Already shipped by HealthPlix (H.A.L.O., ~20 languages), Eka (EkaScribe), and multiple open-source teams (Vaidya). Model quality is owned by Sarvam and the EMRs. Not defensible for a 5-person team. |
| Records timeline / cited patient-journey brief | Built by CareWeave and oncobrief in this same programme. Commodity extraction. |
| AI chatbot over records / "ask your records" | Demo-friendly, low willingness to pay, high hallucination risk, and the programme excludes clinical interpretation. |
| Diabetic retinopathy screening AI | Clinical interpretation, device risk, crowded, and RetinaX already owns the operational slice. |
| Risk scoring / deterioration prediction / triage | Explicitly out of scope and a CDSCO device risk. |
| Full EMR / clinic OS | Practo, Eka, HealthPlix, Clinizy own it. A 5-person team cannot win. |
| Patient consumer app | Low retention, low willingness to pay, and the buyer is not the doctor. |

---

## 8. Scoring rubric (100 points)

Score every thesis on every dimension. **Use one convention and state it:** either score each dimension on its weight scale (0–15, 0–10, 0–5) and sum, or score each dimension 0–10 and compute `Σ score × weight / 10`. Do not mix the two. A mixed panel must be normalised before averaging; the judgment memo records how.

| # | Dimension | Weight | What a 9–10 looks like | What a 1–3 looks like |
|---|---|---|---|---|
| 1 | Problem reality and frequency | 15 | You have seen this failure this week; it happens every day in every clinic | A plausible story with no frequency |
| 2 | Failure cost and urgency | 10 | Harm, money or licence at stake; a buyer already spends on it | Inconvenience |
| 3 | Buyer and willingness to pay | 15 | A named budget holder with a recurring trigger and a price they already pay for something worse | "Doctors will pay" with no evidence |
| 4 | Defensibility (Thiel) | 15 | A secret, a standard, a dataset or a network that compounds; 10x on one axis | A screen an incumbent adds in a sprint |
| 5 | Technical depth and honest AI | 10 | A real system with a hard technical core and AI used only where it earns its place | A wrapper or a prompt |
| 6 | Programme rubric fit | 15 | Non-clinical, measurable KPI, low-cost channel, multilingual, human override, audit, 60–90 day proof | Clinical claim, no KPI, enterprise integration |
| 7 | India scale (Tier 1/2/3/rural) | 10 | Works on a shared phone and a paper register; private and government | Tier 1 private only; needs an EMR |
| 8 | Regulatory and ethical safety | 5 | Administrative receipt; no interpretation; DPDP-native | Device-adjacent or consent-blind |
| 9 | Demo-ability and narrative | 5 | One unforgettable 40-second moment a doctor recognises | A dashboard tour |

**Total 100.**

---

## 9. Required output from every judge

Write to your assigned file in `docs/research/2026-11-04-final/panel/`.

```
# <Judge name> — scorecard

## Stance (one line)

## Scores

| Thesis | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | TOTAL |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 Closure Ledger | | | | | | | | | | |
| T2 90-Day Recheck | | | | | | | | | | |
| T3 Annual Review Pack | | | | | | | | | | |
| T4 Bag Reconciliation | | | | | | | | | | |
| T5 Identity Firewall | | | | | | | | | | |

## Why the winner wins (top 3 reasons, evidence-backed)

## Fatal flaw of each thesis (one line each)

## What would make the winner 95+

## The one question I would ask at the finale

## Verdict (one sentence)

## Confidence and what I could not verify
```

Return the same content in your final message, compressed to under 700 words.

---

## 10. What the panel is not allowed to assume

- That a doctor will pay. No interview exists.
- That a hospital quality head will pay. No interview exists.
- That the KPI improves. No pilot exists.
- That the demo reflects live ingestion. It does not.
- That a GitHub repo is the whole competitor. It is the public tip.
- That winning the hackathon equals a company. It does not.

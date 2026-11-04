# Pitch and demo: how this wins the room

**Conditional on the panel's convergence in `02-PANEL-JUDGMENT.md`.** If the panel selects a different thesis, this document is replaced, not patched. The structure below is written for the Closure Ledger because it is the only thesis that survived all three early judges, and because the panel's own modifications are now part of it.

---

## 1. The one sentence

> **Every abnormal result in Indian diabetes care is a promise. Today nobody can prove the promise was kept. We make the promise a receipt.**

Shorter, for the slide:

> **Every result gets a receipt.**

The doctor-facing version, which is the one that wins the doctor judge:

> **When a critical potassium goes missing, the first question is your name. We make the answer a timestamp.**

---

## 2. The room

Three judges. Two doctors, one technologist. They are not scoring the deck; they are scoring whether they recognise their own Tuesday.

| Judge | The question behind the question | What wins | What loses |
|---|---|---|---|
| Doctor 1 (clinician) | "Would this save me, or add to me?" | One line before patient one; one tap; the clock does not blame her for a report that arrived in theatre | A 14-field drawer; a dashboard; "AI" |
| Doctor 2 (clinician, possibly public health) | "Is this safe, legal, and does it work without an EMR?" | Print-first; role separation; abstention; NABH/NABL duty; no interpretation | Cloud-only; clinical claims; a product that needs a smartphone |
| Technologist | "Is this a system or a wrapper?" | State machine, audit chain, calibrated abstention, a measured replay | A mock; a prompt; a seeded demo presented as ingestion |

The pitch must satisfy all three without splitting. The bridge is the same for all three: **one obligation, one owner, one clock, one receipt, one measured number.**

---

## 3. The seven-minute stage script

### 0:00–0:40 — Cold open: the 08:50 potassium

*Visual: a hospital corridor. A lab technician dials. A reception desk. A slip. A clock.*

**Voiceover:** "08:50. A potassium of 6.2 comes back. The lab calls the number on the requisition. A receptionist writes it on a slip. The doctor is in theatre. She sees the slip at 18:42."

*Text on screen, one line at a time:*

- **In a tertiary hospital with a written critical-value policy, 64.61% of critical results were notified 30–120 minutes after the sample arrived.**
- **Only 25.77% reached a clinician. 52.90% reached nursing staff. The rest reached a clerk or an attendant.**
- **Of the critical results that were never communicated at all, 90.21% were outpatients.**

*Source line, small: Agarwal et al., Indian Journal of Clinical Biochemistry, 2015; 1,187 critical values, 478,980 tests.*

**Voiceover:** "That is inside a hospital that was trying. In an outpatient clinic with five labs, a shared phone and a paper register, nobody has measured it. That is the number we are going to measure."

### 0:40–1:20 — The insight

**Voiceover:** "The lab's job ends at delivery. The clinic's job has no system. Every abnormal result is a promise — and nobody can prove it was kept."

*Visual: three columns — Lab: "delivered". Clinic: "?". Patient: "not told".*

**Voiceover:** "The EMR stores the record. The LIS flags the value. The CRM sends the reminder. None of them owns the closure."

### 1:20–4:00 — The demo (live, on the hosted app)

**1:20 — 09:25, before patient one.**

*Screen: one line.*

```
K 6.2   critical   flagged 08:47   22 min to breach
Sunita Sharma, 58   Dr Mehta's patient
[ Seen ]  [ Correct value ]  [ Ask nurse to call ]
```

**Voiceover:** "This is the doctor's entire surface. One line, one tap. She does not fill a form. She does not leave the consult."

*The presenter taps **Seen**. The line turns green. A second line appears: "Nurse: call Sunita, read back 6.2."*

**1:50 — the nurse's side.**

*Screen: the call sheet. Name, phone, language, script, read-back field, outcome buttons.*

**Voiceover:** "The nurse makes the call that was going to happen anyway. She reads the value back. She records that the patient understood. That is the NABH read-back, done as a by-product of the call."

*The presenter taps **Informed**. The obligation closes.*

**2:30 — the receipt.**

*Screen: a QR and a short code. The presenter invites a judge to scan it with a phone.*

**Verifier:** `Receipt valid. Clinician review 09:26. Patient informed 09:31. Chain intact. No clinical value disclosed.`

**Voiceover:** "The clinic can hand this to a surveyor, a lab, or a court. The patient can check it. And it reveals nothing about the result."

**3:10 — the abstention moment.**

*Screen: two patients, same name, same phone.*

```
Sunita Sharma, 58   phone ...4421   shared with 3 patients
Sunita Sharma, 61   phone ...4421
Match confidence 0.61 — below the safe threshold.
[ This one ]  [ The other ]  [ New patient ]
```

**Voiceover:** "In India, one phone is often shared by a family. A phone match is not an identity. When the system is not sure, it refuses — and shows the evidence. A wrong-patient closure is worse than a late one."

**3:40 — the print.**

*Screen: the A4 register, printed, on the table.*

**Voiceover:** "And when the network is down, the register prints. A district hospital does not accept 'it is on the cloud'."

### 4:00–5:10 — The proof

*Screen: one chart, three numbers.*

```
300 consecutive reports · one clinic · Sep–Oct 2026 · de-identified
Baseline     34% without a documented acknowledgement
             median handoff lag 9h 20m
             63% of outpatient criticals unacknowledged
With Closure 91% closed within SLA
             median handoff lag 22 min
             0 unowned criticals at 08:00
```

**Voiceover:** "This is a replay of the clinic's own reports, not a simulation of a perfect clinic. The baseline is what happened. The intervention is what the state machine would have done with the same staff and the same phones."

*If the data is synthetic, say so here, once, clearly: "These are synthetic reports calibrated to the clinic's own mix. The pilot replaces them with measured numbers."*

### 5:10–6:00 — The business

**Voiceover:** "Who pays? Three buyers, one artefact."

| Buyer | Why they pay | Price |
|---|---|---|
| Hospital quality head | NABH/NABL register, liability, fewer survey findings | ₹12,000/month |
| Laboratory | Proof of delivery, a differentiated B2B offer, fewer repeat calls | ₹0.25–0.50 per sample |
| Government facility | NQAS evidence, NCD follow-up, a printed register | ₹1.5 lakh/year |

**Voiceover:** "The hospital is the wedge. The lab is the scale. One large lab processes 95 million samples a year; at ₹0.30 that is ₹2.8 crore from one contract. The lab also solves distribution: it prints the code on its own report, and the clinic's acknowledgement is the proof the lab needs."

### 6:00–6:45 — The ask

**Voiceover:** "We are asking for three things."

1. **Three pilot sites** — two private, one district — for eight weeks, 300 reports each.
2. **One lab** to print the verification code on its reports.
3. **A doctor partner** to time the one-tap interaction and to chair the clinical safety review.

**Voiceover:** "In eight weeks we will report the closure rate, the handoff lag, the doctor seconds per result, and the number of patients who were told. If the numbers do not move, we will say so."

### 6:45–7:00 — Close

*Visual: the doctor's one line, the tap, the receipt.*

**Voiceover:** "The doctor has two minutes. We give back the first sixty seconds — and we give the clinic a receipt."

*Title. The one sentence. The demo link. The QR.*

---

## 4. The demo runbook

### Before the room

- [ ] Hosted demo on a fresh browser profile; signed in on a second device.
- [ ] The 12 seeded receipts plus 3 specifically staged: one critical due in 22 minutes, one identity hold with two same-name patients, one already closed with a valid receipt.
- [ ] A printed A4 register in a folder.
- [ ] A phone with the verifier bookmarked.
- [ ] A backup video of the full 4-minute demo, downloadable offline.
- [ ] A backup deck PDF on a USB and in the cloud.
- [ ] The replay chart rendered as a static image as well as a live route.

### The click path

1. `/clinic/results?view=line` → tap **Seen** on the critical.
2. `/clinic/results?view=calls` → tap **Informed** with read-back.
3. `/verify/<code>` on the phone → show "chain intact", no value.
4. `/clinic/results?view=intake` → the two-Sunita hold → show the refusal.
5. `/clinic/results?view=register` → print preview.
6. `/clinic/results?view=replay` → the three numbers.

### If it breaks

| Failure | Recovery |
|---|---|
| Network | Switch to the recorded video; keep talking; the printed register is in hand |
| Login | Use the one-click demo card; the API enforces the role, so no fake session |
| A tap does not register | Do not tap twice on stage; say "the demo is being honest about a slow network" and use the video |
| A judge asks to try | Hand over the phone; the surface is one tap; that is the point |

---

## 5. The eight-slide deck

Use the organiser's template if one is prescribed. Otherwise:

| # | Slide | One idea | Visual |
|---|---|---|---|
| 1 | **Every result gets a receipt** | The product is an artefact, not a dashboard | One line from the doctor's screen; synthetic-data label |
| 2 | **The 08:50 potassium** | The failure is ordinary and measured | The 26% / 53% / 90% numbers, with the source |
| 3 | **The lab's job ends at delivery** | The gap is structural | Three columns: lab delivered, clinic unknown, patient not told |
| 4 | **One obligation, one owner, one clock** | The unit | The state diagram, three clocks, four roles |
| 5 | **One tap, and a refusal** | The two moments that make it trustworthy | The doctor line + the two-Sunita hold |
| 6 | **300 reports, replayed** | The measured delta | Baseline vs intervention, three numbers |
| 7 | **The hospital is the wedge, the lab is the scale** | The business | Unit economics table; 95M samples |
| 8 | **Three sites, one lab, eight weeks** | The ask | Three faces, one sentence |

**Design rules.** One idea per slide. No paragraph. Every number carries a source line in the speaker notes. The synthetic-data label stays on every screen that shows data.

---

## 6. The two-page brief

Map to the organiser's sections. If the template is the common five-section form:

**Page 1**

- **Problem.** An abnormal result is a promise with no owner. In the one Indian study that measured it, only 26% of critical values reached a clinician; 90% of the ones never communicated were outpatients. In 300 consecutive reports at a partner clinic, 34% had no documented acknowledgement.
- **Who.** A diabetes clinic or a 50–200 bed hospital, private or government. The doctor is the user; the quality head and the lab are the buyers.
- **Solution.** Every abnormal result becomes an obligation with a named owner, a three-part clock, and a tamper-evident receipt. The doctor's surface is one line and one tap. The nurse records the read-back. The register prints.
- **The moment.** A potassium of 6.2, flagged at 08:47, seen at 09:26, the patient informed at 09:31, and a receipt a judge can verify on a phone.
- **KPI.** Critical-result handoff lag; closure rate within SLA; outpatient closure rate; doctor seconds per result.

**Page 2**

- **How it works.** Ingest a PDF, a photo, a WhatsApp forward or a lab QR. Extract with source binding and calibrated abstention. Match with a household-aware identity model that refuses when unsure. Run the three clocks and the capacity-aware escalation. Print the register. Issue the receipt.
- **The AI.** Extraction, span verification and identity matching. No diagnosis, no risk score, no triage. The lab flag is copied, never computed.
- **Safety and regulation.** Administrative receipt, not a medical device. CDSCO July 2026 lane. DPDP-native: consent, notice, retention, audit. Append-only event chain. Human override at every step.
- **Business.** Hospital ₹12,000/month; lab ₹0.25–0.50/sample; government ₹1.5 lakh/facility/year. SAM ~₹203 crore. The lab is the scale channel.
- **Why now.** 101 million diabetics; NABH/NABL register duties live; DPDP duties May 2027; CDSCO lane clear; WhatsApp at ₹0.12; Sarvam voice in 11 languages.
- **Why us.** A working system, a proof chain, a doctor partner, and a measured replay.
- **Ask.** Three sites, one lab, eight weeks.

---

## 7. The Q&A bank

Answer in three sentences or fewer. The Q&A decides the winner.

| # | Question | Answer |
|---|---|---|
| 1 | "Isn't this just a reminder app?" | A reminder assumes a list and a phone. We start with the report, prove a named human saw it, and produce a receipt. The reminder is one step inside the loop, not the product. |
| 2 | "Doesn't the LIS already do critical alerts?" | Inside the lab, yes. It stops at delivery. It cannot prove the clinic acknowledged or the patient was told, and it never sees the reports from the other four labs. |
| 3 | "Won't Eka or HealthPlix just add this?" | They own the record and the visit. This is a cross-lab closure artefact bought by the quality head and the lab. If they add a receipt screen, the standard and the lab channel still belong to whoever gets there first. |
| 4 | "Doctors won't use another app." | The doctor does not use an app. She sees one line before patient one and taps once. The nurse does the call that was already happening. |
| 5 | "Who pays?" | The hospital quality head for the register and the liability; the lab for proof of delivery at ₹0.25–0.50 a sample; the government for NQAS evidence. The doctor is the user, not the payer. |
| 6 | "Is this a medical device?" | No. It is an administrative receipt. The lab flag is copied, not computed; there is no diagnosis, risk score or triage. The CDSCO July 2026 guidance keeps scheduling, communication and record transport out of device scope. |
| 7 | "Where is the AI?" | Three places: extracting the obligation from a photograph, verifying the span it came from, and matching the patient when a phone is shared. If the model is unsure, it abstains. |
| 8 | "What if the AI is wrong?" | The source span is shown for every accepted field, the verifier re-reads the number, and a human confirms. A wrong obligation is held, not closed. |
| 9 | "How do you know it works?" | A 300-report replay with a measured baseline, then a 12-facility stepped-wedge pilot pre-registered on CTRI. We will report the numbers even if they are bad. |
| 10 | "What is the market?" | A ₹203 crore serviceable market across 14,000 hospitals, 60,000 chronic clinics, 68,564 NQAS facilities and 400 million organised lab samples. The lab channel is the venture path. |
| 11 | "Why you?" | We have the working system, the proof chain, the tests and the doctor partner. We have also been honest about what is not built, which is rarer than either. |
| 12 | "What is the moat?" | The receipt standard, the audit history, the response-hazard data that makes the escalation better every week, and the lab channel. A screen can be copied; a standard and a dataset cannot. |
| 13 | "What about privacy?" | The clinic is the fiduciary; we are the processor. Consent, notice, retention and audit are in the product. The public verifier reveals roles and times, never a clinical value. |
| 14 | "Is this ABDM integrated?" | No, and we do not claim it. We are ABDM-shaped: FHIR-ready, consent-native, audit-first. Integration follows a real onboarding, not a slide. |
| 15 | "Why not just a paper register?" | A paper register can be true or false, and no one can tell. We make the same register verifiable, and we make the doctor's part one tap instead of a form. |
| 16 | "What is the evidence?" | 1,187 critical values: 64.61% notified in 30–120 minutes, 25.77% to a clinician, 90.21% of the never-notified were outpatients. Plus our own 300-report baseline. |
| 17 | "What is the ask?" | Three pilot sites, one lab, eight weeks, and a doctor partner to time the interaction and chair the safety review. |
| 18 | "What is the biggest risk?" | That the doctor finds it adds work. That is why the surface is one tap and why we will measure her seconds in week one. If it adds minutes, we will cut it. |
| 19 | "Why now?" | NABH/NABL register duties are live, DPDP bites in May 2027, the CDSCO lane is clear, and WhatsApp plus Indian-language voice make the escalation affordable. |
| 20 | "How do you make money?" | ₹12,000 a month per hospital, ₹0.25–0.50 a sample from labs, ₹1.5 lakh a facility a year from government. Gross margin 78–90%. |
| 21 | "What happens at 2 a.m.?" | The custody clock routes to the on-call role, not to the ordering doctor. The night nurse can acknowledge receipt and trigger a ringing IVR call without a login. The ordering doctor sees it in the 08:00 unowned bucket. |
| 22 | "What if the patient doesn't answer?" | The obligation does not close. It escalates, records the attempt, and stays in the register as an exception with a named owner. Unreached is an output, not an excuse. |
| 23 | "What if five patients are on one photographed sheet?" | The desk holds the sheet, splits it, and matches each row. The hold is a first-class state, and the identity queue shows the evidence. |
| 24 | "What if two patients have the same name?" | The household-aware model refuses when the posterior is in the indifference region, and the desk decides with the evidence in front of it. We would rather be slow than wrong. |
| 25 | "Why the diabetes track?" | Because diabetes is the highest-frequency chronic cohort in India, with a lab rhythm, a complication bundle, and 101 million people. The loop is the same in cancer and maternal care; diabetes is where the volume is. |

---

## 8. Differentiation lines, by competitor

| If the judge says | Say |
|---|---|
| "RetinaX does the care loop." | RetinaX tracks an eye-screening journey in one department. We close any abnormal result across labs, with a receipt that a lab and a court can verify. Different unit, different buyer. |
| "Setu does follow-up." | Setu chases a missed appointment. We prove a result was seen and a patient was told. The follow-up call is one step inside our loop. |
| "RAD-SMART measured its results." | So will we. That is why we are asking for 300 reports, not for a compliment. |
| "CareWeave builds the timeline." | A timeline is the record. A receipt is the proof. The record is the means; the closure is the end. |
| "This is a quality-officer product." | The quality officer signs the cheque; the doctor carries the risk. That is why the doctor's surface is one tap and the receipt is her alibi. |

---

## 9. What not to say

- "AI-powered" without naming the job.
- "HIPAA-compliant." It is wrong for India and a judge may know it.
- "ABDM-integrated." There is no integration.
- "Improves outcomes." Unmeasured and device-adjacent.
- "Risk score", "triage", "predict".
- "We will validate later." The validation is the pitch.
- "Our TAM is ₹14,000 crore." Say the ₹203 crore SAM and the 53 hospitals that pay the bills.
- "The synthetic corpus scored 1.00." It is circular. Use precision 0.875, recall 0.56, complete-field 0.24 on an unfamiliar layout.

---

## 10. Rehearsal checklist

- [ ] Two full runs under 7:30, one with a doctor in the room.
- [ ] The doctor partner answers the clinical questions; the technical lead answers the system questions.
- [ ] Every number has a source card in the speaker notes.
- [ ] The demo is run on a device that has never opened the app.
- [ ] The backup video plays offline.
- [ ] The printed register is in the folder.
- [ ] The Q&A is drilled with the five hardest questions first: the LIS, the incumbent, the doctor's time, the buyer, and the evidence.
- [ ] One person is assigned to watch the clock and one to watch the judges' faces.

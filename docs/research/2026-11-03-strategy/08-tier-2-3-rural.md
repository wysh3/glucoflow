# Tier 2, Tier 3 and rural: the expansion case the reviewer asked for

This note answers the middle-review point directly. It is not a "we will expand later" slide. It argues that the follow-up product should be **designed for Tier 2/3 first**, because the constraints there are the product's core design constraints, and Tier 1 is the easy expansion rather than the other way round.

## The one-line argument

**The follow-up problem is worst where the records are thinnest, the distances are longest and the staff are fewest. That is Tier 2/3 and rural India. A product that works there works everywhere; a product built for a Tier 1 EMR does not work there.**

## Definitions, used consistently

| Tier | Working definition in this note | Typical clinic | Typical patient channel |
|---|---|---|---|
| Tier 1 | Metro and large state capital | Multi-doctor clinic or hospital with an EMR, front desk, billing | App, portal, WhatsApp, phone |
| Tier 2 | Large town or small city, 1 to 5 lakh population | 1 to 5 doctor clinic or 20 to 80 bed nursing home; paper or a basic EMR | WhatsApp, phone, walk-in |
| Tier 3 | District town, 20,000 to 1,00,000 population | Solo doctor or small nursing home; paper register; one clerk | Phone, WhatsApp, ASHA/ANM, walk-in |
| Rural | Block and village | PHC/HWC/CHC, sub-centre, ASHA/ANM | Phone (shared), ASHA home visit, camp |

The programme's own tracks (diabetes, cancer, maternal/child) cut across all four. The product should not be tier-specific in its core; it should be **channel-specific**: paper, phone, WhatsApp, ASHA visit. That is what makes the same product work across tiers.

## Why Tier 2/3 is the right design centre

### The need is concentrated there

- Public NCD clinics and district hospitals carry a large chronic load with paper registers and limited digital tracking. The 2026 multicentric assessment of 29 public facilities found "systemic issues" in digital and data systems for NCD patient tracking, inconsistent use of NCD registers, and limited staff training in digital tools.
- The Seoni QI programme cut missed hypertension visits from 66% to 22% in a district hospital with ASHA home visits and record triangulation, without an app. That is the operating reality the product must fit.
- Private care is the majority of outpatient care (about 70%, per the WHO 2022 estimate cited by Indian industry coverage; verify before the deck), and Tier 2/3 private clinics are the least digitised segment.
- Patients travel long distances, pay out of pocket, and often have no one to accompany them. The Puducherry retinopathy study found 41% had no attender and 38.6% cited cost.

### The incumbents are weakest there

- EMR-first products assume a digital patient list and a front desk that can use one.
- Reminder vendors assume a working phone number and a patient who reads the message.
- Hospital CRMs are sold to hospitals, not to a 2-doctor clinic.
- Government HMIS captures data but does not work the list or resolve the barrier.

The white space is not "another clinic app". It is the **operating layer for a paper-first clinic** that has a phone and a clerk, not an EMR.

### The channels already exist

- WhatsApp is the default patient communication channel in urban and semi-urban India.
- Voice calls work on feature phones and are familiar to patients.
- ASHA/ANM home visits exist in the public system and are the strongest lever in the Seoni evidence.
- Paper registers are the source of truth in most Tier 2/3 clinics; a photo is a valid input.
- Clinic owners talk to each other; a cluster is a real distribution channel.

## The constraints, and what they force

| Constraint | What it looks like | Product response |
|---|---|---|
| Connectivity is intermittent | 2G/3G pockets, power cuts, shared Wi-Fi | Offline-first PWA; queue and sync; SMS/IVR fallback; no heavy assets |
| Devices are shared and low-end | One clinic phone, one clerk's Android, patients on feature phones | Multi-user clinic login; patient flow works on a phone; voice/IVR; no patient app |
| Language is local and code-mixed | Hindi/English, Marathi, Tamil, Telugu, Bengali, Odia; Roman script | Language pack per cluster; voice notes; fixed question set; human review of translations |
| Staff turnover is high | The clerk who knew the register leaves | The ledger, not the clerk's memory, is the source of truth; short training; inline scripts |
| Data is incomplete | Missing phone, illegible address, duplicate names, family folders | Reachability audit; capture at registration; alternate contact; dedupe; ASHA fallback |
| Trust is fragile | Patients suspect spam or a data leak | Clinic-branded messages; consent receipt; no clinical details in the message; one-tap stop; human callback |
| Ability to pay is low | ₹2,000 to 6,000/month is a real decision | Per-clinic pricing; pilot; revenue-linked ROI; government contract for public facilities |
| Government procurement is slow | Tenders, payment delays, staff transfers | Start with a district health society pilot; per-facility price; align to an existing KPI; partner with an installed integrator if needed |
| ASHA capacity is limited | ASHAs are overloaded and incentivised for other tasks | The product reduces their list to the unreached and gives them a script; it does not add a new reporting burden |

## The pros of a Tier 2/3-first strategy

1. **The pain is acute and visible.** A clinic owner can name the patients who stopped coming; the register is on the desk.
2. **The product is simpler.** No EMR integration, no FHIR mapping, no hospital IT committee. A photo, a CSV and a phone.
3. **The value is measurable in money.** A recovered visit is revenue for a private clinic; a closed defaulter is a KPI for a public facility.
4. **The competition is weaker.** The incumbents are EMR-first, English-first and Tier 1-first.
5. **The distribution is cheaper.** A cluster of 50 clinics can be reached through one association, one lab and word of mouth.
6. **The government story is credible.** A district NCD clinic is a referenceable pilot, not a hypothetical.
7. **The same core scales up.** Tier 1 is the same loop with a better front desk; the product does not need a separate build.

## The cons, stated plainly

1. **Lower ARPU.** A Tier 3 clinic may pay ₹2,000 to 4,000/month, not ₹10,000. The unit economics need volume or a government contract.
2. **Higher support cost.** Connectivity, language and staff turnover create more hand-holding per clinic. The gross margin can be thin if support is not productised.
3. **Payment risk.** Government contracts can take 6 to 12 months to pay; a small team cannot float that without a bridge.
4. **Data quality is the product's first problem.** If the clinic will not fix the register, the product cannot work. The reachability audit has to be a 10-minute task, not a data-entry project.
5. **ASHA/ANM capacity is not infinite.** The product must reduce their work, not add a dashboard. The field worklist has to be short and actionable.
6. **Trust is earned clinic by clinic.** A startup brand on a health message is a liability; the clinic brand is the asset.
7. **Political and transfer risk.** A district champion can be transferred; the product needs a departmental owner, not a personal one.
8. **The "free government HMIS" risk.** The state may provide a free tool that covers part of the workflow. The product must be clearly complementary: it works the list and closes the loop; the HMIS stores the record.

## The product adaptations that make it work

### Clinic side

- **Paper-first intake.** Photo of the register or a CSV; OCR plus human confirmation; no EMR required.
- **Reachability audit.** A one-screen report: how many due patients have a working phone, how many have an alternate, how many are unreachable. This is the first "wow" for a Tier 3 owner.
- **Clerk mode.** A phone-first worklist with a script, a call button, a WhatsApp button, and three disposition buttons. No training manual.
- **Morning brief.** Five numbers and the escalations; printable for the clinic wall.
- **Offline queue.** Actions work offline and sync; the app never blocks a call.

### Patient side

- **No app, no login.** WhatsApp or a voice call; the clinic's number; the patient's language.
- **A three-question conversation.** Can you come? If not, why? What would help?
- **A consent receipt.** A short message: what the clinic will ask, what it will not ask, how to stop.
- **A human escape hatch.** "Call the clinic" is always one tap away.

### Field side (ASHA/ANM)

- **A short worklist.** Name, phone, language, barrier, best time, and the one action.
- **A script and a referral card.** What to say, what not to say, where to send the patient.
- **A closed-loop confirmation.** The ASHA marks visited/booked/refused; the clinic sees it; the ledger closes.
- **No new reporting.** The product reuses the data the ASHA already collects; it does not add a parallel register.

### Government side

- **A coverage view by facility and barrier.** Due, reached, booked, attended, unreached, closed. This is the district's KPI view.
- **A consent and audit trail** that satisfies the DPDP Rules and the programme's own record requirements.
- **A per-facility deployment** that does not require a new HMIS or a state-wide integration.
- **A training kit** for ANM/ASHA and a one-page SOP for the medical officer.

## The go-to-market sequence

### Phase 1: one Tier 2 private cluster (months 0 to 3)

- 3 clinics, 500 to 800 due patients, one language pair beyond English.
- One ASHA/field partner or a clinic-hired caller.
- One lab partner for the "nearby lab" resolution.
- Goal: prove the recall lift and the willingness to pay.

### Phase 2: one Tier 3 town and one government CHC (months 3 to 6)

- 5 private clinics in a Tier 3 town.
- One CHC/NCD clinic with the district health society's permission.
- Same core, different worklist: clerk vs ASHA.
- Goal: prove the paper-first deployment and the government KPI.

### Phase 3: one district (months 6 to 12)

- 10 to 20 facilities in one district, public and private.
- A district coverage view; a per-facility contract or a district contract.
- A train-the-trainer model for ANM/ASHA.
- Goal: prove the government unit economics and the referral/field model.

### Phase 4: adjacent segments (months 9 to 18)

- Maternal/child: ANC/PNC follow-up with FOGSI; the same loop, a different due rule.
- Cancer: post-treatment surveillance with NCG; the same loop, a longer tail and a higher severity.
- Results: the second loop, using the existing extraction and audit layer.
- Goal: prove the loop is a platform, not a single-disease tool.

## Unit economics, with explicit assumptions

These are planning estimates, not measured results. Replace them with pilot data.

### Tier 2 private clinic

| Input | Assumption | Value |
|---|---|---|
| Active patients | Clinic register | 2,000 |
| Due per quarter | 30% | 600 |
| Baseline recall completion | Clinic's current rate | 50% |
| Lift from the product | Conservative | +10 percentage points |
| Extra visits | 600 × 10% | 60 |
| Revenue per visit | Consultation plus tests | ₹600 |
| Extra revenue per quarter | 60 × ₹600 | ₹36,000 |
| Product price | Per clinic per month | ₹4,000 |
| Cost per quarter | 3 × ₹4,000 | ₹12,000 |
| Clinic's net gain per quarter | Before staff time | ₹24,000 |
| Gross margin to the vendor | After messaging, model, support | 60 to 75% |

### Tier 3 private clinic

| Input | Assumption | Value |
|---|---|---|
| Active patients | Smaller register | 900 |
| Due per quarter | 30% | 270 |
| Lift | +10 percentage points | 27 visits |
| Revenue per visit | Lower ticket | ₹400 |
| Extra revenue per quarter | 27 × ₹400 | ₹10,800 |
| Product price | Per clinic per month | ₹2,500 |
| Cost per quarter | 3 × ₹2,500 | ₹7,500 |
| Clinic's net gain per quarter | Before staff time | ₹3,300 |

The Tier 3 clinic's ROI is thin at a 10-point lift. The product needs either a higher lift, a lower price, or a government subsidy. That is the honest constraint. A 20-point lift would double the gain; that is what the pilot must test.

### Government CHC/NCD clinic

| Input | Assumption | Value |
|---|---|---|
| Registered NCD patients | Facility register | 3,000 to 8,000 |
| Due per quarter | 25% | 750 to 2,000 |
| Baseline missed visits | Public programme | 30 to 60% |
| Lift | Conservative | +10 percentage points |
| Extra completed follow-ups | 750 × 10% | 75 |
| Value per follow-up | Avoided complication, programme KPI | Not priced |
| Contract price | Per facility per year | ₹1 to 3 lakh |
| Payment cycle | Government | 3 to 12 months |

The government case is a KPI and coverage case, not an ROI case. The product must be priced per facility and tied to a programme target (loss to follow-up, follow-up completion, ASHA visit coverage).

## Metrics by tier

| Tier | Primary KPI | Secondary | Guardrail |
|---|---|---|---|
| Tier 2 private | Recall completion within 30 days | Reachability rate, barrier resolution, extra visits, staff minutes | Opt-out rate, complaints |
| Tier 3 private | Recall completion, reachability repair rate | Staff minutes per patient, WhatsApp delivery | Consent rate, data quality |
| Government CHC | Follow-up completion, unreached rate | ASHA visit coverage, time-to-contact | ASHA workload, data entry burden |
| Rural | Contact rate, ASHA visit completion | Patient satisfaction, barrier resolution | Consent, phone sharing, trust |

## What would kill the expansion

- The Tier 3 clinic's ROI stays below ₹5,000/quarter at a realistic lift.
- The government payment cycle exceeds 12 months and no bridge partner is available.
- The ASHA workload rises instead of falls.
- The clinic will not repair the register after two attempts.
- The product needs a smartphone and a data plan that the clinic does not have.
- The language pack cannot reach an acceptable comprehension level with a human review.

## The one-slide version

> **Why Tier 2/3 first.** The follow-up problem is worst where records are thinnest and distances are longest. The incumbents are EMR-first and Tier 1-first. The channels that work are paper, phone, WhatsApp and ASHA visits. We design for those, prove the loop in one Tier 2 cluster and one government CHC, then expand to Tier 3 and rural with the same core. The Tier 2 clinic pays because the recovered visit is revenue. The government pays because the closed defaulter is a KPI. The product is the same; the worklist is different.

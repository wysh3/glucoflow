# The recommendation: own the follow-up list, not the record

> **Superseded for the lead recommendation.** The revised lead is the result accountability loop in [13-revised-recommendation-result-loop.md](13-revised-recommendation-result-loop.md). The follow-up thesis below remains the second loop.

Decision note, 3 November 2026. This is the thesis the team should take into the final submission and the 28 November finale. It is deliberately narrow. The evidence is in `03-evidence-followup.md`; the alternatives are in `04-problem-space.md`; the validation is in `06-validation-plan.md`.

## The one sentence

**Every Indian clinic has a list of patients who should come back. The list is often unreachable, and nobody owns it. We make the list reachable, find out what stopped each patient, route the barrier, and prove every due patient was accounted for.**

Shorter, for a slide:

> **The follow-up list nobody owns.**

## The problem, in plain terms

A diabetes clinic in a Tier 2 city has 2,000 patients on its register. Perhaps 600 are due for a follow-up this quarter. The front desk has a paper register, a WhatsApp number and one clerk. It calls the patients it can reach. The rest are not called, or called once, or called on a number that no longer works.

The doctor sees the patients who come back. The doctor does not see the ones who do not. The clinic loses the visit, the patient loses continuity, and the register slowly becomes a list of people who used to come.

The evidence says this is not a small edge case:

- In a Chennai audit of 3,696 public-programme patients, only **60.4% had a legible phone number**, only **16.4% had a complete address**, and only **11.2% were reliably trackable by both**. Among diagnosed TB patients, only **10.2%** were trackable by both. Missing contact information was associated with pre-treatment loss to follow-up (OR 4.5).
- In a Punjab public hypertension programme, **50 to 60% of patients did not attend scheduled follow-up**. The top reasons were "not feeling sick" (24.8%), distance (22.3%), no instructions (15.3%), acute illness (8.3%) and waiting time (7%). More than half continued treatment elsewhere; 54% of those preferred private clinics.
- In a Puducherry diabetic retinopathy cohort, **50.5% delayed because "my eyes were okay"**, 41.0% had no one to accompany them, and 38.6% cited cost. **26% progressed to vision-threatening disease** during the delay.
- Childhood cancer treatment abandonment is **14.3%** at AIIMS/CanKids and **27.1%** at a regional cancer centre in Assam.
- In a Seoni district hospital, a quality-improvement programme cut missed hypertension visits from **66% to 22% in nine months** using ASHA home visits and record triangulation. No app.

The last fact is the most important. It proves the KPI can move in an Indian public hospital with the resources already there. It also sets the bar: if ASHA visits and a paper register work, why does the clinic need software?

## The insight

**The follow-up gap is not a reminder problem. It is a reachability and barrier problem.**

A reminder app assumes three things that are often false in an Indian clinic:

1. The patient is on a list, and the list is complete.
2. The patient has a working phone number and can read the message.
3. The patient is not coming because they forgot.

The evidence says the list is incomplete, the contact is often broken, and the reasons are mostly not forgetting. They are "I feel fine", distance, cost, no one to accompany me, no clear instruction, a long wait, or a switch to another provider.

So the product does not start with a message. It starts with an audit:

- Who is actually due?
- Can we reach them?
- If not, what is missing, and who can fix it?
- If yes, what happens when we ask why?

The unit of work is not a record. It is a **due patient with a disposition**. The product's promise is not "we sent 500 messages". It is "no due patient was silently dropped".

## The product

Three jobs, in order. The first two are the product; the third is the proof.

### 1. Make the list reachable

- Import the clinic's register from a photo, a CSV or an Excel sheet.
- Read the names, phone numbers, addresses, last visit, condition and clinician.
- Flag missing, illegible, duplicate, invalid or shared phone numbers.
- Capture a working number and an alternate contact at registration, with a consent script in the patient's language.
- Verify the number with a low-cost check (a missed call, a WhatsApp opt-in, a one-question reply).
- Produce a **reachability audit**: how many due patients can be reached, how many cannot, and why.

This is the part no reminder vendor does, because it is unglamorous and it is the actual bottleneck.

### 2. Ask why, then route the barrier

- Contact the patient on the channel they use: WhatsApp, a voice call, SMS, or a clinic staff call.
- Speak the patient's language, including code-mixed Hindi/English and a regional language.
- Ask a small, fixed set of clinician-approved questions: Can you come? If not, what is stopping you? Is there someone who can bring you? Do you have a preferred day or time?
- Classify the barrier into a fixed taxonomy: no symptoms, distance, cost, no attender, work, childcare, wait time, switched provider, transport, language, trust, forgot, other.
- Route to a resolution the clinic can actually deliver:
  - Book a teleconsult instead of a visit.
  - Offer a nearby lab, PHC or camp for the test.
  - Assign an ASHA/ANM home visit or a field call.
  - Send a scheme/benefit or transport contact.
  - Offer a different slot or a family booking.
  - Record a documented discharge from the list ("moved away", "under another doctor", "declined").
- If the patient does not answer after a fixed number of attempts, mark them **unreached** and assign a named human owner. The unreached are the output, not an exception.

The agent never diagnoses, advises or triages clinically. A fixed red-flag phrase ("chest pain", "bleeding", "can't breathe") creates an administrative callback task for a human; it does not become an AI decision. Every message and every disposition is logged.

### 3. Prove the loop closed

- A **loop ledger**: every due patient, every attempt, every reply, every barrier, every resolution, every outcome.
- A **morning brief** for the doctor: five numbers, the three escalations, the barrier map, and the patients who need a decision. Not a dashboard of 600 names.
- A **field worklist** for the ASHA/ANM or the clinic's caller: name, phone, language, barrier, best time, and what to do.
- A **coverage view** for the district or the owner: due, reached, booked, attended, unreached, closed, by facility and by barrier.
- An exportable audit: who was contacted, when, in what language, what they said, who decided, and why.

The ledger is the product's memory and the clinic's defence. It is also the proof that the system is not a reminder blast.

## What is new

The category is crowded. The team must name the adjacent players and explain the difference in one breath.

| Player | What they do | Why this is different |
|---|---|---|
| Clinizy | A clinic OS with recall, billing, pharmacy and lab; ₹1,499/month list price | It assumes a digital clinic and a reachable patient. It does not audit or repair the register, and it does not route a barrier to an ASHA visit or a teleconsult. |
| Eka Care | Free EMR with automated follow-up reminders and ABDM rails | A reminder is a message. The product starts before the message, with reachability, and ends after it, with a barrier resolved. |
| Vitaloop | AI voice agent that calls lapsed lab patients and books them back, pay-on-return | It works on a lab's existing list. It does not fix a paper register, an incomplete address, or a patient who cannot travel. |
| Practo / HealthPlix | Appointments, EMR, patient demand | They own the digital front door. The product owns the follow-up work after the visit, including the patients who are not on the digital front door. |
| Hospital CRM / Lifemaan | Enquiry, appointment and referral tracking | A CRM tracks what the clinic sent. The ledger accounts for who was not reached. |
| Government CPHC-NCD / ASHA registers | Data capture and defaulter lists | The product makes the list usable, assigns the visit, and closes the loop; it does not replace the ASHA or the government register. |

The one-sentence differentiation:

> **They message the patients they can reach. We start with the ones they cannot.**

The second sentence, for a judge who says "this is a CRM":

> **A CRM records a conversation. This proves a patient was accounted for, or names the human who now owns them.**

## The beachhead

**Private diabetes clinics in one Tier 2 cluster, plus one government NCD clinic.**

Why diabetes:

- The largest chronic cohort with a repeating follow-up rhythm.
- The clinic owner is the buyer; the decision is fast; the value is revenue-linked.
- RSSDI is a programme partner and a distribution channel.
- The same loop transfers to maternal/child (ANC/PNC) and cancer (post-treatment surveillance) without changing the core.

Why a cluster, not a city:

- Word of mouth between clinic owners is the cheapest acquisition channel.
- A cluster lets the team run one ASHA/field partnership, one lab partnership and one language pack.
- A cluster is small enough to dominate before expanding.

Why a government clinic from day one:

- It forces the product to work without an EMR, without clean data, and with ASHA/ANM.
- It is the proof for the "private and government" claim the reviewer asked for.
- It creates the district-level coverage story that a government buyer needs.

The first 90 days: 3 private clinics + 1 government NCD clinic, 500 to 800 due patients, one language pair beyond English, one ASHA/field partner.

## Market reality: the beachhead is not a venture-scale market at flat pricing

The honest market arithmetic matters more than a TAM slide.

- India has about **13.6 lakh registered allopathic doctors** and perhaps **10.9 lakh active** at an 80% availability assumption. It has **31,882 PHCs, 6,359 CHCs and 714 district hospitals** (Rural Health Statistics 2022 to 23), plus a large but poorly counted private clinic and nursing-home sector.
- At a flat **₹1,000 to 2,000 per doctor per month**, the addressable chronic-care clinic market is roughly **₹200 to 400 crore a year (US$25 to 50 million)**. That is a real business for a focused team. It is not a venture-scale outcome on its own.
- The two largest Indian clinic platforms report about **64,000 doctors combined** (Practo Ray 50,000+, HealthPlix 14,000+), and those are users, not all paying seats. That is a sanity check against any model that assumes lakhs of paying clinics at a flat price.
- A flat per-clinic subscription at ₹4,000/month needs **10,000 clinics for ₹48 crore ARR**. That is possible over five years, but it is a grind, and the incumbents bundle recall for less.

The conclusion is not "the market is too small". It is "the flat SaaS version is too small". The business only becomes venture-scale if the pricing tracks the value delivered and the product expands beyond one clinic's recall list.

### The pricing model to test

Use a **base fee plus a value fee**, not a flat seat:

| Component | What it pays for | Indicative price |
|---|---|---|
| Base | The ledger, the register audit, the morning brief, support | ₹2,000 to 4,000 per clinic per month |
| Value fee | Each patient who attends a follow-up after being reached and booked | ₹50 to 100 per recovered visit, or 10 to 15% of the recovered visit value |
| Government | Per facility plus a coverage-based bonus | ₹1 to 3 lakh per facility per year, tied to follow-up completion |
| Lab/partner | A referral or a completed test | Negotiated per test, only where lawful and consented |

Why this matters:

- A clinic that recovers 22 visits a month at ₹550 each gains ₹12,100. A ₹3,000 base plus ₹75 per recovered visit (₹1,650) costs ₹4,650, about 38% of the gain. The clinic keeps the rest, and the vendor's revenue rises with the outcome.
- A flat ₹4,000 fee is 33% of the gain and is easier to sell, but it caps the vendor's revenue at the clinic's willingness to pay.
- The value fee is untested in this market. It is also the only structure that can scale with the 101 million diabetes patients rather than with the number of clinics.

### The path to a larger market

1. **Adjacent loops in the same clinic.** Results accountability, referrals and maternal/child follow-up reuse the ledger and the patient relationship. Each adds revenue per clinic without a new sale.
2. **Government coverage contracts.** A district with 100 facilities is a larger contract than 100 private clinics, and the KPI is the same. The payment cycle is slower, so it needs a bridge or a partner.
3. **Labs and diagnostic partners.** A lab that pays for a completed repeat test or a closed loop can subsidise the clinic's fee. Vitaloop already sells pay-on-return recall to labs, which validates the model and warns that the lab is a competitor as well as a partner.
4. **Hospitals and payers.** A hospital with 20,000 chronic patients and a NABH follow-up obligation pays more per patient than a solo clinic. The sales cycle is longer, but the contract is larger.
5. **The per-patient layer.** If the product becomes the follow-up layer for a district or a payer, the unit is the patient, not the clinic. That is the only version that reaches a ₹500 crore+ revenue path.

### The ROI argument for a private clinic

- 700 patients a month; 25% overdue = 175.
- 70% contactable = 122.
- 25% response = 31 bookings.
- 70% show rate = 22 recovered visits.
- ₹550 per visit = ₹12,100 a month.
- A ₹3,000 base + ₹75 per recovered visit = ₹4,650. The clinic keeps about ₹7,450 before staff time.

Do not claim this ROI. Measure it in the pilot. The pitch should say: "Here is the arithmetic we will test", not "here is the saving". The pilot's job is to replace every assumption in this table with a measured number.

### The government argument

- Loss to follow-up is a programme KPI.
- ASHA/ANM already do home visits; the product makes the worklist and the coverage auditable.
- A district can buy per facility without an EMR replacement.
- The contract is larger than a clinic, but the payment cycle is 3 to 12 months and the procurement runs through state health societies and GeM. A startup usually sells through an integrator or a pilot MoU, not a direct tender.

### The uncomfortable conclusion

At flat pricing, this is a **US$25 to 50 million SAM** and a good small business. At value-based pricing, government coverage and adjacent loops, it can become a **₹500 crore+ revenue company**, but that path is unproven. The pilot must prove two things before the team raises or scales:

1. Recovered visits per clinic per month are above six; below that, the clinic cancels.
2. Clinics will pay a value fee, not only a flat subscription.

If both fail, the honest outcome is a profitable niche SaaS, not a venture-scale company. The team should decide whether that is worth building before it spends a year on it.

## The moat

The model is not the moat. The workflow and the data are.

1. **The reachability and barrier dataset.** Which contact fields fail, in which geography, for which segment, and which repair works. This compounds with every clinic and is not in any EMR.
2. **The resolution playbook.** Which barrier, in which setting, is best resolved by a teleconsult, a nearby lab, an ASHA visit, a scheme, or a discharge. This is operational knowledge encoded in the product.
3. **The ledger and the audit trail.** The clinic's defensible record of who was contacted and what happened. Switching means losing the history.
4. **The clinic's patient relationship.** The outreach is clinic-branded, not startup-branded. The patient trusts the clinic; the clinic trusts the product.
5. **Distribution.** RSSDI/FOGSI/NCG networks, lab partners, district health societies, and clinic-to-clinic referrals.
6. **The language and voice assets.** Code-mixed Indian-language conversations, scripts and barrier classifiers tuned to real replies.

A competitor can copy a screen in a month. Copying the operating discipline, the playbook and the distribution takes a year.

## Why now

- **The burden is at scale.** India has about 101 million people with diabetes and 136 million with prediabetes (ICMR-INDIAB-17, Lancet Diabetes & Endocrinology 2023). GLOBOCAN 2024 counts 1.56 million new cancer cases and 3.32 million people living within five years of a diagnosis. The country records about 23.2 million births a year. Every one of those cohorts has a follow-up tail, and every tail leaks.
- **The contact layer is broken, and now fixable.** Paper registers are being photographed; small language models can read them; phone numbers can be validated; WhatsApp and voice are cheap.
- **The government is measuring continuity.** ABDM has linked over 100 crore health records (May 2026), and NCD programmes report follow-up. The infrastructure for identity and exchange exists; the follow-up work does not.
- **The regulatory clock is running.** The DPDP Rules 2025 were notified in November 2025, with a phased compliance timeline and a May 2027 deadline. Clinics will need consent, notice and audit for outreach. A product that builds consent into the workflow is easier to adopt than a bolt-on.
- **The incumbents are EMR-first.** They are optimising the record and the digital front door. The unreached patient is not their centre of gravity.

## Why us

- The team already has the hard back end: multi-tenant auth, row-level security, an auditable approval path, evidence binding, a worker, a web/Android client and a hosted demo.
- The team has a doctor partner and a diabetes clinic workflow.
- The team has demonstrated the discipline to build verification and audit, which is exactly what a follow-up ledger needs.
- The team is small enough to run a concierge pilot and learn the barrier taxonomy by hand before automating it.

The honest gap: the team has not yet run a real clinic pilot, has not measured a recall lift, and has not integrated WhatsApp or telephony. The plan in `06-validation-plan.md` tests those first.

## What the product is not

- Not an EMR. It does not replace the clinic's records.
- Not a diagnostic or triage tool. It does not interpret symptoms or results.
- Not a reminder blast. The reminder is one step; the ledger and the barrier resolution are the product.
- Not a patient app. The patient uses the phone and the channel they already have.
- Not an ABDM integration. It can use ABHA optionally later; it does not claim it now.
- Not a 3D gimmick. The 3D loop visual is an explanation of where patients leak, not the product.

## The 30-second version

> "Every clinic has a list of patients who should come back. In India, that list is often unreachable: in a Chennai audit, only 11% of patients could be reliably tracked by phone and address. The rest are not reminded; they are lost. We audit the list, fix the contact, ask the patient what stopped them, route the barrier to a teleconsult, a nearby lab or an ASHA visit, and give the clinic a ledger where every due patient has a disposition. The clinic recovers visits; the district sees coverage; the patient is not dropped. We start with diabetes clinics in one Tier 2 cluster and one government NCD clinic."

## The 2-minute version

Add:

- The Punjab evidence: 50 to 60% miss follow-up; the top reasons are not forgetfulness.
- The Seoni evidence: a QI programme cut missed visits from 66% to 22% with ASHA visits and a paper register; the product makes that discipline scalable and auditable.
- The competitor distinction: Clinizy, Eka and Vitaloop message the reachable; we start with the unreachable.
- The pilot: 3 clinics + 1 CHC, 500 to 800 due patients, 8 weeks, recall completion, reachability, barrier resolution, staff minutes.
- The ask: one clinic and one district partner for the pilot; a doctor partner for the question set.

## The risks, stated plainly

| Risk | Why it matters | Mitigation | Kill signal |
|---|---|---|---|
| The clinic will not fix the register | The product's first job depends on clean contact data | Make the audit a 10-minute task; capture at registration; offer a clerk-assisted mode | <50% of missing contacts repaired in 2 weeks |
| The patient will not answer | The unreached stay unreached | Multi-channel (WhatsApp, voice, SMS), local language, clinic branding, ASHA fallback | <40% contact rate after 3 attempts |
| The barrier cannot be resolved | The product becomes a survey | Start with resolutions the clinic already has (teleconsult, nearby lab, ASHA visit); add partners gradually | <30% of barriers resolved |
| The clinic will not pay | The category is used to free/cheap tools | Price against recovered visits; paid continuation after a free pilot; per-clinic not per-doctor | <2 of 3 clinics pay |
| The incumbent bundles it | Clinizy/Eka can add a recall screen | Own the reachability and barrier workflow, the ledger and the field worklist; go where the incumbents are weak (paper, public, Tier 3) | Win rate <30% in head-to-head |
| The regulatory burden is underestimated | DPDP consent, WhatsApp policy, data retention | Consent-first design, data minimisation, audit, grievance officer, DPIA-lite | Cannot obtain consent for >70% of patients |
| The team confuses a service with a product | Founder calls make the pilot look good | Product autonomy ratio; founder-free week; staff time per patient | <50% of actions handled without the founder by week 6 |

## The decision

Build A. Keep B (closed-loop results) as the second loop and the fallback if A's demand test fails. Do not build a new records feature, a new dashboard, or a 3D demo before the loop runs.

The next document is the validation plan. It is designed to kill A quickly if the evidence does not support it.

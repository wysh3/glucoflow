# Executive brief: what to build, why, and what would kill it

> **Superseded for the lead recommendation.** This brief reflects the first-pass follow-up thesis. The revised lead is the result accountability loop in [13-revised-recommendation-result-loop.md](13-revised-recommendation-result-loop.md). The follow-up thesis remains the second loop.

3 November 2026. Four days before the final submission (7 November, 23:59 IST; the public sources disagree by one day). Twenty-five days before the IIT Bombay finale (28 November). This brief is the decision, the evidence and the plan. The detailed notes are indexed in `README.md`.

## The verdict

The reviewer is right about the current product. Glucoflow is a well-built records workflow in a category that ABDM, Eka Care, Practo, HealthPlix, Navina, PicnicHealth and the government's small-clinic HMIS already occupy. Its verification mechanisms are real, but they are features of a record, and the clinic does not pay for a record. The "Ask, don't guess" pre-visit agent is more 2026, but it is a concept deck, not a build, and it is still a context-capture product in a crowded conversation space.

The fix is not another feature or a better deck. It is a different job.

**Recommended job: own the clinic's follow-up list.**

Every Indian clinic has a list of patients who should come back. The list is often unreachable, and nobody owns it. The product makes the list reachable, asks the patient what stopped them, routes the barrier to a resolution, and gives the clinic a ledger where every due patient has a disposition, including the ones who never answered.

One sentence:

> **The follow-up list nobody owns.**

## Why this problem, in evidence

- In a Chennai audit of 3,696 public-programme patients, only **60.4% had a legible phone number**, only **16.4% had a complete address**, and only **11.2% were reliably trackable by both**. Among diagnosed TB patients, only **10.2%** were trackable by both. Missing contact information was associated with pre-treatment loss to follow-up (OR 4.5).
- In a Punjab public hypertension programme, **50 to 60% of patients did not attend scheduled follow-up**. The top reasons were "not feeling sick" (24.8%), distance (22.3%), no instructions (15.3%), acute illness (8.3%) and waiting time (7%).
- In a Puducherry diabetic retinopathy cohort, **50.5% delayed because "my eyes were okay"**, 41.0% had no one to accompany them, and 38.6% cited cost. **26% progressed to vision-threatening disease** during the delay.
- Childhood cancer treatment abandonment is **14.3%** (AIIMS/CanKids) and **27.1%** (Assam).
- A Seoni district hospital cut missed hypertension visits from **66% to 22% in nine months** using ASHA home visits and record triangulation, without an app.

The last fact is the proof that the KPI can move in an Indian public hospital. It is also the warning: the product must make the operational discipline easier and auditable, not claim that software replaces the ASHA visit.

## The insight

**The follow-up gap is not a reminder problem. It is a reachability and barrier problem.**

A reminder assumes a complete list, a working phone and a patient who forgot. The evidence says the list is incomplete, the contact is often broken, and the reasons are mostly not forgetting. They are "I feel fine", distance, cost, no one to accompany me, no clear instruction, a long wait, or a switch to another provider.

So the product starts before the message (make the list reachable) and ends after it (route the barrier). The unit is not a record; it is a **due patient with a disposition**. The promise is not "500 messages sent"; it is "no due patient silently dropped".

## What is new

The category is crowded, and the pitch must say so.

| Player | What they do | Why this is different |
|---|---|---|
| Clinizy | A clinic OS with recall, billing, pharmacy and lab at ₹1,499/month | Assumes a digital clinic and a reachable patient; no reachability audit, no barrier routing |
| Eka Care | Free EMR with automated follow-up reminders and ABDM rails | A reminder is a message; we start before it and end after it |
| Vitaloop | AI voice calls to lapsed lab patients, pay-on-return | Works on a lab's existing list; does not fix a paper register or a patient who cannot travel |
| Practo / HealthPlix | Appointments and EMR | They own the digital front door; we own the patients outside it |
| Hospital CRM | Enquiry, appointment and referral tracking | A CRM tracks what was sent; the ledger accounts for who was not reached |
| Government CPHC-NCD / ASHA registers | Data capture and defaulter lists | We make the list usable, assign the visit, and close the loop |

The one-line differentiation:

> **They message the patients they can reach. We start with the ones they cannot.**

The second line, for a judge who says "this is a CRM":

> **A CRM records a conversation. This proves a patient was accounted for, or names the human who now owns them.**

## Why this can be a company, and the honest limit

The flat-price math is not venture scale:

- About 13.6 lakh registered allopathic doctors, perhaps 10.9 lakh active.
- 31,882 PHCs, 6,359 CHCs and 714 district hospitals, plus a large, poorly counted private clinic sector.
- At ₹1,000 to 2,000 per doctor per month, the addressable chronic-care clinic market is roughly **₹200 to 400 crore a year (US$25 to 50 million)**.
- Practo Ray (50,000+ doctors) and HealthPlix (14,000+ doctors) together report about 64,000 doctors, and those are users, not all paying seats.

The path to a larger business is not more flat seats. It is:

1. **Value-based pricing:** a base fee plus ₹50 to 100 per recovered visit, or a share of the recovered revenue.
2. **Government coverage contracts:** a district with 100 facilities is a larger contract than 100 private clinics, and the KPI is the same.
3. **Adjacent loops:** results accountability, referrals, maternal/child follow-up, using the same ledger and patient relationship.
4. **Labs and hospitals:** a lab or a hospital with 20,000 chronic patients pays more per patient than a solo clinic.

The pilot must prove two things before the team raises or scales:

- Recovered visits per clinic per month are above **six**; below that, the clinic cancels.
- Clinics will pay a **value fee**, not only a flat subscription.

If both fail, the honest outcome is a profitable niche SaaS, not a venture-scale company. The team should decide whether that is worth a year before it spends one.

## Tier 2/3 and rural: the reviewer's second point

The product should be designed for Tier 2/3 first, not expanded there later.

- The problem is worst where records are thinnest and distances are longest.
- The incumbents are EMR-first, English-first and Tier 1-first.
- The channels that work are paper, phone, WhatsApp and ASHA visits.
- A Tier 2 private clinic pays because a recovered visit is revenue.
- A government CHC pays because a closed defaulter is a KPI.
- The same core works in both; the worklist is different (clerk vs ASHA).

The honest cons: lower ARPU, higher support, government payment delays, data quality, ASHA capacity, and trust earned clinic by clinic. The mitigations and the phased plan are in `08-tier-2-3-rural.md`.

## Regulation: the reviewer's third point

**HIPAA is a United States statute and does not apply to an Indian clinic treating Indian patients.**

The applicable stack:

- **DPDP Act 2023** and **DPDP Rules 2025** (G.S.R. 846(E), 13 November 2025). The substantive duties commence **13 May 2027**. The consent-manager rule starts 13 November 2026. The product is the clinic's **data processor**; the clinic is the **data fiduciary**.
- **ABDM Health Data Management Policy** only if the product onboards as a HIP/HIU. The product is "ABDM-shaped, not connected".
- **NMC Telemedicine Guidelines 2020** if the product gives clinical advice. It does not; reminders and logistics are not telemedicine.
- **CDSCO device rules and the July 2026 software guidance**: a risk score, triage, early warning or "improves outcomes" claim can make it a medical device. Stay in scheduling, reminders, communication and record transport.
- **IT Act s.43A/SPDI Rules and CERT-In directions**: 6-hour incident reporting and 180-day logs in India.
- **NABH Digital Health Standards** where the clinic is accredited; the audit trail becomes survey evidence.

The product implication is simple: ask for less data, get explicit consent, log everything, name a grievance officer, and never claim a clinical function. The details and the 12-item pilot checklist are in `07-india-regulatory-map.md`.

## UX/trust and the 3D question: the reviewer's fourth point

The strongest trust move is not a prettier screen. It is **asking for less**.

- The patient does not upload reports or create an account. The product needs a phone number and a reason, not the medical record.
- The message is clinic-branded, in the patient's language, with a one-screen consent notice and a one-tap stop.
- The doctor gets a five-minute morning brief and three escalations, not a dashboard of 600 names.
- The 3D visual is a **loop map** that shows where patients leak; the red branch is the patients nobody called. It is not a 3D body, an AI orb or a chatbot avatar.

The details, the copy and the accessibility rules are in `09-ux-trust-3d.md`.

## The plan for the next four days

1. **Today-tomorrow:** the ten interviews and three register audits in `06-validation-plan.md`. Do not pitch; ask for the due list.
2. **Tomorrow-Thursday:** build the synthetic 120-patient demo slice: reachability audit, loop board, Hindi conversation, morning brief, ledger. Do not rebuild the records app.
3. **Thursday:** rewrite the deck to the seven slides in `10-pitch-and-demo.md`. Cut the five-year chart, the test count and the "30% time saving".
4. **Friday:** rehearse the three-minute demo; run the five-viewer comprehension test; get the doctor partner's sign-off on the question set and the scripts.
5. **Saturday 7 November:** submit. State the synthetic data, the assistive scope and the unmeasured claims.

The honest fallback: if the interviews do not support the thesis, submit the existing records product with an honest label, or the PreVisit concept, and do not claim the new thesis. A working product with a true, narrow claim beats a new story with no evidence.

## The eight-week pilot

- 3 private clinics in one Tier 2 cluster + 1 government CHC/NCD clinic.
- 500 to 800 due patients; stepped-wedge by site; 4-week baseline.
- Primary KPI: recall completion within 30 days.
- Secondary: reachability, contact rate, barrier resolution, staff minutes, unreached rate, opt-out, recovered visits.
- Kill criteria: under 10 points of lift, under 50% disposition completeness, over 3 minutes per patient, fewer than 2 of 3 clinics paying, over 5% opt-out, autonomy below 50%.
- The founder-free week and the clerk test separate product value from manual effort.

The full design is in `06-validation-plan.md`.

## What would make me change this recommendation

- If 7 of 10 clinics say they already have a reliable, reachable follow-up list, the reachability thesis is wrong.
- If clinics will not share or repair the register, the phone-first product is unworkable; the fallback is ASHA/home-visit-first, or the results loop.
- If a well-funded incumbent already sells the exact reachability + barrier loop in India, the novelty collapses; the fallback is the per-result accountability loop, where the competitor research found a real white space.
- If the pilot's lift is under 10 points, kill it. Do not rationalise.

## The bottom line

The team has a strong backend and a weak story. The backend is the proof layer; the story should be the loop. Build the loop, measure the return, and be willing to stop. That is the Zero to One move: one narrow problem, one exceptionally good solution, a small market you can dominate, and evidence before scale.

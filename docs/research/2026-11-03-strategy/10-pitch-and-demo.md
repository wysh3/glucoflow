# The pitch and the demo

> **First-pass pitch for the follow-up thesis.** The revised result-loop pitch and demo are in [13-revised-recommendation-result-loop.md](13-revised-recommendation-result-loop.md). The storytelling rules here carry over.

This is the narrative for the 7 November submission and the 28 November finale. It assumes the product in `05-recommended-thesis.md` and the demo slice in `06-validation-plan.md`. The deck is seven slides. The demo is three minutes. The goal is one sentence the judge can repeat.

## The one sentence

> **Every clinic has a list of patients who should come back. The list is often unreachable, and nobody owns it. We make it reachable, find out what stopped each patient, and prove every due patient was accounted for.**

The judge's version, after the demo:

> "They found the patients the clinic could not reach, asked why, and got them back."

## The seven slides

### Slide 1: Title

> **The follow-up list nobody owns.**
>
> A follow-up agent for Indian clinics that starts with the patients everyone else cannot reach.
>
> Synthetic data · Assistive only · Human approval required

Visual: one clinic register photo, one WhatsApp thread, one red "24 unreached" chip. No dashboard.

### Slide 2: The problem

Headline: **The patients who need you most are the ones you never hear from.**

Three facts, each with a source:

- Only **11.2%** of 3,696 public-programme patients in Chennai were reliably trackable by phone and address. Among diagnosed TB patients, **10.2%**. (BMC Infectious Diseases 2018)
- **50 to 60%** of hypertension patients in a Punjab public programme missed scheduled follow-up. The top reasons were "I feel fine" (24.8%), distance (22.3%) and no instructions (15.3%). (J Clin Hypertens 2021)
- In a Puducherry eye clinic, **50.5%** delayed because "my eyes were okay", **41%** had no one to bring them, **38.6%** cited cost. **26%** progressed to vision-threatening disease. (Indian J Ophthalmol 2017)

Visual: a due list with names crossed out; a phone number with missing digits; a distance line from a village to the clinic.

Do not put the 101 million diabetes statistic on this slide. It is context, not the problem.

### Slide 3: The insight

Headline: **This is not a reminder problem. It is a reachability and barrier problem.**

Two columns:

| What a reminder app assumes | What the evidence shows |
|---|---|
| The list is complete | 34.4% of records had missing or illegible contact information |
| The phone works | Only 60.4% had a legible phone |
| The patient forgot | The top reason is "I feel fine"; then distance, cost, no attender |

One line at the bottom:

> **They message the patients they can reach. We start with the ones they cannot.**

### Slide 4: The product

Headline: **Three jobs. One ledger. No patient dropped.**

A simple three-step diagram:

1. **Make the list reachable.** Photo/CSV intake, contact audit, consent, alternate contact.
2. **Ask why, then route.** WhatsApp/voice in the patient's language; a fixed barrier list; a teleconsult, a nearby lab, an ASHA visit, or a documented close.
3. **Prove the loop closed.** Every due patient has a disposition; the unreached have a named owner; the doctor gets a five-minute brief.

Visual: the loop board with the red `Unreached` lane, and a WhatsApp thread in Hindi/Roman Hindi.

### Slide 5: The demo

Headline: **120 due patients. 46 with a contact problem. 24 still unreached. Zero without a disposition.**

A screenshot sequence, not a feature list:

- The reachability audit.
- The Hindi conversation: "I cannot come, there is no one to bring me." The agent offers a teleconsult; the patient books.
- The unreached lane: the agent assigns an ASHA visit; the ledger records it.
- The doctor's brief: three escalations, the barrier map.

One line:

> **Every number opens the patient, the attempt, the reason and the owner.**

### Slide 6: The proof

Headline: **We will measure the only thing that matters: did the patient come back?**

The pilot:

- 3 private clinics + 1 government CHC, 500 to 800 due patients, 8 weeks.
- Primary KPI: recall completion within 30 days.
- Secondary: reachability, contact rate, barrier resolution, staff minutes, unreached rate, opt-out.
- Design: stepped-wedge by site; baseline 4 weeks; pre-registered analysis.
- Kill criteria: under 10 points of lift, under 50% disposition completeness, over 3 minutes per patient, fewer than 2 of 3 clinics paying.

One line:

> **If the lift is not there, we will say so and stop.**

This slide is the credibility. Do not replace it with "135 tests".

### Slide 7: Why now, why not them, why us

Three short columns.

**Why now.**

- 101M diabetes, 1.56M new cancers a year, 23.2M births: every cohort has a follow-up tail.
- Multilingual LLMs, WhatsApp and cheap voice make the conversation possible at ₹ per patient.
- The DPDP Rules 2025 set the consent and audit standard; a product built for it is easier to adopt.
- The incumbents are optimising the record and the digital front door.

**Why not them.**

- Clinizy bundles recall into a ₹1,499 clinic OS; Eka ships reminders inside a free EMR; Vitaloop calls lapsed lab patients.
- They assume a digital list and a reachable patient. We start with the paper register, the missing number and the patient who cannot travel.
- A CRM records what the clinic sent. The ledger names the human who owns the patient who was not reached.

**Why us.**

- The auditable backend, the evidence binding and the review discipline already exist.
- A doctor partner and a diabetes clinic workflow.
- The team can run a concierge pilot and encode the barrier playbook before automating it.

### Slide 8: The ask

Headline: **One cluster. One district. Eight weeks.**

> We are looking for three private clinics in one Tier 2 cluster and one government NCD clinic to run an 8-week pilot. We will publish the baseline and the delta, including the negative result. If the loop works, we will expand to 10 clinics and one district.

Visual: the map of one cluster, one district, one loop.

## The three-minute demo

The demo is a story with five beats. It uses synthetic data and says so. It does not show a dashboard tour.

### 0:00 to 0:20: The starting point

> "This is a synthetic clinic in a Tier 2 town. 120 patients are due this month. Before we talk to anyone, we audit the list."

Show the reachability audit: 46 with a contact problem (22 missing a phone, 14 invalid, 10 duplicate/family records); after the audit, 34 are repaired and 12 remain unreachable. 108 are reachable in total.

> "The clinic thought it had 120 patients to call. 46 of the records were broken. We repaired 34, and 12 people are still unreachable. Add the 12 who never answer, and 24 patients have no one to own them."

### 0:20 to 0:50: The unreached branch

Show the loop board. The red `Unreached` lane is lit at 24.

> "A reminder app would send 120 messages and report 108 delivered. We report 24 people who cannot be reached, and we assign each one an owner."

Click one: a patient with no working number and an old address. The clinic's options: an alternate contact, a letter, an ASHA visit. Assign the ASHA.

### 0:50 to 1:40: The conversation

Play the WhatsApp thread in Roman Hindi:

> **Clinic:** Namaste. This is [Clinic]. You were due for a follow-up on 12 October. Can you come in the next two weeks? We will ask 3 short questions. Reply STOP to stop.
>
> **Patient:** nahi aa paungi, koi saath le jane wala nahi hai
>
> **Agent:** Samajh gayi. Kya aap phone ya video par doctor se baat kar sakti hain?
>
> **Patient:** haan, video se ho jayega
>
> **Agent:** Theek hai. [Date, time] par video consultation book kar diya. Clinic aapko call karega. Aapne report nahi bheji, sirf samay aur reason bataya. Dhanyavaad.

> "She did not need an app, a login, or her reports. She needed someone to ask why. The barrier was 'no one to bring me', and the resolution was a teleconsult."

### 1:40 to 2:20: The doctor's brief

Show the morning brief: 120 due, 96 reached, 74 booked, 24 unreached, 3 escalations.

> "The doctor does not see 600 names. She sees three escalations: a patient who mentioned chest pain and needs a human call, a patient who asked for a person, and a patient whose barrier the clinic cannot solve. The rest is a ledger."

Show the barrier map: 18 distance, 9 cost, 6 no attender, 4 no symptoms.

> "The barrier map is the clinic's next operational decision: a camp in the north, a teleconsult slot, a lab partner. That is not a report; it is a to-do list."

### 2:20 to 3:00: The proof

> "At the end, every due patient has a disposition. 120 due, 96 reached, 74 booked, 24 unreached with a named owner, 0 dropped. That is the number we will measure in the pilot: recall completion within 30 days. If it does not move, we will say so."

Close:

> "The clinic's records are not the product. The patient who comes back is."

## The 30-second answer

> "Indian clinics run follow-up on a list that is often unreachable: in a Chennai audit, only 11% of patients could be reliably tracked by phone and address. A reminder cannot fix a missing number or a patient who cannot travel. We audit the list, ask the patient what stopped them, route the barrier to a teleconsult, a nearby lab or an ASHA visit, and give the clinic a ledger where every due patient has a disposition. We start with diabetes clinics in one Tier 2 cluster and one government NCD clinic."

## The 10-second answer

> "We find the follow-up patients the clinic cannot reach, ask why, and get them back."

## Objections and answers

| Objection | Answer |
|---|---|
| "This is a reminder app. Clinizy/Eka does this." | "They message the patients they can reach. We start with the ones they cannot: the missing number, the invalid number, the patient who cannot travel. The product's first output is a reachability audit, not a message." |
| "Why not just hire a clerk?" | "The clerk is the user, not the competitor. We make the clerk's list complete, give them the script, route the barrier, and prove coverage. The clerk test in the pilot measures whether the product beats a clerk with a script. If it does not, we lose." |
| "AI is not necessary." | "The AI reads the paper register, handles the multilingual replies, classifies the barrier and routes it. The human calls are human. If a clerk alone can do it at the same cost, the AI is not the value and we should know that." |
| "Patients will not trust it." | "We do not ask for their reports. We ask for a phone number and a reason, in their language, from their clinic, with one-tap stop. The pilot measures consent and opt-out." |
| "The willingness to pay is low." | "We price a base plus a value fee and measure recovered visits. If a clinic does not recover at least six visits a month, it will not pay, and we will stop." |
| "Government sales are slow." | "The first revenue is private. The government pilot is a district NCD clinic, per facility, aligned to a follow-up KPI. We are not betting the company on a tender." |
| "Is this a medical device?" | "No. We do not diagnose, triage, score risk or recommend treatment. We schedule, remind, communicate and route a human task. The CDSCO guidance excludes clinic scheduling and communication software." |
| "Is this ABDM-integrated?" | "No. It is ABDM-shaped: consent, audit and FHIR-ready data. We do not claim an integration we do not have." |
| "Why you?" | "We have the auditable backend, the review discipline and a doctor partner. The hard part is trust and operations, and that is what we have built." |
| "What if the patient does not answer?" | "The unreached are the product. They get a named human owner and a field worklist; the ledger shows them. They are not an exception in a delivery report." |

## What to cut from the current deck

- The five-year dual-axis scenario chart. It reads as a mockup.
- The feature list and the 180-test count. Engineering evidence is not product evidence.
- The "30% less preparation time" target. It was never measured.
- The "AI extracts records" hero. It is the old job.
- The "ABDM" hint. It is not integrated.
- The 3D body, the AI orb and the chatbot avatar. They imply diagnosis or gimmick.
- The word "triage". It is a clinical function and a device risk.
- "HIPAA". It does not apply in India.

## What to add

- The reachability audit as the first product screen.
- The red `Unreached` lane and the named owner.
- The patient conversation in a real local language, with a consent receipt.
- The barrier map and the clinic's next action.
- The pilot design, the KPI and the kill criteria.
- The regulatory page: DPDP, processor, consent, no device.
- The Tier 2/3 expansion page: one cluster, one district, one ASHA worklist.

## The closing line

> **The clinic does not need another record. It needs the patient to come back.**

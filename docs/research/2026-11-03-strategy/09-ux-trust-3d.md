# UX, trust and the 3D question

The reviewer asked for an easier UI/UX, a design where patients are not worried about their personal details, and "a 3D model or something very attractive". This note answers all three, and it argues that the strongest trust move is not a prettier screen. It is asking the patient for less.

## The trust insight

The current product asks a patient to upload medical reports. That is a large ask: it is health data, it is sensitive, and the patient does not know what the clinic or the startup will do with it. The follow-up product does not need those records.

**It needs two things: a way to reach the patient, and the patient's own reason for not coming.**

That is a much smaller ask, and it changes the conversation:

- "We are not asking for your reports. We are asking whether you can come for your follow-up, and if not, what is stopping you."
- "The clinic already has your record. We only need a phone number and a reason."
- "You can stop the messages at any time. The clinic can still call you."

This is privacy by design, not a privacy policy. It also reduces the regulatory surface: the product processes contact and logistics data, not clinical records. The clinic remains the data fiduciary for the record; the product is the processor for the follow-up.

## The patient experience

The patient should never download an app, create an account, or learn a new interface. The experience is a WhatsApp thread or a phone call from the clinic's number.

### Step 1: the first message

> **From: [Clinic name]**
> Namaste. This is [Clinic]. You were due for a follow-up on [date]. We are checking whether you can come.
>
> You do not need to share your reports. We will ask 3 short questions. Reply STOP to stop these messages, or call [clinic number] to speak to a person.

Why this works:

- The clinic's name is the sender, not the startup's.
- The reason for the message is explicit.
- The ask is small and bounded ("3 short questions").
- The patient can stop or call a human without navigating a menu.
- No clinical value, diagnosis or test result is in the message.

### Step 2: the three questions

1. "Can you come to the clinic in the next two weeks?"
   - Yes, I can.
   - I can come but not in two weeks.
   - No, I cannot.
2. If no: "What is stopping you?" with a short list in the patient's language:
   - I feel fine, so I did not think I needed to come.
   - It is too far / travel is difficult.
   - It costs too much.
   - I have no one to bring me.
   - I cannot take time off work.
   - I have no one to look after the children / the family.
   - The wait at the clinic is too long.
   - I am seeing another doctor.
   - I did not understand what to do.
   - Other.
3. "What would help?" with options the clinic can actually deliver:
   - A phone/video consultation.
   - A lab or clinic closer to home.
   - A home visit by a health worker.
   - A different day or time.
   - Help with a scheme or the cost.
   - A call from the clinic.

The patient can reply by voice note if typing is hard. The agent transcribes, confirms and records the barrier. The patient sees the confirmation in their language.

### Step 3: the confirmation

> "Thank you. We have booked you for [date/time] with [doctor]. If you cannot come, reply here or call [number]. Your clinic has your record; we did not ask for it."

The confirmation is the receipt. It says what was booked, what was not asked, and how to change it.

### What the patient never sees

- A diagnosis, a test value, a risk score or a treatment recommendation.
- A chatbot pretending to be a doctor.
- A long consent document before the first message.
- A request to upload reports.
- A startup brand at the top of the message.

### What the patient can always do

- Stop messages with one word.
- Call the clinic from the thread.
- Ask for a person.
- Ask what data the clinic holds and how to correct it.
- Complain to a named person with a published response time.

## The consent receipt

The consent notice is one screen, in the patient's language, before the first message. It is not a 20-page policy. It says:

| What | Why |
|---|---|
| Your phone number | To contact you about your follow-up |
| Your preferred language | To speak to you in a language you understand |
| Your reason for not coming | To help the clinic remove the barrier |
| Your appointment | To book and confirm it |
| Who processes it | The clinic, and the product as its processor; WhatsApp as the messaging provider |
| Where it is stored | India (or the stated country) |
| How long | At least one year for logs, then erased when the purpose ends |
| How to stop | Reply STOP, or call the clinic |
| How to complain | A named person, a phone number, a published 90-day response |

The patient can accept, decline or ask a question. The consent is recorded with a timestamp, a version and a language. If the patient declines, the clinic can still call them, but the product cannot message them.

## The doctor's experience

The doctor does not need another dashboard. The doctor needs a five-minute morning brief and a short escalation list.

### The morning brief

One screen, above the fold:

- **Due this week:** 120.
- **Reached:** 96.
- **Booked:** 74.
- **Unreached:** 24 (with a named owner for each).
- **Barriers:** 18 distance, 9 cost, 6 no attender, 4 no symptoms, 3 other.
- **Needs your decision:** 3.

Below the numbers, three cards:

1. **The three escalations.** A patient who mentioned a red-flag phrase; a patient who asked for a person; a patient whose barrier the clinic cannot resolve.
2. **The barrier map.** A small chart of what is stopping patients, with the top action the clinic can take (a camp, a teleconsult slot, a lab partner).
3. **The unreached.** The 12 patients with no contact, each with the attempts, the last known number, and the assigned human owner.

The doctor can tap any number to see the ledger. There is no wall of 600 names.

### The loop board

For the clerk or care coordinator, a board with columns:

`Due → Contacted → Replied → Booked → Attended → Closed`

and a separate `Unreached` lane with a red border. Every patient is in exactly one column. A patient cannot be dragged to `Closed` without a disposition. The unreached lane is never empty by accident; it is the product's main output.

The visual language:

- Green: booked or attended.
- Amber: replied with a barrier, being resolved.
- Red: unreached or escalated.
- Grey: closed with a documented reason.

No confetti. No gamification of patients. The board is a worklist, not a game.

### The clinic's weekly review

A one-page PDF or screen:

- Due, reached, booked, attended, unreached, closed.
- The barrier mix and the top three actions.
- The staff minutes per patient.
- The recovered visits and the revenue.
- The consent and opt-out rate.

This is the page the owner signs off on and the district reviews.

## The 3D question

The reviewer asked for "a 3D model or something very attractive". The wrong response is a 3D body, a 3D pill, or a floating AI orb. Those imply diagnosis, or they are decoration. The right response is a 3D **loop map** that makes the product's core insight visible: patients leak at specific points, and the unreached branch is the one nobody sees.

### What the 3D loop is

A three-dimensional flow of the patient cohort:

- A node for **due** (120 patients).
- A flow to **reached** (96), then **booked** (74), then **attended** (68).
- A branch to **barrier** (18 distance, 9 cost, 6 no attender, 4 no symptoms), then to **resolved** or **escalated**.
- A dark red branch to **unreached** (24), which grows toward the viewer when the presenter clicks "show unreached".
- A final node for **closed with a reason**.

The 3D is not a chart of the clinic's performance in the abstract. It is a map of where the patients are. The red branch is the story: the patients the clinic never sees.

### How it is used

1. **In the pitch.** A 20-second animation: the loop fills, the red branch grows, the presenter clicks it, the ledger filters to the 12 names, and one patient's WhatsApp conversation plays. The 3D is the setup for the human story, not the story itself.
2. **In the clinic.** A static or slowly animated version on the weekly review screen. It shows the leak and the top action. It is not the daily worklist.
3. **On the landing page.** A lightweight WebGL loop with a "show me the unreached" toggle. It is the demo's first impression.

### How it is built

- Three.js or React Three Fiber, with a simple instanced-node scene; no heavy GLTF models.
- A 2D SVG fallback for low-end devices, reduced motion, and screenshots.
- Under 2 MB of assets; 60 fps on a mid-range Android; no WebGL on a 2G connection.
- The data is synthetic in the demo; the clinic version uses aggregate counts, not patient names, on the 3D view.
- The 3D view never shows a patient identifier. The ledger is a separate, access-controlled screen.

### Why this is not a gimmick

A generic 3D model would be a gimmick. This one answers the product's central question: **where do patients leak?** The unreached branch is the one a CRM cannot show, because a CRM only tracks what it sent. The 3D makes the invisible visible. That is the test for any visual: if it does not make the leak or the barrier clearer, cut it.

### What not to build

- A 3D human body or organ. It implies clinical interpretation and device risk.
- A 3D pill or stethoscope. It is clip art with polygons.
- A talking avatar. It implies a doctor and raises the telemedicine/device question.
- A 3D dashboard with fake depth. It slows the demo and adds nothing.
- A 3D model that requires a download. The patient never sees it; the judge should see it instantly.

## Accessibility and low-digital-literacy rules

- Large type, high contrast, one action per screen.
- The patient flow works in WhatsApp; no app, no login.
- Voice notes in, voice replies out for low-literacy patients.
- The clinic flow works one-handed on a phone.
- The language is the patient's, including Roman script; no English-only fallback.
- The consent notice is read aloud by a voice note option.
- The 3D loop has a static fallback and a "reduce motion" setting.

## How to test the UX in the pilot

- **Comprehension:** after the first message, call 30 patients and ask, "Why did the clinic message you?" Target: 80% can say the reason.
- **Consent:** the share who accept the notice and the share who opt out. Target: 70% consent, under 5% opt-out.
- **Trust:** "Did you think this was spam or a fraud?" Target: under 10% yes.
- **Burden:** the median time for a clerk to work 20 patients. Target: under 2 minutes per patient.
- **Doctor use:** does the doctor open the morning brief on 4 of 5 days? Target: 80%.
- **Explaining the product:** 5 viewers explain it back in one sentence. Target: 3 of 5 mention the unreached or the follow-up, not "records" or "AI".

## The one-slide version

> **Ask for less, show the leak.** The patient does not upload reports or create an account. They get a clinic-branded message, three questions in their language, and a one-tap stop. The doctor gets a five-minute brief and three escalations, not a dashboard. The 3D loop shows where patients leak; the red branch is the patients nobody called. Trust comes from asking for less, not from a privacy policy.

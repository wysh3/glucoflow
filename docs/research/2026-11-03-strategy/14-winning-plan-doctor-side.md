# The winning plan: a doctor-side product for a panel of two doctors and one technologist

3 November 2026. This memo is about winning the final, not about exploring. It assumes the final deliverables are the MVP, the two-page brief, the presentation in the prescribed sequence, and the 6 to 7 minute demo video. The panel is two doctors and one technology expert. The Top 10 are shortlisted from this round.

The short answer: the product should be the doctor's **60-second delta**. Not a records dashboard. Not a lab admin tool. A one-page brief that tells the doctor the three things that changed since the last visit, the two things that are unresolved, and a source for every line. The doctor decides. The AI prepares.

## 1. The panel is the product test

Two doctors and one technologist will score different things. The pitch must satisfy both without splitting into two pitches.

| Judge | The question they are really asking | What wins | What loses |
|---|---|---|---|
| Doctor 1 | "Would this save me time in my own OPD?" | A recognizable pain, a 60-second change, a source for every number, no extra work | A dashboard tour, a claim of diagnosis, a product that adds a step |
| Doctor 2 | "Is this safe for my patient and my licence?" | Human approval, explicit limits, audit, no autonomous advice, a refusal path | "AI doctor", a risk score, a black box, a hidden uncertainty |
| Technology expert | "Is this a real system or a wrapper?" | A working MVP, a versioned data model, extraction, reconciliation, audit, a measured KPI | Slides, a mock, a chatbot over a PDF, an unmeasured claim |

The doctors vote on relevance and trust. The technologist votes on feasibility and substance. A product that only pleases one loses.

## 2. The deliverables, and what "good" means for each

### The functional MVP

- A hosted link that opens without a password, or a one-click demo account.
- A synthetic patient cohort with realistic records, not a blank screen.
- A guided "judge mode" that walks the panel through the key moments in 4 minutes.
- Three actions the panel can try: open a source, accept a delta item, flag an unresolved item.
- A visible "synthetic data" label and a one-line scope statement.
- A fallback video or screenshots in case the network fails.

### The two-page brief

- Strictly the prescribed template. Do not add, remove or reorder sections.
- One idea per section. Tables and short bullets, not paragraphs.
- The first page answers why this problem, for whom, and what changes. The second answers how it works, why it is safe, how it makes money, and why this team.
- Every number has a source or a "to be measured" label.
- A single screenshot of the delta, not a collage.

### The final presentation

- The prescribed slide sequence. Customize the visuals, not the order.
- One idea per slide. The slide is a visual aid, not a document.
- The doctor partner speaks for the problem and the clinical fit. The technical lead speaks for the build and the evidence.
- A live or recorded demo in the middle, not at the end.
- A closing slide with the one sentence and the ask.

### The 6 to 7 minute video

- A short film, not a screen recording.
- A cold open with the pain, a turn with the product, a proof with the KPI, an ask.
- The doctor on camera. A synthetic patient story with a name.
- Captions and a clean voiceover. No background music that fights the voice.
- One unforgettable moment. For this product, the moment is the doctor finding a missed change in 40 seconds.

## 3. The patterns that win startup hackathons

These are the patterns that separate the winners from the polished losers.

1. **The judge is the user.** Design for the two doctors in the room, not for a generic investor.
2. **The demo is the product.** A working MVP with a scripted story beats a better deck every time.
3. **One patient, one story.** A named synthetic patient with a concrete outcome is more persuasive than a market size.
4. **The doctor must speak.** A real doctor saying "I would use this" is the strongest signal a doctor judge can receive.
5. **Show the failure first.** The first 30 seconds show the current pain, not the solution.
6. **One unforgettable moment.** A single screen or interaction the judges remember the next day.
7. **A new verb.** The product gives the doctor an action, not a dashboard. Here, the verb is "I see what changed."
8. **Narrow scope.** One workflow, one user, one outcome. Platforms lose.
9. **Measured proof.** A small honest metric beats a large invented one. Time-to-brief, delta completeness, unresolved items closed.
10. **Safety fluency.** The doctors trust a product that names its limits. The technologist trusts an audit trail.
11. **The business model in one slide.** Who pays, how much, why now. No TAM theatre.
12. **The team slide is the moat.** Clinical access, a working backend, distribution, speed.
13. **The Q&A is the final.** The winner is often the team that answers the hard question best.
14. **The brief is a filter.** The judges may read the two pages before the video. Make them scannable.
15. **The video is a film.** Script it, shoot it, edit it. Do not narrate a cursor.
16. **The slide sequence is a constraint.** Use the organizer's structure. Do not fight it.
17. **The why now is 2026.** AI extraction, WhatsApp, ABDM, DPDP, cheap inference. Not "digital India" generic.
18. **The why not them names the incumbents.** Eka, Practo, Navina, Epic, the hospital HIS. Show the gap.
19. **The why you is specific.** The existing backend, the doctor partner, the clinical access, the verification discipline.
20. **The ask is concrete.** Three clinics, 100 follow-ups, eight weeks. Not "fund us."

## 4. The philosophy

The doctors on the panel are not buying software. They are protecting three things: their time, their patient, and their judgement. The product wins if it returns all three.

- **The doctor's attention is the scarce resource.** Every screen should give attention back, not ask for more.
- **The record is the means; the decision is the end.** The product should not display records. It should change the next action.
- **The AI is a clerk, not a doctor.** It reads, reconciles and prepares. The doctor decides.
- **Trust is a design material.** Sources, uncertainty, refusals and audit are features, not compliance.
- **The demo is a moral argument.** It shows what the doctor deserves: time, clarity and control.
- **Win the panel, not the market.** The panel is a proxy for the user. Optimize for recognition, not for a generic pitch.

The one-sentence philosophy:

> **The doctor has two minutes. We give back the first sixty seconds.**

## 5. The doctor-side problem: the 60-second delta

### The problem

A follow-up visit begins with a reconstruction. The doctor opens the old reports, the prescriptions, the discharge summary, the WhatsApp messages and the lab portal. The patient repeats the story. The doctor tries to answer four questions before the patient sits down:

- What changed since the last visit?
- What is still unresolved?
- What does the patient say that the record does not?
- What can I safely skip?

In a busy Indian OPD, this happens in about two minutes. The doctor often skips it. The cost is a missed change, a repeated test, a missed referral, or a patient who leaves without a clear next step.

### The insight

The record is not the doctor's problem. The doctor does not need another timeline. The doctor needs the **delta**: the three things that changed, the two things that are unresolved, and the source for every line.

The delta is a different unit from a record or a summary:

| Record | Summary | Delta |
|---|---|---|
| Everything the clinic has | A narrative of the chart | What changed, what is unresolved, what conflicts |
| The doctor searches | The doctor reads | The doctor decides in 60 seconds |
| Completeness is unclear | The model writes | Every line opens its source |
| A storage problem | A reading problem | An attention problem |

### The product

A one-page pre-visit brief with four blocks:

1. **Changed.** New results, new diagnoses, medication starts, stops and dose changes, new patient-reported events. Each item has a date and a source.
2. **Unresolved.** Results not reviewed, referrals not completed, tests not done, questions the patient asked that no one answered. Each item has an owner and an age.
3. **Conflicts.** The patient says one thing, the record says another, or two sources disagree. The product shows both and does not choose.
4. **What we do not know.** Missing pages, partial dates, units that cannot be merged, identity that is not confirmed. The product refuses to guess.

The doctor can accept, edit, flag or ask the patient. The accepted delta becomes the visit note. The unresolved items become tasks. The conflicts stay visible.

The AI does the reading, matching, extraction and reconciliation. It does not diagnose, interpret, recommend or score risk. Every line has a source. Every uncertainty is shown.

### Why this is doctor-side

- The user is the doctor, not the lab or the admin desk.
- The pain is the first two minutes of the visit.
- The value is attention, not storage.
- The doctor is the hero. The AI is the clerk.
- The product makes the doctor look better to the patient, not replace the doctor.

### Why this is not a records dashboard

The hero screen is not a timeline. It is a one-page delta with three changes and two unresolved items. The doctor does not browse. The doctor decides.

The one-line differentiation:

> **An EMR shows you the record. We show you what changed, what is unresolved, and what the record cannot tell you.**

The second line, for a judge who says "this is a summary":

> **A summary tells you what is in the chart. A delta tells you what to do next, and refuses to guess when the chart is incomplete.**

## 6. The MVP

### The synthetic patient

One patient, four years of records, three conditions, five medications, twelve reports, two referrals, six patient messages. The patient is synthetic and labelled. The story is realistic:

- A 58-year-old man with type 2 diabetes, hypertension and a recent eGFR drop.
- A missed eye referral from 14 months ago.
- A statin stopped after a report the doctor never saw.
- A patient message: "I feel dizzy when I stand up."
- A duplicate HbA1c from two labs on the same day.
- A missing page in the 2023 discharge summary.

### The five screens

1. **Delta.** Three changes, two unresolved, one conflict, one unknown. A 42-second read.
2. **Source.** Click any line. The original page opens with the exact line highlighted.
3. **Conflict.** The patient says one thing, the record says another. Both are shown, with dates and sources.
4. **Unresolved.** A result not reviewed, a referral not completed, a question not answered. Each has an owner and an age.
5. **Visit note.** The accepted delta becomes a draft note. The doctor edits and signs.

### The judge mode

- A "Start the 4-minute tour" button.
- A progress chip: "1 of 5."
- A "Show the source" interaction the judge can try.
- A "What we do not know" panel that is visible on every screen.
- A final screen with the KPI and the pilot ask.

### What to cut

- No multi-patient dashboard.
- No admin settings.
- No real ABDM integration.
- No real WhatsApp integration. Use a labelled simulation.
- No 3D body. The 3D loop can be a small visual on the title and the closing slide, not the product.

## 7. The two-page brief

Use the organizer's template exactly. Map the content below to its sections. Do not add or remove sections.

### Page 1

**Problem.** A follow-up visit begins with a reconstruction. The doctor has about two minutes and a bag of reports. The three things that changed are buried, the unresolved items are invisible, and the record cannot say what it does not know.

**Who.** A follow-up doctor in a Tier 2 diabetes, maternal or cancer clinic. The same problem exists in a government OPD and a private hospital.

**Solution.** A one-page pre-visit delta with four blocks: changed, unresolved, conflicts, and what we do not know. Every line opens its source. The doctor accepts, edits or flags. The AI reads and reconciles. It does not diagnose or recommend.

**The moment.** The doctor finds a missed eGFR drop and an uncompleted eye referral in 42 seconds.

**Evidence.** The two-minute consultation (IJCMH 2019). The incomplete-record evidence (Chennai audit, 11.2% trackable). The missed-result evidence (6.8% to 62% in the international review; 64.61% of critical values notified 30 to 120 minutes in an Indian tertiary hospital). Use only the numbers that survive the source check.

**KPI.** Time-to-brief under 60 seconds. Delta completeness. Unresolved items closed within 7 days. Doctor-reported confidence.

### Page 2

**How it works.** Ingest PDFs, photos, WhatsApp forwards and lab reports. Extract facts with evidence. Bind each fact to a source line. Version the facts. Compare the current state with the prior state. Generate the delta. Require human approval before the note.

**The AI.** Extraction, entity resolution, reconciliation, delta generation, source binding. No diagnosis, no treatment advice, no risk score, no autonomous action. The model is a clerk, not a doctor.

**Safety and regulation.** The clinic is the data fiduciary; the product is the processor. DPDP consent, notice, retention and audit. No medical device claim. No ABDM integration claim. The product is a documentation and retrieval aid. Every line is source-linked. Every uncertainty is shown.

**Market and business.** Every follow-up visit is the unit. The beachhead is diabetes follow-up in one Tier 2 cluster. The buyer is the clinic owner or the hospital quality head. The price is per doctor or per clinic, with a pilot. The expansion is maternal, cancer, and government OPDs.

**Why now.** AI extraction is finally good enough for Indian paper and WhatsApp. The records are digitised but unusable. The doctor's time is scarcer. The DPDP Rules set the audit standard. The incumbents are EMR-first.

**Why us.** The working backend, the evidence binding, the identity firewall, the review and revision model, the doctor partner, the speed.

**Ask.** Three clinics, 100 follow-ups, eight weeks. A doctor partner for the delta rubric.

## 8. The presentation

Use the organizer's slide sequence. If the sequence is the common eight-slide structure, this is the content map.

| Slide | Content | Visual |
|---|---|---|
| 1. Title | The 60-second delta. One sentence. Synthetic data label. | A doctor's desk, a bag of reports, a 60-second timer |
| 2. Problem | The reconstruction. The two-minute visit. The three things buried. | One real quote from the doctor partner; a timeline of the visit |
| 3. Solution | The four blocks: changed, unresolved, conflicts, unknown. | One screenshot of the delta |
| 4. Innovation | The unit is the delta, not the record. Every line has a source. The product refuses to guess. | A side-by-side of a record vs a delta |
| 5. Impact | Time-to-brief, unresolved items closed, confidence. The 42-second demo. | A before/after timer; a small chart |
| 6. Feasibility | The working MVP, the architecture, the data model, the pilot. | One architecture diagram, not a wall |
| 7. Business | Who pays, the price, the beachhead, the expansion. | One unit-economics table |
| 8. Team and ask | The doctor partner, the technical lead, the clinical access, the ask. | Three faces, one sentence |

The doctor partner speaks on slides 2 and 5. The technical lead speaks on slides 4 and 6. The presenter holds the story together.

## 9. The 6 to 7 minute video

### 0:00 to 0:30: Cold open

A doctor's desk. A plastic bag of reports. A wall clock. The doctor has two minutes.

Voiceover: "A follow-up visit begins with a reconstruction. The doctor has two minutes. The bag has forty pages. The question is simple. What changed?"

### 0:30 to 1:30: The failure

The doctor opens three reports, a prescription and a WhatsApp message. The camera shows the missed eGFR drop and the unopened eye referral. The doctor says: "I did not see this. The patient did not bring it. It was in the bag."

The patient repeats the story. The doctor asks about dizziness. The record says nothing. The clock moves.

### 1:30 to 2:15: The insight

Voiceover: "The record is not the problem. The doctor does not need another timeline. The doctor needs the delta: what changed, what is unresolved, and what the record cannot tell you."

The screen shows the four blocks: changed, unresolved, conflicts, unknown.

### 2:15 to 4:30: The demo

The delta opens. Three changes, two unresolved, one conflict, one unknown. The timer reads 42 seconds.

The doctor clicks the eGFR line. The source page opens with the line highlighted. The doctor clicks the unresolved eye referral. The referral letter and the date are shown. The doctor clicks the conflict. The patient says "I stopped the statin"; the last prescription says "continue". Both are shown.

The doctor accepts two items, flags one, and asks the nurse to call the patient. The visit note drafts itself. The patient leaves with a clear next step.

### 4:30 to 5:30: The proof

The pilot. Three clinics, 100 follow-ups, eight weeks. Time-to-brief under 60 seconds. Delta completeness. Unresolved items closed within 7 days. A doctor on camera: "I would use this tomorrow."

The numbers are labelled measured, target or to be measured. No invented outcome.

### 5:30 to 6:30: Why now, why us, why not them

- Why now: AI extraction, digitised records, doctor time, DPDP, WhatsApp.
- Why not them: EMRs show the record; summaries tell the story; the delta tells the doctor what to do next and refuses to guess.
- Why us: the working backend, the evidence binding, the clinical partner, the speed.

### 6:30 to 7:00: Close

The doctor closes the laptop. The clock reads 60 seconds. The patient smiles.

Voiceover: "The doctor has two minutes. We give back the first sixty seconds."

Title. The one sentence. The demo link. The ask.

## 10. The Q&A

Prepare these answers. The Q&A decides the winner.

| Question | Answer |
|---|---|
| "Is this an EMR?" | No. It sits on top of the records the clinic already has. It is a decision brief, not a storage system. |
| "How is this different from Eka, Practo or Navina?" | They show the record or a summary. We show a verifiable delta and the unresolved items. Every line opens its source. We refuse to guess. |
| "How do you handle incomplete records?" | The "what we do not know" block. Missing pages, partial dates and unconfirmed identity are visible. The product does not infer. |
| "Is the AI safe?" | It extracts and reconciles. It does not diagnose, recommend or score. The doctor approves the note. Every action is audited. |
| "What is the KPI?" | Time-to-brief under 60 seconds, delta completeness, unresolved items closed within 7 days, doctor confidence. |
| "How will you measure it?" | A 3-clinic pilot, 100 follow-ups, a manual baseline and a delta arm, same cases, balanced order. Time and accuracy. |
| "Who pays?" | The clinic owner or the hospital quality head. Per doctor or per clinic. A premium layer on the records. |
| "How big is the market?" | Every follow-up visit. The beachhead is diabetes follow-up in one Tier 2 cluster. The expansion is maternal, cancer and government OPDs. |
| "What is the moat?" | The versioned fact graph, the source-linked delta, the refusal semantics, the clinical trust, the workflow data. |
| "Why now?" | The extraction is finally good enough for Indian paper and WhatsApp. The records are digitised but unusable. The doctor's time is scarcer. |
| "What about privacy?" | The clinic is the data fiduciary, the product is the processor. Consent, minimisation, retention, audit. The doctor sees only their patient. |
| "What about the 2-minute visit?" | The delta is designed for 60 seconds. The doctor acts on three items, not forty pages. |
| "What is the biggest risk?" | The doctor does not trust the delta. The source link and the "unknown" block are the answer. The pilot measures trust and time. |
| "What is the ask?" | Three clinics, 100 follow-ups, eight weeks, a doctor partner for the delta rubric. |
| "Why you?" | The working backend, the evidence binding, the identity firewall, the clinical partner, the speed. |

## 11. The four-day execution plan

### Day 1: freeze and build the data

- Freeze the delta story and the synthetic patient.
- Build the fixture: 12 reports, 5 medications, 2 referrals, 6 messages, 1 conflict, 1 missing page.
- Build the delta screen and the source viewer.
- The doctor partner signs off on the clinical plausibility.

### Day 2: build the interactions

- The accept, edit and flag actions.
- The unresolved panel and the "unknown" block.
- The visit note draft.
- The timer and the judge mode.
- A browser test of the full flow.

### Day 3: shoot and write

- Shoot the doctor and the clinic footage in the morning.
- Record the screen demo.
- Write the two-page brief in the prescribed template.
- Build the eight-slide deck in the prescribed sequence.
- Edit the video to 6 to 7 minutes.

### Day 4: rehearse and submit

- Deploy the MVP and test the link on a fresh device.
- Run the video once with the panel in mind.
- Rehearse the Q&A with the doctor partner and the technical lead.
- Submit the MVP link, the brief, the deck and the video.
- Keep a backup video and screenshots.

## 12. What not to do

- Do not show a dashboard tour.
- Do not claim diagnosis, treatment or clinical outcomes.
- Do not use a five-year scenario chart.
- Do not say "AI doctor" or "AI triage".
- Do not overrun the video. Six to seven minutes means six to seven.
- Do not change the slide sequence or the brief template.
- Do not fake a metric.
- Do not let the technologist see a mock.
- Do not let the doctors see a product that adds work.
- Do not answer a hard question with "we will do it later" if the MVP can show it now.

## 13. The seven ways this loses, and the countermeasures

| Failure mode | What the judge says | Countermeasure |
|---|---|---|
| The summary trap | "This is an EMR feature. Eka and Practo have it." | The hero is one page, the unit is the delta, the "what we do not know" block is visible, and every line opens a source. The doctor partner says on camera: "This is not my EMR. It is the two minutes before my EMR." |
| The mock | "This is a slide. Show me it working." | A hosted MVP, a judge mode, three tryable actions, a backup video, and a synthetic data label. The link is tested on a fresh device. |
| The video tour | "This is a screen recording with a voiceover." | A scripted film with a cold open, a doctor, a patient story, a turn, a proof and an ask. Six minutes forty-five seconds, captions, no cursor wander. |
| The thin evidence | "Where is the proof this saves time?" | Label every number. Pre-register the pilot. Show the 42-second timed flow. Say "to be measured" where it is true. The doctor partner answers the clinical questions. |
| The extra work | "This adds a step to my day." | The delta is one page, the note drafts itself, the unresolved items become tasks. The doctor does not browse. The doctor decides. |
| The template break | "You did not follow the prescribed brief or slide sequence." | Use the organizer's files. Map the content to their sections. Two people check the order and the word count before submission. |
| The wrapper | "This is a chatbot over a PDF." | Show the data model, the source binding, the versioned facts, the identity hold, the audit, the extraction evaluation and the human approval. The technologist should see a system, not a prompt. |

## 14. The one thing to do first

Write the delta story and the synthetic patient before writing any code. The story is the product. If the doctor partner cannot say "I would use this tomorrow" after reading the five-screen flow, do not build it. Fix the story first.

The winning sentence:

> **The doctor has two minutes. We give back the first sixty seconds.**

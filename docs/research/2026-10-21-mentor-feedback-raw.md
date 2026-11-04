# The raw read: what the mentor is actually saying, and what to do next

**21 October 2026 · follow-up to the novelty review**

The mentor's exact words were sharper than "no novelty":

> "I have seen many CRM softwares and many hospitals are already using your kind of product, so I don't find any novelty in this or any wow factor. This is something you'd see 10-15 years ago people would be solving for and not now."

That is not one objection. It is three, and they need three different answers:

1. **Category objection** — "you look like an EMR/CRM; hospitals already buy this."
2. **Demo objection** — "nothing in your pitch makes me lean forward."
3. **Era objection** — "the problem's time has passed; this is a 2010–2015 problem."

A better slide deck can fix the second. It cannot fix the first or the third. This note is about the first and third, and about whether the project should pivot, narrow, or stop pretending to be novel.

I am going to be blunt. The previous note was too gentle: it argued that the build is better than the pitch. That is true, but it misses the mentor's point. **The build is a good 2015 product. The pitch cannot turn it into a 2026 product.** The rest of this note explains why, and what to do about it.

---

## 1. Is he right? Check each claim

| His claim | Verdict | What the evidence says |
|---|---|---|
| "Many CRM softwares… hospitals already use your kind of product." | **Mostly right** | The screen is a patient list, a work queue, notes, roles and a timeline — the grammar of an EMR/CRM. Large hospitals run HIS/EMR; the government has launched a light, affordable ABDM-enabled HMIS for small clinics ([PIB](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2278996), [The Indian Practitioner](https://theindianpractitioner.com/government-launches-affordable-cloud-based-hmis-for-small-clinics/)). Eka Care, HealthPlix and Practo already sell the clinic-facing layer. The specific AI review workflow is not standard, but the category is. |
| "No novelty or wow factor." | **Right about the demo** | The most impressive visual in the deck is a five-year chart that is hard-coded scenario data, not the product's output. The real product is a review queue with a side-by-side source viewer. That is reassuring, not wow. Safety features do not make a judge lean forward. |
| "This is something 10-15 years ago people would be solving for, and not now." | **Right about the job** | Scan → OCR → human review → timeline is the 2010s document-digitisation workflow. An LLM makes it cheaper and more accurate, but it does not change the job. The 2026 frontier is **agentic, conversational, prospective** — systems that act, ask, and follow up, not systems that store and display. |
| "Hospitals are already using it." | **Partly right, and the loophole is closing** | Large hospitals: yes. Small clinics: less penetrated, but the government is closing that gap with a light HMIS and ABDM incentives. The small-clinic gap is a go-to-market argument, not a novelty argument. |

He may be pattern-matching. Your product is not literally an EMR: it has evidence-bound facts, identity holds, per-entry publication, revisions and a non-generative assistant. A hospital HIS does not do those things. But **the burden of proof is on you, and the demo does not overcome the pattern.** In a 60-second first impression, it looks like a clinic CRM with an AI extraction step. That is the perception you have to break, not argue with.

### What he might mean by "10-15 years ago"

There are three possible readings, and they lead to different fixes:

| Reading | What it implies | Fix |
|---|---|---|
| **The problem is old** — digitising and organising records | The market has moved on; records are infrastructure now | Change the problem, not the UI |
| **The workflow is old** — scan, review, timeline, dashboard | The product is a 2014 workflow with a 2026 model | Change the job to something only 2026 technology enables |
| **The business model is old** — per-clinic software subscription | The economics look like 2010 SaaS | Change the buyer/model (API, patient subscription, outcome-based) |

Ask him which one he meant. Do not guess. The answer determines whether you need a new product, a new demo, or a new business model.

---

## 2. The uncomfortable structural truth

The reason every idea you try feels crowded is that **it is crowded at every layer**. This is not a failure of imagination; it is the state of the market.

| Layer | Who already owns it | What that means for you |
|---|---|---|
| Records aggregation | ABDM (100 crore linked records), Eka PHR, Samsung Health | Commodity; the state is the platform |
| Document extraction | Eka Parrotlet, DocXplor, HealthPlix | Commodity; accuracy is an arms race you cannot win |
| Summaries / visit briefs | Navina (20,000+ clinicians), PicnicHealth, Hona | Commodity; evidence-linked summaries already exist |
| Chart audit / documentation quality | Charta Health (Bain-backed, athenahealth marketplace), Brellium ($23M, Oct 2026), Sayvant, Medisolv | A crowded 2026 category, not an empty one |
| Claim verification | VeriFact (research system for verifying LLM clinical text against EHR) | Academic precedent; product opportunity, not a blank slate |
| Voice / WhatsApp clinic workflows | Clinizy (WhatsApp recall), VaidyaAI (multilingual triage with Whisper), many bots | Crowded at the edges; execution matters more than the idea |
| Pre-visit planning | AMA, Navina, every quality-improvement programme | Old workflow, new automation |
| Human abstraction | Flatiron, Ontada, PicnicHealth | A decades-old industry |

This is why my previous "verification layer" recommendation, while defensible, was still vulnerable to the mentor's critique: **chart audit and provenance are also old jobs.** Charta, Brellium and Sayvant are doing AI chart review in 2026 with more capital and distribution. A page-completeness checkbox is a good feature, not a new era.

**The raw conclusion: there is no obvious unoccupied idea in "diabetes records + AI" that a small team can build in 18 days.** If you keep searching the same space, you will keep finding the same companies. Novelty has to come from somewhere else.

---

## 3. The one thing he may be wrong about

Your product is not a CRM in one important sense: **it treats a clinical fact as a claim with a source, a reviewer, a revision and a refusal path.** A CRM stores leads; your system can show that the number came from line 14 of page 1 and was approved by a named reviewer. That is a real difference.

But the difference is invisible in the first minute, and the mentor is judging the first minute. So he is right about the *perception* and right about the *burden of proof*. The correct response is not "but we have revisions." It is to show one thing in 30 seconds that a CRM cannot do. If you cannot, the product is a CRM with extra steps, and he is right.

The things a CRM cannot do, in order of demo strength:

1. **Catch an omission** — the page shows 12 candidate lines but only 6 facts; publication is blocked until the page is accounted for. (Not built yet; 3–4 days.)
2. **Block a wrong-patient record** — the printed identifier does not match; publication is impossible; no override. (Built; samples exist.)
3. **Refuse to average two conflicting same-day results** — the chart shows both and requires a disposition. (Partly built; needs a demo document.)
4. **Answer "no matching record" instead of guessing** — the assistant plans retrieval; the server renders the answer. (Built.)
5. **Open the exact line behind a number** — click a point, see the source highlight. (Built.)

Any one of these is a better 30-second demo than the five-year scenario chart. But none of them changes the *job*; they change the *trust*. The mentor is asking for a new job.

---

## 4. Five points of view

| POV | What they see | What they would say |
|---|---|---|
| **Mentor / investor** | A clinic CRM with an AI extraction step; a scenario chart; a per-clinic subscription | "Would I fund this? No. The category is crowded, the demo has no moment, and the team has not found an insight I haven't seen." |
| **Doctor** | Another system to log into; a review queue that adds work; a timeline they already have in their EMR | "Does this save me time? Maybe on a new patient with a plastic bag of reports. But I still have to review every entry, and my EMR already stores the reports." |
| **Patient** | Another app; upload your PDFs; trust us with your data | "I won't scan my reports. If you let me talk on WhatsApp, maybe. What do I get?" |
| **Engineer** | A solid pipeline, evidence binding, RLS, Android, tests; the novel part is small | "The moat is workflow and data access, not code. Anyone can copy the UI in a month." |
| **Judge** | A clean deck, a queue, a chart, a list of features | "What will I remember tomorrow? The queue? The scenario chart? Nothing." |
| **Competitor** | Eka, ABDM, the government HMIS, Navina, Charta | "Why won't we crush you? Distribution, free/cheap software, and a model that gets better every quarter." |
| **Your team** | Weeks of work, a working app, a doctor partner, 18 days left | "Do we pivot, narrow, or defend? And can we build anything meaningful in 18 days?" |

The doctor and patient rows are the most important. **The doctor's bottleneck may not be records at all.** It may be time, adherence, missed follow-ups, or the patient's understanding. If you have not asked the doctor what their actual bottleneck is, you are guessing. The mentor's critique may be a symptom of that: a generic solution in search of a specific problem.

---

## 5. The only sources of novelty left

Technology novelty is the hardest and least durable option. For a small team, novelty usually comes from one of five places:

1. **A specific insight from the clinic.** A repeated failure that the doctor can describe in one sentence and no existing product owns. This is the most available and most defensible source.
2. **Access.** A doctor or clinic that will co-design and pilot; data or workflow access that Eka/ABDM do not have.
3. **A segment the incumbents ignore.** Small clinics with paper records, family folders, patients who switch doctors, rural/vernacular, low-literacy.
4. **A medium the incumbents are weak in.** Voice, WhatsApp, offline, shared family phones.
5. **A business model the incumbents cannot copy.** API/infrastructure, patient subscription, outcome-based, insurer/employer payer.

The current product has (2) potentially and (5) not at all. It has no (1), (3) or (4) in the pitch. That is the gap.

**The next idea should come from the clinic, not from a market map.** You have a doctor partner. Use them to find the sentence that no competitor has built for. The market map tells you what not to build; the doctor tells you what to build.

---

## 6. Three 18-day paths (and one fallback)

These are ranked by how well they answer the mentor's *era* objection, not by how much code they reuse.

### Path A — The doctor-insight wedge (recommended process)

**Do not pick the idea first.** Spend five days finding one specific, repeated failure in the clinic, then build the narrowest demo that fixes it.

Candidate insights to test with the doctor:

- "I never know whether the patient actually took the drug I prescribed." → a patient-reported medication timeline, captured by voice/WhatsApp, with the clinic seeing exceptions.
- "The patient brings a plastic bag of reports and I only look at the last page." → a missing-pages/report chaser that assembles the full set before the visit.
- "I spend ten minutes finding the old report and then two minutes with the patient." → a retrieval agent that answers "show me the 2023 eGFR and its source" in one step.
- "The patient's story and the record disagree, and I don't know which to trust." → a two-source reconciliation view (patient-reported vs. documented), with no inference.
- "I only see the patient when they are already sick; I have no idea what happened between visits." → a between-visit check-in, voice/WhatsApp, exception-only for the clinic.

**Why this answers the mentor:** the novelty comes from a workflow insight, not from an AI feature. If the insight is specific and repeated, the demo will feel new even if the technology is standard. If the insight is generic, you will be back where you are now.

**Effort:** 5 days of interviews/observation + 9–11 days of build + 3 days of deck/demo. Tight but feasible if the insight is narrow.

**Risk:** the doctor may not have a specific insight; the clinic may not have time; the insight may require a 6-month build. That is why the five-day sprint has kill criteria.

### Path B — The AI claim-check (fastest 2026 job)

**The job:** a patient brings an AI-generated health answer (ChatGPT, WhatsApp forward, a symptom-checker result). The clinic checks each claim against the patient's verified record and sees which claims are supported, not found, or contradicted, with sources.

**Why it is 2026:** consumer LLMs created a new behaviour — patients arriving with AI-generated claims — and no clinic product is built to reconcile it with the record. The research system VeriFact shows the technical shape (verify LLM-generated clinical text against EHR), but it is not a clinic workflow product.

**Demo:** paste a six-claim ChatGPT answer; the app extracts the claims, checks them against the record, and shows "2 contradicted by your record (source), 3 not in your record, 1 supported." The doctor can respond; the patient sees why.

**Why it answers the mentor:** it is not a records app. It is a new job created by the last three years. It uses your verified-record backend as the source of truth. It is demo-able live in 60 seconds.

**Effort:** 7–10 days (text only; no audio, no new storage).

**Risk:** it may be seen as a feature/gimmick; "not found" is not "false"; claim extraction can err; the buyer is less obvious (clinic add-on or patient subscription). But it is the cheapest credible pivot.

### Path C — The voice-first between-visit check-in (best wow, heavier build)

**The job:** a patient gets a voice/WhatsApp check-in between visits — "How was your week? Any lows, missed medicines, numbness?" — answers in Hindi/English by voice, and the clinic sees a structured exception brief with the audio and the source.

**Why it is 2026:** code-mixed vernacular ASR plus an LLM makes open-ended voice intake possible; text-based PHRs fail for low-literacy patients. It is conversational, prospective and low-burden, not a dashboard.

**Demo:** an elderly patient speaks; the clinic sees "2 low readings, missed metformin twice, new foot numbness" with the audio snippet and a patient-reported label; the doctor confirms or asks a follow-up.

**Why it answers the mentor:** it changes the medium and the time horizon (between visits), not just the UI. It is the most human demo and the most likely to make a judge lean forward.

**Effort:** 12–14 days (audio capture, ASR, structured extraction, clinic brief, consent, tests). The current app has no audio support, so this is a real build.

**Risk:** ASR accuracy in Indian languages/accents; latency; privacy/consent for audio; Android microphone plugin; scope creep into clinical advice. Narrow it to one language, ten scripted conversations, and a synthetic demo.

### Path D — The fallback: keep the product, change the audience

If no specific insight emerges in five days, or the team cannot build a credible 2026 demo in 18 days, **stop pitching this as novel**.

- Target the segment the incumbents ignore: small clinics with paper records, family folders, patients who switch doctors.
- Sell the measurable operational outcome: time-to-answer, wrong-patient block rate, review time, retrieval time.
- Use the hackathon for feedback and pilot introductions, not for validation of novelty.
- Enter a B2B/health-tech competition or incubator where traction and ROI matter more than "wow".

This is not a failure. It is a recognition that the product is a solid B2B workflow tool in a crowded category, and that the hackathon's novelty bar is not the same as the market's need. **A viable business can be unnovel.** But you cannot sell it to a novelty judge as novel.

### Path E — Do not do these

- **Do not pivot to chart audit.** Charta (Bain-backed, athenahealth marketplace), Brellium ($23M), Sayvant and Medisolv are already there. It is a 2026 category, but it is crowded, and it is still a records job.
- **Do not add more dashboard features.** That is the thing the mentor is rejecting.
- **Do not claim ABDM integration** without an integration.
- **Do not put the five-year scenario chart in the hero.** It reads as a mockup.
- **Do not answer "no novelty" with "but we have 180 tests."** Engineering evidence is not product novelty.

---

## 7. The five-day insight sprint

Before you write another line of product code, spend five days here. It is the highest-leverage work available.

### Day 1 — Three doctor interviews (30 minutes each)

Ask, in this order:

1. "Walk me through the last diabetes follow-up where the records were a problem. What happened?"
2. "What do you do every day that is stupid, repetitive, or dangerous?"
3. "What do you wish you could ask the record, but can't?"
4. "What do you never have time to do?"
5. "What do you do when the patient brings a plastic bag of reports?"
6. "What do you do when the patient's story and the record disagree?"
7. "What would you pay to make disappear?"
8. "What have you tried that failed?"

Do not pitch. Do not show the app. Write down exact phrases. The insight is usually in a complaint, not in a feature request.

### Day 2 — Observe one clinic session (or a recorded one)

Map the workflow. Time the steps. Find the biggest waiting, duplication, or error. Look for the moment where the doctor sighs, squints, or asks staff for something. That moment is the product.

### Day 3 — Three candidate insights

Write each as a sentence: "When [situation], the doctor cannot [job], so they [workaround], which costs [time/risk]." Score each on frequency, severity, willingness to pay, buildability in 10 days, novelty, and your access to the data.

### Day 4 — Test the top insight with the doctor

Ask: "If we built exactly this, would you use it? What would make you not use it? Who would pay?" If the doctor is lukewarm, drop it. Do not build something the doctor will not use in a pilot.

### Day 5 — Decide

Write a one-page insight memo: the sentence, the evidence, the demo, the metric, the build plan, the kill criteria. Then choose Path A, B, C or D. Do not start with "we already built X, so let's use X."

**Kill criteria for the sprint:** if you cannot find a specific, repeated failure that the doctor can describe in one sentence, do not pivot. Go to Path D and stop pitching novelty.

---

## 8. What to say to the mentor

Do not defend the product. Do not explain the revisions. Say something like:

> "Fair. The current product is a records workflow, and that category is being commoditised by ABDM, Eka and even the government's light HMIS for small clinics. I'm not going to argue that it's novel. We're keeping the verified-record backend, but we're changing the job. I'm spending the next five days with Dr. [name] to find one specific, repeated failure in the clinic that no existing product owns, then building the narrowest demo that fixes it. If we can't find one, we'll reposition this as a B2B workflow tool and stop pitching it as a novelty. Which of these three directions would you back: a between-visit voice check-in, an AI claim-check for patient-generated advice, or an agent that chases missing records?"

This does four things: accepts the critique, shows a plan, keeps the asset, and asks him to engage constructively. It also forces him to name what he would consider novel, which is more useful than guessing.

If he still says no after a specific insight and a live demo, **he may be the wrong audience.** Get three more opinions: a practising doctor, a clinic owner, and someone who buys healthcare software. One mentor's opinion is data, not destiny.

---

## 9. The hard truths

1. **The current product is a good 2015 product.** That is a diagnosis, not an insult. It is well built, and the pipeline is an asset. But the job it does is from the document-digitisation era.
2. **You cannot reframe your way out of a crowded category.** The previous note tried to; the mentor saw through it. A new slide deck will not fix the era objection.
3. **The 2026 frontier is not "store and display."** It is act, converse, anticipate, and follow up. If the product does not do one of those, it will read as old.
4. **The next idea should come from the clinic, not from a market map.** You have a doctor partner. The insight is in their complaints, not in a competitor matrix.
5. **You can win a novelty review or build a 2015-style business; in 18 days, pick one.** They need different pitches, different demos and different audiences. Doing both at once is how you end up with a deck that satisfies neither.
6. **Do not throw the codebase away.** Auth, RLS, upload, extraction, review, revisions, Android and the hosted demo are real assets. The pivot is a new job on top of them, not a rewrite.
7. **One mentor's opinion is data, not destiny.** But his pattern is consistent with the market. Do not dismiss it because it is uncomfortable.

---

## 10. Decision tree

```
Did the 5-day insight sprint produce a specific, repeated failure
that the doctor can describe in one sentence?
├─ Yes → Can you demo the narrowest fix in 10 days?
│        ├─ Yes → Build that. Use Path A. The insight is the novelty.
│        └─ No  → Choose Path B (claim-check) or C (voice) as the demo;
│                 keep the insight as the roadmap.
└─ No  → Stop pitching novelty.
         ├─ Goal = hackathon → Use the strongest existing refusal demo
         │                    (wrong patient, missing identifier, source line,
         │                    "no matching record") and be honest that the
         │                    product is a workflow tool, not a new era.
         └─ Goal = company  → Path D: pick a segment, measure ROI, get pilots.
```

**Kill criteria:** if 3 out of 5 test viewers do not lean forward within 60 seconds of the demo, the wow is not there. Iterate once, then fall back. Do not spend 18 days polishing a demo that does not land.

---

## 11. Sources for the market claims

| Source | What it supports |
|---|---|
| [PIB — eSushrut@clinic for small clinics](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2278996) · [The Indian Practitioner](https://theindianpractitioner.com/government-launches-affordable-cloud-based-hmis-for-small-clinics/) | The government is providing a light, affordable ABDM-enabled HMIS for small clinics — the "clinic records software" category is being commoditised from the state side |
| [Charta Health](https://www.chartahealth.com/ai-chart-review) | AI chart review is a funded category (Bain-backed, athenahealth marketplace) |
| [HIT Consultant — Brellium raises $23M](https://hitconsultant.net/2026/10/13/brellium-raises-23m-debuts-cortexlm-clinical-compliance-payer-clawback-guarantee/) | AI clinical compliance/chart audit is attracting capital in 2026 |
| [Sayvant](https://sayvant.com/post/sayvant-launches-autonomous-patient-chart-analysis-for-emergency-and-hospital-medicine) | "Autonomous patient chart analysis" is already a product category |
| [VeriFact](https://www.semanticscholar.org/paper/VeriFact%3A-Verifying-Facts-in-LLM-Generated-Clinical-Chung-Swaminathan/64aa50e16a32aaf2702d92cddd3e3f91ea4fe7e1) | Verifying LLM-generated clinical text against the EHR has research precedent |
| [Clinizy Care](https://clinizy.in/blog/automated-patient-recall-feedback-whatsapp) | WhatsApp-based clinic recall/feedback is already a product |
| [VaidyaAI](https://github.com/dhruvWorkss/VaidyaAI) | Multilingual voice triage for Indian clinics is already being built by others |
| [Eka Care — agentic multimodal](https://www.eka.care/services/how-ekacare-is-building-agentic-multimodal-healthcare-for-india-scale-patient-care-with-nvidia-nemotron-3-nano-omni) | Indian incumbent already ships PHR + EMR + scribe + lab parsing + follow-up agents |
| [Navina](https://www.navina.ai/) · [PicnicHealth](https://picnichealth.com/explore-the-app) | Evidence-linked summaries and patient timelines are existing products |
| [ABDM 100 crore records](https://newsonair.gov.in/ayushman-bharat-digital-mission-achieves-milestone-of-over-100-crore-health-records-linked-with-abha/) | Record aggregation is national infrastructure |

---

## The one-paragraph answer

The mentor is not wrong. The current product is a well-built records workflow in a category that ABDM, Eka, the government's small-clinic HMIS, Navina and PicnicHealth already occupy, and the demo's most impressive visual is a scenario chart. A better deck will not fix that. The only honest ways forward are to find a specific, repeated clinic failure that no existing product owns (five-day sprint, then build the narrowest fix), to build a genuinely 2026 job on top of the verified-record backend (claim-check or voice check-in), or to stop pitching novelty and run it as a B2B workflow business. What you should not do is add another dashboard feature and call it novel. The codebase is an asset; the job is the problem.

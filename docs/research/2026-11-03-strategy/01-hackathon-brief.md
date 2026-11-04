# Health-a-thon 2026: the complete programme brief

Extracted 3 November 2026 from `https://healthathon.reskilll.com/`, its `llms.txt`, `sitemap.xml`, and the client bundle `/assets/index-DFtazIRs.js`. The site renders client-side, so the visible pages were read from the bundle's data objects. Quoted wording is the programme's, not ours.

## Status and dates

| Item | Value |
|---|---|
| Programme window | 1 August - 28 November 2026 |
| Doctor and healthcare professional registration | 1 August - 3 October 2026 (closed) |
| Technology team registration | 15 August - 3 October 2026 (closed) |
| Matchmaking and team formation | 22 August - 3 October 2026 |
| Round 1 idea submission | 12 September - 3 October 2026 |
| Round 1 evaluation and shortlisting | 26 September - 3 October 2026 |
| Build sprint and final submission | 10 October - 7 November 2026 (the bundle's window closes at 2026-11-08 00:00 IST; `llms.txt` says 5 October - 8 November) |
| Top 30 teams announced | By 14 November 2026 |
| Grand finale | 28 November 2026, IIT Bombay, Powai, Mumbai, in person |
| Prize pool | ₹54+ lakh, split evenly across the three clinical tracks; every finalist is awarded |
| Current status (3 November) | Build sprint closes in four days. The final submission is the immediate gate; the finale is three and a half weeks away. |

The programme describes the build sprint as four weeks with mentors and expert check-ins. The earlier Round 1 gate is closed. A draft that is not submitted is not judged, and there is no late lane.

## Organisers and partners

- Koita Foundation and IIT Bombay's Koita Centre for Digital Health (KCDH).
- Clinical partners: National Cancer Grid (NCG), Research Society for the Study of Diabetes in India (RSSDI), Federation of Obstetric and Gynaecological Societies of India (FOGSI).
- Technology partner: Sarvam AI.
- Platform: Reskilll. Contact: healthathon@reskilll.com.

## Tracks

| Track | Network | Programme's framing |
|---|---|---|
| Cancer care | NCG | Improve care coordination, follow-up and patient support across the cancer care journey |
| Diabetes care | RSSDI | Enhance long-term management, engagement and continuity of diabetes care |
| Maternal and child health | FOGSI | Strengthen maternal and child care through better guidance, follow-up and support |

## Teams and eligibility

- Teams of two to five, with one doctor partner and one technical lead.
- The doctor partner must be a practising doctor, or a medical student in final year or later (intern, resident, fellow). Allied health professionals cannot hold the role.
- One person cannot hold both lead roles.
- Anyone on the team can submit. One entry per team.
- Organisers may ask for proof of qualification at any stage.

## Scope: what may be built

The programme's own wording:

> "Assistive, not diagnostic. Solutions simplify operational workflows - follow-up and recall, notes and documentation, patient navigation, workflow automation. Nothing may diagnose, prescribe, replace clinical judgement, or act as clinical decision support. Strong entries also keep a human override and an audit trail for operational actions."

Out of scope, verbatim:

> "Clinical AI solutions involving diagnosis, treatment recommendations, clinical decision support, clinical risk scoring, interpretation of medical data or autonomous clinical advice."

In-scope framing:

- Healthcare workflows, operations and continuity of care.
- Patient engagement and administrative processes.
- Solutions for doctors, care teams, patients and caregivers.
- Workflow-first tools with light integration effort.
- AI agents, orchestration frameworks, APIs and open-source tools are explicitly encouraged.
- Teams may solve one use case, combine several, or build an end-to-end connected solution.

Data rule, verbatim:

> "Use only fake or fully anonymised data. Real patient data must never be shared on the platform, with mentors, or in demos."

## The design bar (the closest thing to a rubric)

The site publishes three groups. They are the best available proxy for how a strong entry is judged.

### Solution focus and technology

- Address real-world challenges for doctors, care teams, patients and caregivers across workflows, operations, continuity of care, engagement and administration.
- Use existing AI capabilities, including agents, orchestration frameworks, APIs and open-source tools.
- Work with existing systems, workflows and information sources with minimal implementation effort.
- Flexible innovation: one use case, several, or an end-to-end solution.

### Human-centred and safe

- Easy for doctors and patients: usable in a busy clinic and by people with limited digital fluency; low training; a clear next step.
- Multilingual and caregiver-friendly: support the languages of the users; design for caregivers as well as patients and clinicians.
- Low risk with human override and an audit trail: assistive, not diagnostic; a person can always override automation; important actions are auditable.

### Assistive impact and delivery

- High-frequency workflow pain.
- Clear operational outcomes.
- Demonstrable results within 60 to 90 days.
- Near-term impact on low-cost channels.
- Light first-phase integration.
- A named measurable operational KPI.
- A credible path to pilot evidence in a real care setting within two to three months.

The FAQ repeats the same bar and adds examples: "recall completion, time-to-note, no-show rate or handoff lag" as KPIs; "paper registers, Excel, PDFs, scans, WhatsApp or hospital systems" as the information the clinic already has.

## The 13 official use cases

The programme says these are illustrative, not exhaustive. A team may write its own problem statement.

### Clinician and care team

1. **Patient follow-up and continuity of care.** Keep patients connected across months; surface who needs follow-up before they are lost.
2. **Consultation readiness and patient journey review.** Start every consult with a complete longitudinal view, not a scramble across systems.
3. **Patient registry and population health.** A live view of the panel: care gaps, priorities, longitudinal journeys.
4. **Clinic operations and patient flow.** Run busy OPDs with real-time flow, smarter slots, fewer bottlenecks.
5. **Doctor productivity and knowledge assistant.** An assistive co-pilot for teaching, research and administrative content; the clinician stays in control.
6. **Patient education and digital engagement.** Accurate, multilingual education and campaigns without turning clinicians into a content team.
7. **Clinic performance and practice growth.** Grow referrals, retention and reputation with practice insights.

### Patient and caregiver

8. **Care journey companion.** Stage-aware guidance: what next, what to prepare, when to seek help.
9. **Long-term care engagement.** Sustained adherence over months and years.
10. **Family and caregiver support.** Tools for families who coordinate care, with consent and clarity.
11. **Healthcare navigation and access.** Clear next steps across registration, tests, billing and referrals.
12. **Financial and administrative support.** Insurance, schemes and paperwork made navigable.
13. **Patient health journey progress.** A simple longitudinal view of milestones done, pending and next.

The team's current diabetes records product maps to use case 2 (consultation readiness), with pieces of 1 and 3. That is the crowded end of the list. Use case 1 is the operational end, and the programme names recall completion as a model KPI.

## Submission content

Round 1 required five sections, and the final round is described as a working prototype plus a live demonstration:

1. The exact problem and what changes if it is solved.
2. What you are building and with what.
3. Why this is the right team.
4. Whether any part already exists.
5. A deck taking the reader end to end.

Prototype link, video walkthrough and supporting document are optional in Round 1. The finale requires a live demonstration of a working prototype to the jury.

## Evaluation

The public pages do not publish a scoring rubric or weights. They say entries are evaluated by the jury and organisers and that their decisions are final. The design bar above is the only published standard. Treat it as the rubric until the organisers say otherwise.

## What the programme is optimising for

Reading the design bar and FAQ together, a winning entry in this programme looks like:

- A high-frequency operational pain, not a clinical claim.
- A named KPI that can move in 60 to 90 days.
- A product that works with the clinic's existing paper/Excel/WhatsApp reality.
- Low training, local language, caregiver-aware.
- Human override and an audit trail.
- A working prototype at the finale, not only a deck.
- Evidence of a real pilot path, not a market-size slide.

The team's current product is strong on evidence, audit and human approval. It is weak on the first three: the pain is records preparation, the KPI (time saved) is unmeasured, and the workflow assumes digital records more than the target clinic has. That gap is the opening for the repositioning in `04-recommended-thesis.md`.

## What is not public

- The jury's scoring weights.
- The number of Round 1 entries and the shortlist size beyond Top 30.
- The exact final-submission form fields and file limits (login-gated).
- Any commitment that the build-sprint deadline is 7 or 8 November; the two public sources disagree by one day. Treat 7 November 23:59 IST as the safe deadline.

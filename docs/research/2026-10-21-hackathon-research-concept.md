# A research-backed concept for the health-a-thon

**21 October 2026 · diabetes × AI × system design**

The hackathon scope is unusually specific: workflow first, AI agents and orchestration, multilingual and caregiver-friendly, human override and audit trail, measurable in 60–90 days, and explicitly **not** diagnosis, treatment, clinical decision support, risk scoring, interpretation or autonomous advice.

This note scans recent research across those exact constraints, extracts the design principles, and proposes one concept that fits every line. The short version:

> **Build a pre-visit intake agent that asks patients and caregivers the questions the clinic needs, in their language and script, and refuses to guess when the message is ambiguous. The clinician gets a source-linked brief with the uncertainty visible, approves it, and every action is audited. Measure it against a simple structured form in a 60–90 day pilot.**

The research supports each design choice — and it also warns that AI alone will not beat a well-designed simple workflow. That warning is the most important part of the design.

---

## 0. The one-page answer

| Question | Answer |
|---|---|
| **What is the concept?** | A workflow-level, multilingual pre-visit agent for diabetes clinics. Patients or caregivers answer a short, clinician-approved question set by voice or text. The agent structures the answers, **asks a clarifying question instead of guessing**, and gives the clinician a one-screen brief with the original words, the unresolved items and an audit trail. |
| **Why is it 2026?** | Agentic orchestration, multilingual LLM/ASR, caregiver mode, deterministic uncertainty routing and audit-ready logs. Not another records dashboard. |
| **What is the novel mechanism?** | A **script-aware uncertainty router**: native vs Roman script, code-mixing, ASR confidence, extraction self-consistency and slot ambiguity determine whether the agent asks, routes to a human, or accepts. It never silently fills a gap. |
| **Why does it fit the scope?** | It is workflow, continuity, patient engagement and administrative intake. No diagnosis, no treatment, no CDS, no risk score, no interpretation, no autonomous advice. The clinician approves everything. |
| **What is the wow?** | A patient speaks Romanized Marathi; the agent understands the intent but says "I'm not sure which medicine you mean — was it metformin 500 or 850?" The clinician sees the uncertainty instead of a confident wrong answer. |
| **How is it measured?** | Completion rate, time-to-brief, item completeness, clarification rate, wrong-guess rate (target 0), clinician edit rate, caregiver participation, patient comprehension — against a simple structured form. 60–90 days, one clinic, 30–50 patients. |
| **Why will it beat the "CRM" critique?** | The demo opens with a conversation, not a patient list. The clinic's record is the backend, not the product. The product is the agent's questions and the clinician's brief. |

---

## 1. What the recent research says

Seven clusters matter for this scope. For each: the finding, the design implication, and the citation.

### 1.1 Conversational agents in diabetes show promise — but safety and escalation are underdesigned

A 2025 systematic review of conversational agent (CA) interventions in diabetes care found **16 studies, 9,076 participants, 13 countries**. Eleven studies assessed effectiveness; most reported improvements in glycemic control (**HbA1c reductions of 0.3% to 1.0%**), medication adherence, health behaviours or mental health. Thirteen studies examined acceptability; most users responded positively, though some found the interactions **repetitive or impersonal**. Crucially, **only four studies addressed safety**, and mechanisms such as **clinical escalation protocols were inconsistently applied**. Most studies were rated weak in methodological quality.

A related JMIR review of CAs for chronic disease self-management makes the same point from a design angle: the field needs structured evaluations that integrate **biomedical, behavioural and technological** perspectives, not just engagement metrics.

**Design implication.** Do not build another chatbot that answers. Build the **safety and escalation layer** around the conversation: what the agent may ask, when it must stop, when it must route to a human, and what the human sees. That is the gap the literature names.

- Conversational agent interventions in diabetes care: [ScienceDirect, 2025](https://www.sciencedirect.com/science/article/pii/S0168822725004437)
- Conversational Agents Supporting Self-Management in Chronic Disease: [JMIR, 2025](https://doi.org/10.2196/72309)
- Engagement with CA-enabled interventions in cardiometabolic disease: [JMIR mHealth/uHealth, 2025](https://doi.org/10.2196/67913)

### 1.2 In India, the script is a safety variable, not a formatting detail

"Script Gap" (Web Conference 2025) is the most directly useful paper for an Indian multilingual product. The authors studied **133,000 real WhatsApp conversations** from a maternal-health organisation in India, covering English, Hindi, Telugu, Kannada, Marathi, Punjabi and Nepali, and benchmarked leading LLMs on **3,156 patient messages**.

Findings:

- **Romanized Indian-language messages are consistently worse** than native-script messages: **5–12 F1 points** lower on average, and **10–20 points** lower for Kannada, Telugu, Marathi and Nepali.
- Only **52.2%** of Romanized messages reached full cross-model agreement, versus **60.4%** for native script.
- The missed-emergency rate rose from **6.5%** on native script to **7.7%** on Romanized messages.
- The models often **understood the intent** but still produced brittle final labels. As the authors put it: "models that appear to understand romanized input may still fail to act on it reliably."

**Design implication.** Multilingual is not a translation feature. It is an **uncertainty source**. A safe system must detect script/code-mixing, estimate its own confidence, ask a clarifying question, and route low-confidence items to a human — rather than pretending the model is equally reliable in every script. This is the core of the concept's novel mechanism.

- Script Gap: [arXiv 2512.10780](https://arxiv.org/abs/2512.10780)

### 1.3 Caregivers want to help — without surveillance or blame

A 2025 qualitative study of an AI-enabled **family module** in a diabetes app interviewed **25 patients with type 2 diabetes and 25 family members**. Participants saw the module as valuable for reinforcing self-discipline. But:

- Some patients worried about **family involvement eroding their autonomy** and control over self-management.
- Family members worried about **caregiving burden** and **self-blame** if they could not support the patient adequately.
- Participants wanted **control over the frequency of nudges**.
- They valued collaborative goal setting, report cards and AI-powered smart logging.
- Family members asked for **personalised explanations of the patient's data and medical terminology**, and resources for **first-time caregivers**.

**Design implication.** Caregiver mode must be **consented, scoped and low-pressure**: the patient chooses what the caregiver sees and contributes; the caregiver gets plain-language explanations, not raw data; nudge frequency is controlled; caregiver entries are labelled separately. Do not build surveillance.

- AI-enabled family module: [Digital Health, 2025](https://doi.org/10.1177/20552076251322654), [PubMed 40144049](https://pubmed.ncbi.nlm.nih.gov/40144049/)

### 1.4 Workflow-level agents need roles, handoffs, gates and audit — not just a model

The ACL 2026 survey **"LLM-Based Multi-Agent Systems for Clinical Workflows: A Survey of AI Hospitals"** defines the design vocabulary this hackathon is asking for:

- Agents take **explicit roles**, **hand off shared state**, use **EHR- or guideline-grounded tools**, and operate with **safety gates** and **audit-ready logs**.
- Systems should be compared at the **workflow level**, not by model components or end-task accuracy, because "clinical action, evidence, and accountability are expressed through state transitions and handoffs."
- The taxonomy covers **roles and handoffs, memory and evidence, tools, reasoning, control and escalation**.
- Evaluation is a **four-layer stack: safety, process, outcome, operations**.
- The paper introduces **Integration Readiness Levels (IRL1–IRL6)**, from simulation to monitored pilot to canary deployment.

A 2026 PRISMA systematic review of **agentic AI in healthcare** screened **3,467 records to 70 studies**. It found that agentic systems are typically built from **planning, action, reflection and memory**, and are most often **multi-agent or supervisor/hierarchical** architectures. Application maturity is concentrated in diagnosis and monitoring, mostly proof-of-concept or retrospective. The review states: **no included study reported prospective clinical trial evidence or regulatory-cleared deployment.** The persistent barrier is the lack of standardised, transparent engineering reporting.

**Design implication.** Design the entry as a **workflow-level multi-agent system** with explicit roles and handoffs, shared state, evidence-grounded tools, a safety gate before the record, an audit log, and an **IRL3–IRL4** claim (simulation/replay/monitored pilot), not autonomy. The absence of prospective operational evidence is the gap a 60–90 day pilot can fill.

- AI hospitals survey: [ACL 2026](https://aclanthology.org/2026.acl-long.2123/)
- Agentic AI in healthcare systematic review: [IEEE Access, 2026](https://doi.org/10.1109/ACCESS.2026.3725858)

### 1.5 Stakeholders want explainability, integration and human support — not more autonomy

A 2026 JMIR systematic review of **qualitative studies** on AI in diabetes care synthesised **14 studies, at least 738 participants, 9 countries** (2023–2025), covering patients, family caregivers, doctors, nurses, specialists and administrators.

Findings:

- Stakeholders saw AI as useful for **preventive and individualised care, education, self-management and decision-making**.
- Concerns included **accuracy, bias, privacy, accountability, increased workload, caregiver burden, loss of professional autonomy, and erosion of human-centred care**.
- Participants emphasised **explainability, intuitive design, integration with existing systems, tailored training, and continued access to human support**.
- Eleven findings were rated high confidence.
- The authors are explicit: the qualitative findings **do not demonstrate clinical effectiveness, safety or improved outcomes**.

A 2025 trust study (38 patients with T2D, 18 caregivers, 59 HCPs in Germany, Spain and the US) found that trust in digital diabetes tools builds in three levels: **trust in one's own role (self-efficacy), trust in data as empowerment, and trust in the viability of behaviour change**. Trust in a digital tool is not the same as trust in a medication.

An HCI study of **21 patients with T2D, 784 authentic patient questions and 7 endocrinologists** found that patients use generative AI as a **"pre-visit educator"**, while clinicians see gaps in **safety, personalisation and medication interpretation**. The design implications were **multi-model orchestration, risk-aware fallback, citations, and optional physician review**.

**Design implication.** The brief must be **explainable, integrated and human-backed**. Show the original words, not just the extracted value; show what is unresolved; let the clinician approve; keep a human support path. The "pre-visit educator" framing is exactly the safe role for the agent: it prepares the visit, it does not replace it.

- Stakeholder perspectives: [JMIR 2026](https://doi.org/10.2196/105329), [PMC13596760](https://pmc.ncbi.nlm.nih.gov/articles/PMC13596760/)
- Trust building: [Patient Related Outcome Measures, 2025](https://doi.org/10.2147/PROM.S498339)
- Between Knowledge and Care (T2DM HCI): [arXiv 2510.10048](https://arxiv.org/abs/2510.10048)

### 1.6 The caution: AI personalisation may not beat a simple, well-designed workflow

The most important paper for the hackathon's "measurable impact" criterion is the **mDiabetes** study in rural Karnataka, India: **1,048 adults**, six months, WhatsApp delivery, comparing **AI-personalised messages** (reinforcement learning) with **static, well-designed messages**.

Result: **no significant between-group differences** in the primary outcomes. Both groups improved. The authors conclude that simple, well-designed mHealth delivered through an accessible platform like WhatsApp can achieve meaningful behaviour change **without complex AI**.

A CHI 2025 qualitative study of **T2 Coach**, an automated health coach used by 16 people with diabetes or prediabetes, found that users valued reliability, flexibility and encouragement, but wanted **more fluid conversations, more tailoring and more context sensitivity** — all of which require more intelligence, not less.

**Design implication.** The hackathon entry must be compared against a **simple structured form or static WhatsApp questionnaire**, not against "no tool". If the AI does not improve completion, completeness, time-to-brief or clinician edit rate over the simple baseline, the product is the workflow and the brief, not the AI. Say that honestly; it is a stronger position than an unmeasured AI claim.

- mDiabetes rural India: [JMIR 2025](https://doi.org/10.2196/79283), [PMC12717508](https://pmc.ncbi.nlm.nih.gov/articles/PMC12717508/)
- T2 Coach: [CHI 2025](https://doi.org/10.1145/3706598.3714404)

### 1.7 One more design warning: do not repeat the EHR trap

A 2026 BMJ Health & Care Informatics review of ophthalmic AI makes a broader point: EHRs digitised clinical work while increasing **documentation burden, workflow rigidity and burnout**. AI can go deeper than the EHR — drafting summaries, interpreting images, recommending follow-up — and risks becoming **another opaque information-processing layer**. The authors propose a three-layer architecture: **globally standardised objective observation, explicit local policy and workflow adaptation, and clinician-authored AI operations governed by safety gates**. Their design principle: **automation should make evidence more visible, not less.**

**Design implication.** The clinician brief must make the evidence **more visible**, not replace it with a confident summary. That is why every item keeps its original words and its uncertainty state.

- Grounded ophthalmic AI beyond the EHR trap: [BMJ Health & Care Informatics, 2026](https://pubmed.ncbi.nlm.nih.gov/42869617/)

### 1.8 The interdisciplinary map

The concept deliberately mixes six fields. This is the "diabetes × AI × system design" combination the hackathon is asking for.

| Field | What it contributes | Key papers |
|---|---|---|
| **Clinical informatics** | Workflow, safety, escalation, audit, human oversight | Diabetes CA review; AI-hospitals survey; ophthalmic AI/EHR trap |
| **HCI / human-centred design** | Patient/caregiver experience, trust, explainability, burden | Family module; trust study; T2DM HCI study; T2 Coach |
| **Multilingual NLP** | Script/code-mixing, uncertainty, confidence, evaluation in Indian languages | Script Gap |
| **Agent systems** | Roles, handoffs, shared state, tools, gates, memory | AI-hospitals survey; agentic AI review |
| **Implementation science / evaluation** | Baseline comparison, pilot design, operational metrics, 60–90 day feasibility | mDiabetes; stakeholder review |
| **Clinical safety / governance** | Scope boundaries, red-flag escalation, audit, no diagnosis/advice | AI-hospitals IRL ladder; ophthalmic three-layer architecture |

The design principle that emerges from the mix is simple: **the agent's intelligence should be spent on knowing what it does not know, not on sounding confident.**

---

## 2. The gap, synthesised

| Research finding | What it means for the product |
|---|---|
| CAs in diabetes improve outcomes, but safety/escalation is underdesigned (only 4/16 studies addressed safety) | Build the **safety and escalation layer**, not another chatbot |
| Romanized Indian-language messages are 5–12 F1 points worse and have higher uncertainty | Make **script-aware uncertainty** a first-class product feature |
| Caregivers want to help but fear burden, blame and loss of autonomy | Build **consented, scoped, low-pressure caregiver mode** |
| Workflow-level agents need roles, handoffs, gates and audit logs; agentic AI lacks prospective operational evidence | Design a **workflow-level agent** with explicit handoffs, gates, audit and an IRL3–4 pilot |
| Stakeholders want explainability, integration, human support and preserved professional autonomy | Show the **original words and the unresolved items**, not just a summary |
| AI personalisation did not beat simple static messages in a large rural Indian trial | **Compare against a simple baseline**; let the AI earn its place |
| EHRs increased documentation burden; AI should make evidence more visible | The brief must **increase evidence visibility**, not hide it |

The white space is not "another diabetes chatbot" and not "another records dashboard". It is a **pre-visit workflow agent designed around uncertainty, caregivers and human approval, evaluated against a simple baseline**.

---

## 3. The concept: PreVisit (working name) — "ask, don't guess"

### 3.1 One line

> **A multilingual pre-visit agent that asks patients and caregivers the questions the clinic needs, refuses to guess when the message is ambiguous, and gives the clinician a source-linked brief with the uncertainty visible.**

### 3.2 The patient and caregiver journey

1. The clinic sends a link (web or WhatsApp) before the visit.
2. The patient chooses a language and whether a caregiver can join.
3. The agent asks **5–7 fixed, clinician-approved questions**: home readings, medication timing, symptoms since the last visit, barriers, questions for the doctor.
4. The patient answers by text or voice, in native or Roman script, code-mixed.
5. The agent extracts structured items and checks its own confidence.
6. If an item is ambiguous, it asks **one clarifying question** — not a guess.
7. If it is still ambiguous, it marks the item **unresolved** and routes it to the clinic.
8. The clinician sees a one-screen brief: confirmed items, unresolved items, the original words/audio, and a "what we don't know" section.
9. The clinician confirms, edits, or asks staff to follow up. Nothing enters the record without approval.
10. The audit log records the agent's questions, the patient's answers, the clinician's decisions and the reasons.

### 3.3 The agent architecture

A workflow-level design, following the AI-hospitals vocabulary:

| Agent / service | Role | Input | Output | Gate |
|---|---|---|---|---|
| **Intake agent** | Ask the fixed question set; adapt follow-ups only to fill missing slots | Patient/caregiver messages | Answers, language/script, timestamps | Max 2 clarifications per slot; stop and route if still unresolved |
| **Extraction agent** | Structure patient-reported items against a fixed schema (reading, medication timing, symptom, barrier, question) | Answers | Items with source spans and confidence signals | No interpretation; no diagnosis; no advice |
| **Uncertainty router** | Deterministic policy over script, code-mixing, ASR confidence, extraction self-consistency, slot completeness, drug-name match | Items + signals | Ask / accept / route-to-human | **Never silently fill a gap** |
| **Brief composer** | Build the clinician brief with original words and unresolved items | Accepted + unresolved items | One-screen brief | No clinical interpretation; patient-reported labels |
| **Audit / approval service** | Record every action and human decision | Agent actions + clinician actions | Immutable audit log | Clinician approval required before record write |

Shared state: the patient-reported items, their source spans, confidence state, clarification history, caregiver contributions and clinician decisions. The handoff state is explicit — the brief composer never has to guess what the intake agent asked.

**Implementation note.** The orchestrator can be LangGraph/LangChain, a small typed state machine, or a workflow engine. The framework is not the novelty. Keep the **router as pure code with unit tests**; keep the LLM on extraction, question generation and language handling only. That makes the safety behaviour reproducible and auditable, and it stops the model from quietly deciding when to skip a gate.

### 3.4 The uncertainty router — the novel mechanism

The router is a **deterministic policy**, not an LLM judgment. That matters for auditability: the same signals produce the same routing decision, and the decision is explainable.

**Signals**

- **Script**: native script vs Roman script vs mixed; language identification confidence.
- **Code-mixing**: Hindi-English, Marathi-English, etc.
- **ASR confidence** (if voice): per-word or per-segment confidence.
- **Extraction self-consistency**: run the extraction three times (or with two model variants); if the structured values disagree, the item is uncertain.
- **Slot completeness**: missing time, missing dose, missing unit, missing context.
- **Drug-name match**: exact/fuzzy match against a local Indian brand/generic list; low match → ask.
- **Numeric format**: ambiguous decimal separators, ranges, inequalities.
- **Source ambiguity**: the answer could refer to more than one item in the question set.

**Policy**

| State | Condition | Action |
|---|---|---|
| **Accept** | All critical slots present; high script confidence; extraction consistent; drug match exact/fuzzy high | Show as confirmed in the brief |
| **Clarify** | One critical slot missing or inconsistent; confidence below threshold; script/code-mixing uncertain | Ask one targeted question, max 2 attempts |
| **Route** | Still unresolved after clarification; ASR confidence very low; drug match ambiguous; conflicting values | Mark unresolved; send to human review with the original source |
| **Stop** | The message contains a red-flag phrase from a fixed, clinician-approved list | Do not classify or advise; show a fixed "please contact the clinic" message and route to staff immediately |

The **Stop** state is important for the scope: the agent does **not** triage or diagnose. It recognises a fixed phrase list, gives a fixed administrative instruction, and hands the message to a human. That is an escalation protocol, not clinical decision support.

**Why this is novel enough**

- It makes **multilingual uncertainty** visible and actionable, which the Script Gap paper shows is a real safety blind spot.
- It is a **workflow-level** mechanism, not a model feature: it changes what the agent asks, what the clinician sees, and what gets audited.
- It is **evaluable**: on a set of scripted ambiguous messages, you can measure clarification rate, resolution rate, wrong-guess rate (should be 0 by design) and human-review rate.
- It directly implements the hackathon's **human override and audit trail** requirements, not as a checkbox but as the core loop.

Uncertainty routing is not new in machine learning. What is new here is making it a **clinical workflow object**: a state the clinician can see, a decision the auditor can replay, and a question the patient experiences as help rather than failure — in Indian languages, in a diabetes clinic, with a human gate.

### 3.5 The clinician brief

One screen, three sections:

1. **Confirmed items** — each with the normalized value, the original words, the timestamp, and a "patient-reported" label.
2. **Needs clarification / unresolved** — what the agent asked, what the patient said, why it is unresolved.
3. **What we don't know** — missing answers, skipped questions, caregiver notes not confirmed by the patient.

Actions: **Confirm**, **Edit**, **Ask staff to follow up**, **Not relevant**. Every action requires a reason and is audited. The clinician can approve all confirmed items at once, but cannot approve an unresolved item without resolving it.

No risk score. No "urgent" label. No advice. No color-coded "abnormal" flags and no AI-generated reference-range interpretation; if the clinic record already contains a reference range, show it as recorded, not as an AI judgment. The brief is a structured account of what the patient said, with the uncertainty preserved.

### 3.6 Caregiver mode

- The patient chooses whether a caregiver can join, and what the caregiver can see.
- The caregiver gets a **plain-language explanation** of the patient's reported items, not raw data.
- Caregiver contributions are labelled **caregiver-reported** and kept separate from the patient's answers.
- Nudge frequency is controlled by the patient; there is no surveillance or automated guilt.
- The clinician sees who reported what.
- A first-time caregiver gets a short "how to help" resource, not a stream of alerts.

This directly addresses the family-module findings: autonomy, burden, self-blame and the need for tailored explanations.

### 3.7 What it deliberately does not do

- It does not diagnose, interpret symptoms, score risk, recommend treatment, or give clinical advice.
- It does not decide urgency; it recognises a fixed red-flag phrase list and routes to staff with a fixed message.
- It does not auto-write to the clinical record; the clinician approves.
- It does not replace the clinic's EMR; it produces a brief that can be copied or referenced.
- It does not claim multilingual accuracy; it measures it on a scripted set and reports the errors.

---

## 4. Why this fits the hackathon scope

| Scope requirement | How PreVisit meets it |
|---|---|
| **Workflow first, minimal integration** | A web/WhatsApp link; no EMR integration; the clinic reviews a brief. |
| **AI agents and orchestration** | Four explicit agents/services with roles, shared state, handoffs and gates. |
| **Multilingual and caregiver-friendly** | Native/Roman script handling; caregiver consent mode; plain-language explanations. |
| **Human override on every step** | The clinician confirms/edits every item; unresolved items cannot be approved. |
| **Audit trail** | Every agent question, patient answer, router decision and clinician action is logged with a reason. |
| **Assistive, not diagnostic** | Patient-reported data only; no interpretation, no advice, no risk scoring. |
| **Measurable in 60–90 days** | Completion, time-to-brief, completeness, clarification, edit rate, comprehension, against a simple form. |
| **Low operational risk** | The agent can fail closed: if it is unsure, it asks or routes; the clinic can fall back to a form. |
| **Human-centred design** | Explainability, original words, "what we don't know", caregiver burden controls. |

The out-of-scope list is respected: no diagnosis, no treatment recommendation, no clinical decision support, no clinical risk scoring, no interpretation of medical data, no autonomous clinical advice. The red-flag path is an **administrative escalation to a human**, not a clinical triage decision.

---

## 5. The three-minute demo

| # | Scene | What it shows | Time |
|---|---|---|---|
| 1 | A patient opens the link, chooses Hindi/Marathi, and answers by voice or Romanized text: "kal raat sugar 210, metformin liya nahi, chakkar aa rahe the" | The channel and the multilingual reality | 25s |
| 2 | The agent extracts a reading, a missed dose and a symptom; the timing of the reading and the dose are ambiguous; it asks **two targeted questions** instead of guessing | The uncertainty router | 40s |
| 3 | One medication name is still ambiguous after the clarification; the item is marked **unresolved** and routed to the clinic, with the original audio/text | The "never guess" guarantee | 25s |
| 4 | The clinician opens the brief: confirmed items, unresolved items, "what we don't know", the original words; confirms two items, edits one, asks staff to follow up on the unresolved medication | Human override + evidence visibility | 40s |
| 5 | The caregiver joins with consent, adds "she also had dizziness on Tuesday", labelled caregiver-reported; the clinician sees who said what | Caregiver mode without surveillance | 25s |
| 6 | The audit panel shows the agent's questions, the patient's answers, the router decisions and the clinician's actions | Audit trail | 25s |

**The wow moment is scene 2/3**: the agent **asks** instead of guessing, and the clinician sees exactly what is uncertain. That is the opposite of the "confident AI chatbot" cliché, and it is directly grounded in the Script Gap finding.

---

## 6. The 60–90 day evaluation

### 6.1 Design

- One diabetes clinic; 30–50 patients due for a follow-up; 2–3 clinicians.
- Randomise or counterbalance patients to:
  - **Arm A (baseline):** a simple structured WhatsApp form with the same questions, plus a staff call for missing answers.
  - **Arm B (PreVisit):** the multilingual agent with the uncertainty router.
- Same question set, same clinician brief format where possible, same follow-up window.
- Measure at the item level, not just the patient level.

### 6.2 Metrics

| Metric | Definition | Why it matters |
|---|---|---|
| **Completion rate** | % of invited patients who finish the intake | Engagement; the first failure mode |
| **Time to complete** | Median minutes for the patient/caregiver | Burden |
| **Item completeness** | % of required items captured per patient | Data quality |
| **Clarification rate** | % of items that triggered a clarifying question | The router's cost |
| **Resolution rate** | % of clarified items resolved without human review | The router's benefit |
| **Wrong-guess rate** | % of accepted items that the clinician later corrected as wrong | The safety headline; target 0 |
| **Clinician edit rate** | % of items the clinician edits | Brief quality |
| **Time-to-brief** | Median clinician minutes from opening the brief to approval | Workflow benefit |
| **Caregiver participation** | % of patients who invite a caregiver; % of caregiver contributions accepted | Caregiver value |
| **Patient comprehension** | Teach-back score: can the patient recall what they reported and what happens next? | Human-centred outcome |
| **Safety events** | Any advice/interpretation; any unresolved item approved without resolution; any red-flag message not routed | Must be zero |

### 6.3 Success criteria (proposed, to be agreed with the clinic)

- Completion ≥ 60% in Arm B (vs baseline; no fixed target until baseline is measured).
- Item completeness ≥ 90% for the required items.
- Wrong-guess rate = 0 for accepted items (by design, verified by audit).
- Time-to-brief ≤ 3 minutes median.
- Clinician edit rate ≤ 15%.
- Caregiver participation ≥ 25% where offered.
- No safety events.

Do not claim clinical outcomes. Do not claim HbA1c improvement. The outcome is **operational**: a better brief, faster, with fewer hidden errors.

### 6.4 The baseline is the point

The mDiabetes result is the warning: a well-designed simple message can do as well as AI personalisation. The evaluation must include the simple form. If PreVisit does not beat it on completion, completeness, time-to-brief or edits, the honest conclusion is that the **workflow and the brief** are the product, and the AI is optional. That is still a useful finding, and it is a much stronger position than an unmeasured "AI-powered" claim.

---

### 6.5 The 10-scenario test (before the pilot)

You do not need a clinic to prove the router works. Build a small, honest technical test:

| Scenario type | Count | What it tests |
|---|---|---|
| Native-script Hindi/Marathi messages | 4 | Baseline extraction |
| Roman-script Hindi/Marathi messages | 4 | The Script Gap condition |
| Code-mixed messages | 2 | The hardest multilingual case |
| Ambiguous medication names | 3 (across the above) | Clarification vs guess |
| Missing timing (before/after food) | 2 | Slot completeness |
| Conflicting readings in one message | 2 | Disagreement handling |
| A fixed red-flag phrase | 1 | Stop-and-route path |
| Caregiver-reported messages | 2 | Caregiver labelling |

For each scenario, write the intended items and the expected router state. Measure:

- **Extraction accuracy** per item (value, unit, timing, medication).
- **Clarification rate** and **resolution rate**.
- **Wrong-guess rate** among accepted items (target 0).
- **Human-review rate** for unresolved items.
- **Time to complete** and **time to brief**.

Report the errors. A 10-scenario test is not a clinical validation, but it is enough to show that the router behaves as designed and that the multilingual failure mode is real. That is exactly the kind of evidence the hackathon's "measurable impact" criterion rewards.

### 6.6 The seven-slide story

If you present this, the deck almost writes itself:

| Slide | Headline | What it shows |
|---|---|---|
| 1 | **Ask, don't guess.** | A multilingual pre-visit agent for diabetes clinics. One sentence, one patient conversation screenshot. |
| 2 | **The 2.2-minute visit has a context problem.** | 2.2 minutes per patient in a busy OPD; patients and caregivers do not type English; the clinic gets an incomplete story. |
| 3 | **In India, the script is a safety variable.** | Script Gap: 5–12 F1 point drop on Romanized messages; higher uncertainty; missed emergencies rise. The agent must know when to ask. |
| 4 | **Four agents, one brief.** | Intake → extraction → uncertainty router → clinician brief, with the audit log. One architecture diagram. |
| 5 | **The agent asks; the clinician decides.** | Live demo: Romanized Hindi/Marathi → clarification → unresolved item → clinician brief → audit. |
| 6 | **Measure it against a simple form.** | 10 scripted scenarios + 60–90 day pilot: completion, completeness, time-to-brief, wrong-guess rate, edits, caregiver participation. |
| 7 | **One clinic, 30–50 patients, 60–90 days.** | The ask. Team, doctor partner, metrics, safety gates. |

The slide that wins the room is 5. The slide that wins the mentor is 3, because it shows you read the research and found a real, non-obvious safety problem.

---

## 7. The 18-day build plan

This assumes one full-time builder and a doctor available for two short sessions. It reuses the existing Glucoflow stack where possible.

### Week 1 (21–27 October): the conversation and the router

| Day | Task | Output |
|---|---|---|
| 1 | Finalise the 5–7 question set with the doctor; define the item schema; write 10 scripted patient/caregiver scenarios (native/Roman Hindi, English, one caregiver) | One-page spec + scenario set |
| 2 | Build the patient intake flow (web chat, WhatsApp-style) with language/script capture and consent | Scene 1 works |
| 3 | Build the extraction agent against the fixed schema; store source spans | Items + confidence signals |
| 4–5 | Build the deterministic uncertainty router; clarification loop; unresolved state; red-flag stop path | Scenes 2–3 work |
| 6–7 | Build the clinician brief and approval flow; reuse the existing review/revision/audit semantics | Scene 4 works |

### Week 2 (28 October–4 November): the caregiver, the audit and the proof

| Day | Task | Output |
|---|---|---|
| 8 | Caregiver consent + scoped contributions + labels | Scene 5 works |
| 9 | Audit panel + event log + reasons | Scene 6 works |
| 10 | Metrics panel: completion, clarification, resolution, edits, time-to-brief, wrong-guess | Evidence screen |
| 11 | Run the 10 scripted scenarios; measure accuracy, clarification rate, wrong-guess rate; fix the router | First results |
| 12 | Build the simple-form baseline for the pilot (can be a static WhatsApp flow or a web form) | Comparison arm |
| 13 | Demo video, 3 minutes; deck; screenshots | Submission assets |
| 14 | Doctor review: does the brief make sense? Is the wording safe? Would they use it? | Sign-off or fixes |
| 15–18 | Buffer, final numbers, rehearse the 30-second answer, submit | Submission |

### If voice is too heavy

Start with **text** in native and Roman script. The Script Gap finding is about text, so the uncertainty demo works without ASR. Add voice as a stretch in days 3–5; if the ASR quality is poor, keep it as a "record a voice note" input with a transcript for the clinician, and label the transcript as machine-generated. Do not let ASR risk sink the demo.

### What to reuse from the current app

- Authentication, roles, patient/clinic tenancy, RLS.
- Patient record and notes schema; patient-reported labels.
- Review/approval semantics: every item needs a decision; reasons; revisions.
- Audit/revision tables and the source viewer.
- Web/Android shell; the hosted demo; the synthetic demo accounts.
- The existing "no matching record" and "refuse clinical advice" patterns.

### What to cut from the hero

- The lab-report extraction pipeline (keep as backend, not the pitch).
- The Master dashboard, SOS, 80/20 categories.
- The records queue as the first screen.
- The five-year scenario chart.

The new first screen is a **conversation**; the second is a **brief**; the third is an **audit**.

---

## 8. Risks and guardrails

| Risk | Guardrail |
|---|---|
| Scope creep into diagnosis/triage | Fixed question set; no interpretation; red-flag path is a fixed administrative escalation, not a clinical decision |
| Multilingual overclaim | Test on 10 scripted messages; report errors; never claim equal accuracy across scripts |
| ASR failure | Text-first; voice as a stretch; transcript labelled machine-generated |
| Caregiver privacy/autonomy | Explicit consent; scoped access; patient controls what is shared; caregiver entries labelled |
| Clinician burden | One-screen brief; bulk confirm for confirmed items; unresolved items are the only ones that need attention |
| AI does not beat the form | Measure against the form; if it does not, say so and position the workflow/brief as the product |
| WhatsApp API approval | Demo on web chat styled as WhatsApp; note the production channel and consent requirements |
| Model cost/latency | Bounded calls; cache; fallback to the form; no long-running agent loops |
| Audit authenticity | Append-only log; actor, timestamp, reason, source; no silent edits |

---

## 9. Why this answers the mentor

| Mentor objection | How PreVisit answers it |
|---|---|
| "It looks like a CRM." | The demo opens with a patient conversation and a clinician brief, not a patient list. The record is the backend. |
| "No wow." | The agent asks a clarifying question in the patient's language instead of guessing; the clinician sees the uncertainty. That is a new behaviour, not a new dashboard. |
| "This is a 10–15 year old problem." | The job is 2026: multilingual agentic intake, script-aware uncertainty, caregiver mode, audit-ready workflow. The old problem was digitising records; this is deciding what to ask and what not to guess. |
| "Hospitals already use this." | They use EMRs and portals. They do not use a pre-visit agent that surfaces its own uncertainty and gives the clinician a source-linked brief. |
| "Where is the evidence?" | Seven research clusters, a deterministic router, a scripted evaluation and a 60–90 day pilot against a simple baseline. |
| "Is it safe?" | No diagnosis, no advice, no autonomous action; every item is patient-reported, clinician-approved and audited; the red-flag path routes to a human. |

The one-sentence pitch:

> **"Everyone is building AI that answers. We built the agent that knows when to ask."**

---

## 10. References

| Paper | Venue / year | What it gives the design |
|---|---|---|
| [Conversational agent interventions in diabetes care: a systematic review](https://www.sciencedirect.com/science/article/pii/S0168822725004437) | Diabetes Research and Clinical Practice, 2025 | 16 studies, 9,076 participants; HbA1c 0.3–1.0%; only 4/16 addressed safety; escalation inconsistent → build the safety layer |
| [Conversational Agents Supporting Self-Management in Chronic Disease](https://doi.org/10.2196/72309) | JMIR, 2025 | Multidisciplinary evaluation; biomedical + behavioural + technological |
| [Engagement With Conversational Agent-Enabled Interventions in Cardiometabolic Disease](https://doi.org/10.2196/67913) | JMIR mHealth/uHealth, 2025 | Design features and engagement evidence |
| [Script Gap: Evaluating LLM Triage on Indian Languages in Native vs Roman Scripts](https://arxiv.org/abs/2512.10780) | Web Conference 2025 | 133k WhatsApp conversations; 5–12 F1 point Roman-script gap; higher uncertainty → script-aware routing |
| [Acceptability of an AI-enabled family module in diabetes](https://doi.org/10.1177/20552076251322654) | Digital Health, 2025 | 25 patients + 25 family members; autonomy, burden, self-blame; nudge control → consented caregiver mode |
| [LLM-Based Multi-Agent Systems for Clinical Workflows: A Survey of AI Hospitals](https://aclanthology.org/2026.acl-long.2123/) | ACL 2026 | Roles, handoffs, shared state, evidence, safety gates, audit logs; IRL1–6; four-layer evaluation → workflow-level design |
| [Agentic AI in Healthcare: Current Applications, Challenges, and Future Directions](https://doi.org/10.1109/ACCESS.2026.3725858) | IEEE Access, 2026 | 70 studies; planning/action/reflection/memory; no prospective clinical trial evidence → prospective operational pilot is the gap |
| [Stakeholder Perspectives on the Integration of AI in Diabetes Care](https://doi.org/10.2196/105329) | JMIR, 2026 | 14 studies, 738+ participants; explainability, integration, human support, accountability → brief design |
| [Trust Building for Optimal Adoption of Digital Healthcare Technologies for Diabetes](https://doi.org/10.2147/PROM.S498339) | Patient Related Outcome Measures, 2025 | Three levels of trust: self-efficacy, data empowerment, viability → patient/caregiver framing |
| [Between Knowledge and Care: Generative AI-Based IUI in T2DM](https://arxiv.org/abs/2510.10048) | arXiv / HCI, 2025 | 21 patients, 784 questions, 7 endocrinologists; AI as pre-visit educator; safety gaps; multi-model orchestration, citations, physician review |
| [Artificial Intelligence-Enabled mHealth (mDiabetes) in Rural India](https://doi.org/10.2196/79283) | JMIR, 2025 | 1,048 adults; AI-personalised vs static WhatsApp: no significant difference → measure against a simple baseline |
| [T2 Coach: A Qualitative Study of an Automated Health Coach](https://doi.org/10.1145/3706598.3714404) | CHI 2025 | 16 users; reliability/flexibility valued; want more tailoring and context → conversation quality matters |
| [Grounded ophthalmic AI beyond the electronic health record trap](https://pubmed.ncbi.nlm.nih.gov/42869617/) | BMJ Health & Care Informatics, 2026 | EHRs increased documentation burden; three-layer architecture; automation should make evidence more visible → brief design |

---

## The one-paragraph answer

The research does not point to another records dashboard. It points to a **workflow-level, multilingual, caregiver-aware pre-visit agent** that is designed around what it does not know. Conversational agents in diabetes show promise, but safety and escalation are underdesigned. Romanized Indian-language messages are measurably less reliable, so uncertainty must be a first-class feature. Caregivers want to help but fear burden and loss of autonomy, so their mode must be consented and scoped. Workflow-level agents need roles, handoffs, gates and audit logs, and the field lacks prospective operational evidence. And a large rural Indian trial warns that AI personalisation may not beat a simple, well-designed message — so the product must be measured against a simple form, not against nothing. PreVisit is that bet: it asks instead of guessing, shows the clinician the uncertainty, keeps the human in control, and measures whether it actually helps.

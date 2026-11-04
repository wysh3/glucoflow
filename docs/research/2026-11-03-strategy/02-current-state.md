# What exists, what the reviewer is actually saying, and the premise that keeps failing

Audit date: 3 November 2026. Sources: the repository at commit `10eed73`, `README.md`, `app/reports/acceptance.md`, `app/reports/takeover-audit-2026-10-03.md`, `docs/research/2026-10-21-*.md`, the decks in `deliverables/`, and the application source. I did not re-run the database-backed suites or the live model; claims about tests are the repository's dated reports, not fresh measurements.

## 1. What is actually built

| Layer | State | Evidence | What it means for a pivot |
|---|---|---|---|
| Clinic web | Patient list, progression chart/table, review queue, identity and source review, approval, source drawer, documents, search, history, export | `app/apps/client/src/features/clinic/`; browser suites | Reusable shell, design system and review semantics |
| Patient web | Sign-in, approved values, PDF/image upload, visit notes with versions | `features/patient/` | Reusable patient identity and upload surface |
| Android | Shared Capacitor client, signed APK, emulator evidence for both roles | `reports/device-check.md`, evidence screenshots | Real but not physical-device verified |
| API and worker | Fastify, PostgreSQL RLS, durable leased jobs, private source URLs, approval and revision procedures | `apps/api`, `apps/worker`, `supabase/migrations` | The strongest reusable asset: multi-tenant, auditable write path |
| Extraction | PDF text, OCR, deterministic fixture engine, validation, live multimodal adapter | `packages/extraction` | Real, but weak on unfamiliar layouts |
| Live model | Adapter implemented and gated; evaluation harness proven against stubs | `reports/frozen-evaluation.json` | Never run against a real model in the reports |
| Tests | 180 unit/integration across 29 files, 12 SQL checks, 88 browser checks, 8 chat checks (4 Oct report) | `README.md`, `reports/record-chat-2026-10-04.md` | Engineering evidence, not product evidence |
| Hosting | Vercel frontend, Azure Container Apps API/worker, Supabase auth/storage; dated report | `reports/hosted-deployment-2026-10-03.md` | Historical; current revision not re-verified |

Measured extraction limits, from the repository's own reports:

- On the final unseen synthetic corpus: precision 1.00, recall 1.00, complete-field accuracy 0.8834 (event dates are the weak field).
- On the 12-document unfamiliar-layout corpus: precision 0.875, recall 0.56, complete-field accuracy 0.24, identity-state accuracy 0.3333.
- The default demo provider is a deterministic fixture engine, labelled as such in the UI. The live model is unmeasured.

That gap is the honest state of the core technical asset. Any new product that depends on reading arbitrary Indian paper documents must plan for human correction; it cannot claim general extraction accuracy.

## 2. What is only a deck

`deliverables/pitch/AskDontGuess_Healthathon_2026.pptx` (21 October 2026) describes "PreVisit", a multilingual pre-visit agent with an uncertainty router. It is a concept deck. There is no PreVisit feature in the client, API, worker or database. The deck's screens and conversation are illustrations, not a running build.

That matters for the finale, which requires a live demonstration of a working prototype. A concept deck with no build is a weaker position than a narrower product that runs.

## 3. The two rounds of feedback

### 3.1 The October feedback

The mentor's exact words, recorded in `docs/research/2026-10-21-mentor-feedback-raw.md`:

> "I have seen many CRM softwares and many hospitals are already using your kind of product, so I don't find any novelty in this or any wow factor. This is something you'd see 10-15 years ago people would be solving for and not now."

That is three objections, not one:

| Objection | Meaning | What fixes it |
|---|---|---|
| Category | "You look like an EMR/CRM; hospitals already buy this." | A different job, not a better dashboard |
| Demo | "Nothing makes me lean forward." | One moment a CRM cannot produce |
| Era | "This is a 2010 to 2015 problem." | A job that exists because of 2024 to 2026 capabilities: agents, multilingual conversation, WhatsApp, cheap inference |

### 3.2 The middle-review feedback

The four points reported by the team:

1. No novelty.
2. Work on the pros and cons of Tier 2/Tier 3/rural expansion.
3. Check Indian government rules, "like HIPAA or something".
4. Make the UI/UX easier, so patients are not worried about their personal details; add attractive things, "like a 3D model or something".

Decoded:

| Feedback | The real question | The wrong answer |
|---|---|---|
| No novelty | "What is the one sentence here that is new, and what proves it?" | "We have 180 tests and source highlighting." |
| Tier 2/3/rural | "Can this business work where the money and the patients actually are, or is this a Tier 1 demo?" | "We will expand later." |
| Indian rules | "Do you know the law you are operating under, and is the product designed for it?" | "We comply with HIPAA." (HIPAA is US law and does not apply in India.) |
| UI/UX and privacy | "Will a patient in a Tier 2 clinic trust this enough to use it, and will a doctor find it obvious?" | "We will add a 3D model." |

The four points are not independent. A product that is a records dashboard has to ask patients to trust a startup with documents, has to explain a complicated review workflow, and has to sell to clinics that may not have digital records. A product that works through the clinic's existing phone/WhatsApp channel and asks the patient three plain questions has an easier trust story, a simpler UI, and a natural Tier 2/3 path.

## 4. The premise that keeps failing

The team has now tried two versions of the same premise:

> "If we make the record more complete, more verifiable, and better designed, the doctor will adopt it and the judge will see it as new."

Version 1 was the records workspace. Version 2 was the pre-visit conversation. Both assume the value is in **capturing and presenting context better**. The mentor rejected version 1 as a CRM. Version 2 is more 2026, but it is still a context-capture product in a crowded conversation space, and it is not built.

The premise fails for a structural reason: **the clinic is not paid for the record; it is paid for the visit, and it is judged on whether the patient comes back.** A better record is a cost centre. A closed follow-up loop is revenue and continuity. That is why the same technology feels like a CRM in one frame and like an operating system for the clinic's day in another.

The new product should therefore change the unit of value:

| Old unit | New unit |
|---|---|
| A patient record | A due patient with a disposition |
| A document | A loop that must close |
| Accuracy of extraction | Whether the patient returned |
| A dashboard the doctor opens | A morning brief that tells the clinic who to call and why |
| A patient who uploads a PDF | A patient who answers a WhatsApp question in their language |

This is not a rebrand. It changes the data model, the user, the KPI, the sales pitch and the demo.

## 5. What is genuinely reusable

| Asset | Reuse in the new thesis | Rework |
|---|---|---|
| Auth, RLS, multi-tenancy | Clinic and staff accounts; patient consent scope | Add patient contact and consent records |
| Upload, OCR, extraction | Read paper registers, lab reports, discharge summaries | Add register/CSV import and phone-number parsing |
| Review and approval semantics | Disposition gate: no due patient closes without a reason | Rename clinical review to operational disposition |
| Evidence binding | Every due date opens the source page or register line | Add register-row evidence |
| Audit and revisions | Every contact attempt, reply, escalation and outcome is logged | Add outreach events and consent history |
| Design system | Clinic and patient surfaces | Add the loop board, morning brief and patient WhatsApp surface |
| Android app | Clinic staff on a phone; patient camera | Add offline queue and share-to-app intake |
| Hosted demo | Synthetic demo tenant | Add a synthetic 120-patient follow-up cohort |

The backend is worth keeping. The pitch, the hero screen and the job are not.

## 6. The constraint that decides the plan

The final submission is due in four days (7 November 23:59 IST, with an 8 November ambiguity in the public sources). The finale is 28 November. A new product cannot be built from scratch in four days.

The only credible move is a **vertical slice of a new job on the existing backend**, with a synthetic cohort and a scripted outreach demo. That is enough to change the story and show a working prototype. The 60 to 90 day pilot is the post-hackathon plan, not a claim for this week.

What must be true by 7 November:

- A new one-sentence problem and a new one-sentence product.
- A running screen that shows a due list, a disposition for every patient, an unreached branch, and a patient conversation in a local language.
- A measured synthetic demo: 120 due patients, 96 contacted, 74 booked, 24 unreached with a named owner, 6 escalated, 0 without a disposition.
- A deck that leads with the loop, not the record.
- A credible pilot design with a named KPI and kill criteria.

What must not be claimed:

- Real patient data.
- Live WhatsApp or telephony at scale.
- Measured clinical or revenue outcomes.
- ABDM integration.
- That the AI is accurate on arbitrary Indian paper.

## 7. The honest verdict on the current product

The build is solid engineering in a category that is being commoditised from three directions: national infrastructure (ABDM), Indian incumbents (Eka, Practo, HealthPlix), and free or cheap government HMIS for small clinics. The verification mechanisms are real and uncommon, but they are a feature of a record, and the buyer does not pay for a record.

The product is not worthless. It is a strong evidence and audit layer. The mistake is selling it as the product. In the new thesis it becomes the **proof layer** behind a loop the clinic already cares about: who is due, who was reached, what barrier stopped them, what happened next, and who is still unaccounted for.

That is a story a doctor can repeat in one sentence, a judge can see in one demo, and a pilot can measure in eight weeks.

# Glucoflow: novelty review and repositioning

**Deep research note · 21 October 2026**

Prepared from the repository, the current decks, the dated verification reports and external market/literature research. The trigger is the review round: a mentor said the project has **no novelty**. This note asks whether that is true, why it is true, and what can be done about it before the 8 November sprint end (confirm the exact submission deadline).

**How to read this**

| Section | Question it answers |
|---|---|
| §0 | The short answer, if you read nothing else |
| §1 | What the app actually is — including what is real and what is demo scaffolding |
| §2 | Why "no novelty" is the correct diagnosis |
| §3 | Where the actual white space is |
| §4 | Novelty theses, scored |
| §5 | The recommended thesis, demo and proof |
| §6 | An 18-day plan |
| §7 | Slide-by-slide rewrite and a 30-second answer |
| §8 | Objections and answers |
| §9 | Sources and evidence grades |

I inspected the implementation, the decks, the reports and the live site. I did **not** re-run the database-backed test suites (local PostgreSQL was not running on port 55432), did not call the live model, and did not use the app as a signed-in user. Claims below are tied to the dated reports where they come from reports, and labelled as claims where they are claims.

---

## 0. The short answer

1. **The mentor is right at the level of category.** The deck sells "AI extracts records, a human reviews them, and a doctor sees a timeline." That category is occupied by national infrastructure (ABDM: 100 crore linked records), a funded Indian incumbent shipping the same pipeline through Samsung phones (Eka Care), and global companies selling the same visit-summary-with-evidence pattern (Navina, PicnicHealth). The deck does not contain a sentence that is both true and new.

2. **The build is better than the pitch.** The code contains genuinely uncommon mechanisms: facts bound to exact source lines with a bounding-box highlight, a patient-identity hold that cannot be overridden, per-entry publication with retain/supersede/withdraw dispositions for earlier facts, append-only approval revisions, coverage semantics where absence is never shown as normal, and a chat that plans retrieval but never writes the clinical answer. None of this is on a slide.

3. **The fix is a claim and a proof, not another feature.** The strongest available claim is: **Glucoflow is the verification layer for diabetes records — a chart that accounts for every page, gives every number a receipt, refuses to guess, and measures how many AI errors are stopped before they reach the chart.** That is a different category from "AI lab-report reader".

4. **Three things to build and measure in 18 days:** (a) page-completeness attestation plus an omission-containment experiment, (b) a fault-containment matrix and review economics versus manual reading, (c) a "since last visit" delta view. The first two create the novelty evidence; the third makes the product useful in the demo.

5. **If the mentor wants category novelty rather than execution novelty, the only bigger play is the verified handoff packet** — ABDM moves records; Glucoflow attests them. That is a three-to-six-month company, not an 18-day demo. Do not pretend otherwise.

The rest of this note explains how I reached those conclusions and what to do on Monday.

---

## 1. What the app actually is

### 1.1 The loop that works

In plain terms: a patient or clinic uploads a scanned report; a worker reads it and proposes structured facts with quoted evidence; a reviewer checks each entry against the source and approves it; the approved facts become a versioned, source-linked timeline that the doctor explores and exports. Patient notes, home readings and symptoms run alongside as clearly labelled patient-reported data. Nothing is diagnosed, scored or recommended.

It is **not** an EMR, not a diagnostic tool, and not an ABDM client. It is a records-to-verified-facts pipeline with two interfaces (patient and clinic) and a publication gate.

The loop, stage by stage:

| Stage | What happens | Where it lives |
|---|---|---|
| Intake | Patient or clinic uploads PDF/JPEG/PNG, or a photo batch; limits enforced server-side | `apps/api/src/routes/uploads.ts`, worker |
| Preparation | PDF text extraction, OCR for image-only pages, page coverage recorded (text / OCR / mixed / unreadable / excluded) | `packages/extraction/src/prepare.ts` |
| Extraction | An adapter proposes facts with evidence IDs; fixture engine by default, live multimodal adapter when configured | `packages/extraction/src/pipeline.ts`, `providers/` |
| Validation | Deterministic checks: test aliases, unit allowlist, ambiguous decimals refused, date precision, duplicates, quote-in-page verification | `packages/extraction/src/validate.ts` |
| Review | Reviewer sees source and fields side by side; every entry gets review / correct / exclude; identity must be resolved; no approve-all | `apps/client/src/features/clinic/review/page.tsx` |
| Publication | One approval batch and revision; earlier affected facts require retain / supersede / withdraw with reasons | `supabase/migrations/004_review_approval.sql` |
| Read | Visit overview, progression by test and unit, prescriptions, examinations, notes, search, source viewer, PDF export snapshot | `apps/client/src/features/clinic/`, `packages/data/src/` |
| Patient side | Uploads, approved records, visit notes with versions, home readings, symptoms, demo SOS snapshot | `apps/client/src/features/patient/`, `features/master/` |
| Assistant | GPT-6 Luna plans a structured retrieval request; the server renders every value, date and source button from authorised records | `apps/api/src/guide/conversation.ts` |
| Platforms | One React client on web and Capacitor Android; Fastify API; separate worker; PostgreSQL with RLS | repo root |

The pipeline is real. The repository reports 180 tests across 29 files, 12 SQL isolation/constraint checks, 88 desktop/mobile browser checks and 8 focused chat checks, dated 4 October 2026 (`README.md`). The hosted demo responds at `glucoflow.vercel.app`. The Android APK is in `deliverables/`.

### 1.2 The assets the deck does not sell

These are the parts that are hard to copy and that a judge cannot see in the current deck.

| Mechanism | What it actually does | Why it is uncommon | Evidence |
|---|---|---|---|
| **Receipt** | Every fact stores evidence spans; the source viewer highlights the exact normalised bounding box on the page; if coordinates are missing it shows the page and quote and draws no box | Most products link to a document or page, not to the line that produced the number | `apps/client/src/components/source-viewer.tsx`, `packages/extraction/src/prepare.ts` |
| **Identity firewall** | Identifier on the document must match the assigned patient; a mismatch is always a hold; missing identity needs a reasoned confirmation; a matching name alone never clears it | Patient-uploaded records routinely belong to a relative; most workflows let staff "fix it later" | `packages/domain/src/review.ts` |
| **Per-entry publication** | No approve-all; every entry needs a decision; publication blockers are explicit; amendments require dispositions for earlier facts | Consumer PHRs import and display; EMRs overwrite; the default is not "prove each entry" | `packages/domain/src/review.ts`, migration 004 |
| **Revisioned assertions** | Approved facts are append-only with approval revision and status events; corrections create new versions; old versions remain | The record can answer "who changed this, when, and why" without a separate audit database | migration 004, `packages/data/src/review.ts` |
| **Coverage semantics** | Page coverage and "source-only" facts; "no matching report in uploaded records" instead of "normal"; partial dates are not plotted; units are never merged or silently converted | Most charts quietly drop or merge what does not fit; this one states the gap | `packages/domain/src/timeline.ts`, `DECISIONS.md` #7 |
| **Non-generative assistant** | The model returns a validated retrieval plan; prose, values and links are rendered server-side from authorised facts; clinical requests get a refusal | Most "chat with your records" products let the model write the answer, which creates hallucination surface | `docs/APP_GUIDE.md`, `api/src/guide/conversation.ts` |
| **Context separation** | Drafts, withdrawn/superseded facts, illustrative Master charts and other patients are not attached to chat; patient-reported entries stay labelled | Easy to violate once a "summary" is generated | `docs/APP_GUIDE.md` |

These are not marketing claims. They are code paths with tests and dated reports behind them. The deck mentions "source evidence" once, in a sub-bullet, and never shows the identity hold, the disposition, or the refusal.

### 1.3 What is demo scaffolding, not product

This distinction matters because a judge who clicks around will find it.

| Surface | What it really is | How it is labelled |
|---|---|---|
| **Master dashboard, 2022–2026 Q2** | The supplied PDF's synthetic scenario, hard-coded in `packages/domain/src/master.ts` (HbA1c 7.2 → 8.0, fasting 132 → 142, eGFR 75 → 55) | "Synthetic scenario", "supplied scenario" in the UI |
| **Medication phases** | Four hard-coded summary strings derived from the supplied PDF | "Supplied regimen log. Continued use and missing stop dates require physician confirmation." |
| **80/20 care categories** | A manual clinician label with illustrative proportions | "Proposed framework … not a measured clinic distribution" |
| **Screening tracking** | A clinic-configured interval; "Pending review" means the interval elapsed, not that a test is due | "No recorded date does not establish whether a test was performed" |
| **SOS** | An append-only snapshot with SHA-256 digest delivered to a demo clinic inbox | "Does not contact emergency responders" |
| **Live extraction** | Verified on a 12-document, 22-fact self-authored corpus; fixture extraction on unfamiliar layouts is much weaker | Labelled live versus fixture in the UI |
| **Hosted deployment** | Dated 3 October 2026; the live site responds, but the current revision's end-to-end hosted path is not re-verified in this note | Historical report, not a fresh claim |

The important point is not that these are fake — they are labelled. The important point is that **the most impressive visual in the deck (the five-year dual-axis chart) is scenario data, not the product's output.** The product's real output is three approved HbA1c points, each opening a source line. That is less pretty and much more interesting, because it is evidence.

### 1.4 Measured versus claimed

| Claim | Evidence | Verdict |
|---|---|---|
| "180 tests, 29 files; 12 SQL checks; 88 browser checks; 8 chat checks" | README, 4 October 2026 | Self-reported, dated; not re-run here |
| "Live extraction: precision 1.00, recall 1.00, complete field 0.9091" | `reports/extraction-evaluation-luna-observation-v2.json`: 12 documents, 22 facts, 12 provider calls, US$0.0102 | Real run, but on a self-authored corpus with a tuned prompt; not real records |
| "Unfamiliar layouts: precision 0.875, recall 0.6364, complete field 0.2727" | `reports/extraction-evaluation-eval-corpus-external.json`, fixture engine | Real run; shows the honest weakness |
| "30% less preparation time" | Deck slide 5 | **Target, never measured** |
| "Working web and Android app" | APK, emulator report, browser suites | Real, with a physical-device pass outstanding |
| "Hosted authentication and storage" | Dated deployment report | Implemented; not re-verified here |
| "ABHA/ABDM integration" | None | Not implemented; correctly not claimed in the app |
| "Clinical validation" | None | Not claimed, correctly |

Two numbers matter most for the novelty argument. The live model is good on a small curated set; the fixture engine collapses on unfamiliar layouts (0.27 complete fields). **That gap is not a weakness to hide. It is the reason the verification layer exists.** A product that claims accuracy on 12 documents is unremarkable; a product that shows what happens when the model is wrong is interesting.

### 1.5 The uncomfortable economics

The core loop **adds work to the clinic**: every extracted entry must be reviewed. The pitch claims the loop saves time. Both things can be true only if review is faster than the manual alternative, or if the review is amortised across visits.

There are three cases:

| Case | What the clinic spends | What it gets |
|---|---|---|
| First capture of a paper report | Review time per document (reading the highlighted source, confirming fields) | A structured, source-linked fact set; no retyping |
| Return visit | Little or no review if nothing new | Instant retrieval across years, with sources |
| Amendment / new report | Review the new entries plus dispositions for affected old facts | A versioned correction trail |

The 30% target in the deck conflates these. If a 10-fact report takes 90 seconds to review, that may be no faster than skimming the paper for one visit. The value appears on the **second and third visits**, when the history is already verified, and in **retrieval** (finding the 2023 eGFR and its source) rather than in **first capture**.

This is probably part of what the mentor reacted to, even if not stated that way: the product asks the clinic to do the work it claims to save. The answer is not to deny it. The answer is to **measure both cases separately** and to make the reusable-asset argument explicit. If review turns out to be slower than manual reading, the honest fallback is exception-based review (auto-accept only when deterministic checks pass and the layout is known), with the trade-off measured. That is a product decision, not a slogan.

Two adoption assumptions also deserve scrutiny. In a small clinic, the reviewer and the clinician are often the same person, so review time comes directly out of consultation time. And the patient-upload loop assumes patients will photograph or upload records, which is a behaviour change. Neither assumption invalidates the product, but both make a "saves time" claim harder; the pilot should test them explicitly rather than treating them as given.

---

## 2. Why "no novelty" is the correct diagnosis

### 2.1 The deck, decomposed

The current seven-slide deck makes five claims. Each one is true. Each one is already someone else's product.

| Deck claim | Who already does it | What that means |
|---|---|---|
| "Lab trends, prescriptions and patient reports together, with access to the original records" | ABDM-linked PHRs; Eka Care; Samsung Health Records; PicnicHealth | Aggregation is infrastructure, not a differentiator |
| "AI extracts report fields with source evidence; a reviewer checks them" | Eka Care's Parrotlet models; DocXplor; HealthPlix; PicnicHealth's abstraction; Navina | Extraction plus human review is the industry default |
| "Dated results and medications share one timeline" | Every PHR and EMR; PicnicHealth's visit timeline; Navina's chart summary | A timeline is table stakes |
| "Home readings and symptoms sit alongside the history" | Indian diabetes apps; PicnicHealth; Apple Health | Patient-reported data is a feature, not a thesis |
| "Screening dates and configured intervals support follow-up" | Eka Care's agents explicitly "flag a missed follow-up"; Navina's care-gap module; every diabetes registry | Care-gap tracking is a known product category |

The deck's own archived judge audit said the same thing in October: *"Unique OCR is not an adequate claim"* and *"compare against the strongest practical alternative"* (`archive/.../outputs/Sutra_Judge_Audit.txt`). The new deck replaced the wording but not the structure. It still argues "we do the workflow", not "we do something the workflow cannot get elsewhere".

### 2.2 The market evidence

These are public, dated sources. Company pages are company claims; I mark them as such in §9.

**National infrastructure**

- ABDM passed **100 crore health records linked with ABHA** in May 2026, doubled from 50 crore in 15 months, with **450+ public and private solutions integrated** ([Akashvani News, 22 May 2026](https://newsonair.gov.in/ayushman-bharat-digital-mission-achieves-milestone-of-over-100-crore-health-records-linked-with-abha/)). Record aggregation and exchange at national scale is no longer a startup wedge.
- ABDM uses FHIR R4, consent-based exchange and federated storage; it is a **transport and consent layer**. It does not attest that each observation is a correct transcription of the source ([ABDM technical analysis, 2025](https://zenodo.org/records/18594090)).

**Indian incumbents**

- Eka Care runs **Eka PHR** ("millions of consumers"), **Eka EMR**, **Eka Scribe**, and the **Parrotlet** model family for lab-report and prescription parsing into FHIR/LOINC. In April 2026 it described agents that "reason over a patient's history to flag a missed follow-up or an adverse drug interaction" ([Eka Care, 27 April 2026](https://www.eka.care/services/how-ekacare-is-building-agentic-multimodal-healthcare-for-india-scale-patient-care-with-nvidia-nemotron-3-nano-omni)). Its lab-parsing benchmark post is explicit about the same hallucination and sparse-table problems Glucoflow handles ([Eka Care, 26 November 2024](https://www.eka.care/services/lab-ready-and-prescription-perfect-ekas-small-llms-vs-industry-giants)).
- Samsung Health shipped a **Health Records** feature in India with Eka Care, linked to ABHA, showing prescriptions, lab reports and hospital visits ([Eka Care, 18 January 2025](https://www.eka.care/eka-news/samsung-and-eka-care-bring-digital-health-revolution-to-your-fingertips)). The consumer "records in one place" story is already on the phone.
- YourStory described Eka Care in November 2025 as "using AI to standardise India's chaotic medical records" ([YourStory](https://yourstory.com/2025/11/healthtech-startup-eka-care-ai-standardise-medical-records-doctor-patient)).
- HealthPlix markets an "AI Powered EMR" and a separate **HALO: Doctor's AI assistant** app ([HealthPlix](https://www.healthplix.com/overview-healthplix), [Google Play](https://play.google.com/store/apps/details?id=com.healthplix.halomobile&hl=en_US)).
- DocXplor extracts medical records for hospitals and insurers in India ([The Hindu BusinessLine](https://www.thehindubusinessline.com/info-tech/docxplor-extracts-medical-record-speeds-up-process-in-hospitals-insurance-cos/article70707370.ece)).

**Global comparators**

- **PicnicHealth** sells a patient-facing visit timeline, AI search with links to records, trends, a smart medication list, a shareable health snapshot and sharing with clinicians ([PicnicHealth](https://picnichealth.com/explore-the-app)). That is, feature for feature, the consumer half of Glucoflow.
- **Navina** sells a clinician copilot that reconciles fragmented data into "a single source of truth", with "clinical evidence for every insight surfaced", used by 20,000+ clinicians and ranked #1 in KLAS 2025 for clinician digital workflow ([Navina](https://www.navina.ai/)). That is the clinic half, with the evidence claim already made.
- **Hona** (Y Combinator) pitches "Less time with charts. More connected patients." ([Y Combinator](https://www.ycombinator.com/launches/KHV-hona-less-time-with-charts-more-connected-patients)).
- **Medisolv acquired Health Elements AI** in May 2026 to automate clinical data abstraction and registry support ([HIT Consultant](https://hitconsultant.net/2026/05/01/medisolv-acquires-health-elements-ai-abstraction-automation/)).
- Flatiron Health, Ontada, Verana Health and similar real-world-evidence companies run **human abstraction with source verification and QA** as a core business (named as category examples; I did not individually verify each company's current workflow). "Human-in-the-loop extraction" is not novel; it is an industry.

**Competitive matrix (public evidence only)**

Legend: ● publicly evidenced as a core capability; ◐ partial, adjacent or document-level; ○ not publicly evidenced. Company claims are not audited. "Completeness gate" means a publication gate that requires accounting for every page before release.

| Player | Aggregate records | Extract / structure | Per-fact source evidence | Clinic attestation | Completeness gate | India presence |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ABDM / ABHA | ● | ○ | ◐ document-level | ○ | ○ | ● |
| Samsung Health + Eka | ● | ○ | ◐ document-level | ○ | ○ | ● |
| Eka Care (PHR/EMR/Scribe) | ● | ● | ◐ | ◐ EMR notes | ○ | ● |
| HealthPlix | ◐ | ◐ | ◐ | ◐ | ○ | ● |
| DocXplor | ○ | ● | ◐ | ○ | ○ | ● |
| PicnicHealth | ● | ● | ● record links | ○ their abstractors | ◐ human QA | ○ |
| Navina | ● | ● | ● | ◐ clinician accepts | ○ | ○ |
| Hona | ◐ | ◐ | ◐ | ○ | ○ | ○ |
| RWE abstraction (category) | ◐ | ● | ● | ◐ QA, not clinic | ● source-data verification | ○ |
| **Glucoflow (current + planned)** | ◐ per clinic | ◐ live on a small corpus | ● exact line | ● per-entry, revisioned | ● to build | ● |

The matrix shows the combination that is actually available to this team: **exact-line evidence + clinic attestation + a completeness gate + Indian clinic workflow.** Each column exists somewhere; the combination in a point-of-care product for Indian diabetes clinics does not, as far as the public evidence shows. That is a narrower claim than "no one does this", and it is defensible.

**The problem is real, but it is not "nobody has digitised records"**

- A 2019 study across nine super-specialty clinics at a government hospital in Patna found an average of **2.2 minutes per patient consultation** for physicians, with gastroenterology, neurology and oncology seeing more than 200 patients per working day ([Pandey et al., IJCMH 2019](https://www.ijcmh.com/index.php/ijcmh/article/download/5276/3452)).
- ICMR-INDIAB projects **101.3 million people with diabetes and 136.0 million with prediabetes** in India ([IJDDC 2024](https://www.ijddc.org/doc/fq_7JiWk-1-13410_2024_1406_PrintPDF.pdf)).
- Pre-visit planning is an established primary-care workflow, not a new idea ([AMA Steps Forward, 2025](https://edhub.ama-assn.org/journals/steps-forward/articlepdf/2837432/ama.2025.0001947_1756239273.05052.pdf)).
- Patient-held diabetes records ("diabetes passports") were studied in 2005 ([PubMed 15860240](https://pubmed.ncbi.nlm.nih.gov/15860240/)).

So the problem is real and the timing is good. The issue is that **the problem is already being solved at scale, and the deck does not say what is left.**

### 2.3 The four collisions

The deck's value proposition collides with four existing layers:

1. **Aggregation collision.** ABDM, Samsung Health, Eka PHR and PicnicHealth already put records in one place. "Records in one place" cannot be the novelty.
2. **Extraction collision.** Eka's Parrotlet, DocXplor, HealthPlix and PicnicHealth all parse Indian medical documents. "AI reads the report" cannot be the novelty.
3. **Summarisation collision.** Navina and PicnicHealth already produce evidence-linked summaries and snapshots. "A doctor-friendly summary" cannot be the novelty.
4. **Review collision.** Human abstraction with source verification is the standard in clinical research and in PicnicHealth's own operations. "A human checks the AI" cannot be the novelty.

The only defensible ground left is **what the record can prove about itself**, and **what the system refuses to do**. That is where the code already lives; the deck does not.

### 2.4 What the deck never shows

A novelty case needs six things. The current deck has none of them in a form a judge can check.

| Needed | Current deck | Consequence |
|---|---|---|
| A baseline | "Preparing the history takes work" | No comparison; the 30% target floats |
| A failure path | One line: "identity conflicts block publication" | The most interesting behaviour is invisible |
| A unique mechanism | "AI extracts; reviewer checks" | Indistinguishable from Eka/PicnicHealth/Navina |
| A measured outcome | "135 tests" and a target | Engineering evidence is not product evidence |
| A "why now" | None | ABDM's 100 crore records are the obvious why-now, and the deck does not use them |
| A "why not them" | None | Eka and ABDM are never named; a judge will name them for you |

There is also a presentation problem: **the hero chart is scenario data.** A judge who has seen many decks will recognise a five-year, five-point-per-series chart as a mockup, not an extraction output. The product's real chart is three points and a source link. Showing the real one, with the seam visible, would be more credible.

### 2.5 The critique behind the critique: review burden

The deeper issue is not "someone else does extraction". It is that **the product shifts the hard work to the reviewer and calls the result a time saving**.

Every entry needs a decision. A ten-fact lab report needs ten decisions plus an identity check plus an approval. That is 30–90 seconds of skilled attention. In a 2.2-minute consultation, that is not free. The product's defence is that the review is **one-time** and the retrieval benefit is **recurring**, but the deck never makes that argument or measures either side.

This matters for novelty because a judge can reasonably say: "You have added a reviewer to the loop and called it AI. Where is the new capability?" The answer has to be: the capability is **containment with a receipt** — the reviewer is not there to make the model look good; the reviewer is there because the record must be defensible, and the system is designed to make that reviewer's attention land on the exact line that matters. That is a different product from "AI that saves typing".

---

## 3. Where the white space actually is

The market has solved **movement** (ABDM), **parsing** (Eka, DocXplor), **summaries** (Navina, PicnicHealth) and **abstraction** (Flatiron, Ontada, PicnicHealth). It has not solved five things that matter for a trust layer.

### 3.1 Transport versus truth

ABDM links documents and consent. It does not say: this HbA1c of 7.8 % was read from line 14 of page 1 of this PDF, by this reviewer, on this date, and is still current. A linked record can still be the wrong patient, the wrong unit, a duplicate, or an unreadable scan. **Movement is solved; attestation is not.**

This is the strongest "why now": the more records move, the more valuable a verification layer becomes. The pitch can say: *ABDM solved movement. Glucoflow solves meaning and trust.* That is complementary to Eka, not competitive with it, which is a more credible story for a small team.

### 3.2 Accuracy versus containment

Every vendor reports accuracy. Few publish **what happens when the model is wrong**. The research literature recognises the review burden ([NEJM AI, "The Burden of Reviewing LLM-Generated Content", 2025](https://ai.nejm.org/doi/abs/10.1056/AIp2400979)) and the automation-bias risk ([Becker's Hospital Review](https://www.beckershospitalreview.com/healthcare-information-technology/ai/how-nyu-langone-is-combating-automation-bias/)). Clinical extraction research increasingly uses selective prediction and abstention. But clinic-facing products still compete mainly on average accuracy.

A **containment** claim is different and testable:

> For every injected error, does the system stop it before publication, flag it for review, or let it through silently?

The answer can be measured per fault type. It is a property of the system, not of the model. It is also the property a clinic actually cares about, because a wrong number in a chart is worse than a missing number.

Containment has a second half that almost no product addresses: **completeness**. Precision measures what the model got right; it says nothing about what it missed. A page-level attestation — did we capture everything on this page, and if not, what is missing? — turns omission from an invisible model failure into a recorded human decision. It is uncommon in clinic-facing products and is the mechanism that makes the omission experiment possible.

### 3.3 Summary versus delta

A summary answers "what is in the record". A doctor at a follow-up asks "what changed since last time, and what is unresolved". Most document-centric systems can produce a summary but not a **verifiable diff**, because they do not store versioned assertions with dispositions. Glucoflow does. The delta is a small build on top of the existing revision model, and it is the most demo-able clinical object the product can own.

### 3.4 Passive record versus contestable record

Patients can see their records in ABDM-linked apps. They rarely have a way to **contest a specific fact** with evidence and have that contestation recorded. In Indian clinics, family folders and shared phones make wrong-patient records a real risk; the app already blocks mismatches, but the patient has no channel to say "that is my father's report" unless the clinic builds one. A two-sided attestation (clinic approves, patient can challenge with a reason) is uncommon and fits the safety story. It is also a stronger novelty claim than another dashboard.

### 3.5 Review as a scarce resource

The literature on clinician-in-the-loop screening and annotation yield is active (for example, "Clinician-in-the-Loop Screening Saturation: Predicting Annotation Yield for Efficient EHR Review", BMC Medical Informatics and Decision Making, 2025). Clinic-facing products rarely expose **review triage**, as far as the public evidence shows. If review economics turn out to be the binding constraint, a risk-based routing layer (structural checks first, human attention on the uncertain remainder) is a legitimate mechanism — but it weakens the "every entry reviewed" guarantee, so it must be a measured trade-off, not a slogan.

### 3.6 The white-space map

| Layer | Solved by | Still open | Glucoflow asset |
|---|---|---|---|
| Move records | ABDM, Eka, Samsung | Cross-system consent at scale | None (correctly not claimed) |
| Read documents | Eka Parrotlet, DocXplor, HealthPlix | Reliability on unseen Indian layouts | Evidence-bound extraction, honest evaluation |
| Summarise | Navina, PicnicHealth, Hona | Summary that can be checked line by line | Exact source highlight, revisions |
| Verify | Clinical research abstraction, PicnicHealth ops | **Per-fact clinic attestation with dispositions** | Review semantics, identity hold, versioning |
| Account for omissions | Vendor accuracy claims | **Page-level completeness attestation** | Page coverage + publication gate (build) |
| Prove safety | Vendor accuracy claims | **Containment of model errors** | Deterministic checks + forced review |
| Show change | Pre-visit planning, EMR reports | **Verifiable delta since last visit** | Versioned facts (build the view) |
| Contest | Nothing consumer-facing | **Patient challenge with evidence** | Not built (roadmap) |

The bold rows are the only ones where an 18-day build can produce something a judge has not seen. The completeness row is the strongest of them, because it changes what "review" means: not "check the list" but "account for the source".

---

## 4. Novelty theses, scored

A novelty thesis is not a feature. It is a sentence a judge can repeat, plus evidence that the sentence is true. The options below are ranked against the 8 November deadline, not against a three-year roadmap.

**Ratings (1–5; market novelty judged against public evidence, not patents)**

| Thesis | Market novelty | Fit to build | Demo clarity | Measurability | 18-day feasibility | Risk level (5 = low) | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| **A. The complete, checkable chart** | 4 | 5 | 5 | 5 | 4 | 5 | **Recommended** |
| B. The verified handoff packet | 4 | 2 | 4 | 3 | 1 | 3 | Post-hackathon |
| C. The regimen timeline | 3 | 3 | 4 | 3 | 2 | 3 | Feature, not thesis |
| D. The contestable record | 4 | 4 | 4 | 2 | 3 | 4 | Strong stretch |
| E. Review triage / calibration | 2 | 4 | 2 | 5 | 3 | 3 | Supporting only |

### A. The complete, checkable chart — recommended

**Thesis.** Most AI record tools compete on how much they get right. Glucoflow makes the record **account for what it might have missed**, prove where every number came from, and refuse when the record cannot support a claim.

**What is new.** A page-level completeness attestation: every page must be marked captured, flagged as missing content, or excluded with a reason before publication. The reviewer is not just checking a list of extracted facts; they are accounting for the source. This is analogous to source-data verification in clinical research; as far as the public product evidence shows, it is uncommon in clinic-facing tools and rarely a hard publication gate.

**Why it matters.** Extraction accuracy hides omissions. A model that extracts six of eight rows can score well on precision and still leave the doctor with a false sense of completeness. The page attestation turns omission from an invisible model failure into a recorded human decision. That is a different safety property from "the model is accurate". It does not guarantee completeness — a reviewer can still rubber-stamp a page — and Experiment 1 is designed to test whether the panel actually changes detection, not to assume it does.

**Demo moment.** Page 1 shows "12 candidate lines · 6 facts extracted". The reviewer opens the page, sees the two rows the model skipped, flags "missing rows", and publication stays blocked until the page is resolved. Few demos in this category show the system catching what it did *not* extract.

**Effort.** 3–4 days: one migration, one API patch, one UI panel, publication blocker, tests. It reuses the existing page coverage and source viewer.

**Risk.** Low clinical/regulatory risk; it strengthens the existing human-approval position. The main risk is reviewer fatigue, which is exactly what the review-economics experiment measures.

### B. The verified handoff packet

**Thesis.** ABDM moves records. Glucoflow attests them. A patient can carry a clinic-verified, source-manifested packet to a second clinic, which imports it as read-only attested facts with explicit gaps.

**What is new.** The unit of exchange is not a document and not a FHIR bundle; it is a set of reviewed assertions with a signed manifest, revision, and unresolved items. That is genuinely complementary to ABDM.

**Why it matters.** Patients move between cities, labs and hospitals. A second doctor currently re-reads or re-tests. A verifiable packet could reduce repeat history-taking and repeat testing.

**Demo moment.** Clinic A verifies; the patient shares a packet; Clinic B opens it and sees "42 facts verified by Clinic A on 12 Oct; 3 unresolved; 2 pages excluded". Every fact still opens its source.

**Effort.** 20–30 days minimum. It touches cross-tenant security, consent, revocation, import conflicts and the export manifest. Doing it badly would break the isolation story that is currently a strength.

**Risk.** High scope and legal risk. This is the right six-month company, not the right 18-day demo. Mention it as the roadmap, do not fake it.

### C. The regimen timeline

**Thesis.** The clinical object is not the prescription list; it is the documented regimen over time — starts, dose changes, additions, and explicit gaps ("no later prescription recorded").

**What is new.** Reconstructing regimen state from Indian prescriptions (brand names, strengths, frequencies) with a source for every transition, and refusing to infer discontinuation.

**Why it matters.** Diabetes care is a sequence of regimen changes. A list of PDFs does not show the sequence; a reconstructed timeline does.

**Demo moment.** "Metformin 500 mg → 1000 mg (Jun 2023); glargine added (Jun 2023); lispro added (Jun 2024); no later prescription recorded after Feb 2026." Each step opens the prescription.

**Effort.** 12–15 days: brand normalization, strength parsing, temporal state machine, doctor validation. The existing medication phases are hard-coded, so this is a real build.

**Risk.** Inference risk: "no later record" must never become "stopped". Indian brand normalization is hard and the evaluation set is small. Better as a post-hackathon feature.

### D. The contestable record

**Thesis.** The patient can challenge a specific fact with a reason and evidence; the clinic resolves it with a disposition; both versions remain in history.

**What is new.** Two-sided attestation. Most PHRs let patients view or edit; few let them formally contest a clinic-approved fact and force a recorded resolution.

**Why it matters.** Family folders, shared phones and wrong-patient uploads are real. The app already blocks identity mismatch; the challenge loop extends the same safety logic to errors the system cannot detect.

**Demo moment.** A patient sees a duplicate HbA1c and challenges it; the clinic withdraws the duplicate with a reason; the timeline shows the correction and the challenge.

**Effort.** 6–8 days: schema, API, UI, notifications, tests.

**Risk.** Low patient participation is hard to measure in 18 days; it may look like a feature rather than a thesis. Best as a stretch goal after the core proof.

### E. Review triage / calibration — supporting only

**Thesis.** Route scarce reviewer attention to the facts with the highest expected error, with a measured risk–coverage curve.

**What is new.** A calibration layer on top of the deterministic issue codes and per-field reliability, rather than a raw model confidence score.

**Why it matters.** If review economics are the binding constraint, triage is the lever.

**Effort.** 5–7 days, but it needs labelled data the team does not yet have at scale.

**Risk.** It weakens the "every entry reviewed" guarantee. Do not lead with it. Use it only if the review-economics experiment shows review is too slow, and report the trade-off honestly.

### What the mentor might have meant

"No novelty" can mean four different things. The response differs.

| Likely meaning | Best response | Why |
|---|---|---|
| "The category is crowded" | **A** — completeness/verification | A new mechanism plus a proof, not another feature |
| "There is no technical contribution" | **A + E** — completeness gate plus calibration | A systems contribution and a measured risk–coverage curve; C is the fallback if the doctor wants a clinical object |
| "It will not change clinical care" | **B** — verified handoff | The only option with a care-continuity outcome, but it is a six-month build |
| "It is just a dashboard" | **A + the demo** | Show the refusals and the omission catch; a dashboard cannot do either |
| "There is no evidence" | **Experiments 1–3** | The numbers are the answer, whichever thesis you choose |

If you are unsure, assume the first meaning. It is the most common, and A answers it without abandoning the build.

### Why A now, B later

A is the only thesis that is simultaneously (a) different from the market's accuracy race, (b) buildable on the existing code, (c) demonstrable in one screen, and (d) measurable in the time available. B is the bigger idea, but it requires a cross-tenant product and consent model that does not exist yet. C and D are good features that can be added after A gives the product a spine.

---

## 5. The recommended thesis

### 5.1 One line

> **Glucoflow is a diabetes record that accounts for itself: every page is accounted for, every number has a receipt, and the system refuses to guess.**

Shorter, for a slide:

> **A chart that can prove it is complete.**

The claim is not "our AI is more accurate". The claim is "our record is checkable, and we can show what the AI missed".

### 5.2 The four mechanisms

| Pillar | Mechanism | Status | What the judge sees |
|---|---|---|---|
| **Account** | Every page must be marked captured / missing content / excluded with a reason before publication; the page shows a heuristic prompt (candidate lines or table rows vs. extracted facts), not a guaranteed row detector | **Build (3–4 days)** | The system catching an omission |
| **Receipt** | Every fact opens the exact source line (bounding box where available), with reviewer, approval revision and change history | Built | Click a number, see the line |
| **Refuse** | Identity mismatch is a hard hold; unreviewed facts never plot; ambiguous dates get no point; units are never merged; absence is never "normal"; the chat refuses clinical advice and says "no matching record" | Built | A series of refusals that protect the chart |
| **Brief** | "Since last visit": new facts, superseded/withdrawn facts, new patient reports, unresolved reviews, identity holds, source-only items | **Build (3–4 days)** | The doctor's 30-second delta |

Four mechanisms is a lot for one slide. Group them as **Verify** (Account + Receipt), **Contain** (Refuse), **Brief** (delta). Three words a judge can remember.

### 5.3 Why this is a different category

| The market's frame | Glucoflow's frame |
|---|---|
| How much can the model extract? | What can the record prove? |
| Accuracy on a corpus | Containment of errors, including omissions |
| A summary of the chart | A delta since the last visit |
| Human review as a cost | Human attestation as the product |
| Documents linked in one place | Assertions with source, reviewer, revision |
| "Trust the AI" | "Check the AI" |

The last row is the whole pitch. It is also the only frame in which the existing safety work is an asset rather than an apology.

### 5.4 The demo, six scenes, about three minutes

| # | Scene | What it proves | Time |
|---|---|---|---|
| 1 | Upload `synthetic-wrong-patient.pdf`; the identifier does not match; publication is blocked and cannot be overridden | Identity firewall | 25s |
| 2 | Upload a report with a skipped row; the page panel shows 12 candidate lines, 6 extracted facts; the reviewer flags "missing rows"; publication stays blocked until resolved | **Completeness attestation** | 45s |
| 3 | Correct a wrong value against the highlighted source line; approve; the receipt shows reviewer, revision and reason | Receipt + revision | 40s |
| 4 | Two labs report the same test on the same day with different values; the chart shows both and refuses to average; a disposition is required | Refusal to guess | 25s |
| 5 | Open "Since last visit": four new facts, one superseded, two unresolved, one identity hold; every item opens its source | Delta brief | 35s |
| 6 | Ask the assistant for a value that is not recorded; it says "no matching record"; ask for a dose change; it refuses | Non-generative assistant | 25s |

Scene 2 is the hero. It is the only scene that shows the product doing something no one else in the room is likely to demo: **catching what the model did not extract**.

### 5.5 The proof: three experiments

These are the numbers that convert the thesis from a claim into evidence. They are deliberately small, honest pilots, not a clinical trial.

#### Experiment 1 — Omission containment (the core)

**Question.** If the model drops a fact, does the page attestation cause a human to catch it?

**Design.**
- Take 12 synthetic reports from the existing external corpus.
- For each, remove one to two reference facts from the extraction output (simulating an omission). Keep the page image and text unchanged.
- Arm A: fact-only review (current behaviour, no page attestation).
- Arm B: page-attestation review (the new panel, with candidate-line vs. extracted-fact counts).
- Reviewers: 3 people (ideally one clinic staff member and one doctor; if unavailable, label it a non-clinician pilot).
- Counterbalance document order; same reviewers, different arms, washout between arms.

**Metrics.**
- Omission detection rate (the primary outcome).
- Time per document.
- False alarms (flagging a page that is complete).
- Reviewer confidence (1–5).

**Expected shape.** Arm B should detect more omissions, at some time cost. The interesting result is the trade-off, not a guaranteed win. If Arm B does not improve detection, report it and revise the mechanism; do not hide it.

**Why it is novel enough.** Accuracy benchmarks measure what the model found. This measures whether the workflow catches what it missed. That is a different question, and it is the question a clinic actually cares about.

#### Experiment 2 — Fault containment matrix

**Question.** For each fault type, is the fault hard-blocked, flagged, reviewer-visible, or silent?

**Fault types.** Wrong plausible value; wrong implausible value; wrong unit; wrong date; partial date; wrong patient identifier; missing identifier; hallucinated test; omitted fact; unreadable page.

**Two reviewer models.**
- **Approve-all** (worst case): the reviewer approves every entry without checking. This exposes which faults are caught by hard gates alone.
- **Checks-source** (intended use): the reviewer checks the highlighted line. This exposes which faults depend on human attention.

**Output.** A 10 × 4 matrix with counts. The headline is not a single accuracy number; it is the distribution: which faults are structurally impossible to publish, which are flagged, and which depend on the reviewer.

**Honest expectation.** Identity and unreadable pages are hard gates. Unit, date, evidence and duplicate faults are flags: they are visible and mostly prevent plotting, but a reviewer can still approve a source-only fact. A plausible value substitution or a wrong-but-valid date depends on the reviewer. An omission is invisible unless the page attestation catches it — which is exactly why Experiment 1 exists. The matrix should say this plainly; pretending every fault is blocked would destroy the credibility of the rest.

#### Experiment 3 — Review economics and task time

**Question.** Is review faster than the manual alternative, and is retrieval faster on a return visit?

**Design.**
- 12 documents, 3 reviewers, counterbalanced:
  - Arm A: paper/PDF plus a blank structured form (manual capture).
  - Arm B: Glucoflow review.
- Measure capture time, correction count and missed errors against the reference.
- Separately, 8 follow-up questions (latest HbA1c; change since last visit; current regimen; last eye exam; lows in the last month; new symptoms; missing results; source of a specific value).
  - Arm A: a folder of PDFs.
  - Arm B: the app.
- Measure time and answer accuracy.

**Output.** Median time per document, median time per question, and the difference between first capture and return-visit retrieval. Report the two separately. The deck's 30% target should be replaced by whatever the data shows, or removed.

### 5.6 Claims: what is safe to say

| Safe wording | Why it is safe | Avoid |
|---|---|---|
| "Every approved fact opens the exact source line and carries the reviewer and revision." | True in the build | "Clinically validated" |
| "Identity mismatches and unreadable pages are hard gates; unit, date and evidence faults are flagged before publication." | True by design; verify in Experiment 2 | "The AI never makes mistakes" |
| "We measure omission detection and error containment, not just accuracy." | The experiment exists | "100% accurate" |
| "Review is a one-time cost; retrieval is the recurring benefit." | Testable in Experiment 3 | "30% less preparation time" (until measured) |
| "The assistant retrieves recorded facts; it does not interpret or advise." | True in the build | "AI doctor" |
| "ABDM moves records; we verify what they say." | Accurate positioning; no integration claimed | "ABDM-integrated" |

One more distinction matters for liability: the clinic is attesting **what the document says**, not whether the lab result is clinically true. The product scope already says this (`docs/mvp/01-product.md`: "Approved facts are versioned clinic assertions about what the document says"). Put that sentence on a slide. It is the difference between "the clinic vouches for the medicine" and "the clinic vouches for the reading", and it is the reason a doctor can safely sign.

### 5.7 The one-page positioning

> **Glucoflow — the complete, checkable diabetes record.**
>
> A diabetes follow-up depends on records the doctor did not create. AI can read those records, but a wrong number is worse than no number, and an omission is invisible. Glucoflow turns reports into a record that can account for itself: every page is accounted for before publication, every number opens the exact source line, every change carries the reviewer and revision, and the system refuses to guess when the record cannot support a claim. The doctor sees only what changed since the last visit, with the unresolved items called out. We measure what the system stops — including what the model missed — rather than claiming an accuracy number.
>
> For clinics: less re-reading, fewer wrong-patient records, a defensible audit trail. For patients: a history that travels with its evidence. For the ecosystem: the verification layer that ABDM's transport layer does not provide.

---

## 6. The 18-day plan

The deadline is the 8 November sprint end. That is about 18 days from 21 October. The plan assumes one full-time builder and a doctor available for two short sessions.

### Week 1 (21–27 October): build the proof

| Day | Task | Output |
|---|---|---|
| 1 | Freeze the thesis and the six demo scenes; choose the 12-document corpus and the fault list | One-page spec; no more positioning debates |
| 2 | Build the adversarial set: wrong patient, missing identifier, duplicate, same-day conflict, skipped rows, unreadable page | 6–8 documents with reference answers |
| 3–4 | Page-attestation schema, API and UI; publication blocker; tests | The hero scene works end to end |
| 5 | Omission-containment harness: inject dropped facts; run both arms | First matrix |
| 6 | Fault-containment harness: 10 fault types; approve-all vs checks-source | Second matrix |
| 7 | Review-economics pilot: 12 documents, 3 reviewers, counterbalanced | Time and detection data |

### Week 2 (28 October–4 November): build the payoff and the deck

| Day | Task | Output |
|---|---|---|
| 8–9 | Delta endpoint and "Since last visit" panel; edge cases (no prior visit, partial dates, same-day duplicates, unit variants) | Scene 5 works |
| 10 | Tests: pure functions, API, browser; update the acceptance mapping | Green checks |
| 11 | Optional: patient challenge loop (only if days 8–10 are done) | Stretch scene |
| 12 | Re-run the three experiments with the final build; record numbers | Evidence table |
| 13 | Rewrite the seven slides; capture real screenshots (not scenario charts) | Deck v1 |
| 14 | Doctor review: does the completeness panel make sense? Does the attestation wording protect them? | Sign-off or fixes |
| 15 | Demo video, 3 minutes, one take per scene; rehearse the 30-second answer | Video + script |
| 16–18 | Buffer: fix what broke; final numbers; submit | Submission |

### If you only do three things

1. **Page completeness attestation.** It is the novel mechanism; without it, the pitch collapses back into "AI extraction".
2. **Omission-containment experiment.** It is the proof; without it, the mechanism is just a UI idea.
3. **Deck rewrite around the receipt.** Without it, the judge never sees the mechanism.

### If you have less than 10 days

- **Skip the delta view.** It is the usefulness proof, not the novelty proof. Scenes 1–4 and 6 already exist.
- **Build only the page attestation** (3–4 days), then run a 6-document omission pilot instead of 12.
- **Rewrite the deck around the refusal scenes and the receipt.** The claim still works without the delta.

### If you have 3 days

Do not fake the page gate. Run the fault matrix on the existing system, show the identity hold, the missing-identifier sample, the source highlight and the "no matching record" answer, and present page completeness as the next build with a clear rationale. A smaller true claim beats a larger false one. The mentor's objection was about novelty, not about the amount of code; a precise new frame plus honest evidence can answer it even without a new feature.

### What to cut from the submission story

- The five-year Master dashboard chart (keep it as a labelled appendix or remove it from the hero).
- The SOS scene (it is a demo inbox, not the thesis).
- The 30% target (replace with measured numbers or delete).
- The feature grid ("extraction, review, timeline, notes, search, export").
- The claim that the app is "AI-powered" in the same sentence as the fixture label.

Keep the chat, the Android app and the SOS as supporting evidence of completeness, not as headline novelty. A judge who sees six features remembers none; a judge who sees one refusal remembers it.

### Risks to the plan

| Risk | Mitigation |
|---|---|
| The doctor is unavailable for review | Use two clinic staff for the pilot; label it a workflow pilot, not a clinical validation |
| Reviewers are too few for significance | Report medians and raw counts; call it a pilot; do not claim statistical significance |
| Page attestation slows review too much | Measure it; if the cost is high, offer a "quick confirm" for text-only pages and reserve full attestation for image/table pages; report the trade-off |
| The omission injection is unrealistic | Use real omitted rows from the corpus, not random deletions; have the doctor sanity-check two examples |
| The delta view exposes data-model gaps | Build it as a read-only projection over existing revisions; do not change publication semantics in the last week |

---

## 7. Slide-by-slide rewrite

The current deck is seven slides. It is well designed and honest about limitations. The problem is that it describes a category. The rewrite keeps the design language and changes the argument.

### Slide 1 — Title

**Current:** "A patient's follow-up history, ready for the doctor to review." / "Lab trends, prescriptions and patient reports together, with access to the original records."

**Replace with:**

> # Every number has a receipt.
> ### A diabetes record that accounts for itself.
> Every page accounted for. Every fact traceable. Every change attributable.
>
> `glucoflow.vercel.app` · Synthetic data · Human review controls publication

**Why.** The title is the claim. "History ready for review" is a category; "every number has a receipt" is a mechanism. It also sets up the demo: the judge will look for the receipt.

### Slide 2 — Problem

**Current:** three generic cards: reports scattered, history takes work, follow-up hard to track.

**Replace with:** one number and one sentence, then three consequences.

> **2.2 minutes per patient** in a busy super-specialty OPD.
> The doctor must trust records they did not create.
>
> - **Records are documents, not facts.** The value is on page 3 of a PDF from another lab.
> - **AI can read them, but a wrong number is worse than no number.** And an omission is invisible.
> - **The clinic cannot vouch for what it cannot trace.** So the history is re-read, re-asked, or re-tested.

**Evidence note (speaker):** 2.2 minutes is from a 2019 study of nine super-specialty clinics at a government hospital in Patna; it is context, not a national average. The point is the direction, not the decimal.

**Why.** This reframes the problem from "records are scattered" (which ABDM is solving) to "records cannot be checked" (which ABDM is not solving).

### Slide 3 — Insight

**Current:** the five-year dual-axis chart from the supplied scenario, plus three feature cards.

**Replace with:** the receipt anatomy, on a real screenshot.

> ## The bottleneck is not extraction. It is proof.
>
> **A fact is not a number. It is a claim with a history.**
>
> `7.8 %` → page 1, line 14 → reviewed by R. Menon, 12 Oct → revision 9 → still current
>
> *One tap opens the exact line. The reviewer, the reason and the revision travel with the value.*

Use a real screenshot of the review screen with the source highlight, not the scenario chart. If a chart is needed, use the three approved HbA1c points from the seed data, clearly labelled "three approved results, three sources".

**Why.** The current hero visual is a mockup. A judge will trust a plain screenshot with a visible seam more than a beautiful chart that the product did not generate.

### Slide 4 — What we built

**Current:** a five-stage workflow diagram plus a second patient-reporting row.

**Replace with:** three mechanisms, one screenshot each.

| Account for every page | Receipt for every fact | Refuse to guess |
|---|---|---|
| Page 1: 12 candidate lines, 6 facts extracted. The reviewer flags the missing rows before publication. | Click any number: the exact source line is highlighted, with reviewer and revision. | Wrong patient: publication blocked. Ambiguous date: no point. No record: "no matching record", not "normal". |

Bottom line: **Publication requires every page to be accounted for and every entry to be decided.**

**Why.** Three mechanisms are memorable; nine features are not. It also shows the product doing something no one else in the room demos.

### Slide 5 — Proof

**Current:** impact cards, "135 tests", "30% target".

**Replace with:** the containment matrix and the omission result.

> ## We do not claim accuracy. We measure what the system stops.
>
> | Injected fault | Hard gate | Flagged | Reviewer-visible | Silent if ignored |
> |---|---|---|---|---|
> | Wrong patient identifier | ✓ identity hold | ✓ | ✓ | 0 |
> | Missing identifier | ✓ until reasoned confirmation | ✓ | ✓ | 0 |
> | Unreadable page | ✓ until excluded | ✓ | ✓ | 0 |
> | Unsupported unit | | ✓ | ✓ | 0 plotted; source-only if approved |
> | Ambiguous / partial date | | ✓ | ✓ | 0 plotted; source-only if approved |
> | Hallucinated test | | ✓ evidence unmatched | ✓ | possible if the flag is approved |
> | Possible duplicate | | ✓ | ✓ | possible if ignored |
> | Plausible wrong value | | | ✓ | **depends on review** |
> | Wrong but valid date | | | ✓ | **depends on review** |
> | Omitted fact | | | ✓ with page attestation | **the reason for the page panel** |
>
> Plus: review time per document versus manual; omission detection with and without page attestation; retrieval time for eight follow-up questions.

Fill the actual numbers after the experiments. If a cell is bad, show it. The credibility of the slide comes from the bad cell, not the good ones. Note the honest distinction: only identity and unreadable pages are hard gates; units, dates and evidence are flags that a reviewer can still approve (units and partial dates are not plotted). That is why the review screen puts the source next to the field.

**Why.** Every other deck will claim accuracy. This slide claims something different and shows its weak point. That is what a mentor remembers.

### Slide 6 — Why now and why us

**Current:** clinic subscription, processing at scale, expansion.

**Replace with:** the market layer, in three lines.

> **ABDM moved 100 crore records. It did not attest them.**
>
> Aggregation is national infrastructure. Extraction is a funded incumbent's product. Summaries are a global category. **Verification is the layer none of them sells per fact.**
>
> Glucoflow is complementary: it sits between the record and the chart, and it produces the manifest the next system can trust.

Business model, one line: clinic subscription per verified patient per month; patient portability later; no claim of ABHA integration.

**Why.** It shows the team has read the market and chosen a complementary position rather than pretending Eka/ABDM do not exist.

### Slide 7 — Demo and ask

**Current:** "brings the follow-up history into one place" + demo URL.

**Replace with:**

> ## The record a doctor can check.
>
> 3-minute demo: wrong patient blocked → missing row caught → value corrected with receipt → same-day conflict not averaged → delta since last visit → assistant refuses to guess.
>
> **Pilot ask:** two diabetes clinics, 60–90 days. Measure time-to-answer eight follow-up questions, review time per document, silent-error rate under injected faults, and omission detection.
>
> **Team:** [real doctor], [technical lead], [clinic access status].

**Why.** The ask is specific and operational. It gives the judge a way to say yes.

### The 30-second answer

Use this verbatim when asked "what is new?".

> "Every team here can extract a lab report. The hard part is that a wrong number is worse than no number, and an omission is invisible. So we built the record around proof: every page has to be accounted for before publication, every number opens the exact source line, every change carries who approved it and why, and the system refuses to guess — identity mismatch blocks, unreviewed facts never plot, ambiguous dates get no point. Then we measure what it stops, including what the model missed. That is the novelty: not a better extractor, a record you can check."

### The 10-second answer

> "We do not sell extraction. We sell a record that can prove it is complete."

### The two-minute story

1. **Problem.** A doctor has 2.2 minutes and a pile of records they did not create. AI can read the records, but a wrong or missing number is invisible.
2. **Insight.** The bottleneck is proof, not extraction. A number needs a receipt, and a page needs an owner.
3. **Mechanism.** Page attestation, exact source receipts, refusal semantics, and a delta since the last visit.
4. **Proof.** A fault matrix and an omission experiment; we publish the cells where we depend on the human.
5. **Ask.** Two clinics, 60–90 days, four operational metrics.

---

## 8. Objections and answers

| Objection | Answer | Evidence to have ready |
|---|---|---|
| "This is just an EMR/PHR." | We do not replace the EMR. We verify records before they enter it. The product is the receipt and the publication gate, not the chart. | The review screen; the manifest |
| "Eka Care/ABDM already do this." | They move, parse and summarise. They do not attest each fact or account for each page. We are complementary: ABDM moves records; we verify what they say. | The market matrix; the ABDM 100 crore figure |
| "Review adds work." | Yes. It is a one-time capture cost with a recurring retrieval benefit. We measure both separately. If review is slower, we will say so and test exception-based review. | Experiment 3 |
| "Your accuracy on unfamiliar layouts is low." | Correct: 0.27 complete fields on the external fixture corpus. That is why the system is designed to contain errors instead of claiming accuracy. The live model reached 0.91 on 22 facts, still on a self-authored corpus. | The two evaluation reports |
| "Where is the clinical outcome?" | None claimed. The KPI is operational: time-to-answer, review time, silent-error rate, omission detection. Clinical outcomes need a different study. | The pilot design |
| "SOS, chat and ABHA are gimmicks." | They are supporting surfaces, not the thesis. We can remove them from the hero without weakening the argument. | The demo script |
| "Why would a clinic vouch for a patient's record?" | The clinic attests what the document says, not whether the lab result is clinically true. That is a transcription attestation, with a recorded reason and revision. | `docs/mvp/01-product.md` |
| "What is defensible?" | The review semantics, the page attestation, the measured containment, and the local workflow. Not the model. | The code paths; the matrix |
| "Is this just a UI?" | The UI is the forcing function; the gate is the product. A checkbox that does not block publication would be theatre. Ours blocks it. | The publication blockers |
| "Why now?" | ABDM has linked 100 crore records; AI-generated clinical content is increasing; the binding constraint is verification, not digitisation. | The ABDM source |
| "Who is the buyer?" | The clinic, per verified patient per month, starting with a diabetes OPD. The patient portability product comes later. | Slide 6 |
| "Is the doctor real?" | [Answer only with verified names and roles.] | Team slide |

---

## 9. Sources and evidence

### External sources

| Source | Date | What it supports | Grade |
|---|---|---|---|
| [Akashvani News — ABDM 100 crore records](https://newsonair.gov.in/ayushman-bharat-digital-mission-achieves-milestone-of-over-100-crore-health-records-linked-with-abha/) | 22 May 2026 | National scale of record linking; 450+ integrators | A (official broadcaster) |
| [Eka Care — agentic multimodal healthcare](https://www.eka.care/services/how-ekacare-is-building-agentic-multimodal-healthcare-for-india-scale-patient-care-with-nvidia-nemotron-3-nano-omni) | 27 Apr 2026 | PHR + EMR + Scribe + lab parsing + follow-up agents | B (company claim) |
| [Eka Care — Parrotlet small LLMs](https://www.eka.care/services/lab-ready-and-prescription-perfect-ekas-small-llms-vs-industry-giants) | 26 Nov 2024 | Indian lab-report/prescription parsing and hallucination problems | B (company claim) |
| [Eka Care — Samsung Health Records](https://www.eka.care/eka-news/samsung-and-eka-care-bring-digital-health-revolution-to-your-fingertips) | 18 Jan 2025 | Consumer record access through phones in India | B (company claim) |
| [YourStory — Eka Care standardises medical records](https://yourstory.com/2025/11/healthtech-startup-eka-care-ai-standardise-medical-records-doctor-patient) | Nov 2025 | Media framing of the same problem | C (media) |
| [HealthPlix — AI-powered EMR](https://www.healthplix.com/overview-healthplix) | accessed Oct 2026 | Indian EMR with AI positioning | B (company claim) |
| [HealthPlix HALO on Google Play](https://play.google.com/store/apps/details?id=com.healthplix.halomobile&hl=en_US) | accessed Oct 2026 | Doctor-facing AI assistant | B (company claim) |
| [PicnicHealth — explore the app](https://picnichealth.com/explore-the-app) | accessed Oct 2026 | Timeline, AI search, trends, medication list, snapshot, sharing | B (company claim) |
| [Navina](https://www.navina.ai/) | accessed Oct 2026 | Clinician copilot with evidence for every insight; 20,000+ clinicians | B (company claim) |
| [Hona — Y Combinator launch](https://www.ycombinator.com/launches/KHV-hona-less-time-with-charts-more-connected-patients) | accessed Oct 2026 | "Less time with charts" category | B (company claim) |
| [HIT Consultant — Medisolv acquires Health Elements AI](https://hitconsultant.net/2026/05/01/medisolv-acquires-health-elements-ai-abstraction-automation/) | 1 May 2026 | Clinical data abstraction automation as a market | C (trade press) |
| [The Hindu BusinessLine — DocXplor](https://www.thehindubusinessline.com/info-tech/docxplor-extracts-medical-record-speeds-up-process-in-hospitals-insurance-cos/article70707370.ece) | accessed Oct 2026 | Indian record extraction for hospitals/insurers | C (media) |
| [Pandey et al., IJCMH 2019](https://www.ijcmh.com/index.php/ijcmh/article/download/5276/3452) | Oct 2019 | 2.2 minutes per patient in nine super-specialty OPDs | A (peer-reviewed, single site) |
| [ICMR-INDIAB, IJDDC 2024](https://www.ijddc.org/doc/fq_7JiWk-1-13410_2024_1406_PrintPDF.pdf) | 2024 | 101.3 million diabetes, 136.0 million prediabetes | A (peer-reviewed) |
| [NEJM AI — The Burden of Reviewing LLM-Generated Content](https://ai.nejm.org/doi/abs/10.1056/AIp2400979) | 2025 | Review burden is a recognised problem (title/venue; abstract not accessible) | A (venue), B (content unseen) |
| [AMA Steps Forward — Pre-Visit Planning](https://edhub.ama-assn.org/journals/steps-forward/articlepdf/2837432/ama.2025.0001947_1756239273.05052.pdf) | 2025 | Pre-visit planning is established prior art | A (professional body) |
| [PubMed 15860240 — diabetes passports](https://pubmed.ncbi.nlm.nih.gov/15860240/) | 2005 | Patient-held diabetes records are old prior art | A (peer-reviewed RCT) |
| [ABDM technical analysis (Zenodo)](https://zenodo.org/records/18594090) | 2025 | ABDM architecture: FHIR R4, consent, federated storage | C (secondary analysis) |

### Repository evidence

| File | What it supports |
|---|---|
| `app/README.md` | 180 tests / 29 files; 12 SQL checks; 88 browser checks; 8 chat checks (4 Oct 2026) |
| `app/reports/extraction-evaluation-luna-observation-v2.json` | Live model: 12 documents, 22 facts, complete field 0.9091, US$0.0102 |
| `app/reports/extraction-evaluation-eval-corpus-external.json` | Fixture on unfamiliar layouts: precision 0.875, recall 0.6364, complete field 0.2727 |
| `app/packages/extraction/src/validate.ts` | Quote-in-page verification, unit checks, ambiguous decimals, duplicate hints |
| `app/packages/domain/src/review.ts` | Identity states, publication blockers, review progress |
| `app/supabase/migrations/004_review_approval.sql` | Append-only facts, approval revisions, dispositions, status events |
| `app/apps/client/src/components/source-viewer.tsx` | Exact bounding-box highlight, page/quote fallback, expiring URL |
| `app/apps/api/src/guide/conversation.ts` | Retrieval-plan prompt; server-side rendering; clinical refusal |
| `app/docs/APP_GUIDE.md` | Chat bounds, data not sent to the model, no persisted conversation |
| `app/packages/domain/src/master.ts` | The 2022–2026 scenario is hard-coded, not extracted |
| `deliverables/submission/Glucoflow_Pitch_Concise.pptx` | Current deck: 7 slides, scenario chart on slide 3 |
| `archive/2026-10-02-before-build/outputs/Sutra_Judge_Audit.txt` | Earlier warning: "Unique OCR is not an adequate claim" |

### What I did not verify

- I did not re-run the database-backed test suites; the local PostgreSQL instance was not running (`ECONNREFUSED 127.0.0.1:55432`).
- I did not call the live model or the hosted API.
- I did not use the hosted demo as a signed-in user; I only confirmed that `https://glucoflow.vercel.app` responds.
- I did not inspect every client screen; the inventory is based on the code paths, the demo script and the screenshots in `app/reports/evidence/`.
- Company pages are company claims. The competitive matrix says "not publicly evidenced", not "does not exist".

### The one-paragraph answer to the mentor

> You were right about the category: the deck described a records dashboard that ABDM, Eka Care, Navina and PicnicHealth already occupy. But the build contains something the deck did not show: a record that accounts for itself. Every page must be accounted for before publication, every number opens the exact source line, every change carries the reviewer and revision, and the system refuses to guess. We can measure what that stops — including what the model missed — rather than claiming an accuracy number. That is the novelty: not a better extractor, a record you can check. Give us two clinics and 60–90 days, and we will measure the four numbers that decide whether it is a product.

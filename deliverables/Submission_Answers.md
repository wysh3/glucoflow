# Glucoflow submission answers
Aligned with the current deck and the working local implementation. Checked 3 October 2026.

Implementation status: the web and Android workflows, API, worker, database, extraction
pipeline, review, progression, search, patient notes and exports are built and verified
**locally** against synthetic data. Extraction runs on a deterministic fixture rule engine,
not a live model. Hosted authentication and storage, a physical Android device and any time
saving are **not** verified. The deck now states this on the slides themselves.

FORM STATUS
The official public guide confirms five submission sections. Exact field labels, character limits and upload restrictions remain unverified because the form requires login. Adapt the blocks below to the actual questions. These are proposed answers, not a submitted entry. Exact fields remain login-gated. Build specification: ../docs/mvp/README.md.

SOLUTION NAME: Glucoflow
TRACK: Diabetes Care
FOCUS: Doctor / Care Team
Track and focus are inherited from the doctor partner's registration. Confirm the registered selections match this proposal. Suggested use-case description: consultation preparation and patient history review; the exact portal option remains unverified.

1. PROBLEM AND INTENDED CHANGE
Before a diabetes follow-up consultation, clinic staff and doctors reconstruct the patient's history from separate lab reports, prescriptions and scanned documents. Dates, results and care events are scattered, making progression difficult to review without repeatedly opening old records. At subsequent visits, much of this preparation happens again.

Glucoflow addresses the operational work of assembling and updating a traceable patient history. We propose to start with one diabetes clinic's follow-up workflow. Success means reducing the combined time staff and doctors spend preparing and locating records while preserving the accuracy of the approved history. The frequency and baseline workload require validation with the practising-doctor partner.

PROPOSED OPERATIONAL KPI
Primary KPI: median combined staff and doctor time per return visit for preparation and retrieval, including corrections and failed extractions. Extraction accuracy is already measured on synthetic corpora; **no time saving has been measured yet**, and none is claimed. Target: at least 30% less time than the better manual baseline, without worse final-record precision or recall. Compare the current process with a structured manual timeline, using 30 unseen synthetic histories, independent reference records and balanced task order. Use separate participants for the same cases across workflows to reduce recall effects. Measure first intake separately. Score patient identity, test, date, value and unit. Every exported fact must retain its source. Unresolved identity conflicts must block release. No measured savings or patient outcomes are claimed.

2. SOLUTION AS BUILT
Glucoflow is a working web and Android application that prepares a source-linked progression view for diabetes follow-up visits. Staff upload PDFs or scans. The extraction pipeline proposes structured, dated entries with the quoted source line for each one, and a reviewer checks every entry against the original document before approval. Nothing reaches the approved history automatically: publication needs an explicit decision for every entry and a resolved patient identity.

The local build is verified end to end on synthetic records: upload → worker processing → review → approval → progression, on both roles, with 95 automated tests, 25 end-to-end API checks and 43 browser checks passing. In this environment the extraction provider is a deterministic rule engine over labelled fixtures, and every screen that shows its output says so. A live model adapter is implemented and refuses to run without credentials and a spending limit; it has not been exercised.

The doctor can explore recorded lab trends alongside dated prescriptions, screening documents and clearly labelled patient-reported notes. Each entry links to its source. Missing measurements remain gaps and clinical interpretation stays with the doctor.

At the next visit, Glucoflow retains unchanged approved history and presents new information or amendments for review. Staff can export the updated visit summary for the existing clinic workflow. The initial prototype will demonstrate upload, extraction, correction, approval, interactive progression and persistent records. Patient and clinic roles work on both platforms. Short pre-visit notes remain labelled patient-reported. Search within the patient's approved records opens the original source. Optional consent-based ABHA integration is a later extension, not a dependency for the first build.

TECHNOLOGY AS BUILT
Vite, React and TypeScript provide the shared interface, with Capacitor packaging the Android app; the signed release APK installs and runs on an Android emulator, including patient upload and a reviewer approval. A Fastify API and a separate document worker run against PostgreSQL, which enforces row-level isolation and owns all publication, note and export mutations. Digital PDF text extraction, OCR for image-only pages and a provider boundary that can call a multimodal model all feed the same review step. Server-side validation, duplicate detection, amendment history and explicit approval control the approved view.

Deployment configuration exists for Vercel, Railway and Supabase (container recipes, environment contract, migration path with the hosted role name), but no hosted environment has been exercised. Hackathon demonstrations use synthetic data throughout. Measured extraction accuracy on held-out synthetic corpora: precision 1.00 and recall 1.00 on the final unseen corpus, with the weakest field being event dates on image-only pages (0.88 exact). That measures these documents only; unfamiliar real records are not covered.

DEMO FLOW (VERIFIED)
On Android, a synthetic patient uploads a report and adds a visit note. Clinic staff sign in and see the same patient's approved history on web or Android, with the pending review count. Staff open the review queue, open the new report, check each extracted entry against its quoted source, correct or exclude uncertain entries, and approve. The approved value appears in the progression chart, and the source document opens from the value. The visit summary exports as a PDF. Signing out and back in confirms persistence. Duplicate uploads, a wrong-patient document and an unreadable scan are handled by the queue and the review screen.

Everything above was exercised on the running build: on web through the automated browser suite, and on Android on an API 35 emulator, where a reviewer approval was confirmed in the database. The deck's new final slide shows three unedited screenshots from that build; the earlier illustrations remain concept mockups.

3. TEAM FIT — REQUIRES REAL DETAILS
Practising doctor: [name, specialty, current practice, relevant workflow experience]
Technical lead: [name, relevant skills, link to actual work]
Other members: [name, specific responsibility, relevant evidence]
Clinic access: [confirmed site and permission status, or pending]

Suggested answer after replacing all brackets:
[Doctor name] will define the clinic workflow and assess whether the approved history faithfully represents the source records. [Technical lead] will implement the application, extraction pipeline and deployment. [Other member] will handle [responsibility]. Our relevant experience includes [actual work and link]. Clinic testing access is [confirmed details / pending]. We will evaluate the complete workflow on synthetic cases and pursue a supervised operational pilot over 60–90 days.

Do not submit bracketed placeholders or invent experience, team members or partnerships. The deck truthfully shows these details as pending; replace that line with verified names and roles before submission if available.

4. EXISTING WORK
We have prepared the problem definition, workflow and pitch, and built the application: a working web client, Android app, API, worker, database schema with row-level isolation, extraction pipeline, review and approval flow, progression view, patient-scoped search, patient notes and visit-summary export. It runs locally on synthetic records and is verified by the test suites named above. Not yet verified: live model extraction, hosted authentication and storage, a physical Android device, and any time saving. Third-party components in use: Vite, React, Capacitor, Fastify, PostgreSQL, pdf.js, Tesseract.js, Recharts and jose; the model adapter speaks the OpenAI-compatible chat completions protocol and is not yet pointed at a live model.

For any yes/no prior-work question, follow its exact wording. Disclose an existing team product or repository if applicable, and separate pre-existing features from planned hackathon work. Do not infer a yes/no response solely from using third-party libraries.

5. DECK AND OPTIONAL MATERIALS
Current aligned deck: Glucoflow_Pitch.pdf
Editable version: Glucoflow_Pitch.pptx
The official guide requires an end-to-end deck. Its public FAQ lists a prototype link, video walkthrough and supporting document as optional. File format and size restrictions must be checked inside the form.
Prototype link: leave empty until a working link exists.
Video link: leave empty until an actual walkthrough exists.
Supporting document: optional. Archived supporting proposals are superseded; do not attach them as current materials.

DECK STATUS
Glucoflow_Pitch.pptx / Glucoflow_Pitch.pdf were updated on 3 October 2026: the concept-only wording is replaced with the verified local build, a new final slide shows unedited screenshots from the running web and Android builds, and the outstanding items (live model, hosted deployment, physical device, time saving) are stated on the slides.

SUBMISSION CHECKLIST
- One shared entry per team; any current member can submit.
- Confirm the required practising-doctor partner and technical lead.
- Confirm inherited track and solution focus.
- Replace team placeholders using real evidence.
- Upload the current Glucoflow_Pitch.pdf from deliverables.
- Keep all benefits and productivity figures labelled as targets or assumptions.
- Confirm exact field limits and file restrictions in the authenticated form.
- Submit the entry; an unsubmitted draft is not judged.
- Official FAQ deadline: 3 October 2026, 23:59. The quoted FAQ does not specify timezone.
- The FAQ says edits remain possible until the deadline and the last saved version is evaluated.
- Build sprint listed: 5 October–8 November 2026.

Sources checked:
https://healthathon.reskilll.com/guide
https://capacitorjs.com/docs
https://fastify.dev/docs/latest/Guides/Getting-Started/

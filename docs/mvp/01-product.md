# Product scope and decisions

> **7 November scope update:** The user adopted the inpatient coordination PDF and explicitly authorized Hermes reuse, GPT-6.1 implementation agents, Azure deployment, and OpenUI interactive answers. The active [care plan](../superpowers/plans/2026-11-07-hermes-care.md) adds these journeys while retaining the authorization, source evidence, human approval, patient-record and web/Android requirements below. The historical “Deferred” list does not prohibit the newly authorized synthetic care workspace. Live hospital APIs and clinical decisions remain outside this implementation.

> **7 November web audit clarification:** The user further requested a complete web/navigation review, governed operational skill reuse, current public-skill/model research, and actual native Hermes execution for cognitive workflows including document processing. Follow the [web coherence plan](../superpowers/plans/2026-11-07-web-coherence-audit.md). Hermes is the agent execution engine; deterministic source preparation/validation, durable job leases, storage and server authorization remain platform services. A model may propose record facts but never publish them. The supported report intake remains PDF/JPEG/PNG until an explicit video output contract and capable provider are validated; native upstream video-tool availability alone is not a shipped feature. No existing records, job history or secrets are removed in this consolidation.

## Purpose

Prepare a diabetes follow-up history from records the clinic and patient already possess, preserve reviewed facts between visits, and make the supporting evidence easy to open. The primary measurable outcome is combined staff and doctor task time for a return visit, with final-record accuracy checked independently.

## 7 November hospital authority extension

The user explicitly authorized a hospital administration interface and multiple named demo staff per role. This supersedes the earlier exclusion of an administration UI below. Follow [hospital authority plan](../superpowers/plans/2026-11-07-hospital-authority.md). Operator-provisioned verified identities may be activated, assigned a care role or revoked by hospital administrators. Administrative status and care roles do not imply patient-record reviewer/clinician access. Managed shared workspaces enforce the assigned hospital role on the server; private fictional workspaces support clearly labelled persona switching. The original patient and clinic experiences remain.

## Users and permissions

There are two product experiences, patient and clinic. Within the clinic, reviewer and clinician are distinct permissions. One account may have both clinic permissions. An operator manages demo memberships and patient links through a local administrative script. Administration alone does not grant clinical-record access; no administration UI is included.

| Actor | Main job | Publication authority |
|---|---|---|
| Patient | Upload their documents, submit visit notes, view their approved history | Cannot approve extracted clinical facts |
| Reviewer | Confirm identity and source facts, correct drafts, resolve document conflicts | Approve supported facts for an assigned clinic patient |
| Clinician | Explore approved progression and open evidence | Can review only if separately granted reviewer permission |
| Administrator | Provision demo accounts and links through a local script | Cannot self-grant unrestricted data access through the UI |

Both experiences exist on desktop web, mobile web and Android. The server derives permissions from verified membership. A visible role selector only changes context among authorized roles. The demo uses separate seeded patient and clinic accounts; no universal role toggle that bypasses authentication.

## Complete MVP journeys

1. Patient signs in, uploads a synthetic report, checks upload status, writes a short pre-visit note.
2. Clinic reviewer opens the work queue, verifies the intended patient, checks proposed facts against source evidence and approves or excludes each entry.
3. Clinician opens progression, selects a test, changes the date range, inspects dated medication and note entries, opens an original report, and exports an approved summary.
4. A later report joins the same history. Earlier unchanged approvals persist. A correction retains the old version in history.
5. Patient sees the approved update and the review status of their own uploads.

An app download is optional for patients. The browser provides the same workflow. Android adds camera access and an installable app entry point.

## Scope locked for this build

- One demo clinic plus a second isolated test clinic to prove access separation.
- One patient record belongs to one clinic in this MVP. Cross-clinic sharing is deferred.
- Supported input: PDF, JPEG and PNG, at most 15 MiB per file and 10 pages per document. A photo batch contains at most 10 images and 15 MiB total.
- Supported lab observations: HbA1c, fasting/random/post-meal glucose as distinct codes, laboratory-reported eGFR, urine ACR and lipid components. Record BP and weight if documented. Units and original wording stay visible.
- Dated prescription records include name, strength, dose instructions and source when available. A prescription does not establish medication consumption or continued use.
- Screening and examination entries show documented eye/foot/nerve records and dates. No interpretation of scans or calculation of screening due dates.
- Short patient note: free text up to 1,000 characters, event date optional, and categories Medication taking, Symptoms, Diet/activity, Other. The patient reviews it before sending. No real-time symptom monitoring promise.
- Timeline, patient-scoped report search, source review, patient notes, approval history and PDF summary export are required.
- English MVP interface. Preserve original source language. Unsupported-language text can be manually reviewed; do not silently translate clinical content. Localization-ready labels, with a second language only after translation review.

## Deferred

Live ABHA/ABDM integration, hospital APIs, appointments, billing, clinician chat, push alerts, automated reminders, emergency SOS, caregiver delegation, background offline sync, predictive scores and autonomous clinical advice. Their absence is intentional and must not be hidden behind inactive demo controls.

## Source of truth

Original documents are evidence. AI output is a proposal. Approved facts are versioned clinic assertions about what the document says. Patient statements retain their reporter and cannot become measured results through review. Charts read only current approved observations.

## Success conditions

The phone upload reaches the correct clinic queue. Every approved plotted fact can open its source. An explicit wrong-patient identifier blocks publication and requires rejection and a fresh correctly assigned upload. Missing identity requires documented reviewer confirmation. A repeat upload does not add repeated points. Concurrent reviewers cannot silently overwrite each other. A successful reload preserves approved history. The signed Android APK works without a development server.

## Demo priority

The patient context, pending work, progression chart and source-opening action must be visible without hunting through menus. Favor one visible next action at each step. Retain an explicit Back action on narrow screens.

## Evidence and claims

Use synthetic data throughout the hackathon build. Measure workflow outcomes instead of claiming patient benefit. Do not present benchmark extraction accuracy as clinical validation. Registration/team eligibility and the official form remain separate submission tasks.

Source: [Health-a-thon guide](https://healthathon.reskilll.com/guide), checked 2 October 2026.

## Clarification from the supplied clinical context

The immediate physician job is to review a consolidated visit overview and find the original report quickly. Progression remains central. Add patient-scoped report search as a required MVP function. Search is retrieval over authorized records and source references, not clinical question answering.

Do not infer hidden disease, why a value changed or whether a treatment worked. A displayed absence means no matching record in the uploaded, reviewed collection. It does not establish that the test was never performed or is overdue. Do not use app participation to block medication refills or appointment access.

The supplied three-minute/30-second claims are unmeasured context, not accepted latency or workload results. The physician's reported experience can inform interviews; attribute and validate it before using it as a general statistic. Product name remains Glucoflow.

## Fixed delivery scope

The client starts in light mode. Dark mode is deferred. Reviewer and clinician permissions are distinct; the seeded clinic demonstration account has both. The patient demonstration account has only its self-link. No role can change the active patient without a visible identity update. The product and feature scope in this document is the authority for the build. Detailed contracts in document 09 implement this scope and do not expand it.

## 7 November hackathon guardrail clarification

The user supplied six official FAQ screenshots and explicitly asked to enforce them. This supersedes the October dashboard's derived clinical review flags and diagnostic reference panels: remove low-glucose triggers, eGFR decline interpretation and generic diagnostic ranges. Keep source values, patient reports, manually assigned operational categories, explicitly configured administrative intervals, human review and audit trails. No interval is filled automatically. Synthetic-only demo remains mandatory. Static UI localization and bounded Sarvam transcription/read-aloud are newly authorized; transcription is an editable draft, never a clinical assertion or automatic action. Caregiver access requires an actual delegated identity/consent model and is not implemented by sharing a patient password.

For the current inpatient coordination submission, the proposed primary operational KPI is median verified collection-to-laboratory-receipt lag. Return-visit preparation time remains a secondary record-workspace measure. The [FAQ scope audit](../../app/reports/hackathon-scope-audit-2026-11-07.md) defines the denominator, missing receipts and proposed 60–90 day evaluation; no pilot outcome is claimed.

## 7 November continuous workspace UI

The user explicitly requested reusing the referenced Codex web UI around GlucoFlow. The pinned MIT CodexApp 0.1.91 presentation is adapted into React, with original scoped styles and attribution. This supersedes the earlier page/header/tab placement constraints where needed for one persistent application shell and conversation beside working content. Role authorization, patient context, source evidence, human approval, synthetic labels, light default and supported web/Android contracts remain. The original Codex app-server, coding tools and desktop launcher are not part of GlucoFlow. See the [canvas design](../superpowers/specs/2026-11-07-canvas-workspace-design.md).

## 7 November direct speech and minimal navigation clarification

The user's latest explicit instructions supersede the expanded speech-review forms and permanently visible workspace toolbars. A mic click starts recording; stopping requests transcription into an editable draft, without sending that draft. A speaker click explicitly requests synthesis/playback; stopping cancels it. No extra review checkbox is required for these speech operations. Clinical-record publication and operational task approval remain human actions. Care defaults to chat with a compact Worklist/Encounters switch; operational tools, learning and simulation are contextual. Existing route permissions, data and direct links remain intact.

## 7 November welcome correction

The user's rejection of the bare account-picker entry supersedes the root-to-sign-in redirect. The root is a focused product welcome with a clearly labelled illustrative operational handover, dominant clinic demo action and secondary patient entry. `/sign-in` remains a legacy alias to the same entry, preserving protected destination state. Demo roles are progressively disclosed; permissions and fictional-data requirements remain unchanged.

## 7 November DKA/HHS demo context

The user supplied handwritten clinical-context notes. DKA remains the blueprint's primary operational demonstration; HHS is an optional fictional transfer-handover preset. Documented diagnoses remain context, never inferred conclusions. No mortality claims, dosing, correction targets or clinical decision rules are added. New chat starts a separate saved simulation, explicitly preserving the old workspace. See `app/reports/dka-hhs-demo-2026-11-07.md` for the demonstrated scope.

## 7 November reference-inspired workspace home

The user supplied a Treasury-style sidebar/dashboard/composer reference. Apply its quiet visual hierarchy to GlucoFlow's existing workspace. The empty conversation home shows current operational task counts, recent source events and handover owners, then the same chat composer. Values derive from saved synthetic state; no invented trends, clinical scores or outcome metrics. Primary destinations appear once in the desktop sidebar or mobile bottom navigation. Existing clinical authorization and evidence controls remain unchanged.

## 7 November light canvas and loader clarification
The user explicitly requested a single-screen desktop overview, no stacked top bars or heavy status bars, consistent neutral styling and no browser disclosure triangles. Desktop account/language controls move to the sidebar; mobile keeps access. Native disclosure semantics, clinical approval, source evidence and synthetic labels remain. Grok orb MIT vector artwork is adapted for loading only, with reduced-motion support and attribution.

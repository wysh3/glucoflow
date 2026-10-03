# Product scope and decisions

## Purpose

Prepare a diabetes follow-up history from records the clinic and patient already possess, preserve reviewed facts between visits, and make the supporting evidence easy to open. The primary measurable outcome is combined staff and doctor task time for a return visit, with final-record accuracy checked independently.

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

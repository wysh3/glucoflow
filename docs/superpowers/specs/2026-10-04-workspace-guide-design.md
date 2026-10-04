# Calm clinic workspace and app guide

Approved in chat on 4 October 2026: the user asked to implement the presented design completely, including cleanup and deployment, and delegated implementation details. Execute directly in this session; do not add further design approval gates or delegate implementation.

## Intended outcome

Reviewers start a sample demo without hunting for files. Doctors get a consolidated, source-backed visit overview and direct sidebar navigation. Patients find upload, notes and home reporting quickly. Desktop and Android share a comfortable UI. The assistant helps users operate the app without clinical interpretation.

## Interface

The sign-in landing is centered vertically within a safe-area-aware minimum viewport, with a compact SaaS presentation, small mint orb and four primary role cards. Secondary test accounts are disclosed separately. Typical 1440×900 and 390×844 viewports fit the primary entry screen; do not lock scrolling for short screens or enlarged text.

Replace system select pickers with keyboard-accessible Radix in-app dropdowns, retaining labels, disabled states and form values. Fix safe-area CSS overriding ordinary spacing and align tabs and actions consistently.

Add `/clinic/patients/:patientId/overview` with latest approved measurements and dates, per-result source links, recent documented prescriptions and examinations, patient-reported notes, record availability and links to full trends, documents and home reporting. Prescriptions are source records, not assertions of current medication use. Patient identity remains visible. Existing trends and human review remain available.

Use the desktop sidebar for current-patient sections. Mobile uses compact, scrollable sections and existing bottom navigation without overlap. Show the approved-record overview separately from the illustrative five-year scenario.

## Orb app guide

A compact Live Orb styled guide is available across signed-in screens and landing. Landing help is local and clearly labelled; signed-in chat uses `gpt-6-luna` through a server-only authenticated endpoint. The model classifies app-help intent into a finite catalogue. The server generates all displayed answer text and navigation actions from vetted templates. Never display arbitrary model prose, URLs or HTML.

Request: current screen enum and a message up to 600 characters. Role and capabilities come from the verified actor. No patient ID, records, source text or clinical values are sent to the provider. UI explains that chat is for app help and should not contain health details. Requests asking for diagnosis, disease interpretation, dosage, treatment or changing records receive a fixed refusal. No write tools, autonomous approval, clinical recommendations or emergency dispatch. Links use local action IDs and client-owned destinations, scoped to the current visible patient.

Bound model work: 12 requests per actor per minute, maximum 2 concurrent calls per API instance, a bounded request timeout, output tokens capped at 120, and a configurable hourly model-call ceiling. When unavailable or budget-limited, return honest local app help with its mode. Do not label fallback text as AI. Chat lives only in component memory and clears on role/session changes; no chat database or message logging.

Use the requested 23rd Live Orb source if the registry permits reuse and preserve attribution. Otherwise implement an original light CSS/SVG orb with equivalent eyes and reduced-motion behavior, attributed as visual inspiration. Avoid a heavy WebGL dependency for a 44-pixel helper.

## Cleanup and delivery

Keep historical reports and source evidence. Preserve user-owned untracked decks. Correct outdated README/APK statements, make documentation entry points coherent, place GitHub Actions at the repository root with app working directory, and document assistant configuration and provider budgets. Scan frontend and APK for privileged keys. Build, sign and publish the updated APK; update Vercel and Azure while retaining Supabase privacy and permissions. Commit and push public main after measured verification.

## Verification

Browser checks reproduce landing padding/overflow, in-app keyboard dropdowns, overview sources and sidebar access, guide open/close/navigation and clinical refusals on desktop and mobile. Server tests cover auth, strict body validation, permissions, unsafe model output, provider failure/timeout, call budgets and refusal behavior. Existing upload, review, publication, source, export and isolation checks remain green. Live walkthrough checks deployed role entry, overview and guide. Physical-phone installation is reported separately if unavailable.

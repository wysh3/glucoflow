# GlucoFlow web navigation audit

7 November 2026. Baseline before navigation changes. Chromium at 1440 × 900 and 390 × 844 against the local Vite client and Fastify API. The mobile sweep used reduced motion.

## Observed coverage

Two independent browser sessions traversed 33 surfaces each, including public entry, role selection, care setup, all four care areas, learning, the eight retained clinic routes, all seven clinic patient sections, the four patient routes, both account states, and 404 recovery. No page exceptions or document-width overflow occurred during the 66 visits. This observation covers the two viewports and seeded content.

The interaction sweep used a new, owner-scoped synthetic workspace for each viewport. It exercised one explicit deterministic assistant turn and OpenUI reply, reload persistence, source event validation, role changes, receipt confirmation, task filtering, handover drafting, the reset confirmation and browser Back. Clinic-to-reviewer switching and patient denial at the care URL were both reproduced. The audit made no paid model calls and did not reseed the database.

## Findings and disposition

| Severity | Reproduction and impact | Disposition |
|---|---|---|
| P1 | Open a public receipt with stage `closed_unreachable`. The page says “Closed as unreachable” while green checks mark both “Patient contacted” and “Next step completed”. The visual record conflicts with its disposition. The focused browser reproduction supplied the single public API stage through a controlled response. | Keep public verification. Render an explicit unreachable branch and confirm unperformed steps have no completion mark. The integrity of the event chain is a separate status. |
| P1 | Sign in as Clinic team, open `/clinic/line`, select Switch account, then Reviewer. Both viewports return to the clinician-only line and display a role refusal. The same switch on mobile is labelled “Switch” beside a different simulation role control. | Clear the old protected return target for an intentional account switch and land the new account in its authorized home. Preserve a requested route for an unauthenticated deep link. Use “Switch account” consistently. |
| P1 | Create a workspace and open Hospital simulator. The default Doctor, Asha Shah, and Result acknowledged selection can be submitted even though the selected order only has an order-placed event. Both viewports returned a generic prerequisite error. | Offer an eligible role and order combination when one exists. Explain which event is needed when a selection is blocked, and keep the API validation. |
| P1 | Open the desktop care workspace. Eight links under “Clinic records” present two retained workflows beside the main care tabs, and labels such as Line, Calls, Replay and Ledger do not say what they do. On mobile, the same closure and review controls sit behind one Records disclosure. Care Teams and Patients appear to refer to the same cohort, but their records come from separate synthetic datasets. | Keep a shared hierarchy across widths. Put Care, Patient records, Result closure and Account at the top level. Place closure stages within Result closure and review with Patient records. Label the inpatient simulator and longitudinal patient records as separate scopes. |
| P2 | Emit a valid LIS receipt for Dev Mehta. The matching monitor completes and disappears from the default Worklist. “Source confirmed” is visible after switching Status to All tasks. The Activity log is the other route to evidence, but the emitter gives no direct link to it. | Keep the open default. Add immediate source-confirmation feedback with a link to the completed task or a recent-completions view. |
| P2 | Select Deterministic helper, ask, then reload. The assistant transcript persists while the composer returns to Hermes live. Local Hermes was unavailable, so a subsequent draft could not be sent until the user selected helper again. | Remember the chosen mode within that actor and workspace session, with explicit provenance on each response. Keep the live availability check. |
| P2 | Open an unknown route as a clinic member. “Open the workspace” returns to Patients instead of the current clinic home. The mixed-context Account branch also points “Clinic workspace” at Patients. Sign-in role descriptions still advertise closure jobs even though each clinic card enters Care. | Derive all home links from the same authorized helper. Update access copy to describe where each card actually goes. |
| P2 | Open any retained obligation screen. It duplicates four destination controls in a local Line/Calls/Intake/Register strip and the main navigation. The ledger starts with “The last mile” and a slogan. Replay is exposed as a normal clinic destination despite being a synthetic evidence view. | Keep operational controls. Group them under one Result closure navigation and use task names such as Clinician review, Patient calls, Lab intake and Closure register. Move Replay into the walkthrough or a secondary evidence link. Remove the slogan and numbered navigation labels. |
| P2 | Open a patient as a clinic user. On desktop the seven patient sections sit below the full clinic rail. On mobile the patient header precedes a three-row section grid before any visit information. “Delta” and “History” lack context, and “Home reports” is also a shortcut within Visit overview. | Keep the visible patient identity and search. Put patient-specific sections directly beside that identity, group specialist views, and use “Visit changes” and “Record history” where those labels fit. Keep all underlying routes and evidence views. |
| P2 | Sign in as Patient without a return target. The demo lands at `/patient/master`, whereas a refused clinic route lands at `/patient/records`. The patient Home heading is “Home readings & reporting”, and the Home shortcuts repeat Records, Add report, and Visit notes. A long illustrative medication timeline appears below interactive entries. | Choose one patient home across auth paths. Use a descriptive “Home readings” label if the records list is the home. Keep reading, symptom, upload and note workflows. Place the static five-year scenario in a clearly named demo detail so dated sample medications remain distinct from the patient's approved record. |
| P2 | Open New workspace. The dialog correctly says the previous workspace stays on the server, but the new workspace replaces the one browser pointer. The UI has no route back to the previous workspace. | Describe that behavior plainly. Keep the confirmation and export link. Add an authorized recent-workspace picker only if reopening earlier runs is intended. |
| P3 | The public landing offers Walkthrough twice and Sign in plus Choose an account to the same destination. The walkthrough offers a directly linked retained ledger next to its care run. Public `/demo/delta` is a functional standalone sample without a path back into care. | Keep one primary demo entry and one route to role choices. Place the old sample and proof routes in a secondary demos or tools area. Add a breadcrumb or return link where a demo is meant to be discoverable. |
| P3 | The caret on mobile Records points down while the menu opens upward. The footer labels for “Care” and “Records” differ from desktop, and the page title remains “glucoflow” across the sampled views. | Align direction and labels with the actual menu. Use meaningful document titles on main routes and preserve manual tab keyboard activation. |

### Evidence screenshots

- Primary clinic and care navigation at desktop. [Desktop care](evidence/navigation-audit-2026-11-07/desktop-care-ask.png)
- Source event prerequisite rejection on a fresh workspace. [Mobile simulator](evidence/navigation-audit-2026-11-07/mobile-simulator-default-event.png)
- New reviewer lands at the old clinician-only URL. [Mobile role refusal](evidence/navigation-audit-2026-11-07/mobile-switch-account-refusal.png)
- Conflicting contact status on the unreachable proof. [Mobile public proof](evidence/navigation-audit-2026-11-07/mobile-verify-unreachable.png)
- A separate cohort and nested sections in the retained patient record. [Mobile visit overview](evidence/navigation-audit-2026-11-07/mobile-patient-overview.png)
- Handover after a real local command, with the active playbook version and an explicit review label. [Mobile handover](evidence/navigation-audit-2026-11-07/mobile-care-handover.png)

## Route and action inventory

| Surface | Route or entry | Actions inspected | Proposed home |
|---|---|---|---|
| Public | `/`, `/sign-in`, `/showcase`, `/verify`, `/demo/delta`, unknown route | Sign-in card, walkthrough links, proof form, sample source and review controls, home recovery | Landing, walkthrough and secondary tools |
| Care setup and Ask | `/clinic/care` | Create workspace, mode selector, prompt presets, send, reply persistence, reset confirmation | Care |
| Care Worklist | `?view=worklist` | Status filter, sort and search, monitoring requests, matching receipt transitions | Care |
| Care Activity | `?view=activity` | Approvals, monitor controls and audit log | Care |
| Care Teams | `?view=teams` | Encounters, lab order and source timelines, scoped handover | Care |
| Care Learning | `?view=learning` | Version history, sandbox review and proposal entry | Secondary inside Care |
| Care simulator | `#care-simulator` | Role, encounter, event and order selectors, feed controls, source emission and prerequisite failure | Secondary inside Care |
| Retained closure | `/clinic/line`, `/clinic/calls`, `/clinic/intake`, `/clinic/register`, `/clinic/results`, `/clinic/replay` | Review, source, call outcome, custody, matching, print, filters, import and replay | Result closure |
| Patient records | `/clinic/patients`, `/clinic/queue`, `/clinic/review/:documentId` | Patient selection, queue filters, source-document and review links | Patient records |
| Clinic patient detail | `/clinic/patients/:patientId/{overview,delta,bodymap,progression,documents,master,history}` | Identity, source search, tabs, record availability, data views, upload and export entry | Selected patient |
| Patient | `/patient/{master,records,add-report,visit-notes}` | Home entry, record navigation, upload and review entry, notes and snapshots | Patient workspace |
| Account | `/account` | Identity, sign-out, account switch and authorization boundaries | Account |

The route sweep inspected visible actions and followed selected representative interactions. It did not publish a record, upload a new sample to the shared clinic, transmit a snapshot, or run a physical Android session. The existing Playwright suite is tracked separately.

## Keep, consolidate and remove

- Keep the four care areas, source and timestamp labels, simulation controls and explicit human approval. Maintain the retained role-gated closure and patient workflows.
- Consolidate route labels by user task. Give the inpatient simulation one clear entry, the longitudinal records another, and the result-closure workflow its own local stages. Use the same names and order at desktop and mobile widths.
- Remove duplicate links, decorative numerical labels, slogans on operational pages, and fixture narratives that compete with current records. Keep standalone synthetic demos accessible through the walkthrough or a secondary route.

## Navigation changes verified locally

The clinic now presents Care, Patient records, Result closure and Account in the same order on both widths. Result closure has one permission-filtered stage navigation, and the synthetic cohort replay is linked from its ledger. Patient records open in Visit overview. Normal record navigation presents five sections and leaves the experimental Delta and Body map URLs out of its controls. Clinic and patient home links derive from verified account contexts. Intentional account switching discards the prior route target, while ordinary sign-in retains an authorized deep link.

The simulator selects a source-eligible default, explains a missing prerequisite, and exposes the recorded event and its completed task. The lost-response check confirms that retry submits the same body, expected revision and idempotency key. The assistant preference survives reload within the actor and workspace. Public verification separately shows chain integrity and unconfirmed contact on an unreachable receipt.

- All four original focused regression tests reproduced the defects before the changes.
- The updated navigation suite passed all 12 checks across both viewports. The combined run passed 25 of 26 checks, including the landing, account switching, saved workspace recovery and navigation cases. One mobile skill application case showed pointer interception after closing a nested source dialog. The skill integration lane received the reproduction.
- An independent browser pass opened the ledger, all four closure stages and cohort replay at both widths. The ledger used its own browser title and started at the top after leaving the simulator. No page errors or width overflow were observed.
- Care tabs responded to ArrowRight and Enter. The record guide's animated orb computed to no animation and a zero-second transition with reduced motion. The public-proof rendering check controlled only the response stage.

### Updated browser evidence

- [Desktop care navigation](evidence/navigation-audit-2026-11-07/after-desktop-care.png)
- [Mobile care navigation](evidence/navigation-audit-2026-11-07/after-mobile-care.png)
- [Desktop result closure](evidence/navigation-audit-2026-11-07/after-desktop-closure.png)
- [Mobile result closure](evidence/navigation-audit-2026-11-07/after-mobile-closure.png)
- [Mobile simulated source completion](evidence/navigation-audit-2026-11-07/after-mobile-simulator-completion.png)
- [Mobile unreachable receipt](evidence/navigation-audit-2026-11-07/after-mobile-verify-unreachable.png)

A follow-up checked trailing-slash links. Both Care and Clinician review lost their selected navigation state before normalization. After normalization, four desktop/mobile checks passed, including the correct browser titles, the retained closure stage controls and one assistant entry on Care.

# DKA/HHS demo and New chat — 7 November 2026

## Scope decision

Re-extracted the supplied 26-page GlucoFlow_Final_Novelty_and_UX_Blueprint.pdf. Its initial validation workflow is inpatient DKA with documented renal complexity, operational handoffs, bounded monitoring and reviewed handovers. The two new handwritten images add context about transfer delays, recording discrepancies and cross-department communication. Their mortality figures, insulin doses, potassium thresholds and correction targets are not validated product requirements and were not encoded.

Use DKA as the primary demonstration and HHS as a fictional companion handover scenario. The previously supplied hackathon FAQ excludes diagnosis, prescribing and clinical decision support. A documented diagnosis is scenario context; the app does not infer it or determine resolution, severity or treatment.

## Shipped

- Visible New chat control beside clinic navigation, including an accessible compact mobile icon.
- It starts a new saved simulation, with fresh encounter identities and empty chat. An explicit dialog states that the old conversation, sources and tasks remain in Saved workspaces. This is not a new thread sharing the existing encounter state.
- Initial care screen explains the three existing DKA scenarios and the operational job.
- Add synthetic encounter offers editable DKA/renal-handover and HHS/transfer-handover presets. These create ordinary persisted encounters through the existing authorized API. They add no automatic orders, treatment rules or clinical alerts.

## Five-minute demonstration

1. Open clinic and create the DKA simulation. State that all patients and HIS/LIS events are fictional.
2. Ask which specimens have collection evidence but no receipt. Open Dev Mehta's collection source; distinguish missing receipt evidence from a clinical conclusion.
3. Inspect the operational task and owner. Approve any proposed monitoring explicitly. The configured target is a demo workflow target, never a treatment deadline.
4. In Demo controls, select the lab simulation role and record the matching specimen receipt. Show that source evidence confirms the task and preserves the audit history; do not claim real hospital integration.
5. Return to the doctor role and draft a handover. Show unresolved items, responsible owners and source references. Human review remains necessary.
6. Optionally add the HHS template through Encounters → Add synthetic encounter. Show the receiving-team documentation gap. It is not an automatic clinical pathway.

For the longer novelty demo, show the existing workflow-learning process only after separately rehearsing its source-confirmed task → candidate procedure → sandbox test → approval → distinct target proposal → second approval flow. Do not claim this turn revalidated the complete learning loop. Clinical lessons, treatment outcomes and patient identifiers must not become reusable operational skills.

## Information decay framing

- Lost handoff: connect collection and receipt events to the same order.
- Lost ownership: retain the responsible role in the task and handover.
- Stale status: display source timing and feed freshness; unknown remains unknown.
- Lost context between shifts: preserve unresolved work and sources in a reviewed handover.
- Repeated operational friction: use approved, versioned workflow procedures with evidence and rollback, not learned medical advice.

## Fresh verification

TypeScript passed. All 15 care integration tests passed (1.32 s total; test execution 480 ms). Client production build and asset scan passed. Deployment `dpl_Ak9ubx4UwS3kNHVse5LJtM179HQ8` reached READY at https://glucoflow.vercel.app.

Local browser: New chat dialog and creation; HHS template selection and encounter creation. Hosted browser: created workspace, used New chat, created HHS synthetic encounter and verified persistence after reload. At 390 px the page width was 390 px and New chat remained visible; viewport restored. Screenshots: `evidence/dka-hhs-chat-2026-11-07/new-chat.jpg` and `hhs-preset.jpg`.

No new live model, clinical accuracy, microphone, Android, physical-device or complete historical browser-suite validation. Local runtime showed Hermes unavailable; no inference call was made or represented as successful. This release changes the frontend and uses existing backend commands, not a new backend deployment.

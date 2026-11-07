# Coordination change list — 7 November 2026

Authority: shared GlucoFlow conversation plus user's handwritten operational notes and instruction to implement directly. Existing November scope supersedes older record-only exclusions. Preserve synthetic labels, source evidence, authorization and human approval. The clinical dosing/mortality notes are reference material, not executable requirements or validated claims.

## Implementation and verification
- [x] Explicit task ownership transfer: request, receiving-role acceptance/rejection, unchanged old owner until acceptance, audit history; never marks clinical work complete.
- [x] Browser-independent bounded server monitoring of saved synthetic workspaces, with row locking and restart-safe state. Missing/stale feeds remain unknown.
- [x] Bed/department transfer logistics after a recorded human decision, with staff-entered synthetic references and arrival history; no severity assessment, bed availability inference or ICU triage.
- [x] Show pending responsibility in task/encounter/handover surfaces without adding a new dashboard.
- [x] Verify lab collection → receipt → result → acknowledgement; corrected results reopen the acknowledgement requirement.
- [ ] Click through proposal/approval, sources, simulator, handover, history, saved-state recovery and approved skill reuse.
- [ ] Test server permissions, lifecycle boundaries, concurrency and background monitoring; verify desktop/mobile client.
- [x] Deploy only passing changes and record actual evidence.

## Production gates that require external work
Real hospital connector contracts and access, verified care-team identities, deployment/privacy assessment, consent and retention operations, institutional governance, incident response, load/availability validation and measured pilot outcomes. No clinical recommendations or live ABDM claim. Public demo accounts remain synthetic-only shared identities.

Research screenshots motivate evaluation but their numerical findings have not been independently verified here and are not GlucoFlow outcomes. Primary proposed metric remains collection-to-receipt lag, with missing receipts and acknowledgement/transfer lag tracked separately.

## Follow-up verification

Implemented ownership request/acceptance/decline and terminal withdrawal; deterministic background monitoring independent of model readiness; staged staff-recorded bed logistics; pending-owner display; source-based completion; rollback revalidation. Deployed and verified as recorded in [India readiness](india-readiness-2026-11-07.md). Bed references are staff-entered synthetic evidence, not verified bed-system receipts. The earlier unchecked list is not a claim that every end-to-end journey has been freshly exercised: full skill reuse, every retained screen, physical devices and real connectors retain their own evidence gates.

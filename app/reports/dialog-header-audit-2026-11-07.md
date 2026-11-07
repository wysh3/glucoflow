# Shared dialog header audit — 7 November 2026

## Cause and change
The shared DialogHeader used a wrapping flex row. Long title/description content could consume the row and wrap the close action beneath the description. It now uses a two-column grid: title and actions share the first row, and description spans the next row. Existing accessible close labels, Radix dismissal/focus handling and footer actions remain intact.

The code audit covered 15 shared-header uses, including CareDialog, which serves 13 care dialogs. These include confirmations, saved workspaces, source evidence, task review, encounter/order forms, skills and playbooks. Other consumers include upload, export, record search, guide and document/review flows. This is a shared-component correction, not a separate placement patch for each screen.

New-chat explanatory copy was shortened. The orb's neutral eyes were straightened and lifted, with gentler sway; its small cap, pointer tracking, blink and reduced-motion behavior remain.

## Verification
- TypeScript typecheck passed.
- Deployment build passed; Vercel deployment `dpl_7CUu2qcrbwTbe9sCo8NgDhghaj67` reached READY.
- Hosted saved workspace reopened and New chat confirmation inspected: close at upper right, description below title, footer actions aligned.
- Local confirmation verified at desktop and 390×844 mobile width.
- Local source and task-review dialogs visually verified with close at upper right.
- Escape dismissal and return of focus to the opening control verified locally; source close button also verified.
- Source close action measured 44×44 pixels.
- Git diff whitespace check passed for changed implementation files.

Evidence: `evidence/dialog-header-2026-11-07/hosted-confirmation.png`, `mobile-confirmation.png`, `task-review.png`.

This verifies the shared placement correction and representative dialog behavior. It is not a claim that every application workflow, backend operation, or language was exhaustively retested in this pass. No backend changes were made.

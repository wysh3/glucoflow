# Submission files and reference-inspired home

7 November 2026. User requested official template completion and minimal demo content, then supplied a Treasury workspace reference and authorized implementing it.

## Submission artifacts

`deliverables/phase2-2026-11-07/` contains the prescribed two-page brief and 12-slide presentation as editable PPTX and PDF. Source templates were imported with Artifact Tool. Official branding, dimensions and slide structure were retained. Text was filled and fitted, with template prompts removed. Every slide was rendered and visually inspected; package/layout/import finalization passed. PDF counts are 2 and 12, and exported PDF samples were checked. These files were not inspected in Microsoft PowerPoint.

The user explicitly requested skipping information not supplied. Team code, named contributors/partners, contact, video/repository links and public-sharing consent are omitted. The portal may still require them; these decks do not make the entire submission complete. No new narrated video or portal submission was performed. Costs are explicitly illustrative planning assumptions. No clinical efficacy or formal user-study result is invented.

## Demo cleanup

Removed the unrelated AppointmentPreview panel from Encounters. A fresh simulation contains the three original DKA encounters supporting collection/receipt, result acknowledgement and handover. HHS remains an optional editable template, not another seeded default. Existing saved workspaces and historical records were retained rather than purged.

## Reference implementation

- Neutral sidebar with Home & chat, Worklist, Encounters, Records and Account. Expanded/sidebar rail functionality retained. Mobile uses its existing bottom navigation and drawer.
- Primary destinations no longer repeat as a second horizontal navigation bar.
- Empty chat home contains current open-task count and stages, recent source evidence and unresolved handover owners. No decorative chart or fabricated trend.
- Cards and rows navigate to the existing worklist, encounter view and exact source dialog.
- The composer remains part of the same conversation. On a first reply the overview gives way to the existing message history. Home has one scroll surface to keep all cards and the composer reachable on short displays.

## Verification

Fresh TypeScript checks and production client build/asset scan passed. Local browser verified the task-count drill-down, exact source dialog and home-to-chat transition using the explicitly labelled deterministic helper. That was not a live model call. Hosted and mobile results follow below.

Final deployment `dpl_AAHcpbZNmUBdUZGs3GRQGu4zFvs8` reached READY. Hosted checks verified populated home, worklist drill-down and return navigation. At 390 × 844 the document width remained 390 px; the composer accepted an unsent test draft and it was cleared. Desktop 1440 × 1000 showed all four summary panels and the composer together. The temporary viewport was reset. Evidence: `evidence/reference-home-2026-11-07/desktop.jpg`, `mobile-home.jpg`, `mobile-composer.jpg`.

The previous 15 care integration tests cover unchanged backend commands; no new full browser regression or live provider turn was run for this presentation-only home change. The submission deck's earlier measured results are dated and do not imply a new all-feature verification.

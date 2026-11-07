# Canvas workspace implementation plan

**Goal:** Turn the existing web app into one continuous workspace matching the user's Codex reference.
**Architecture:** Retain React/Hermes/API; compose persistent shell and conversation beside existing working views.
**Spec:** ../specs/2026-11-07-canvas-workspace-design.md

## Tasks

- [x] Click through live entry, care, record and patient journeys and inspect referenced code/licenses.
- [x] Update AppShell with collapsible sidebar, mobile drawer and bounded main canvas, preserving authorization/localization and patient context.
- [x] Keep Care Ask mounted beside the selected work panel, anchor composer, preserve draft and browser navigation; move simulator out of the primary flow.
- [x] Update public entry preview and write canvas interaction regressions.
- [x] Run relevant browser workflows, typecheck/unit checks/build, inspect rendered desktop/mobile layouts, fix regressions and deploy the web update.
- [x] Verify hosted result and record actual measurements and remaining scope.

Keep unrelated uncommitted work. Root owns landing/tests/docs; shell and care components have independent editors under the user's prior GPT-6.1 delegation authorization. No backend behavior or provider spend is required. No blanket future production-compliance claim.

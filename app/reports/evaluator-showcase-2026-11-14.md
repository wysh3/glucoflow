# Evaluator showcase release — 14 November 2026

Branch `dev`. `main` (submission snapshot `9460864`) is unchanged. Plan: `docs/superpowers/plans/2026-11-14-evaluator-showcase.md`.

## What changed for evaluators

- **Landing:** primary "Take the 3-minute tour" button. "Explore the clinic" now opens a ready workspace instead of an empty creation card. A three-card strip states what is real (software, database, role checks, audit), what is simulated (HIS/LIS feeds, all patients) and that a human stays in charge.
- **Showcase workspace (`preset: 'showcase'`):** the original three DKA encounters plus six fictional operational scenarios:
  - HHS with an overdue osmolality receipt
  - ward hypoglycaemia lab confirmation awaiting acknowledgement
  - post-operative transfer whose acknowledgement is already source-confirmed
  - diabetic foot culture in the lab
  - corrected potassium result that invalidates an earlier acknowledgement
  - antenatal OGTT awaiting approval
  
  Context lines are simulated HIS documentation, never app-generated clinical inference. The default seed (`classic`) is unchanged, so archive/continuation flows and existing tests keep three encounters.
- **Unit board on the doctor desk:**
  - Four shift counts: overdue or corrected, results to acknowledge, awaiting approval, closed by source evidence.
  - Patient rows sorted by urgency, each with a five-stage track (ordered → collected → at lab → result → acknowledged) derived only from recorded source events.
  - Each row has a one-click "Simulate HIS/LIS" button. It records the next event as a fictional staff member holding the role the server requires, then returns to the evaluator's persona. The server still refuses lab events from the doctor role (covered by test).
  - A receipt banner explains when a task closed because its matching source event arrived.
- **Guided doctor tour (10 steps):**
  - A spotlight tour that does not block clicks. It pauses under other dialogs and resumes on the same step.
  - On phones it shows as a bottom sheet and respects reduced motion.
  - It waits for the evaluator to perform the real lab event before advancing.
  - It covers the corrected-result reopening, the pipeline, a prefilled Gluco question and the persona switch.
  - It starts from the landing button, from the header Tour button, or from "Start guided tour" on the empty card.
- **How it works (`/how-it-works`):** architecture, a live API response-time check, six server-enforced rules, dated verification counts and an explicit "Not claimed" list.
- **Fixes:**
  - The flaky guide planner test stub timeout was raised (100 ms → 2 s).
  - The pipeline opens fitted to width (minimum 60%) instead of shrinking to the height (53%).

## Fresh verification

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm test` | **424 / 424 passed, 79 files** (adds 4 showcase-seed tests) |
| New browser test `evaluator-tour.spec.ts` | 4 / 4 passed, desktop 1440×900 and mobile 390×844 |
| `landing.spec.ts` (updated for the ready workspace) | 2 / 2 passed, desktop |
| Existing care browser specs | PENDING |
| `pnpm build` | PENDING |
| `pnpm db:test` | 12 / 12 earlier today; no migrations in this release |

Screenshots: `reports/completion-evidence/showcase-*-1440.png` and `-390.png`.

## Deployment

PENDING.

## Limits

Simulated feeds and fictional patients only. No new hospital, ABDM, model-accuracy, Android-device or clinical-outcome claim. The "Simulate" control is a demo affordance that plays the external system; real deployments receive these events from HIS/LIS.

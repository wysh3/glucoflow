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
| Existing care browser specs (9 files) | 29 passed, 2 failed on old expectations (empty-card heading; a second task awaiting approval). Both tests were updated and the affected spec passes 5 / 5 on desktop and 5 / 5 on mobile |
| `pnpm build` | Pass (client, API, worker) |
| `pnpm db:test` | 12 / 12 earlier today; no migrations in this release |

Screenshots: `reports/completion-evidence/showcase-*-1440.png` and `-390.png`.

## Deployment

- **API:** Azure revision `glucoflow-service--dev-showcase-1`, image `glucoflow-api@sha256:5f488f621ad4d734392ae494d979cd8f147553d1670a7dc60f0bbe820c72fd50`.
  - Deployed with `az containerapp update --container-name api` so only the API image changed. The runtime sidecar, secrets, scale and environment are preserved.
  - Healthy, `/health/ready` reports the database reachable.
  - Hosted smoke (`deploy-care-smoke.ts --offline-only`): all checks passed.
- **Worker and runtime:** unchanged (the worker reuses the unchanged reconciliation module). No migrations.
- **Web:** Vercel production deployment `dpl_2ayFris312oSKGC9LUQPpqAR1vxZ` at https://glucoflow.vercel.app, built and scanned by `scripts/deploy-care-web.py`.
- **Production browser run:** `evaluator-tour.spec.ts` and `landing.spec.ts` against the live site, **8 / 8 passed** (desktop 1440×900 and mobile 390×844).
  - Showcase screenshots in `completion-evidence/` come from this production run.
- **Live Gluco turn:** one synthetic question in the showcase workspace replied in 9,985 ms, citing the new scenario encounters with evidence. This is a single observation, not a latency benchmark.
- **Rollback:**
  - API: `az containerapp update -g glucoflow-demo -n glucoflow-service --container-name api --image glucoflowwysh2026.azurecr.io/glucoflow-api@sha256:873fbea1e68a6025b79b1e83e8958c3c489828cc3c0732ad452cb7d0b2a1797a`. This is the previous `cross-team-fixes` image; it accepts only the classic seed, so roll back the web first.
  - Web: restore the previous Vercel production deployment.

## Limits

Simulated feeds and fictional patients only. No new hospital, ABDM, model-accuracy, Android-device or clinical-outcome claim. The "Simulate" control is a demo affordance that plays the external system; real deployments receive these events from HIS/LIS.

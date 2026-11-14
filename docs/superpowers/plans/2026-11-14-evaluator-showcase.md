# Evaluator showcase plan — 14 November 2026

Branch: `dev` (from `main` at `9460864`). `main` stays frozen as the submitted snapshot. Everything below is built on `dev`, deployed to the existing Vercel project and Azure Container Apps, and merged into `main` later through one pull request.

Audience: two doctors and one technician evaluating the live site at https://glucoflow.vercel.app.

Safety boundary is unchanged: synthetic data only, human approval for every action, no diagnosis or treatment advice, no claim of live HIS/LIS/ABDM, and no fixture output presented as live AI.

## What the live site does well today

- Care desk, chat with evidence cards, pipeline, worklist, encounters, handover and patient records all work on the hosted build (checked 14 Nov).
- The patient record view (approved measurements, prescriptions, sources) is credible to a clinician.

## What hurts the first impression today

1. **The best features are hidden.** The `⋯` menu holds 11 items, including Demo controls (sending simulated HIS/LIS events), Shift monitoring, Care routines, Activity and Unit workload. An evaluator will not find them.
2. **The first screen is mostly empty.** "Explore the clinic" lands on a "Create workspace" card. The worklist has only 3 near-identical encounters (all DKA, all "confirm specimen receipt").
3. **Records look dead.** On `/clinic/patients`, 9 of 10 patients show "None".
4. **The pipeline is hard to read.** It opens at 53% zoom with tiny text.
5. **Leftovers from earlier pivots** sit next to the current product: the "Result closure" nav item and legacy routes (`/clinic/results`, `/clinic/line`, `/clinic/replay`, `/showcase`).
6. **Small inconsistency.** The header persona says "Dr Mira Rao" while the sidebar account says "Dr Meera Nair (synthetic)".
7. **Nothing explains the build to the technician.** There is no architecture view, live status, or audit and security story in the product itself.

## Recommendation

An interactive guide is the right centrepiece, but a tour that only points at buttons will not impress doctors. Build a **scenario-driven guided demo**: short role tracks where the evaluator *does* the action and watches the system respond. For example: approve monitoring → send the simulated lab receipt → the task closes with source evidence. Back it with a library of realistic cases and an "Under the hood" page for the technician.

## Phase 0 — Branch and deploy safety

- Work only on `dev`. Keep migrations additive so the code on `main` still runs against the same database.
- Before the first deploy, record the current rollback points: Azure `glucoflow-service--cross-team-fixes`, `glucoflow-worker--cross-team-fixes`, and the current Vercel production deployment.
- Test every release on a Vercel preview URL first. For Azure, deploy a new revision via `scripts/deploy-care-azure.py` with a `dev-*` suffix, run the hosted smoke immediately, and roll back on any failure.
- The rollback commands are documented in `app/docs/CARE_SETUP.md`.

## Phase 1 — Fixes from the 14 Nov audit

- Fix the flaky guide test (stub `timeoutMs`).
- Add the `LC_ALL` setup step to `docs/SETUP.md` and refresh the stale docs (Railway mention, test counts).
- Make the persona name consistent.
- Remove legacy nav and routes from the evaluator path (redirect, do not delete data).
- Open the pipeline at a readable fit-to-width size.
- Split the client bundle (1 MB main chunk) so mobile loads faster.

## Phase 2 — First impression

- Landing offers three clear doors:
  - **Take the 3-minute guided tour** (primary)
  - **Explore freely as Doctor / Nurse / Lab**
  - **Patient view**
- Add one honest line on what is real (the app, database, authorization and audit) versus simulated (hospital feeds, patients).
- Entering the clinic opens a ready, rich workspace automatically. No empty "Create workspace" step.

## Phase 3 — Guided tour engine and tracks

- Build a lightweight spotlight/coach-mark component in the existing design system. It targets `data-tour` anchors and supports step progress, skip, resume, keyboard and screen readers, mobile layout and reduced motion. "Try it" steps advance only when the evaluator performs the real action.
- Tracks, about 2–3 minutes each:
  - **A. Doctor: "Night shift on the DKA unit."** Care desk → ask Gluco → open evidence → pipeline → approve shift monitoring → simulate the lab result → the task closes with its source → edit the handover → named receipt.
  - **B. Nurse and lab.** My Shift, specimen collection, lab queue. Covers soft acknowledgement versus source completion, and a corrected result reopening work.
  - **C. Technician: under the hood.** Switch role → a forbidden action is refused server-side → audit trail → workspace history → Care routine version and rollback → architecture page.
  - **D. Patient.** Add a sample report → clinic review → approved value appears on the progression chart.

## Phase 4 — Real-world scenario library

Offer a scenario picker when creating a workspace. Each scenario has a setting, teams, timed source events, owners and one realistic "twist". All scenarios are operational coordination only: no treatment content.

1. DKA in ICU: ketone result awaiting clinician acknowledgement (existing).
2. HHS in an elderly patient: renal-team handover and osmolality labs pending.
3. Ward hypoglycaemia: point-of-care reading recorded, doctor notification acknowledgement pending.
4. Perioperative insulin infusion: ICU → OT → ward transfer, receiving-team acceptance separate from bed movement.
5. Diabetic foot ulcer: wound swab culture and vascular/podiatry consult pending.
6. Haemolysed sample: lab rejection reopens the task and recollection is needed.
7. Out-of-hours critical result: night handover with a named receipt.
8. Discharge transition: HbA1c pending, educator session, appointment-message preview.
9. Steroid-induced hyperglycaemia on an oncology ward: cross-department consult tracking.
10. Gestational diabetes: OGTT result chasing between obstetrics and endocrinology.

Also:
- Add a visible **Hospital feed** dock with a "Send next event" button that advances the simulated clock. It replaces Demo controls being buried in `⋯`.
- Seed longitudinal records (HbA1c, eGFR, lipids, BP over 12–24 months) for 6–8 synthetic outpatients so Records and Progression look alive.
- Ask the team's doctor partner to review scenario wording before release.

## Phase 5 — Under the hood page (technician)

A public `/how-it-works` page with:
- an architecture diagram (web → API → worker → runtime → Postgres)
- live health of the API, worker and runtime
- the authorization model, the audit trail and what is simulated
- actual measured test results with dates, linked to the evidence reports

## Phase 6 — Verify and release

- Playwright coverage for each tour track and the scenario picker on desktop and mobile (390×844), since doctors may open the link on phones.
- Full suite, typecheck, build and `db:test`.
- Release order: Vercel preview → Azure revision → hosted smoke → Vercel production.
- Write a dated evidence report on `dev`. Open a PR `dev → main` for the later merge.

## Not in scope

Real emergency dispatch, ABDM or HIS integration, clinical risk scores, treatment suggestions, invented metrics, and claims of hospital validation.

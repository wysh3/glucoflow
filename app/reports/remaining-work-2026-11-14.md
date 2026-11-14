# Remaining work audit — 14 November 2026

Checkout: `main` at `9460864`, in sync with `origin/main` (public repo `wysh3/glucoflow`). Only untracked path: `deliverables/phase2-ready/video/` (two demo MP4s, ~25 MB, plus a script).

## Fresh results from this check

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm test` | **419 / 420 passed, 78 files**, 78.5 s. One failure: `apps/api/src/guide/conversation.test.ts` "uses Hermes to resolve a natural question…" got `local` instead of `live`. It passed 3/3 when run alone. Cause: the stub provider uses `timeoutMs: 100` (line 24), which is too tight under full-suite load, so the planner falls back to local mode. This is a flaky test, not a product defect. |
| `pnpm build` | Pass (client, API, worker). Client main chunk is 1.05 MB (207 kB gzip); API bundle 1.1 MB. |
| `pnpm db:test` | 12/12 isolation and constraint checks passed |
| Migrations | 66 files (`001`–`067`), local DB up to date |
| Hosted web `glucoflow.vercel.app` | HTTP 200 |
| Hosted API `/api/v1/config` | HTTP 200 |
| Hosted browser walkthrough | Explore the clinic → Create workspace → Doctor care desk → asked "What is pending…": Gluco answered with 3 synthetic encounters (DEMO-101/102/103) and evidence links, in under ~28 s |
| Not run | Playwright e2e (206 cases), `lint:ui`, Android APK on any device |

Local setup note: on this Mac, `pnpm db:start` fails with "postmaster became multithreaded during startup" unless `LC_ALL=en_US.UTF-8` is exported. This belongs in `docs/SETUP.md`.

## What is done

The engineering MVP and the PDF-scope demo workflows are implemented and deployed: both roles on web, care desk/worklist/encounters/pipeline, source-evidence reconciliation, human approval, shift monitoring, nurse My Shift, lab queue, versioned handover with named receipt, Care routines with rollback, team/hospital role administration, speech (Sarvam), signed APK build (7 Nov), and Phase-2 submission decks plus demo videos.

## Remaining — code or repo work the team can do

1. **Fix the flaky guide test** by raising the stub `timeoutMs` in `conversation.test.ts`. About 15 minutes of work, so the suite goes green on every run.
2. **Clean the public repo for judges.** `deliverables/final/` still holds pre-pivot "Delta" and "Result Ledger" decks and videos. `deliverables/submission/` has 9 deck variants, and `deliverables/phase2-ready/` keeps superseded Final/Team/Timeline copies next to `7BUKY8`. Archive or remove these so only the current submission is visible. Decide whether to commit the untracked demo videos or link them instead (25 MB of binaries in git).
3. **Run one clean full Playwright e2e pass.** The last browser evidence was aggregated across reruns, not a single clean invocation.
4. **Android physical-device pass (R01, R16).** Install `deliverables/Glucoflow_Care_2026-11-07.apk` on a real phone and walk both roles: camera capture, multi-image order, back/keyboard, source opening, exports and session recovery. This is the most-repeated open gate in every report, and a team member's phone is enough.
5. **Durable, paginated care history.** The 90-day simulation hit hard caps of 8 handover drafts and 12 monitors per workspace, and 12 soft acknowledgements per task. This is the largest remaining engineering item before any sustained use.
6. **Phone OTP.** It is in the original spec and was never implemented (no SMS provider). Implement it or formally drop it from `docs/mvp/01-product.md`.
7. **Live extraction model accuracy.** It has never been measured against a real model. Unfamiliar-layout complete-field accuracy is 0.24 on the external corpus. This needs a funded key, a spend cap and a fresh holdout.
8. **Smaller items:**
   - Client code-splitting (1 MB main chunk).
   - Document the `LC_ALL` setup step.
   - Stale docs: `COMPLETION_PLAN.md` still names Railway, and the README says 419 tests where the suite now has 420.
   - Possible persona confusion: the header shows "Dr Mira Rao" while the sidebar shows "Dr Meera Nair (synthetic)".

## Remaining — needs people or institutions, not code

- Measured staff task time with real users, first and return visits separated (R18).
- Hospital partner, real staff accounts and a 60–90 day shadow-mode pilot.
- Privacy, security and legal review, plus a retention agreement, before any real data.
- Real HIS/LIS connectors and an ABDM sandbox (both currently simulated or unconnected by design).
- Reviewed regional-language wording and speech accuracy.
- Decks: the doctor's speciality and public-sharing consent were never supplied.

## Blueprint coverage (from `pdf-compliance-audit-2026-11-07.md`)

Of 25 rows: 4 Implemented, 18 Partial, 2 Not implemented, 1 Roadmap. Most "Partial" rows are partial because their remaining piece is a real-hospital element (connectors, pilot, assignment-level access, staff validation), not a missing demo feature. The 7 Nov final-four section closes the missing demo workflows.

# Local completion evidence — 3 October 2026

This report supersedes the takeover counts for the current local pass. No deployment, paid model call or physical-phone installation was performed.

## Verified commands

| Check | Result | Raw output |
|---|---|---|
| `pnpm typecheck` | both projects pass | [types](raw/local-fixes-types-2026-10-03.txt) |
| `pnpm test` | 120 passing tests across 18 files | [tests](raw/local-fixes-tests-2026-10-03.txt) |
| `pnpm db:test` | 12 passing policy/constraint checks | [policies](raw/local-fixes-policies-2026-10-03.txt) |
| `pnpm smoke` | 25/25 | [smoke](raw/local-fixes-smoke-2026-10-03.txt) |
| `pnpm e2e` | 56 passed, no failures or skips, desktop and 390 px | [browser](raw/local-fixes-e2e-2026-10-03.txt), [JSON](playwright-report.json) |
| `pnpm build` | client, API and worker bundles build | [build](raw/local-fixes-build-2026-10-03.txt) |
| `pnpm verify:built-worker` | one captured stub call and one draft fact; correct prompt/evidence/token/image wiring | [worker](raw/local-fixes-built-worker-2026-10-03.txt) |
| `pnpm evaluate:live-rehearsal --limit` | evaluation protocol works against a labelled stub; no accuracy claim | [rehearsal](raw/local-fixes-live-rehearsal-2026-10-03.txt) |
| `pnpm android:apk` | signed release APK built | [Android](raw/local-fixes-android-2026-10-03.txt) |

APK SHA-256: `37f40d0e8f0db0b49f84aa9eca4bd63240fb60d372da3f3248bfc425838dcd05`. This build was not installed or driven on a physical device in this pass.

## What the regressions establish

- API-role patient reads show approved state for both patient and clinic uploads, while review/staff metadata stays private and another clinic is refused.
- Real OCR processes both images of an ordered batch; a second-page conflicting patient identifier quarantines it. Original source page 2 resolves to image 2. Both browser sizes navigate from photo A to photo B in review.
- Independent pagination retains over 100 observations, 120 context events and 120 notes, and scopes dated notes correctly. Client assembly refuses repeating cursors and changed publication revisions. Date-range filtering passes in both browsers.
- Review corrections update numeric/unit/date normalization and clear obsolete values instead of leaving the old chart value. Intentional JSON nulls remain null.
- Database provider reservations serialize competing calls and refuse cumulative dollar/token overspend. Actual input/output usage is separate and reconciliation is idempotent; unknown usage retains its reservation. The evaluation ledger applies `MAX_RUN_COST_USD` across documents.
- Historical-fact reads are actor scoped and exclude unreleased sources for a patient. Patient summary export, prescription source access, published-correction entry points, account navigation and patient approval status all pass browser checks.
- The app packages local English OCR data. Native external-source opening uses the Capacitor Browser plugin. Rate-limit/oversized-body errors remain 429/413.

The built-worker check was rerun with the development workers stopped after an initial run was taken by a competing fixture worker. The successful capture is a wiring test against a stub, not live-model accuracy.

## Visual inspection

Desktop progression puts prescription/examination/note context beside the graph. Mobile documents use cards, with report names, states and actions together. The typography uses Inter Variable and the controls use the existing shadcn/Radix primitives and Lucide Animated icons. The direction follows [Apple's hierarchy and control guidance](https://developer.apple.com/design/human-interface-guidelines/buttons).

[Doctor overview](evidence/local-fixes/doctor-progression.png) · [Mobile documents](evidence/local-fixes/mobile-documents.png).

## Extraction baseline and remaining gates

Fresh unfamiliar-layout synthetic regression: complete-field accuracy **0.24**, precision **0.875**, recall **0.56**, identity state accuracy **0.3333**, event-date exact **0.8571**. [Captured evaluation](raw/local-fixes-extraction-2026-10-03.txt). The examined corpus is regression data; it cannot support a fresh holdout claim after tuning.

Live model accuracy, actual model cost/latency, human correction rate, hosted Auth/Storage, container image execution, the latest emulator/physical-device walkthrough, phone OTP, productivity timing and clinical outcomes remain unverified or absent. Supabase session lifecycle and production CSP changes are locally compiled preparations. Amendment entry points and database revision rules exist; the complete amendment publication browser walkthrough remains a follow-up gate. Recovery finishes upload bytes already stored on the server; missing bytes need file reselection.

The local demo tenant contains extra synthetic reports and notes from smoke/browser checks. It was not reset or purged. The deck and submission were not refreshed in this local application pass.

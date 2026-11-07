# Synthetic cross-team application verification — 7 November 2026

## Scope

Per the user's clarification, HIS/LIS are simulated source systems. The application, database, authorization, browser interactions, background reconciliation and audit writes are exercised for real with entirely fictional records. No independently operated HIS/LIS or ABHA/ABDM connection is claimed. ABDM remains unconnected; this report does not imply an ABDM mock flow exists.

## Reproduced defects and repairs

1. PostgreSQL JSONB changes object key ordering. Comparing monitor item arrays by JSON.stringify treated unchanged checks as changes, advanced workspace revisions on replay/read, and caused avoidable stale-revision conflicts. Reconciliation now reuses unchanged items and compares identity/length.
2. A worker batch timestamp captured before a newly committed event could reconcile backward and undo a newer confirmation. The worker now skips state updated after its batch timestamp and checks it on the next tick.
3. A patient could click Ask Gluco before its lazy-loaded listener mounted. A page-scoped pending open request now survives initialization. A delayed-module browser regression failed before the fix and passed after it on both viewports.
4. Browser authentication helpers waited for departure from /sign-in even though that route aliases /. They now wait for authenticated controls; sign-out waits for the public sign-in controls. This repairs test synchronization rather than concealing product failures.

## Measured application evidence

- Full Vitest run: **420 tests, 78 files passed**, 14.50 seconds.
- Focused authenticated API/PostgreSQL chain and related tests: **22 tests passed**. Admission/coordinator, nurse, lab, doctor and administrator identities exercised source progression, soft acknowledgement without completion, corrected results reopening work, re-acknowledgement, and audit attribution.
- Concurrent acknowledgement: one success and one stale-revision response; same-key replay does not advance revision.
- Another hospital's actor received 404; revoked access received 403.
- Independent managed-hospital browser chain: **2 passed**, desktop/mobile, 29.9 seconds. Four separate authenticated browser contexts used the actual simulator UI for collection → receipt → validation → acknowledgement; the doctor edited/shared a handover and the named nurse received it. Wrong-role and wrong-recipient actions were refused. Test setup issued local tokens; it did not exercise identity-provider sign-in or staff provisioning.
- Navigation/security browser audit: **16 passed**, desktop/mobile, 49.7 seconds. Account isolation, simulator evidence, safe retry and responsive navigation are covered.

## Limits

These are synthetic automated scenarios, not real staff feedback or hospital clinical validation. Browser coverage is aggregated across the initial run and focused reruns, not represented as one clean full-suite invocation. All **206 currently listed project/test combinations** are accounted for: **204 distinct passing cases and two desktop-only mobile skips**. The manifest is `cross-team-browser-coverage-2026-11-07.json`. The guide agent's 18-case run was console-only; its exact case list is in `guide-browser-coverage-2026-11-07.md`.

Earlier runs exposed obsolete labels/routes, shared-output-directory collisions, and one patient-note test failure during overlapping seeded runs; its unchanged behavioral test passed on both viewports in the isolated-output rerun. One mobile test title was edited after discovery and therefore failed with “Test not found”; the final title passed in a focused rerun. These are reported rather than presented as first-run passes. Landing assertions now require primary actions above the fold on mobile; supporting public-page content may scroll vertically. Desktop still checks the full panel fits; both check horizontal overflow. No new live language-model, Sarvam, video-provider, Android-device or external health-system validation is implied. Previous persistent 90-day history limits remain documented in terra-longitudinal-2026-11-07.md.


## Final verification and release

- Historical care/canvas/episode flows: 22 passed, two desktop-only mobile skips, 1.6 minutes.
- Guide, landing and localization: 18 passed, 43.9 seconds, including delayed guide initialization and clearing patient-scoped drafts/turns.
- Speech: 10 passed, 42.3 seconds. Synthetic browser-generated microphone audio traversed MediaRecorder and 16 kHz mono PCM encoding; Sarvam responses were mocked. Native browser playback, stop-on-navigation, cancellation and permission-denied typed fallback passed.
- Session flows: 14 passed, 55.2 seconds.
- Final upload-to-review-to-approved-patient-record chain: 2 passed, 33.3 seconds.
- TypeScript and git diff whitespace checks passed.
- Hosted deterministic care smoke passed authorization/isolation, idempotent retry, source-backed completion and approved routine reuse. PDF-demo hosted smoke initially returned HTTP 409; two subsequent runs passed. Its original cause was not established. Added safe command/action/error-code diagnostics; no retry was added to hide failures.
- Direct deployed browser check: signed out, entered Patient view and opened the record guide successfully.

Deployment: Vercel `glucoflow-bdcs8f5pu-wyshs-projects.vercel.app` READY and aliased to https://glucoflow.vercel.app. Azure API and worker revisions `cross-team-fixes` READY. API digest `sha256:873fbea1e68a6025b79b1e83e8958c3c489828cc3c0732ad452cb7d0b2a1797a`; worker digest `sha256:866525cc8fdaaf5a52549f93574eb28fecce31390a5a9630e3d610cdb2c987a9`. Existing pinned agent runtime retained. Initial container packaging failed locally on a PostgreSQL socket; build context was replaced with tracked allowlisted files. Worker staging initially omitted scripts; corrected build succeeded. No local credentials were included in staged builds.

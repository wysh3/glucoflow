# Clinic workspace and Gluco guide — 4 October 2026

Delivered a centered compact SaaS-style landing, aligned primary role cards, in-app Radix menus, a source-backed doctor overview and contextual patient sidebar. The original lightweight mint orb opens a keyboard-operable guide throughout the app. Existing synthetic PDF samples remain available in the normal upload/review/publish flow.

## Measured verification

| Check | Result |
| --- | --- |
| TypeScript | Node and web projects passed |
| Unit/integration | 157 passed across 27 files |
| Full browser suite | 78 desktop/mobile Chromium checks passed |
| Final focused browser suite | 10 passed, including viewport bounds and implicit screening-menu option values |
| SQL | 12 isolation/constraint checks passed |
| Production build | Client, API and worker passed |
| Android | Current hosted release built; v2 signature verified |
| Public artifact scan | Model key, storage service key and database password absent from web assets and decompressed APK |

The full suite exercised upload → review → approval, exports, sources, notes, access boundaries, samples and snapshots. Final focused checks followed the production positioning correction and implicit-option value correction; these changed only shared client controls/layout. Browser automation uses the labelled local fixture provider, not a live model. Reports are `playwright-report.json` (full run) and `workspace-browser-report.json` (final focused run).

## Guide boundary

Live GPT-6 Luna classifies one topic; only fixed server-owned app guidance and permitted action IDs are returned. The endpoint derives role from verified current membership and rejects client role/patient claims. Tests cover arbitrary provider prose, malicious URLs, extra JSON keys, clinical refusal, invalid input, authorization, actor throttling, hourly budgets, concurrency, timeout and honest local fallback. No patient records are queried or attached to model messages. No chat is persisted by Glucoflow; provider retention depends on its configuration. See `docs/APP_GUIDE.md`.

A hosted app-help question returned the live GPT-6 Luna label; a synthetic insulin-dose question received the fixed clinical refusal. Role switching clears the conversation. Landing, doctor overview, source access and mobile guide were inspected in the in-app browser. Production CSS minification exposed independent translate properties left by centered-dialog utilities; a separate floating-dialog variant removed the conflict. Viewport-boundary assertions now cover both browser sizes. The screening menu also retains native option-text values when an option has no explicit value.

## Delivery and cleanup

- Frontend: https://glucoflow.vercel.app
- API: https://glucoflow-service.lemonpebble-6e1c6c4b.centralindia.azurecontainerapps.io — ready revision `glucoflow-service--0000002`, image `glucoflow-api:20261004-guide`, digest `sha256:c1bf5abc43eab7cefdbbc73b47f758eb41f01da685ca7f48527b0d72d04dcd14`.
- Worker extraction code is unchanged; deployed `20261004-polish4` remains active. No new database migration was needed.
- Signed APK: `deliverables/Glucoflow_Android.apk`, SHA-256 `44f46a6f4180dd5366c7e96a39d3535298852714a6e1f5cfb11749001e00756d`.
- Public repository: https://github.com/wysh3/glucoflow — main.
- GitHub CI moved from the inactive nested app/.github location to repository-root .github/workflows, with app working directory and lockfile cache path. README, walkthrough, env example and guide operations updated. Historical evidence and unrelated user decks preserved.

## Practical limits

Physical-device camera/session/export behavior has not been independently tested. Large frontend chunk warning remains; the orb introduces no WebGL or new runtime dependency. Clinical/productivity validation, phone OTP and live ABHA remain absent. The existing local migration ledger has a historical 014 checksum mismatch; it was not reset or rewritten. API model limits are per process, appropriate to the current single replica. The guide does not execute mutations or approve facts. Very short screens or larger accessibility text may require scrolling to keep controls reachable.

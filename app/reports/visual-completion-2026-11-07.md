# Visual and interaction completion pass — 7 November 2026

## Implemented

- Home uses the same bounded canvas as conversation: cards scroll in the reading area while the composer remains visible. Mobile overview uses two compact status cards followed by full-width evidence cards; suggestions scroll horizontally instead of consuming multiple input-height rows.
- Browser visual viewport height drives the mobile shell when the keyboard resizes it. Pinch zoom remains available. The bottom navigation hides when a keyboard-sized viewport reduction is detected.
- Record tools now expose their one destination directly. Chat suggestions use an explicit accessible show/hide button instead of a disclosure marker.
- Tightened composer control spacing, retained touch-size send/stop actions, improved small evidence text, and removed invalid nested time elements in recent events.
- Stop reply aborts the current chat request. The existing submission path restores the draft, no automatic retry occurs, and stopped requests do not trigger a misleading runtime health check. Unmount aborts the current request.
- API client rejects late response bodies after caller cancellation. A regression test first reproduced a resolved stale response, then passed with cancellation enforcement.
- Workspace history is available from the workspace menu. It includes paginated revisions, origin/date, read-only task ownership and source evidence, loading/empty/error/retry states, and an explicit baseline-history limitation. It never restores state.
- Existing neutral orb with small cap, gaze tracking and reduced-motion support retained. Existing shared dialog header close placement and collapsed icon rail retained.

## Fresh checks

- Web TypeScript check passed.
- Browser request tests: 5/5 passed, including timeout, no retry, cancellation, late cancelled response and unreadable gateway errors.
- Client production build passed. Existing warning remains: main bundle exceeds 1,200 kB minified; this is not a measured loading-performance result.

## Browser/device acceptance still required by integration owner

- Desktop and 390px: home → conversation → worklist → encounter → records → account; composer visible and no horizontal page overflow.
- New chat/source/task/history dialogs: close button top right, keyboard Escape and focus return.
- History endpoints against current deployed migration, authorization refusal and pagination.
- Live Stop request through API and Hermes process, immediate controls recovery and preserved input.
- Physical Android keyboard, voice recording/read-aloud and back-navigation. VisualViewport emulation is not physical-device evidence.

No new deployment or browser screenshots were produced by this subtask. Root owns integrated browser verification and deployment.

## Follow-up: team access and route loading

- Added read-only Workspace team dialog, showing server-verified assigned role, active member roles and dates without exposing raw account UUIDs. No enrollment UI or grant-by-UUID control was added.
- Team access is queried per actor/workspace. Role switching fails closed until access is verified, and shared workspaces disable simulation switching. Existing server authorization remains authoritative.
- Saved workspace discovery copy includes assigned workspaces; the existing authorized list endpoint supplies them.
- Converted eagerly imported records, account, verification and optional guide modules into route-level lazy imports. Kept the protected shell mounted with a content-area loading state; optional guide has its own Suspense boundary.
- Measured build before: main JS 1,398.56 kB / 305.28 kB gzip. After route splitting: 1,059.90 kB / 212.10 kB gzip (24.2% / 30.5% reduction). No warning threshold increase. The >1,200 kB chunk warning is gone. A Capacitor static/dynamic import notice remains; it does not imply a build failure.
- Fresh web typecheck and 5/5 browser request tests passed after follow-up. Client build passed. These measurements are bundle sizes, not real-user latency or Core Web Vitals.
- Integration acceptance now also includes shared-member navigation, assigned-role display, role-switch refusal and private workspace defaults.

## Follow-up: safe simulation continuation

- Owner-only menu action opens an explicit confirmation before archiving a settled simulation and starting a separate three-record fictional demo. The copy explicitly distinguishes this from hospital intake or patient-care continuity.
- The request sends the expected revision; server settlement and ownership checks remain authoritative. Failure keeps the existing workspace and surfaces the error; success activates the returned workspace and refreshes discovery.
- Archived workspaces render a dedicated read-only view with recorded tasks, saved messages and clickable source evidence. Composer/task/encounter mutation components are not mounted. History, team access and export remain available.
- The client command/chat runner independently refuses archived writes. This complements, not replaces, server enforcement.
- Web typecheck and client build passed after this change. Browser continuation success and pending-work refusal remain integration checks.

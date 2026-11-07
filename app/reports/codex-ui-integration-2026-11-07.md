# Codex UI integration

7 November 2026. The user asked to use the actual referenced Codex UI around GlucoFlow, explicitly correcting an initial plan to create a similar custom canvas. The custom shell attempt was stopped and restored. The shipped approach uses the published upstream UI presentation, adapted into the existing React application.

## What was reused

The linked `friuns2/codex-web-ui` repository is a launcher that patches an installed desktop Codex bundle. Its advertised successor repository currently returns HTTP 404, but the publisher's npm release `@brutalstrikedevs/codexapp@0.1.91` includes the web assets and an MIT license. The tarball's registry SHA-512 integrity and asset hashes were checked. The upstream compiled Vue entry mounts its own application, registers a service worker and connects to Codex app-server. The reusable presentation was therefore ported to React with its original scoped CSS rather than mounting that application inside GlucoFlow.

The reused components include DesktopLayout, ContentHeader, SidebarThreadControls, SidebarMenuRow, ThreadConversation and ThreadComposer. The original CSS rules and an attributed React port of their rendered structure are in `apps/client/src/vendor/codexapp`. This is an adapted UI layer, not an unmodified Vue application or a replacement backend. GlucoFlow still owns identity, patient authorization, data storage, workflows, approvals and Hermes execution. No Codex desktop patcher, coding terminal, command runner, tunnel launcher or upstream service worker is included.

[Shell provenance](../apps/client/src/vendor/codexapp/README.md) · [Conversation provenance](../apps/client/src/vendor/codexapp/CONVERSATION.md) · [Distributed MIT notice](../apps/client/public/third-party/codexapp-LICENSE.txt) · [Asset hashes](../apps/client/public/third-party/codexapp-provenance.json)

A static REA package analysis completed successfully with evidence ID `ev_5c44702635e2b6fc29db3348cc3dd22877a6792da88628507b06b6ddfdbd1e86`. No upstream launcher was executed. Open WebUI was also inspected; it is a separate Svelte/Python product and its current license has branding conditions. No Open WebUI source is included in this release.

## Navigation and interaction

- Public entry, account selection and authenticated screens use the shared upstream shell. Public entry remains visible while the session connects instead of showing only a full-page loader.
- Desktop sidebar supports persistent collapse and a 260–620 px resizing range, bounded by available width. Keyboard resizing and focus restoration are included. Mobile uses an accessible drawer with escape/back handling; existing direct mobile role navigation remains available.
- Care keeps conversation state mounted while a worklist, activity, team or learning panel opens. Split mode depends on at least 900 px of actual available Care width, including changes from sidebar resizing. Narrow layouts expose Back to conversation.
- The original composer presentation sits at the bottom of its pane. Messages and working content scroll independently. Source evidence and approval dialogs preserve the existing APIs and permissions.
- Workspace creation remains explicit. Saved workspaces, simulation controls, live/deterministic mode and human approval remain labelled. The simulator expands a bounded dock so it cannot cover task controls.
- Hiding a conversation stops/removes its read-aloud UI and aborts pending speech operations. Draft text and message history remain. No speech or chat request is sent merely by changing navigation.

## Verification

Initial integrated checks passed all 38 focused desktop/mobile cases. Visual inspection then identified cramped actions at tablet widths and a sidebar-resize edge. Container-aware toolbar and split rules now handle those widths; the full suite includes the resize regression. A final review also required stopping read-aloud when its controls become hidden.

Fresh TypeScript, 276 application tests and production builds passed. Browser and hosted delivery results are recorded below. These navigation checks use fixtures and explicitly selected deterministic mode, not paid-provider quality evaluations. No new Android APK or physical-device claim is made.

## Hosted delivery

The Vercel alias was updated to `dpl_DnwA3XF95pR4kRmsMvfhKkcWmvok` with main asset `index-DMhVT1KR.js`. Azure, migrations, authentication, uploaded records, worker processing and speech caps were not changed by this release. Static checks confirmed the published license/provenance and expected content/security headers. [Deployment and rollback](codex-ui-deployment-2026-11-07.md).

Authenticated hosted browser checks passed at 1440×900 and 390×844: public entry, clinic workspace creation, adjacent/mobile work panel, preserved unsent draft, sidebar collapse/expand, mobile drawer dismissal, no page errors or horizontal overflow. These checks made zero chat or speech POSTs. [Measured hosted results](canvas-hosted-browser-2026-11-07.json).

The added mocked audio regression played a silent MP3, navigated to the narrow worklist and confirmed the original audio paused. It passed in 6.2 seconds. Its first invocation finished its UI assertions but failed on trace cleanup because two test runners shared the same artifact directory; an isolated output directory resolved the harness collision. No provider call was involved.

## Final browser run and corrections

The full run completed in 10.7 minutes: 180 passed, 3 failed, 1 intentionally skipped (the desktop-only sidebar resize case on mobile). Two failures were stale public-navigation tests that searched for links without opening the new mobile drawer. Both tests now follow the visible drawer interaction. The third failure was `ENOENT` during desktop session trace cleanup, from the shared test-artifact directory collision described above; it was not a failed sign-in assertion. Focused rerun results are recorded below.

A repeated hosted screenshot run timed out waiting for session initialization to enable the demo button. A subsequent instrumented run received configuration HTTP 200 on both viewports and passed every check with zero page exceptions and zero chat/speech POSTs. The delay did not reproduce and its root cause is unconfirmed; this report does not imply uninterrupted service availability. Final desktop/mobile screenshots are in `reports/evidence/canvas-2026-11-07/`.

The focused rerun passed all 6 desktop/mobile cases in 17.6 seconds. Across the full run and focused corrections, all 183 applicable original browser cases have passing evidence; the separately added hidden-audio regression also passed. One desktop-only case is intentionally skipped on mobile. No product changes were needed after deployment; the corrections update test navigation and isolate runner artifacts.

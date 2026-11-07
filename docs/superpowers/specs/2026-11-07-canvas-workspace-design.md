# Continuous care workspace

The user's Codex screenshot and Open WebUI/Codex Web UI references establish a continuous application canvas: persistent navigation, central conversation, and adjacent working content. This changes navigation/layout, retaining the existing assistive scope, source evidence, human approvals, actor isolation and synthetic-only boundaries. Light mode remains the active visual contract; copying unrelated desktop platform chrome is unnecessary.

## Approach

Use the existing React client, authenticated API and Hermes runtime. A full Open WebUI fork introduces another Svelte/Python application and replaces established domain authorization. A cosmetic reskin leaves the repeated navigation and lost conversational context. The selected implementation approach is an original workspace composition over existing components, using referenced projects for interaction patterns and compatible licensed code only when it materially helps. The user has standing direct-implementation authorization; no extra approval gate is imposed.

## Structure

- Public home remains a clear entry into the synthetic clinic or patient account flow, with a preview explaining conversation beside source-backed work.
- One application sidebar contains existing authorized destinations. Desktop collapse preserves accessible labelled navigation; mobile uses a navigation drawer and reachable destinations.
- Main area is a bounded canvas. Record/approval pages scroll within it, preserving current URLs, patient identity and back navigation.
- Care conversation stays mounted while worklist, activity, teams or learning opens alongside it on wide screens. On narrow screens, the working panel has an explicit return to conversation; draft text survives switching.
- Conversation scrolls independently, composer remains reachable at the bottom, and contextual source/task/approval dialogs retain their current authorization and focus behavior.
- Workspace creation remains explicit. Saved workspaces, mode selection, human approvals, simulator controls and honest synthetic labels remain discoverable.

## Verification

Click through hosted landing/account/care/record/source paths. Test wide and narrow layouts, pane open/close, draft persistence, browser back/forward, sidebar collapse/drawer focus, selected patient, source dialogs, denial of unauthorized routes and empty/error states. No paid provider calls needed to verify navigation. Rebuild/deploy only after relevant checks and inspect the actual hosted result.

## User correction: use the actual UI

The user explicitly rejected a merely similar custom UI: “use that UI … wrap it around our thing.” The custom implementation was stopped and restored before replacement. The linked `friuns2/codex-web-ui` is a desktop patch launcher. Its declared successor `@brutalstrikedevs/codexapp` 0.1.91 is available on npm with an actual MIT LICENSE; its tarball integrity was verified against registry metadata. The implementation now vendors the actual upstream shell/conversation component styles and ports their rendered component structure into the existing React host. Existing GlucoFlow content replaces coding-specific slots; the Codex server, command runner, desktop patcher and tunnel are not shipped. This is an attributed UI adaptation, not an unmodified deployment of upstream Vue/Codex runtime. Preserve exact provenance and license alongside reused code.

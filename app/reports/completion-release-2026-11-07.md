# Gluco completion release — 7 November 2026

This is a release of the synthetic operational demo, not certification for real hospital use.

## Shipped engineering

- Compact responsive care desk with direct pending-task actions, persistent composer and icon rail. Close controls remain accessible; new-chat and archived-source dialogs were clicked through.
- Handover snapshots render as a short lead plus interactive per-encounter evidence and owners. The full source-bearing original remains explicitly available. Duplicate proposal bodies are no longer shown in structured handover replies.
- Enter sends; Shift+Enter inserts a line; input-method composition is protected. Gluco product branding and Care routines replace infrastructure jargon on ordinary surfaces. Provider selection is tucked into Chat options.
- Stop aborts the request, preserves its draft and rejects late responses. Hosted verification initially found the reused Send/Stop button did not invoke cancellation; distinct keyed controls passed subsequent browser checks. A separate regression now ensures callers are released even when transport ignores abort.
- Real server lifecycle stages use an authenticated NDJSON response. Only allowlisted progress stages are exposed, never hidden reasoning, prompts or tool payloads. Interrupted streams fail honestly.
- Source-bearing durable revision history, owner-controlled same-clinic team permissions and actor audit, safe read-only archival/linked fresh simulation, immutable versioned operational routine artifacts and approval-bound evaluations.
- Six additive migrations 055–060 applied transactionally to the hosted database. Private workspaces remain private unless explicitly assigned.
- Pinned upstream runtime source is included as a verified local archive with license and provenance. Docker no longer clones upstream. Normal package dependencies and configured model/speech APIs still require network services.

## Verification

- Full Node/database suite: **64 files, 357 tests passed**, 15.98s at 20:16 IST; see `completion-suite-2026-11-07.txt`.
- Typechecks and production client build passed. Focused rendering tests verify handover condensation, owners and evidence, alongside keyboard and request-stream tests.
- Lintapple: zero reported issues on the initial landing page at 390×844 and 1440×900. This is not an all-authenticated-screens score.
- Browser: desktop and 390×844 composer; icon-only navigation; new-chat cancel; revision history; workspace team explanation; archive refuses unfinished tasks, accepts explicitly cancelled tasks, and retains read-only source evidence; hosted concise handovers; Enter/send/Stop restores input.
- Live hosted pre-stream measurement: **13,983ms** for one synthetic operational query using the live runtime. This is a single observation, not a p95 or a promise of instant completion.
- Normal successful read/respond loop now stops after the terminal response tool (two model calls rather than a discarded third acknowledgement). The request remains bounded; no canned response bypass was substituted.
- Pinned upstream defaults use an Anthropic model and medium reasoning. Gluco config is explicit. Tracing found that disabled chat reasoning alone did not guarantee a custom-provider wire parameter; configured GPT-6 Luna chat now explicitly sends `reasoning_effort: none`, verified at the wire. This does not change extraction's separate low-reasoning configuration.

- Final hosted streaming sample: first authorized progress at **339ms**, runtime starting at 852ms, provider boundary at 4,835ms, source read at 7,714ms, final saved handover at **9,626ms**. One synthetic sample, not a controlled benchmark or p95. See `gluco-hosted-progress-2026-11-07.json`. Browser also displayed actual preparation progress and opened the final handover's cited source dialog.
- Native runtime: 34 tests passed; four source packaging tests passed separately. Test-container mount failures and earlier cancellation-test assumptions are documented, not hidden.

## Detailed evidence

- `chat-reliability-2026-11-07.md`
- `gluco-progress-2026-11-07.md`
- `gluco-chat-polish-2026-11-07.md`
- `care-durable-history-2026-11-07.md`
- `team-authorization-2026-11-07.md`
- `skill-artifact-hardening-2026-11-07.md`
- `completion-evidence/`

## Limits and outstanding gates

Care routines currently support governed operational templates; they are not unrestricted autonomous skill generation or clinical self-modification. Simulations do not establish real patient outcomes, revenue or a 60–90 day pilot. Live hospital connectors, normalized continuous encounter storage, sustained live-provider capacity/cost validation, complete final patient/Android device regression, reviewed regional-language field accuracy, and hospital privacy/security/governance remain open in `../docs/SHIP_CHECKLIST.md`. ABDM is not registered or integrated. Keep public use synthetic.

## Release identifiers

- Azure API: `glucoflow-service--gluco-progress` ready.
- Azure worker: `glucoflow-worker--gluco-progress` ready.
- API image: `sha256:dffa7855aa6e77609611bd02cfd4c9739c1747e7c12dd89cdf39c5771b5eeec6`.
- Runtime image: `sha256:9dd24be6716466c77e12985c37d7b9ead5ce0e784993bb171cb72453e4059cfb`.
- Worker image: `sha256:505f62ed63df6744637636eb31170c0803b888fd7c3c860473d42ab8d6862be7`.
- Vercel Gluco chat release: `dpl_BmUQ48HTgosk62CHtwVbEWM7LBWK` ready at https://glucoflow.vercel.app. A subsequent landing-only release is tracked separately below.
- GitHub source push pending final landing work and outgoing-source scan.

## Final landing and documentation release

Vercel `dpl_6RJujvuYb1MYjypPAUQoYchrVVdE` is READY. New original generated artwork replaces the blueprint crop; a 32 KB WebP is served. Warm ivory/peach, sea-glass controls and dark teal copy form the landing palette. Removed landing language selector, enlarged orb cap, added bounded faster gaze and gentle hover motion with reduced-motion support.

Typecheck and deployment client build passed. Final lintapple: zero findings at 390×844 and 1440×900. The first palette pass found insufficient secondary-text contrast; the final color was darkened and rechecked. Hosted clinic entry, patient entry and additional role disclosure were exercised; patient entry reached `/patient/records`. This is not a complete new patient workflow regression. Final desktop/mobile screenshots are in `completion-evidence/gluco-landing-*.png`. Root/application READMEs were rewritten around current product behavior and deployment limits.

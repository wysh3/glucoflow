# Removal and interface restraint implementation plan

> Execute directly in the existing checkout under the user's standing implementation authorization. Preserve unrelated changes.

**Goal:** Remove obsolete product surfaces and ornamental UI while retaining the documented doctor and patient journeys.
**Architecture:** Keep React/Capacitor, API, durable worker and native Hermes. Remove frontend code only after tracing references. Retain persisted data, migrations and server audit history.
**Spec:** docs/mvp/01-product.md, docs/mvp/02-screens-and-design.md, and the user's 7 November removal/HIG request.

## Decisions

Choose incremental removal over a rewrite or a visual reskin. Delta/body-map presentations duplicate approved record workflows and were already absent from navigation; remove their frontend implementations and redirect old URLs to the canonical overview. Keep backend delta records pending consumer review. Keep result closure, home readings, configured calendars, manual categories, demo SOS, operational learning and source approval because these are explicitly required capabilities. Simulation controls must remain honestly labelled; removing their labels would not make a production system.

Remove animated companion faces, page indices, decorative rings/hero shadows, redundant walkthrough links, duplicate role text and global background effects. Preserve a plainly labelled record assistant, clear loading/errors and source access. Keep familiar navigation and keyboard controls; do not imitate native Apple platform chrome.

## Tasks

- [x] Audit routes, shared components, active subsystems and production blockers; document keep/remove/defer decisions.
- [x] Remove obsolete Delta/body-map UI and orphan assets/styles; preserve compatible protected redirects.
- [x] Simplify shared headers, assistant presentation and landing/care ornamental surfaces; preserve context and meaningful status.
- [x] Add regression coverage for retired URLs and keyboard navigation. Adapt chat tests to functional state instead of mascot expressions.
- [x] Run typecheck, unit/integration tests, builds and focused both-viewport browser workflows. Inspect rendered screenshots and report measured results.

## Review focus

Old patient URLs must retain authentication and same-patient context. Patient routes must never expose clinic views. Chat must retain pending/error/retry/source behavior without animation timers. Mobile actions must remain at least 44px and not overflow. Required synthetic/fixture/source/approval states remain visible.

## References

Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
Navigation and search: https://developer.apple.com/design/human-interface-guidelines/navigation-and-search
Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
Official Markdown versions retrieved 7 November 2026. Apply clarity, consistent navigation, redundant text removal, keyboard access and reduced motion to this web product; this is not an Apple compliance certification.

Measured evidence, scope limits and hosted delivery: [verification report](../../../app/reports/removal-and-assistive-verification-2026-11-07.md). Required source/human-approval boundaries are retained; this checklist completes the removal pass, not every production or institutional dependency.

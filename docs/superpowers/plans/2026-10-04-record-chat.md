# Gluco conversation implementation plan

Spec: ../specs/2026-10-04-record-chat.md. Native execution as explicitly requested by the user and AGENTS.md; no delegation. User's preserved approval supersedes additional skill approval gates.

## Task 1: Authorized factual conversation
- [x] Write failing integration tests for new endpoint authentication, isolation and approved/reported record responses, plus planner grounding tests.
- [x] Add strict contract, bounded GPT-6 Luna retrieval planner and deterministic record rendering.
- [x] Use existing actor transaction, approved timeline and source records; deny unauthorized and reviewer-only requests.
- [x] Verify unit/integration tests and types.

## Task 2: Expressive chat interface
- [x] Write browser checks for patient follow-ups, clear chat, context reset, motion accessibility and mobile layout.
- [x] Build expressive orb states and revised chat with patient badge, evidence cards, follow-up suggestions, multiline composer and internal scrolling.
- [x] Verify desktop/mobile browser behavior and production layout.

## Task 3: Verify and publish
- [x] Self-review all changes (user prohibits delegation), run types/full tests/SQL/build/browser checks.
- [x] Update user documentation and measured report, preserve unrelated submission files.
- [x] Deploy API/frontend, rebuild signed APK and upload release asset, push public GitHub.
- [x] Check hosted doctor/patient synthetic conversations and evidence, record remaining limitations.

## Ledger
Pre-flight: Task 1 produces ChatAnswer/cards and strict request; Task 2 consumes them. Preserve old navigation endpoint for backwards compatibility. Task 3 builds both clients sequentially because their dist is shared.

Task 1: complete — strict actor/RLS context, bounded shared provider budget, approved-only facts and current reported entries; latest full Vitest pass 180/180, types pass.
Task 2: complete — expressive SVG/CSS orb and responsive record chat; full browser suite 88/88, final chat-focused suite 8/8. Reading-order refinements verified RED→GREEN.
Task 3: publication in progress — API/web deployed, matching signed APK built and scanned, repository/release publishing follows.
Final review: self-review; delegation was explicitly excluded by the user/workspace. Fixed same-day ambiguity, invalid dates, source span preference, pending question visibility and reply position through regression checks. No deferred code findings; physical-device verification remains a documented external limitation.

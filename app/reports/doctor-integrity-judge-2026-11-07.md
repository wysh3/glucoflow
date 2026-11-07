# Independent integrity review — simulated doctor perspective

7 November 2026. This is an AI-assisted source-code review, not a licensed clinician's evaluation, clinical validation, security certification, or observation of real hospital use. It reviewed the current working tree while implementation was ongoing; findings can be superseded by documented subsequent fixes.

## Verdict

The operational demonstration has a credible safety boundary: no autonomous diagnosis or prescribing, explicit synthetic encounters, distinct source events, and named responsibility. The new hospital role work addresses an important weakness. It is suitable for a **bounded synthetic demonstration after the remaining verification**, not a claim that the full master blueprint or a hospital production system is complete.

The episode transcription plot and the approved patient progression are two different data products. They must remain visibly different. A staff-entered reference string is not an accessible original report or a physician-verified measurement.

## Findings

### P1 — Episode transcription errors cannot be corrected or disputed

`app/apps/api/src/care/coordination.ts:94–105` accepts an observation and rejects a changed record with the same `sourceRef`. There is no superseding/correction/dispute transition in the episode record contract. `episode.tsx` plots all stored episode observations. A mistyped value therefore remains in the graph; entering the correction under a new reference creates two apparent measurements rather than a corrected version.

**Required before using these plots for hospital records:** append-only supersession/dispute records, attribution and reason, a current-record projection, and tests showing the old entry remains auditable but is excluded from the current plot. For the immediate demo, explicitly call this an **unverified synthetic transcription preview**, show that no physician verification has occurred, and do not describe it as the verified longitudinal timeline. The current “staff transcriptions” description helps but is not equivalent to an explicit verification state.

### P2 — Episode chart does not meet “open original source from each point”

`app/apps/client/src/features/care/episode.tsx:46–52` renders SVG circles with titles, without a selectable point action. The records list (`:119–125`) displays a source reference as text. The contract contains a string reference rather than a document/version/page locator. This differs from the main patient progression, which has authorized document opening from its result rows.

**Fix:** make points keyboard-selectable and focus/open the exact record detail; show “original source not connected” where only a synthetic reference exists. Only offer “Open original” when an authorized source locator exists. Do not turn arbitrary reference strings into external URLs. The demonstration can use the approved patient progression to prove actual original-document access.

### P2 — One source reference is incorrectly treated as one observation

`coordination.ts:98` searches by `sourceRef` across all episode records. A single report containing glucose, potassium and bicarbonate cannot use the same report reference for all three fields. Users must invent suffixed references, undermining provenance consistency.

**Fix:** separate source-document identity from source-item identity, or require an explicit field locator. Keep encounter/field/time identity distinct from transport idempotency. Add a regression for multiple observations from one report and for conflicting edits to one source item.

### P2 — Valid unitless observations silently disappear from episode plots

`episode-measurements.ts:12` requires a nonempty unit. A pH observation with a genuinely dimensionless unit is rejected from chart series despite the blueprint naming it as an important lane. Blindly accepting all missing units would also be wrong.

**Fix:** represent “dimensionless” separately from “unit unknown”, with an explicit supported observation code. Plot dimensionless values only when explicitly identified; leave unknown units in the source list with an explanation. Do not infer clinical interpretations or normalize unrelated free-text labels automatically.

### P2 — Episode record attribution does not surface the selected demo person

Episode records store `recordedBy` using `context.actorId` (`coordination.ts:104`). For a private workspace the wrapper preserves the authenticated account ID when provided, while the activity log separately receives the simulated person's structured actor. The episode record display does not show either author. Switching nurses is therefore not inspectable at the observation itself.

**Fix:** retain both authenticated recorder and simulated persona explicitly and render the appropriate label in the observation detail. Never rewrite the source author to equal the person who transcribed it.

## Strengths verified in source

- Source-event input normalizes offset timestamps to UTC, validates role/source pairing and retains LIS evidence with explicit sequence gaps instead of inventing prerequisite events (`care/events.ts`).
- Corrected laboratory results invalidate earlier acknowledgment in both backend and pipeline projection.
- Missing evidence is displayed as unverified; an order does not establish collection, receipt or clinical review.
- Episode plots use individual numeric points, preserve incompatible units and do not interpolate missing values or claim treatment effects.
- Approved progression groups by test and unit, retains dated source observations, and distinguishes patient reports and prescription context. A prescription is not claimed to prove consumption.
- Named staff capacity starts unconfirmed. Receiving responsibility and physical placement are separate transitions.
- Seed encounters are explicitly synthetic. New admission does not silently assign the seeded doctor. Existing seeded event authors are unknown rather than fabricated.
- README explicitly excludes diagnosis, prescribing, clinical risk and live ABHA/ABDM claims, and acknowledges production release gates.

## Measured checks

Ran:

```sh
pnpm --pm-on-fail=ignore exec vitest run tests/integration/care-episode-measurements.test.ts tests/integration/care-pipeline-evidence.test.ts packages/domain/src/timeline.test.ts
```

Result: **15 tests passed across 3 files**, 7 November 2026, 22:14 IST. This proves only the exercised helper behavior. It is not browser verification, broad authorization coverage, extraction validation, or a hospital pilot.

## What the panel should be shown

1. A synthetic source event arrives; missing intermediate evidence remains unknown.
2. A named nurse accepts only their own offer; acceptance does not claim laboratory completion.
3. The laboratory records a result; the responsible doctor separately acknowledges it.
4. A corrected result reopens the acknowledgment requirement.
5. Bed placement and receiving-doctor responsibility remain visibly independent.
6. An approved patient result opens its original document. An episode transcription explicitly shows its weaker verification/source status.

Use operational outcomes such as measured acknowledgment or receipt lag. Do not present research-paper outcomes, simulated crowd behavior, or a generated panel score as GlucoFlow clinical benefit. Historical clinical similarity ranking, treatment execution, identity linkage across systems and real ABDM are roadmap items requiring separate scope and validation.

## Remediation update — 22:20 IST

The parent authorized implementation after this independent review. The five concrete findings above are now addressed in the working tree for the synthetic episode workflow:

- Corrections and disputes append a new version with a mandatory reason and predecessor ID; original records remain unchanged. Current plots exclude superseded and disputed values. Coordinator revisions are refused server-side.
- Episode points are keyboard-selectable and show the exact transcription/reference and recorder. Both chart and record details explicitly state that these are unverified synthetic transcriptions and that original documents are not connected. This is not a new document connector.
- Source item identity uses encounter, kind, source reference, label, unit and observation time, allowing multiple analytes from one report while rejecting conflicting replay of one source item.
- Explicit dimensionless input supports pH-like values without treating an unknown unit as dimensionless; contradictory dimensionless/unit combinations are rejected.
- The structured recorder retains the simulated person separately from the authenticated account identifier. Existing records without attribution show Unknown.
- Episode disclosure sections now use ordinary expansion buttons instead of native triangle controls.

Regression development: three new cases failed against the old implementation before the fix. Latest verification: **17 tests passed across 4 files** (episode records, episode measurements, coordination domain and coordination integration); TypeScript and `git diff --check` also passed before the final extra authorization regression was added. Browser click-through and deployment are owned by the parent and are not claimed here. No changes turn these transcriptions into physician-verified records or establish production clinical validation.

# Independent workflow judge review — 7 November 2026

This is an AI-simulated doctor-workflow review of the working source tree, not a review by a licensed doctor, a clinical validation, or evidence of hospital production readiness. No patient outcome or diagnostic claim was assessed. I inspected README, the active product specification, the reference comparison, Care home, episode, pipeline and coordination code. I did not independently exercise the deployed browser or rerun the full test suite. Findings describe this review snapshot while other implementation work continues.

## Verdict

**Promising assistive demonstration; not ready for an unqualified production claim.** Provisional source-review score: **6.5/10** for workflow readiness. This is a qualitative rubric judgment, not a measured clinical metric. The strongest part is explicit evidence and accepted responsibility. The weakest part is the gap between the concise role-labelled entry and the work a particular person actually needs to act on. Fix the P1 issue and the navigation/queue issues below before panel rehearsal, then retest the complete named-person journey.

No P0 issue was established by this review. Identity binding for legacy transfers is being fixed separately and is not counted as resolved here.

## Findings

### P1 — Staff cannot start a subsequent shift in the same workspace

`apps/api/src/care/coordination.ts:37–48` creates a staff member with one `shiftEnd`, rejects duplicate identity/name, and only allows capacity within that shift. `apps/client/src/features/care/episode-coordination.tsx:129` hides capacity confirmation when the shift ends. There is no renewal command in the reviewed command surface. After the seeded eight-hour shift, the same person cannot receive new work or a clinical handover; adding that person again is rejected. Creating a new simulation is not a valid long-running hospital workflow.

**Fix:** add a server-authorized, audited shift-renewal action for the existing roster identity. Preserve accepted work, reset availability to unconfirmed, and require separate capacity confirmation. Test end-of-shift followed by next-shift renewal, duplicate identity prevention, and unrelated-role refusal. Do not silently infer availability from renewal.

### P2 — “Open encounter” opens coordination instead of the episode view

`apps/client/src/features/care/page.tsx:289` passes `setCoordinationId` as the pipeline's `openEpisode` callback. The pipeline action labelled “Open encounter” therefore leads to Team & work, not the episode overview/graphs/source timeline. This makes the requested visualization journey less predictable.

**Fix:** open the existing encounter route parameter and EpisodeDrawer, or rename the action “Coordinate care.” Prefer the former because the pipeline already promises encounter inspection. Verify pipeline → episode → source → back keeps the same encounter.

### P2 — Role-labelled home does not prioritize that person's work

`apps/client/src/features/care/home.tsx:11–15` identifies the demo person but selects the same first three workspace tasks for every role, prioritizing approval irrespective of permission. Pending named offers and receiving-team requests are absent from this entry view. A nurse can arrive at “Nurse care desk” and still need to search for the offer requiring their acceptance.

**Fix:** put current-person pending offers/handovers first, with a direct contextual action. Keep shared team counts explicitly labelled “Team work”; do not hide team context or suggest role change alone changes authorization. Use person IDs for selection, not names. Verify two nurses see distinct offered work and each can reach their own acceptance in one action.

### P2 — New transcription plots are not equivalent to verified progression

`apps/client/src/features/care/episode.tsx:34–54,111–125` plots staff-entered values and shows only a free-text source reference below. The points have an SVG title but do not open original evidence or expose a verification state. `episode-measurements.ts` correctly avoids inference and separates exact labels/units, but this is not the original progression view's source-document contract.

**Fix:** retain the honest “staff transcriptions” label and explicitly say they are not independently verified. Do not call these plots physician-verified/source-document-linked in the presentation. If supporting evidence objects exist, attach a stable evidence ID and an inspect action; otherwise show “Reference only; source document unavailable.” Do not fabricate source files. A complete verification/correction flow is separate scope, not solved by changing the label.

### P2 — Episode detail is still a long inventory

`apps/client/src/features/care/episode.tsx:88–154` stacks order evidence, context, transcriptions, all tasks, all source events and all task activity in one dialog. With many source events this becomes a long scan despite the compact order summary.

**Fix:** keep current owner, open work and latest source status above the fold; place older timeline/activity behind explicit “View history” controls. Preserve evidence and missingness. Test a populated synthetic encounter, not only the three-order seed.

## Strengths to demonstrate

- Pipeline completion is evidence-specific; later events do not fill missing earlier steps.
- Corrected results invalidate older acknowledgement rather than showing a permanent green completion.
- Expected performer, recorded-in-Gluco actor, current clinical responsibility and follow-up owner are distinguished.
- Named acceptance and separately confirmed capacity are a stronger operational demonstration than generic notifications.
- Bed placement and responsibility transfer remain separate.
- Source transcription, approved record and clinical judgment are not represented as the same thing.
- README appropriately rejects production certification, clinical benefit and live ABDM claims.

## Recommended panel demonstration

1. Open one fictional encounter. State the current team, outstanding receipt and source freshness.
2. Coordinator confirms availability and offers bounded follow-up to a named nurse.
3. Switch to a different nurse: the offered work cannot be accepted. Switch to the recipient: accept it.
4. Record performed follow-up: show that this does not invent a lab receipt or physician acknowledgement.
5. Introduce the independent laboratory source event and inspect its evidence.
6. Request receiving clinician acceptance. Show that a ready bed alone does not change clinical ownership.
7. Inspect the longitudinal approved progression separately; distinguish it from unverified episode transcription plots.

Use one operational KPI with a defined denominator and missing-data handling. Do not quote hospital-study improvements as GlucoFlow outcomes. Historical treatment ranking, medication decision support and live ABDM connections remain separate validation and eligibility gates under the assistive-only submission rules.

## Final source re-review after fixes

Re-inspected the changed source on 7 November 2026. **Revised provisional workflow-readiness score: 7.5/10 for the synthetic assistive demo.** This replaces the earlier source-snapshot score; it is still a qualitative AI review, not a doctor endorsement or a measured patient outcome. Browser and test evidence remain the implementing team's separate verification.

| Original finding | Re-review status |
| --- | --- |
| P1 no subsequent staff shift | Addressed in source. `renew_staff_shift` preserves the roster identity and accepted work, clears capacity, withdraws outstanding offers, and records an audit event. Separate availability confirmation remains necessary. |
| Pipeline “Open encounter” destination | Addressed in source. Callback now sets the encounter route parameter rather than opening the coordination form. |
| Generic role home | Addressed in source. `home-work.ts` uses stable named identities for incoming work and handovers, prioritizes them, and distinguishes the shared team worklist. |
| Misleading transcription/source impression | Materially addressed for demo scope. Plots are explicitly unverified synthetic transcription previews; point inspection shows reference, recorder and status. Corrections/disputes preserve history and excluded values do not enter plots. Original hospital documents remain unconnected, so this is deliberately not equivalent to approved longitudinal progression. |
| Long episode inventory | Remains a P2 presentation limitation. Older orders and extra plots are compact, but all task/source/activity lists can still grow long. This does not block the bounded demonstration; do not claim a measured 30-second encounter review for populated hospital use. |

The revised source presents a more coherent answer to “who needs to do what next?” and preserves the distinction between an action, an attestation and independent source evidence. It is suitable to rehearse as a bounded, fictional coordination demonstration once the final test/browser run confirms these paths. Hospital readiness still requires real integration validation, authenticated deployment governance, clinical workflow evaluation and the other explicitly documented release gates. The new master blueprint's treatment-history retrieval and live ABDM ambitions remain future scope, not demonstrated capabilities of this release.

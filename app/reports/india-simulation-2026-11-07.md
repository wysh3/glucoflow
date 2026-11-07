# Synthetic India-context coordination stress study — 7 November 2026

**Engineering simulation, not an India population study, pilot, adoption forecast, clinical evaluation or HTTP load test.** Twelve runs advanced a virtual clock through 90 days each using the actual `executeCareCommand`, `recordSourceEvent` (through commands) and `reconcileCareWorkspace` implementation. The final run exercised **9,709 synthetic arrivals, 19,418 proposed tasks, 529,719 command attempts and 14,120,931 repeated invariant checks; zero invariant failures**. No model, network, external messages, database mutation or real patient records are part of this script. The Vitest global setup separately acquires the local worker-pause lock.

## Scope and reproducibility

Run from `app/`:

```sh
pnpm exec tsx scripts/simulate-india-care.ts
pnpm exec vitest run apps/api/src/care/india-simulation.test.ts
pnpm exec tsc -p tsconfig.node.json --noEmit
```

The script uses Mulberry32 with fixed seeds, a stable event-queue ordering and virtual dates from 1 January through 31 March 2026. UUIDs remain real generated UUIDs; they are excluded from outcome comparisons. The focused suite verifies same-seed aggregate replay equality. Seeded randomness covers arrivals, timing, outages, cancellation/correction, approval withholding, pause, attestation, expiry duration and transfer acceptance. No statistical inference or confidence interval is claimed from three runs per assumed stratum.

**Each virtual day starts a new bounded workspace** with a real default approved playbook and an otherwise empty synthetic cohort. This is 1,080 workspaces, not a continuously growing 90-day hospital database. Up to 16 simultaneous daily encounters interleave in the ordered queue. There is no parallel process contention, realistic staff-service queue, database durability, HTTP rate, production concurrency or sustained resource-usage measurement. The script's measured 6,736 ms wall time is local in-process test runtime, not deployment latency or capacity. Command totals include role selection, explicit synchronization heartbeats, expected rejected probes and duplicated source deliveries; invariant counts include repeated checks of already settled tasks.

A separate actual-command 90-day single-workspace capacity test confirms the limit: starting from the three seeded encounters, **27 additions succeed and the remaining 63 are refused**, leaving exactly 30 encounters with no rejected mutation. The application therefore does not support continuous unbounded hospital histories in a single simulation workspace. Daily cohort rotation is a harness boundary, not a retention or scaling fix.

## Assumptions, not national data

These arbitrary engineering scenarios are named for the requested metro/tier2/tier3/rural exploration. They do not establish the connectivity, staffing, volume, behavior or capabilities of any Indian community. The rates were selected to vary fault exposure, not fitted to survey or hospital data.

| Scenario label | Arrivals per daily workspace | Outage chance per candidate window | Maximum additional receipt delay | Cancellation chance | Correction chance |
| --- | ---: | ---: | ---: | ---: | ---: |
| metro | 12–16 | 15% | 90 min | 8% | 12% |
| tier2 | 8–12 | 30% | 150 min | 10% | 15% |
| tier3 | 5–9 | 45% | 240 min | 12% | 18% |
| rural | 3–7 | 60% | 360 min | 14% | 20% |

Arrivals are uniformly placed in the first 360 virtual minutes. Receipt occurrence is 10 plus an integer in `[0, maximum delay)` minutes after order initialization; collection is two minutes after initialization. Candidate outages begin at minutes 80 and 250, affect either HIS or LIS, and last 30–129 minutes. Connected feeds receive explicit ten-minute sync commands. Failed delivery retries every ten minutes for at most 600 minutes after initialization. HIS-disconnected order initialization is explicitly deferred until reconnection. This queueing assumption was preserved even after the separately discovered failed-command atomicity bug was fixed; the harness does not pretend orders were accepted while HIS was unavailable.

Each arrival proposes one receipt task and one acknowledgement task. Eight percent of proposed encounter pairs withhold human approval; approximately 10% of eligible receipt tasks pause for 20 minutes; approximately 5% of eligible acknowledgement tasks receive explicit human attestation. Fifteen percent of task pairs use a 30-minute expiry, otherwise 240 minutes. Each encounter's receipt task undergoes a shift-transfer request; the receiving role accepts with 80% probability. These are input assumptions, not measured user behavior.

## Observed synthetic results

| Label | Distinct seeds | Arrivals | Source-confirmed tasks | Expired | Cancelled | Human-attested |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| metro | 104729, 130363, 155921 | 3,780 | 5,398 | 1,397 | 596 | 169 |
| tier2 | 1104729, 1130363, 1155921 | 2,677 | 3,720 | 992 | 536 | 106 |
| tier3 | 2104729, 2130363, 2155921 | 1,886 | 2,249 | 980 | 458 | 85 |
| rural | 3104729, 3130363, 3155921 | 1,366 | 1,110 | 1,208 | 358 | 56 |

Every final task belongs to one of these four statuses. Expired tasks are not automatically revived by late delivery. These counts reflect the deliberately different input distributions and cannot support comparisons of actual communities or claims that GlucoFlow improves outcomes.

Measured exercised fault/event counts:

- 39,337 accepted post-order source deliveries and 39,337 exact duplicate no-ops. The initial 9,709 `order_placed` events are additional and excluded from that post-order delivery counter.
- 9,709 wrong-role approval refusals and 9,709 foreign-encounter refusals with unchanged state; a separate regression verifies a real second encounter paired with the wrong order.
- 759 configured feed-outage windows; 6,516 rejected disconnected-feed deliveries; 2,862 rejected out-of-sequence deliveries, then scheduled retries.
- 976 accepted source cancellations; 2,925 later deliveries refused because their order was cancelled.
- 1,225 corrected-result events, each checked to invalidate earlier acknowledgement completion; subsequent acknowledgement uses the corrected version.
- 7,748 accepted and 1,961 rejected shift transfers. Requests retain the prior owner, wrong-role acceptance is refused, accepted transfer does not complete the task.
- 1,568 tasks intentionally left without approval; 871 pauses; 416 explicit human attestations; 19,418 exact-expiry task checks.

The final dataset has 9,709 collections, 8,734 matching receipts and **975 collections without a receipt**. Missing receipt lags remain missing and are excluded from finite-lag quantiles, not assigned zero or treated as completed. Per-run nearest-rank median and p95 are calculated from actual stored events and included in the JSON. `recorded` lag uses receipt occurrence minus collection occurrence; `observed` lag uses receipt ingestion minus collection occurrence and includes simulated feed-delivery delay. These are synthetic operational timestamps governed by the chosen distribution; there is no baseline, treatment arm, productivity result or effectiveness claim.

## Invariants and defects found

Every command/reconciliation checks that source-confirmed tasks have an exact same-encounter/order source event, evidence received before expiry, and an explicit approval audit entry. Other statuses cannot masquerade as source completion. Duplicate source delivery must be idempotent. Unauthorized attempts must not mutate state. Exact expiry must close open work, cancellation must close work or preserve an earlier terminal expiry, ownership must obey transfer acceptance, and unchanged reconciliation must be idempotent.

The direct disconnected-HIS test initially failed: `add_order` appended an order before the source-event command threw, leaving an orphan order in the in-memory workspace. The primary agent fixed production code to roll back the provisional order on failure. The focused suite now also verifies event-capacity failure cannot leave an orphan order. This finding concerns actual domain-command atomicity; the initial test alone did not establish persisted database corruption because repository transactions may discard rejected mutations.

The first run with 12 distinct seeds had two **test-oracle errors**, preserved in `india-simulation-initial-distinct-seed-failures.json`: tier2 seed 1104729/day 73/minute 141 and seed 1130363/day 28/minute 181. A delayed cancellation reached an already expired task. The original assertion demanded `cancelled` even though `expired` is intentionally terminal. The assertion now accepts either cancelled or previously expired, preserving the no-open-work requirement. No production behavior was relaxed to pass that assertion.

## Fresh verification and evidence

- Final simulation: all 12 distinct-seed 90-day runs completed, zero invariant failures. Full inputs, counters, per-run lags and exact seeds: `india-simulation-2026-11-07.json`.
- Final focused suite: **10/10 passed**, 601 ms wall duration (`india-simulation-focused-2026-11-07.txt`). Includes determinism, all four assumption strata, failed-order atomicity at disconnected HIS and source capacity, actual wrong-encounter mismatch, stale feeds/attestation separation, and unrotated 90-day capacity exhaustion.
- Node TypeScript compilation passed after the final harness change.
- Earlier whole-project suite: **309 passed, 1 failed across 55 files**, 12.45 seconds; the failing test was the disconnected-HIS regression before the primary-agent fix. This historical red run is retained in `india-simulation-full-suite-2026-11-07.txt`, not represented as final suite success. The primary agent owns the final combined suite after all concurrent edits.

Acceptance mapping: R02/R19 authorization and failure handling (domain-level probes, not substitute for RLS/HTTP tests); R08/R12 source-backed human approval and correction evidence; R14 bounded lifecycle behavior; R20 reproducible synthetic evidence. Browser/Android physical-device behavior, live integration, multilingual comprehension, real shift staffing, patient outcomes, durable 90-day production retention and field adoption remain unmeasured by this harness.

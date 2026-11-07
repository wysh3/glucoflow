# Synthetic longitudinal reducer exercise — 7 November 2026

A bounded 90-day schedule retained one in-memory seeded workspace per scenario, using the actual care command and reconciliation functions. It did not rotate or reseed the workspace daily. Tier 1, Tier 2, Tier 3 and rural are scenario labels only: each intentionally uses the same hypothetical workload, so these results make no claim about Indian sites, demographics or nationwide practice. No real patient data, external messages, provider calls or load were used. This is not a GPT-6.1 Terra model evaluation, staff simulation, clinical pilot, human feedback, capacity test or evidence of clinical benefit.

Reproduce from `app/`: `pnpm exec tsx scripts/simulate-terra-longitudinal.ts`. The accompanying JSON has the measured per-scenario counts. The schedule issues one eight-hour monitor and one handover draft per day, retains all history, explicitly approves monitoring, and checks expiry. It also issues 14 distinct soft acknowledgements in the first 14 minutes on one still-open specimen task; these are deliberately concentrated cap probes, not 14 actual shifts. UUIDs vary, while schedule and reported counts are deterministic.

Each scenario produced the same results:

| Measure | Result |
| --- | --- |
| Handover creation | 8 succeeded; the ninth on day 9 and 81 subsequent attempts were rejected (82/90 rejected). |
| Shift monitor creation | 12 succeeded and expired; the thirteenth on day 13 and 77 subsequent attempts were rejected (78/90 rejected). Expiry did not free the retained-history slot. |
| Distinct soft acknowledgements | 12 succeeded; two further notes were rejected. A retry of the last accepted note was a no-op. |
| Duplicate commands | All 8 duplicate shares were no-ops; all 12 duplicate monitor approvals were rejected as invalid state. |

The caps are bounded demo design rather than evidence of infrastructure throughput. They nonetheless make this particular sustained schedule impossible within one workspace. Consider paginated durable history or a reviewed archive strategy that keeps source evidence and receipts accessible while allowing new work, along with explicit limits and recovery guidance. Preserve authorization, recipient identity, approval and provenance. The existing continuation implementation archives the old workspace and seeds a **separate fictional episode**; it is not persistent patient-care continuation. The SQL transaction, permission checks, archive behavior and database concurrency were not exercised by this harness, and no claim is made that a continuation succeeds in a deployed environment.

Fresh related verification: `pnpm exec vitest run apps/api/src/care/pdf-demo.test.ts` returned **5 passed, 1 failed**. The failing receipt-before-collection case expected `source_unknown` but the shift monitor returned `source_confirmed` (line 163), despite the test recording the out-of-order receipt as an exception. This needs investigation and correction before relying on that monitor. The other passing cases cover correction reopening, stale version rejection, expiry, authorization and duplicate receipt, but are isolated unit tests, not proof of longitudinal concurrency or a deployed service.

The exercise does not establish genuine workload distributions, staff adoption, sustained accuracy, reliability under load, physical-device behavior, hospital authorization or pilot readiness. Source events remain evidence, soft acknowledgement is not source completion, and actions require human authorization and approval. Map this evidence to the monitoring and handover portions of the revised PDF-demo scope and the source/authorization requirements in the acceptance checklist; it does not close broader MVP acceptance gates.

## Subsequent repair verification

The chronology failure above was captured during the active regression-first repair. The backend was subsequently fixed and independently rechecked by the Terra integrity reviewer; the original receipt remains visible but no longer confirms completion. The final combined suite passed 419 tests across 78 files. This repair does not remove the retained-history limits measured in this longitudinal exercise. See terra-integrity-2026-11-07.md and the final release report.

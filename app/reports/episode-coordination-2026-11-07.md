# Episode coordination implementation — 7 November 2026

Implemented an operational coordination domain within the existing authenticated, row-locked workspace command API. It does not infer clinical capability, diagnose, recommend treatment, or make bed-admission decisions.

## Delivered

- Staff roster records operational capabilities and shift end. Capacity is unknown until a coordinator confirms a bounded number of slots with a time limit and source reference.
- An offer requires approved open monitoring work, appropriate capability, a current shift, and fresh capacity. Pending offers reserve a slot; competing offers cannot overbook it. Acceptance rechecks eligibility. Decline and expiry release reservations.
- Shared-workspace roster enrollment requires an active enrolled account with the matching role. Acceptance is bound to the authenticated named recipient, not merely anyone with the same role. Private simulation role-switching remains explicitly a simulation.
- Follow-up assignment completion records work and its source. It does not turn monitoring into source-verified completion.
- Episode handover keeps the sending clinician accountable until the named receiving clinician accepts. Acceptance propagates only that sending clinician's open responsibilities, leaving lab and nurse owners unchanged. It does not move the patient's recorded bed/location.
- Observation and follow-up records retain supplied source, occurrence time, recording time and authenticated recorder. Exact replay is a no-op; conflicting source-reference reuse and future observations are rejected. No clinical interpretation is added.
- Reconciliation expires offers and pending handovers and retires assignments when the underlying monitoring task closes.
- New synthetic workspaces contain three example staff entries, with no claimed capacity or authenticated bindings. Existing workspaces remain backward-compatible through optional coordination state.

## Verification

`pnpm exec tsc -p tsconfig.node.json --noEmit` passed.

`pnpm exec vitest run apps/api/src/care/coordination.test.ts tests/integration/care-coordination.test.ts tests/integration/care-team.test.ts`: 17 tests passed across 3 files (896 ms reported runner duration). Includes a real database test proving another doctor cannot accept the named recipient's handover and proving source-linked follow-up persistence. Output is in `coordination-green-2026-11-07.txt`.

The initial six domain tests were observed failing against an unimplemented stub before implementation; output is in `coordination-red-2026-11-07.txt`. Additional edge tests cover unknown capacity, decline release, and role mismatch.

## Boundaries

State remains persisted in the existing locked workspace JSON document. This is not a normalized hospital workforce/episode database or a validated production staffing system. Roster shift renewal, historical roster archival, cross-hospital directory/identity integration, and long-running background scheduling are not implemented by this extension. Offers expire on server reads/commands through existing reconciliation; there is no external notification delivery. Capacity counts operational assignments, not patient acuity or clinical workload. Observation provenance is staff-supplied; it is not claimed as authenticated HIS/LIS ingestion. Source-reference granularity must identify each record, not an entire multi-measurement document. No claim is made about clinical outcomes or real-world safety validation.

## Staff onboarding extension

The existing owner-authorized team endpoint now accepts an existing staff account's email in addition to its user ID, plus role and active state. Exact-email lookup is restricted to a workspace owner and RLS-visible user records; the existing database function then requires active membership in the exact workspace clinic and clinician capability for doctor assignment. No account is created and no external invitation is sent. Owner revocation and teammate self-promotion remain prohibited. Team responses include display names and account email for usable owner administration.

Final verification after onboarding: node typecheck passed; 18 tests passed across coordination unit, coordination persistence, and team ACL integration suites. Email enrollment test covers uppercase lookup, attempted teammate enrollment, unrelated-clinic account, absent account, and owner removal. Initial failing and final passing evidence: `team-onboarding-red-2026-11-07.txt` and `team-onboarding-green-2026-11-07.txt`. A first implementation tried reading target clinic membership directly, which is intentionally hidden by membership RLS for nonadministrators; the corrected implementation leaves the exact-clinic decision to the existing authorized database mutation.

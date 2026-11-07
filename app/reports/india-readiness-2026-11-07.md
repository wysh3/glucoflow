# GlucoFlow: India simulation, hardening and shipping decision

7 November 2026, IST. **Tested synthetic demo release; not approved for real patient deployment.** No people were recruited or contacted. “Crowd” means generated interleaved workflows and bounded local HTTP contention, not actual Indian users or validated human behavior.

## Decision

Start with one general-medicine/diabetes ward in an independently managed private hospital with a usable laboratory feed and an engaged nursing-quality lead. The nurse/shift coordinator is the primary daily operator; hospital administration is the economic buyer. Start with collection-to-receipt closure and shift responsibility. Keep diabetes as the initial service context, while the underlying receipt and handover procedures remain reusable across specialties. Do not launch every specialty or every facility tier simultaneously.

The strongest differentiation hypothesis is evidence-backed ownership continuity across systems, followed by reviewed reuse of successful operational procedures. The work has not established that competitors lack these features. It does not establish clinical benefit, improved adoption, willingness to pay, or autonomous invention of skills.

## What was exercised

- [Virtual-time study](india-simulation-2026-11-07.md): 12 distinct-seed runs, each 90 virtual days, across four assumption profiles; 9,709 arrivals, 19,418 tasks, 529,719 command attempts, 759 outage windows, 1,225 result corrections and 976 cancellations. Zero final invariant failures. The 14,120,931 checks include repeated checks of the same state, not independent users or outcomes. Uses 1,080 bounded daily workspaces, not a growing hospital database.
- [HTTP crowd test](india-api-load-2026-11-07.md): 157 localhost requests, 19/19 assertions, concurrency 1/5/10. Ninety reads succeeded; read p95 4.32/11.69/11.19 ms in the final run. Offline chat had 3 successes, 9 revision conflicts and 4 rate limits. These short bursts and one identity cannot establish sustained throughput or real model latency.
- Final integrated suite: **312/312 tests across 55 files**, 13.01 seconds. [Raw result](india-final-suite-2026-11-07.txt). Node/web typechecks and client/API/worker builds passed. Python policy suite: 14/14 in the independent skills review.
- Browser: locally clicked transfer request, receiving-role acceptance and source-confirmed receipt; requested bed transfer, coordinator allocation and arrival, verified current bed changes only on arrival, and reloaded saved state. Inspected the mobile encounter view at 390×844. On production, restored sign-in, created a fresh workspace, opened and closed a source, and collapsed navigation to the icon rail. This is a focused check, not a claim to have freshly clicked every retained screen or tested a physical Android device.
- [Hosted background proof](india-hosted-background-proof.json): approved a one-minute handover monitor, then made no workspace API reads. Read-only database observations showed worker checks and expiry at the 70-second sample, revision 3→4. A single proof does not establish an availability SLA.
- [Hosted Hermes proof](india-hosted-chat-proof.json): one live source-summary request took **15,192 ms**. This remains a latency gap; offline timings must not be presented as live model performance.

## Repairs made from investigation

1. **Rejected order creation is atomic in memory.** Source validation could throw after a provisional order was appended. The order is now removed before propagating failure. Disconnected HIS and source-capacity regressions pass. This finding alone was not evidence of persisted database corruption.
2. **Closed tasks no longer retain pending handovers.** Source confirmation, human attestation, cancellation and expiry withdraw the request, keep the last accountable owner, and append an audit entry. Reconciliation is idempotent.
3. **Care monitoring survives model unavailability.** A bounded readiness probe gates document leasing while deterministic monitoring continues. Failure logs degraded mode; extraction requires an operator restart to retry. Pause behavior, nonoverlap, row-lock contention and transaction rollback are covered.
4. **Skill rollback revalidates current behavior.** Restoring a fixed pattern runs the current sandbox before activation instead of copying historical test flags. This is still fixed-pattern versioning, not an immutable learned procedure.
5. **Independent harness review:** corrected a report sentence (only each encounter's receipt task receives a shift-transfer request) and added a non-vacuous successful-chat baseline assertion. Historical failed results are retained and explained.

## Release evidence

- Web: Vercel production deployment `dpl_8sddP9UTKvBJ5G3543ET6KRCKx5N`, READY, aliased to https://glucoflow.vercel.app.
- API: Azure `glucoflow-service--india-hardening`, READY; image digest `sha256:6086ac3a6b89aaa8242fef53b97baaef4d6d2ebdefc7f70fcf25da619b723444`.
- Worker: Azure `glucoflow-worker--india-hardening`, READY; image digest `sha256:af4cc4b3f78fc13ddec826e3892b5db104f3de911a0487c3f6401f063fee8c96`.
- Pinned Hermes sidecar retained; migration 054 applied transactionally after verifying existing migration checksums.
- Worker minimum replica changed from zero to one, maximum remains one, so the empty document queue does not stop care monitoring. This creates ongoing compute cost; no new Azure bill is inferred.

## What to add, retain and defer

**Retain:** compact chat/canvas, source links, explicit owners, approvals, correction history, simple mic/speaker controls, multilingual static labels and approved operational templates. Use ordinary deterministic code for state tracking and budgets.

**Next engineering gates:** normalized durable encounter/task/event storage and active-queue pagination; separately authenticated team identities; verified connector ingestion and idempotency; distributed model budgets; observability for queue lag and expiry lateness; restore/failover testing; bounded chat scheduling/streaming and measured time-to-first-useful-content; evaluated Hindi/local-language and speech behavior. Do not raise simulator caps as a substitute for storage design.

**Skills:** prioritize specimen receipt, current-result acknowledgement, shift ownership transfer, human-directed transfer logistics, staff-specified follow-up and reviewed source-document preparation. Reuse the operational pattern for renal, oncology or other wards only after validating that site's workflow and permissions. Do not add insulin dosing, glucose-based triage, automatic specialty referrals or protocol interpretation. [Catalog and agent audit](india-skills-and-agent-audit-2026-11-07.md).

**Learning:** propose a versioned patient-independent workflow artifact from reviewed corrections, run positive/negative cases, require an authorized approver, evaluate fresh target evidence, record actual outcomes and support rollback. Current code only captures two predefined patterns. Open-ended skill authoring, immutable artifact hashing and post-release performance-based promotion remain unimplemented. Executable app changes require tests and a reviewed release.

## Scale and field limitations

The single-workspace 90-day test reached the 30-encounter cap after 27 additions to the three seed encounters; 63 later attempts correctly failed. That proves boundedness, not hospital-scale retention. Monitoring selects at most 20 due workspaces per batch with a five-second minimum interval: roughly four workspaces/second is an arithmetic upper bound before runtime/database overhead, not a measured capacity guarantee. Thousands of simultaneously active workspaces need a measured queue design and scaling policy. The short local read burst does not validate this workload.

A real pilot also needs hospital access agreements, assessed privacy/legal obligations, verified real staff authority, connector provenance, independently checked source matching, backup recovery, manual downtime procedures and support coverage. Shared public demo identities must never receive real patient data. ABHA/ABDM is not live. Video ingestion remains unavailable without its validated provider/output contract. Some language choices remain previews. These are explicit shipping gates, not assurances from a successful synthetic test.

## Commercial and 60–90-day field plan

[Detailed decision memo](india-market-and-pilot-2026-11-07.md) contains sources, metric denominators, stopping rules and low/base/high assumptions. Base hypothetical delivery cost is ₹36,970/site/month against an unvalidated ₹60,000 subscription; ₹23,030 contribution excludes central engineering, sales and taxes. Setup/integration is separate. These are planning assumptions, not vendor invoices or customer willingness to pay; speech, extraction and messages need additional measured pricing if included.

Days 1–14: access/governance and workflow observation. Days 15–28: prospective baseline and shadow mode. Days 29–70: bounded assisted operation with a preselected comparison where feasible. Days 71–90: independent source audit, staff workload/burden review and paid continuation decision. Primary metric: collection-to-receipt lag, with missing receipts kept in the denominator and reported separately. Balance against false completion, unnecessary tasks, review burden and handover acceptance delay. Keep version changes attributable. A synthetic 90-day clock cannot supply these field results.

## Acceptance mapping

Maps to original acceptance principles: tenant authorization and rejected mutation safety; provenance and current-version evidence; explicit approval; durable recovery; honest fixture/live separation; web/mobile usability; measured verification. November operational scope adds ownership and bed logistics without changing clinical authority. The original Android and patient-record requirements remain; this pass does not certify them anew.

## Re-run the engineering checks

From `app/`, with the local synthetic database/API configured:

```sh
pnpm --pm-on-fail=ignore simulate:india
pnpm --pm-on-fail=ignore stress:care:local
pnpm --pm-on-fail=ignore test:india
pnpm --pm-on-fail=ignore typecheck
pnpm --pm-on-fail=ignore test
```

The HTTP script is hardcoded to localhost and never calls a model. It creates fresh synthetic workspaces. The virtual-time script is in-memory and does not call external providers.

## Upload pipeline verification

Fresh hosted synthetic PDF processing succeeded in 16,034 ms with one durable provider-call reservation. Its unpublished live Hermes draft, ordered original source and cross-clinic denial passed. Usage recorded 4,988 input and 328 output tokens; the configured ledger estimate was USD 0.000788, not a reconciled provider invoice.

The fixed photo fixture matched a historical upload and was correctly deduplicated in 1,448 ms without creating a new extraction run. The original smoke incorrectly required fresh model usage for that path. [Diagnosis](india-photo-smoke-diagnosis.md) distinguishes this verifier defect from an OCR/model failure. Historical canonical extraction is not fresh verification of photo extraction on this revision.

The repaired smoke rerun (`--confirm-live --resume-pdf`) passed with no new uploads or provider requests. It verified same demo patient/clinic, ordered fixture checksums, absent duplicate extraction run, canonical authorized review/source bytes and cross-clinic denial. This closes the verifier defect; fresh photo extraction remains a separate test.

# Independent integrity review — 7 November 2026

Scope: synthetic care workflow source review, focusing on shift checks, handover, role-specific work, identity and authorization. This is a bounded technical review, not clinical validation, a production security assessment, or a certification. Files may change after this review; findings refer to the reviewed state.

## P1 — inconsistent receipt can be credited as completion

**Observed.** The source-event command deliberately accepts LIS events with missing or inconsistent prerequisites and logs `source_sequence_gap` (`apps/api/src/care/events.ts:153`). Shift monitoring chooses any latest specimen receipt as completion, without checking whether its occurrence follows the collection (`apps/api/src/care/shift-monitoring.ts:115-126`). In a synthetic Vitest reproduction, a seeded collection occurred at 10:50, an LIS receipt was recorded at 12:01 with occurrence time 10:48 (after the order time of 10:45), and the monitor changed from `pending` to `source_confirmed` while the sequence-gap activity was logged. The standalone reproduction passed 1 test in 1 file; its temporary test file was removed after the run. This confirms a behavior defect, not a claim about production incidence.

**Related code inspection, not browser-tested in this review.** Nurse exceptions exclude any order with a receipt (`apps/client/src/features/care/role-work.tsx:63-65`), and the lab queue labels any receipt as `Received` (`role-work.tsx:165-168`). The same sequence-gap example therefore appears capable of hiding the exception and presenting a received stage without indicating inconsistent chronology. Preserve the receipt as source evidence, but represent the gap explicitly and do not mark the ordered collection-to-receipt requirement confirmed without consistent evidence. Test both arrival order and occurrence time, including missing earlier events and backdated late events.

## Other boundaries inspected

- An edit increments the monitoring scope version, clears approval and items, and requires a new approval. The absolute expiry path excludes events received at or after expiry; existing unit tests exercise correction and late receipt boundaries. This review did not independently rerun those tests.
- Shared-workspace command handling checks the current access and projects the assigned role; targeted recipients are rechecked against active membership and allowed roster role at create/edit/approval or sharing (`apps/api/src/care/repository.ts:95-109,148-163`). Handover receipt checks the exact shared version and named account and does not transfer responsibility (`apps/api/src/care/handover-documents.ts:110-122`). This is code inspection, not an exhaustive adversarial or database-concurrency validation. Worker reconciliation does not itself revalidate recipient membership; it performs in-app synthetic checks and sends no external notification. The intended behavior of an already-approved group after a recipient's later revocation should remain explicit.
- The lab queue identifies processing as unverified; soft acknowledgement records a note without changing the task, owner or source completion. Source event correction handling calls `latestAcknowledgement`, which selects an acknowledgement after the latest corrected or validated result. These observations do not establish that every possible out-of-order event combination is safe.

Recommended next step: repair and add persistent regression coverage for the reproduced sequence gap across monitoring and the two role views, then rerun relevant tests and any required browser checks. No patient data or external communications were used.

## Recheck after backend repair

At 22:39 on the review run, I independently repeated the same synthetic scenario: collection at 10:50 and a receipt recorded at 12:01 with occurrence at 10:48. The monitor now reports `source_unknown`, retains the raw receipt and records the sequence-gap activity. The temporary independent regression passed (1 test, 1 file) and was removed. The committed targeted suite also passed: 12 tests across `pdf-demo.test.ts` and `care-pipeline-evidence.test.ts`, including a valid delayed-arrival case. This resolves the reproduced backend false-confirmation behavior for that scenario; it does not prove all event permutations safe.

At the time of this recheck, the nurse and lab view code still used receipt existence without checking its ordering. Their display implications remain open until separately repaired and verified.

## Role-view repair recheck

After the UI repair, independent code inspection confirms that the nurse and lab views apply the shared `specimenReceiptMatchesCollection` check before treating a receipt as verified. The nurse exception retains the inconsistent event with an explanation and source link; the lab queue displays the receipt as unverified and retains its source link. The exact independent backend reproduction and targeted tests above passed after the repair. A separate agent reported six real-browser checks passing, including the inconsistent-receipt case; I did not independently repeat that browser case, so its result is attributed rather than independently verified. The original UI implications are resolved by the inspected change for the reported example; broader event combinations remain outside this bounded review.

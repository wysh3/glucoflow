# Terra simulated workflow review — 7 November 2026

This is a synthetic software exercise from a simulated doctor/nurse perspective, not feedback from a practising clinician or evidence of patient outcomes. It covers desktop and mobile browser flows; it does not establish 60–90 days of persistent-use readiness, native Android behaviour, or production clinical suitability.

## Finding at review time

**P2 — A named recipient had no incoming shift-handover item on My Shift.** In a private synthetic workspace, create a shift handover as the doctor, edit and share version 2 with a named nurse, then switch to that nurse and open My Shift. Neither the sender nor the handover appeared there. Open Encounters, find Shift handover, and version 2 could be reviewed and receipt recorded. In the tested workflow receipt remained bound to that version and did not change the encounter's assigned doctor. This created a discoverability gap for a receiving person who starts from their named-work desk; it does not establish that a notification was promised or that an external message was sent. The Encounters placement was in `apps/client/src/features/care/teams.tsx` and the named-work selection in `apps/client/src/features/care/role-work.tsx`. Source inspection also showed the home incoming-work calculation omitted `handoverDocuments` (`apps/client/src/features/care/home-work.ts`); that home observation was not separately exercised. Recommended repair: show shared, unreceived versions to their exact named recipients in incoming work, with a direct review action, preserving the existing identity checks and version-specific receipt.

## Measured browser exercise

- A local real-API Playwright run passed 6 tests in 10.6 seconds: on both desktop (1440 × 900) and mobile (390 × 844), nurse specimen soft acknowledgement retained monitoring and no completion event; lab queue distinguished expected and validated from unverified processing; a doctor edited, exported and shared a handover, switched fictional people, and only the named recipient acknowledged the shared version. The tests checked the persisted API state and original source reference.
- An independent follow-up real-API run used separate local ports, created/shared the handover, switched to the receiving nurse, checked My Shift, then returned to Encounters and acknowledged it. Both desktop and mobile cases passed the assertions in 9.0 seconds. The absence of a handover on My Shift was the observed finding above, not a passing product acceptance criterion.
- An initial attempt at the follow-up used an old API port and failed at the command-observation assertion; after correcting the test's API port, the two cases passed. That test setup failure was not treated as a product defect.

The separate longitudinal review owns capacity and continuation testing. Source review noted fixed per-workspace limits on handover drafts and versions, but this review did not establish their sustained-use implications. No real patient data or external communications were used.

## Resolution and independent recheck

The UI now surfaces shared, unreceived versions for the exact recipient in Home and the nurse's My Shift, with direct links to the version. I independently reran the updated real-API handover journey on separate Fastify and Vite ports: **2 passed in 12.7 seconds**, desktop and mobile. The run checked that the other nurse does not see the incoming item; the named nurse opens version 2 from Home and My Shift; receipt is stored for version 2 by that nurse; and the encounter owner remains unchanged. The P2 finding is resolved for this tested private synthetic workspace. Shared managed-workspace behaviour and native Android were not independently exercised in this recheck.

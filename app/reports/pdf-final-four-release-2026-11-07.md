# PDF demo workflow release — 7 November 2026

## Delivered

- One fixed, versioned shift-monitoring scope with encounters, sources, rule, recipients and absolute expiry; explicit approval, background checks, per-order evidence, pause/resume, edit/reapproval and stop.
- Nurse My Shift with source exceptions and soft acknowledgement; laboratory expected/received/processing-unverified/validated queue.
- Editable immutable handover versions, exact-version export and in-workspace share, named recipient receipt. Pending receipt links appear on Home and My Shift. Receipt never transfers clinical ownership.
- Static synthetic unit-workload visualization and accessible logistics-only appointment preview. Changing recipient, date/time or location clears approval.
- Hospital setup/role/person management and source-linked episode charts from the preceding hospital-authority change are included in this release; see hospital-authority-release-2026-11-07.md.

## Fresh verification

- Full suite: **419 tests / 78 files passed**, 14.49 seconds.
- Full Node/web TypeScript and client/API/worker builds passed.
- Database checks passed; hosted migration checksums verified and migrations 066–067 applied transactionally.
- Real local API + PostgreSQL browser tests: nurse/lab/handover **6 passed**, desktop 1440×900 and mobile 390×844; shift-monitoring lifecycle **2 passed**, same sizes. Appointment approval-reset and unit-preview browser tests **2 passed** using controlled API fixtures. Fixture tests are not live integration evidence.
- Independent Terra workflow recheck: **2 passed** desktop/mobile for named incoming handover and unchanged owner. Independent Terra integrity reproduction now preserves a receipt before collection as unknown instead of source-confirmed.
- Hosted deterministic smoke passed: authentication/isolation, retry/stale revision, source receipt, approved routine reuse, monitoring scope lifecycle, edited exact-version handover receipt and nurse soft acknowledgement. No new model, speech or video provider test is implied.
- Deployed web browser: created a new synthetic workspace, used Monitor this shift, sent the bounded request, and inspected the scope preview. Gluco readiness was shown; this was not a new live-model latency benchmark.

## Judge findings and repairs

The GPT-6.1 Terra integrity reviewer reproduced a receipt occurring before collection falsely counting as completion. A shared chronology predicate now requires matching source/encounter/order and valid occurrence ordering in individual tasks, grouped monitoring, routine proof, and the nurse/lab displays. Raw inconsistent evidence remains inspectable. Delayed arrival remains valid when occurrence chronology is valid.

The Terra workflow reviewer reproduced missing incoming handover visibility. Home and My Shift now show only the eligible named recipient's pending shared version and open it directly. The reviewer independently rechecked the repair.

The Terra longitudinal reviewer exercised **90 virtual days in one retained workspace per scenario**, across four identically configured hypothetical labels (Tier 1/2/3/rural). Retained history caps stopped the ninth handover and thirteenth monitoring group; 12 soft acknowledgements per task is also a limit. This is a bounded demo, not sustained hospital production. The earlier daily-reset simulation and this persistent-state exercise measure different things. Neither is real human feedback, national evidence, clinical validation or load capacity.

## Deployment

- Web: https://glucoflow.vercel.app (Vercel release glucoflow-pm7vs9c10-wyshs-projects.vercel.app, READY).
- API: glucoflow-service--pdf-final-four, Azure READY.
- Worker: glucoflow-worker--pdf-final-four, Azure READY.
- API image digest: sha256:0a774e0f731b4149c706a0bfd67ad4771ea2f18a9a4ff8e007d3c5896390b041.
- Worker image digest: sha256:76b9df404e9be02510d1bbe7d32e4c0be1151d9ea6ef6aa2cc104e116364110f.
- Existing pinned Gluco runtime image retained, no runtime/provider configuration change.

## Remaining hospital gates

Real independently operated HIS/LIS connectors, encounter/assignment-level access design, consented communication, governance and privacy/retention approval, durable paginated longitudinal history, staff validation and a measured hospital pilot remain open. No live ABDM, automatic diagnosis, treatment decisions, invented processing events, autonomous procedure invention or unlimited scalability claim is made. No new native Android device verification was performed. The 69%/31% score was not reused or replaced by an invented percentage.

## Inspectable evidence

- pdf-compliance-audit-2026-11-07.md — updated blueprint mapping.
- terra-workflow-2026-11-07.md — workflow review and independent repair recheck.
- terra-integrity-2026-11-07.md — integrity reproduction and resolution.
- terra-longitudinal-2026-11-07.md and .json — persistent simulated schedule, counts and limits.
- completion-evidence/shift-monitoring-desktop.png and shift-monitoring-mobile.png.
- completion-evidence/unit-preview-desktop.png and unit-preview-mobile.png.

# Pre-build audit — 2 October 2026

Status: documentation baseline consolidated. Application implementation has not started.

## Cleanup

Old inputs, outputs, deck versions, judge reviews, render intermediates and builders were moved to `archive/2026-10-02-before-build`. Original documents were preserved before editing. All 611 original file contents and symlink targets were verified against the pre-cleanup inventory. No original source was permanently deleted. Archives are excluded from the active build instructions and final package.

## Corrected

- Aligned current pitch, written answers and documentation with Vite/React, Capacitor Android, Fastify API/worker, Supabase, Vercel and Railway.
- Fixed both patient and clinic workflows on both platforms, with distinct reviewer and clinician permissions.
- Kept progression, source inspection and patient-specific search central. Patient notes and prescriptions remain contextual. No inferred measurements, clinical risk alarms, causality or automated screening intervals.
- Specified upload/photo ordering, limits, cancellation and separate storage-token/application expiry.
- Defined source identity holds, mixed-patient quarantine, human review, corrections, amendments and immutable export snapshots.
- Defined transaction-scoped authorization, revision locks, durable jobs, model-call budgets and interrupted-upload behavior.
- Added fixed contracts and a 20-requirement acceptance checklist mapped to build tasks and evidence.
- Preserved the requested application typography/components/icons and restrained Apple/medical style. The deck retains its established presentation theme and labels illustrations as concepts.

## Verification

Active Markdown references were checked for missing local targets. The eight-slide PPTX/PDF were regenerated, structurally checked and visually reviewed. The PDF has eight pages and no detected out-of-page content; automated checks do not replace the visual review. Current materials make no claim that the application, APK or measured productivity results already exist.

## Required during implementation

Choose compatible pinned dependencies and Android secure storage through the defined build gates. Select the extraction model through the documented experiment. Supply actual hosting/model credentials and budget limits. Verify the signed APK on a device and execute all acceptance tests. These are unfinished execution tasks, not hidden assumptions or guarantees of correctness.

Real team/doctor details and authenticated submission field limits must be completed before submission. ABHA integration remains outside this MVP. No application tests have run because there is no application code yet.

## Start here

[Build specification](mvp/README.md) · [Build tasks](mvp/06-build-plan.md) · [Acceptance checklist](mvp/10-acceptance-checklist.md)

# Visual Gluco release — 7 November 2026

## Delivered
- Assistant and workspace wordmark display Gluco.
- Standalone greetings produce a current-workspace visual card with task, encounter and workflow navigation. This is deterministic presentation of saved data, not a clinical AI assessment.
- Department-lane canvas replaces the pipeline stage list. Encounter/order selection, source evidence inspector, zoom, fit and background drag are provided. Initial auto-fit was repaired after desktop browser testing found clipping.
- Receiving responsibility and physical placement remain independent of laboratory events. Missing evidence stays unverified.
- Application aggregate speech, guide/runtime hourly and document monetary allowances are disabled with explicit zero/unlimited semantics. Usage accounting, authentication, per-request bounds, concurrency and cancellation remain.

## Verification
- Full Vitest suite: 381 tests, 70 files passed.
- TypeScript checks and production build passed. Six Python runtime tests passed.
- Local browser: Enter sends hi; visual greeting, pipeline navigation, encounter selection, missing receipt evidence, zoom and fit; mobile 390x844 evidence selection and close controls. Mobile canvas supports horizontal panning rather than shrinking the entire journey to illegible width.
- Hosted browser: workspace creation, Gluco ready, hi visual response, visual pipeline and Sarvam read-aloud. Read-aloud changed to Stop reading, then back to Read aloud when stopped; no application budget error.
- Not measured: subjective audio intelligibility, microphone transcription in this release, sustained production load or clinical outcomes.

## Deployment
- Migration 062 applied after 60 hosted migration checksums verified.
- API ready revision: glucoflow-service--visual-gluco.
- Worker ready revision: glucoflow-worker--visual-gluco.
- Vercel production deployment READY: https://glucoflow.vercel.app
- API image sha256:5bfa4a36128048b8bc992bc6679646b4d643d0cc24bef15e69b216fb5ac19861
- Worker image sha256:e02cb6a5fd9d1ab3040c3b588889d15e4d453c0290f1003f6a9941e300d70e28
- Runtime image sha256:831a3984e14419eaf1dbc902c90afcfc16e169ee410cd15869662370f094fba4

## Boundaries
The new shared doctor-console reference was read and mapped in doctor-console-reference-2026-11-07.md. Medication administration imports, historical clinical-case matching, real hospital feeds and ABDM are not delivered by this visual release. Provider account quotas still apply. This remains a synthetic assistive demonstration, not a hospital production-readiness certification.

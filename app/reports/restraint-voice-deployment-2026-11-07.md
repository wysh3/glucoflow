# GlucoFlow interface, localization and voice release

7 November 2026. Verification uses synthetic demo identities. Follow the [care setup and release steps](../docs/CARE_SETUP.md) for reproduction and rollback.

## Prior production and release preflight

| Component | Prior production |
| --- | --- |
| API | `glucoflow-service--native20261107` |
| Document worker | `glucoflow-worker--native20261107` |
| Vercel | `dpl_6trejatiER5CsWtvNTEhcqbDEZGY` |

The read-only hosted migration preflight matched all 46 previously applied checksums. The approved release selection is `048_result_event_internal.sql`, `049_speech_usage_budget.sql`, `050_explicit_followup_dates.sql`, `051_scoped_escalation.sql`, `052_escalation_row_alias.sql` and `053_escalation_rowtype.sql`. Azure reported no `ENABLE_DELTA` environment entry on the previous API revision.

The API-only Sarvam deployment helper was checked with a synthetic secret fixture. It preserves existing Azure secrets, passes the new one by reference to the API container, refuses an insecure local credential file and reuses an existing secret on a subsequent deploy. The worker and private Hermes sidecar receive no speech key. The web build excludes provider environment values and scans the resulting static assets for known secrets.

The initial hosted allowance is cumulative across demo accounts and replicas: 60 audio seconds and 1,000 synthesis characters. The reservation commits in PostgreSQL before a paid request and includes dispatch failures. A restart, new revision or API rollback does not refill the ledger. Application consent and explicit browser microphone permission still apply. Provider workspace retention remains unverified.

## Built artifacts and local gates

| Image | Linux amd64 manifest SHA-256 |
| --- | --- |
| API | `1b9722f2edb04f479f928758f518db27a1e273635b98ffbe42ee608268b4cf83` |
| Hermes | `44d3d94735f72d67f42b45124f11dc189491d185ca0fec38fd5961183826361a` |

The pinned Hermes image reached readiness and validated the default English and explicit Hindi locale contract in 24.8 seconds at 0.25 vCPU and 512 MiB with networking disabled. The root release gate recorded 276 passing automated tests across 48 files, 26 Python tests, 12 database isolation checks, passing TypeScript and successful client/API/worker builds.

The authorized local Sarvam proof used two requests. Hindi synthesis of 65 text characters returned 4.075125 seconds of audio in 1.508 seconds. Transcription returned the exact synthetic text in 455 milliseconds. Those calls were local. The hosted deployment proof uses configuration and authorization reads.

The static client preflight passed its known-secret scan. Vite reported a 1,406.13 kB main script and 306.84 kB gzip size, down from the previous deployed build's 2,024.75 kB and 482.32 kB. The output no longer contains body-model or Draco assets. The remaining main-script size still triggers Vite's warning.

## Hosted schema

Azure Container Registry confirmed both manifest digests. The Supabase release transaction applied the six selected migrations. The post-apply check verified all 52 recorded checksums and no pending files. A read-only privilege check confirmed the API, worker and authenticated frontend roles cannot execute the raw result event writer. Only the API role can execute speech reservations, and it cannot directly insert, update, delete or truncate the speech ledger. The hosted speech ledger was empty before verification.

## Active hosted release

Azure marked `glucoflow-service--voice20261107` ready and healthy. The document worker remains on `glucoflow-worker--native20261107`. Azure verified the API's Sarvam secret reference and its limits of 60 audio seconds and 1,000 synthesis characters. Neither Hermes container nor the worker container has a Sarvam reference.

Hosted speech capabilities advertised `saaras:v4` and `bulbul:v4-flash` for the clinic and patient demo roles, with unauthenticated access returning HTTP 401. The capability response was marked `no-store`. API readiness, private Hermes health and both web and Android speech CORS preflights passed. A request for Hindi with a nonexistent synthetic workspace passed locale validation before returning HTTP 404. An unsupported locale returned HTTP 422. The retired Delta API returned HTTP 404. The hosted speech ledger remained empty after these checks.

Vercel marked `dpl_2DUZyHYgJ6SxqipdutNNohyuu1vk` ready and assigned the [public production alias](https://glucoflow.vercel.app). Direct requests to the landing, sign-in, privacy, care, retired demo Delta and patient overview paths returned HTTP 200 with the current SPA entry, blob playback CSP and `nosniff` header. The main JavaScript returned the expected MIME type and immutable caching. HTTP checks completed at 14:39:14 IST.

This was a web release. No updated Android APK or physical Android microphone verification is included. Restore the previous API revision or Vercel deployment using the [release runbook](../docs/CARE_SETUP.md). API rollback leaves the migrated database and speech ledger in place and keeps the legacy unscoped timer disabled.

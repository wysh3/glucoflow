# Application allowance removal — 7 November 2026

Requested change: remove application-imposed aggregate spending and usage allowances. A zero setting now explicitly means unlimited, rather than disabling configured speech or rejecting every reservation.

## Completed

- [x] Speech STT/TTS remain available when a server credential exists and aggregate limits are zero.
- [x] Migration 062 keeps authenticated usage accounting, expands counters to bigint and permits unlimited reservations when the configured allowance is zero. Existing accounting is retained.
- [x] Guide and Gluco runtime default to zero aggregate hourly allowance; unlimited mode does not accumulate an in-memory reservation queue.
- [x] Document extraction accepts a zero monetary ceiling, while retaining call, token and timeout execution limits and recording cost.
- [x] Azure revision configuration explicitly sets these allowances to zero, including when reusing an existing speech credential.
- [x] Environment examples and active setup documentation explain zero semantics.
- [x] Authorization, per-request payload limits, concurrency, bounded tool calls, provider timeouts and source approval remain intact.

## Verification

- Focused integration/unit suite: **37 passed / 37** across speech, guide, extraction adapter and provider reservation accounting. All provider tests use stubs; no live provider quality claims.
- Runtime cancellation/admission suite: **6 passed / 6**. Zero hourly allowance accepts more than 1,000 requests without retaining cumulative admission reservations; concurrency and cancellation tests still pass.
- Node and web TypeScript typechecks passed.
- Deployment helper Python compilation passed.
- Migration 062 applied successfully to the local database.

The first test run found two test fixture assumptions: PostgreSQL bigint returns text, and the speech client captures fetch at construction. Tests now parse the counter and install the provider mock before server construction. The corrected suite passed completely.

## Deployment required

Apply `062_speech_unlimited_usage.sql` to the hosted database before API rollout. Rebuild API, worker and Gluco runtime images; update both API and worker revisions using the deployment helper. Required values are `SARVAM_STT_MAX_SECONDS=0`, `SARVAM_TTS_MAX_CHARACTERS=0`, `GUIDE_MAX_CALLS_PER_HOUR=0`, `MAX_DOCUMENT_COST_USD=0`, and runtime `GLUCO_MAX_PROVIDER_CALLS_PER_HOUR=0` (legacy alias `HERMES_MAX_PROVIDER_CALLS_PER_HOUR=0` remains supported).

This report records local verification only. Provider-side account quotas and availability remain external constraints; the application does not bypass them. Optional positive allowances remain supported for administrators who explicitly configure them.

Acceptance mapping: operational reliability, server-side authorization and truthful provider availability are preserved; no clinical behavior, source review or approval scope changes.

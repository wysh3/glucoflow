# Gluco live action progress — 7 November 2026

The chat POST now optionally negotiates `application/x-ndjson` via its `Accept` header. Authentication, workspace scope, body validation and archive checks happen before headers are committed. Existing JSON callers retain the previous response contract.

The API flushes `context` after reading authorized records, then relays only a strict allowlist of action codes. The isolated runtime emits `starting`, `model` at the actual provider request boundary, `reading_sources` when a scoped read tool starts, `preparing_reply` when the terminal response tool starts, and `validating` after runtime validation. The API validates sources and proposals again, emits `saving`, then emits exactly one terminal `result` containing the saved workspace. An error after headers becomes a terminal error frame with a safe message and status.

These are process events, not model chain-of-thought. No generated reasoning, tool arguments, patient names, source text, provider errors or credentials enter a progress frame. Progress is not invented from elapsed time.

## Bounds and isolation

- Runtime journal lives in the individual turn's temporary directory, is deleted with the directory, and contains fixed codes only. Maximum 24 stages / 1 KiB.
- Sidecar flushes each frame and closes the HTTP stream after the terminal result.
- API validates stream shape, UTF-8, allowed stages, maximum 32 frames / 96 KiB, terminal uniqueness and completeness before accepting its output.
- No global progress registry or polling endpoint; no actor can inspect another actor's stream identifier.
- Existing request cancellation, 65-second bridge deadline, private subprocess reaping, provider budget, source verification and human approval remain in force.
- `Cache-Control: no-store, no-transform` and `X-Accel-Buffering: no` discourage proxy buffering. Hosted first-event latency still requires a deployed measurement.

## Validation

- TypeScript typecheck passed.
- 11 focused progress-parser and bridge tests passed.
- 22 focused API/progress tests passed, including real PostgreSQL authorization: patient and cross-clinic requests are rejected before streaming; an authorized request produces two action stages and one saved result.
- Parser regression proves a progress event arrives before the final result exists, accepts split network chunks and rejects arbitrary reasoning fields, incomplete/duplicated/excessive streams.
- Python child cancellation suite: 5/5 passed, preserving process reaping and slot release.
- Initial full pinned runtime run: 31/33 passed; two cancellation test assumptions failed under emulation because the subprocess was killed before writing a marker. Those tests now inspect the spawned OS PID directly and still require the process to be reaped. Focused rerun: 5/5 passed (`gluco-progress-cancellation-2026-11-07.txt`).
- Final native functional run: **34/34 runtime tests passed** in the pinned Linux image with networking disabled and loopback provider. Discovery also picked up a concurrently added source-bundle test module; the old image lacked its new helper mount, causing one import error. With the helper mounted, all **4/4 source-bundle tests passed** separately. These are separate runs, not a claim that the combined discovery command exited successfully. Logs: `gluco-progress-python-final-2026-11-07.txt` and `gluco-progress-bundle-2026-11-07.txt`.
- Actual HTTP streaming cancellation releases the single worker slot. The actual native custom-Luna test confirms `reasoning_effort: none` on both provider calls.

## Limits

Progress makes waiting understandable; it does not make provider computation instantaneous. Model answer tokens are not streamed before application validation. This release does not weaken the source checks to show speculative clinical content earlier. Real hospital integrations and patient data remain out of scope for the synthetic demo.

## Provider configuration correction

The native adapter already disabled automatic reasoning in its agent configuration, but inspection of the pinned custom-provider transport showed that this does not necessarily serialize `reasoning_effort` on an unregistered endpoint. Chat now explicitly sends `reasoning_effort: "none"` for the configured `gpt-6-luna` family and verifies that setting at the actual request boundary. Other models retain their existing configuration; document extraction retains its separate low-reasoning setting. A loopback HTTP test exercises the real upstream runtime and asserts both chat provider requests carry the explicit setting. A hosted measurement, not the configuration change alone, is needed to claim a latency improvement.

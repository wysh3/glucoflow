# Chat reliability completion — 7 November 2026

## Concrete findings

The existing private path was already bounded: API bridge 65 seconds, isolated sidecar 60 seconds including startup, native agent loop 25 seconds, provider HTTP timeout 8 seconds, at most three provider wire calls. The bridge had no automatic retry. The native runtime disabled SDK retries and capped native retry attempts. Thus an unlimited model loop was not the observed cause.

Two avoidable behaviors remained. After the successful `care_respond` tool had validated scope and rendered the entire product reply, the runtime still asked the model for an acknowledgement which the product discarded. A disconnected browser also left the isolated process consuming its slot until completion/deadline. A throwing timing callback could turn a verified response into a failed API turn.

Historical hosted startup/model timings are in `chat-latency-investigation-2026-11-07.md`. Those are not fresh measurements of this change.

## Implemented

- The Node bridge accepts an optional caller AbortSignal, refuses already cancelled calls, aborts its fetch, classifies cancellation separately from deadline expiry, and releases workspace admission in `finally`.
- Telemetry exceptions cannot discard an otherwise validated reply.
- The private sidecar monitors disconnection only for interactive chat. It terminates/reaps the isolated process group, releases the concurrency slot and leaves the conservative provider-call reservation intact. Cancelling cannot undo work already accepted by a provider.
- The native Hermes tool dispatcher still selects and executes the authorized read/respond tools. After a successful terminal `care_respond`, a private adapter control signal exits the native loop, with cleanup in `finally`. It cannot be raised by model text or an invalid/foreign-scope proposal. There is no fabricated provider acknowledgement, greeting bypass, changed clinical boundary or vendor-code patch.
- A normal source-backed turn now uses two provider calls instead of three. Repeating read attempts still stop at the original three-call cap. No extra paid request is made for final prose the UI does not use.

## Verification

- **8/8 TypeScript bridge tests passed**, including actual in-flight cancellation after the local HTTP server receives the request, refusing a second concurrent workspace turn, immediate post-cancel slot reuse, already-cancelled refusal and telemetry failure. The three new tests failed before the bridge changes. Node TypeScript compilation passed.
- **32/32 Python tests passed in 57.979 seconds**, executed in the existing pinned Hermes Linux image with changed adapter files mounted read-only, network disabled and only a loopback stub model. Transcript: `chat-reliability-python-2026-11-07.txt`.
- That suite includes real subprocess cancellation/reaping, real deadline expiry, stdout larger than the pipe, budget reservation retention, actual HTTP socket disconnection followed by successful reuse of a single-worker slot, native tool execution, invalid-order refusal, repeated-read cap, source/skill/language scope, and one-call extraction/record planning.
- The native source-backed tests assert **two** actual loopback provider requests. The HTTP cancellation test observes one abandoned provider request plus two calls for the successful next turn.

## Integration / remaining evidence

Root integration owns browser Stop and Fastify request-disconnect propagation. The added bridge seam alone does not certify browser cancellation. Updated Hermes and API images must be deployed and a bounded synthetic live-provider turn measured before claiming hosted latency improvement. No tokens are streamed before source validation; this change is terminal-tool completion and cancellation, not streaming.

Per-turn native imports/startup remain; process isolation is deliberately retained. The runtime's hourly admission ledger remains process-local and resets at restart. Durable clinic-level spending accounting is separate work. These tests do not establish production capacity, real-provider p95, or unlimited concurrent patient handling.

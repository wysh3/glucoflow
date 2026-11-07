# Chat latency investigation — 7 November 2026

## Actual request path
Vercel React client → Azure Fastify API → authorized PostgreSQL workspace snapshot → private Hermes HTTP sidecar → isolated Python process → pinned Hermes 0.23.0 AIAgent → configured custom provider (`gpt-6-luna`) → validated tool intent → API source validation → database commit → browser rendering.

## Measurements
Synthetic authenticated requests only. These are individual observations, not p95 or load-test results.

- Original hosted “hi”: 43,127 ms end to end.
- Separate original runtime log: bridge 46,960 ms; startup 28,704 ms; agent loop 14,409 ms; provider calls 9,559 ms; tools 220 ms; three provider calls. Do not combine this sample with the preceding request as if identical.
- Same runtime and model after sidecar CPU increase: “hi” 12,491 ms end to end. Bridge 12,105 ms; startup 5,754 ms; loop 5,567 ms; provider 3,446 ms; tools 62 ms; two calls.
- First request during CPU rollout returned 503. Subsequent request succeeded. Rollout interruption remains relevant.

## Root causes and limitations
1. The Hermes container was assigned 0.25 CPU / 0.5 GiB and starts a fresh Python process for every turn. Raising it to 1 CPU / 2 GiB substantially reduced measured startup. API allocation remains unchanged. Minimum one warm replica is retained. Higher resource allocation increases hosting cost; no cost saving claim.
2. Hermes imports and discovers general-purpose tools before applying the two-tool allowlist. An isolated, network-disabled local import profile measured run_agent at ~3.9 seconds, most under model_tools. Host Docker uses architecture emulation; this is diagnostic evidence, not Azure timing.
3. Care requests use up to three sequential provider calls. The final acknowledgement is discarded because the app renders the validated intent. This adds model latency; no unsafe forced-completion shortcut was introduced.
4. The visible response is a policy template selected by Hermes, not unrestricted generated prose. This explains repetitive answers. This behavior needs a separately validated conversational design change, not false claims that the model is broken.
5. Whole replies are returned after validation; there is no token streaming. The UI must show progress while this happens.
6. The sidecar permits one active request. Busy requests return 429, not an indefinite queue. Provider calls, retries and total duration are bounded. This is not evidence of production-scale capacity.

## Applied changes
- Live sidecar resources raised to 1 CPU / 2 GiB; deployment script preserves them.
- Removed the proposed greeting fast path; no canned greeting bypass was deployed.
- Submitted chat text clears immediately, displays in the same message layout as persisted text, and restores on failure.
- Shared orb has a smiling face and teal medical cap. Assistant message header uses that orb instead of the chat icon. Static header variant does not animate; loading variants retain reduced-motion support.

## Rejected experiment
Pinned Hermes restricted worker bootstrap passed 26 local tests but two hosted requests returned 503 without accepted tool output. Rolled back to the original runtime with the larger CPU. The experiment was also removed from local runtime.py. It is not part of the accepted fix. Stub-provider tests alone do not establish live-provider compatibility.

## Verification
- TypeScript typecheck passed.
- Nine bridge/client request tests passed.
- Local browser: deterministic helper submission, cleared composer, rendered source-backed reply and assistant orb verified. This is UI verification, not live-model evidence.
- Frontend deployment dpl_HkRireWhHxfQZDT1Nbz3v5ET658r is READY.
- Final runtime and hosted verification appended below.

### Final retained deployment and checks
- Azure revision `glucoflow-service--cpu-startup-stable` marked ready; original Hermes image retained at digest `44d3d94735f72d67f42b45124f11dc189491d185ca0fec38fd5961183826361a`, with 1 CPU / 2 GiB. API image unchanged. No shortcut API image was deployed.
- Final original-runtime Python suite: 26 tests passed in 26.100 seconds. Combined with nine bridge/client tests: 35 passing tests, plus TypeScript typecheck. These are targeted checks, not a full production certification.
- Hosted browser: signed into synthetic clinic, created workspace, sent “What is pending for the assigned encounters?”, observed real Hermes answer with three scoped source references and cleared composer. Backend bridge measured 15,345 ms; startup 6,388 ms, loop 7,746 ms, provider 5,564 ms, tools 76 ms, three calls.
- Screenshots: `evidence/chat-latency-2026-11-07/pending.png` and `hosted-chat.png`.
- Remaining work is explicit: startup amortization without sharing request data, terminal-tool completion instead of discarded acknowledgement, broader live-provider regression evaluation, and streaming only output that has passed source/scope validation. None is falsely marked complete here.
- Final post-rollback authenticated “hi” check succeeded with engine `hermes` in 13,312 ms end to end. Versus original 43,127 ms, this individual comparison is ~69% faster; not a percentile or reliability guarantee.

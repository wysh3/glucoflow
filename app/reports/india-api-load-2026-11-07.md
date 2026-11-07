# Bounded synthetic local HTTP load — 7 November 2026

Measured against the running API at `http://127.0.0.1:8787`. This was **one synthetic clinic identity**, not a crowd of human users. No hosted traffic, paid provider calls, database reset, or changes to pre-existing workspaces were performed. Each run creates nine disposable synthetic Care workspaces that remain in the local database. The measurements below are from the final run beginning at `2026-11-07T13:42:04.288Z` (run ID `89f47036-a399-411c-a3e1-7ed2d7077b72`), which supersedes the earlier run after adding an assertion requiring a successful baseline chat reply.

Reproduce from `app/`:

```sh
pnpm exec tsx scripts/stress-care-api.ts
```

The existing local API, migrated database, and `.local/demo-credentials.json` are prerequisites. Credentials and response bodies are kept out of output. Allow the actor's one-minute rate-limit window to clear before rerunning, and account for any other activity using that account. Results overwrite `reports/india-api-load-latest.json`; retain that file before rerunning if comparing measurements. There is no remote URL option, redirects are rejected, each request has a 15-second timeout, and the hard request budget is 190.

## Observed results

157 total HTTP requests including authentication, setup, verification and three mismatched-payload probes. All 19 assertions passed, including the non-vacuous successful baseline chat reply assertion. No 5xx or transport failures occurred in the measured load waves. This brief localhost run is not a deployment capacity or sustained-throughput certification.

| Workload | Concurrency | Requests | p50 ms | p95 ms | Requests/sec | HTTP outcomes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Same-workspace read | 1 | 30 | 3.38 | 4.32 | 285.43 | 30 × 200 |
| Same-workspace read | 5 | 30 | 3.49 | 11.69 | 1130.26 | 30 × 200 |
| Same-workspace read | 10 | 30 | 4.66 | 11.19 | 1600.65 | 30 × 200 |
| Distinct-key, same-revision mutation | 1 | 1 | 6.61 | 6.61 | 150.45 | 1 × 200 |
| Distinct-key, same-revision mutation | 5 | 5 | 5.81 | 6.52 | 746.42 | 1 × 200; 4 × 409 |
| Distinct-key, same-revision mutation | 10 | 10 | 8.12 | 9.62 | 1014.93 | 1 × 200; 9 × 409 |
| Same-key replay | 1 | 1 | 4.82 | 4.82 | 205.79 | 1 × 200 |
| Same-key replay | 5 | 5 | 3.88 | 4.50 | 1075.27 | 5 × 200 |
| Same-key replay | 10 | 10 | 5.28 | 7.09 | 1360.38 | 10 × 200 |
| Offline chat, shared workspace | 1 | 1 | 5.60 | 5.60 | 177.91 | 1 × 200 |
| Offline chat, shared workspace | 5 | 5 | 5.28 | 5.72 | 854.03 | 1 × 200; 4 × 409 |
| Offline chat, shared workspace | 10 | 10 | 7.73 | 8.36 | 1174.21 | 1 × 200; 5 × 409; 4 × 429 |

Each mutation contention wave committed one new synthetic encounter and rejected the remaining stale revisions. The replay waves returned 200 for all 16 requests and persisted exactly one matching encounter per wave; all three altered payloads with reused keys returned `idempotency_conflict` (409). The single-request level is a baseline, while concurrency 5 and 10 exercise competing/repeated requests.

The nine chat 409s were explicit `stale_revision` conflicts, not server crashes. Four chat requests returned `rate_limited` (429), consistent with the endpoint's 12-request/minute per-actor limit and 16 attempts in this run. Three chat responses succeeded and identified the offline engine. The chat throughput numbers count all responses, including conflicts and throttles; they do not measure successful assistant replies per second. Callers must handle contention and throttling; this run does not establish whether the UI retries or explains these cases adequately.

## Interpretation and limits

Reads of a single workspace acquire a database row lock, so these figures include that contention. Only 30 reads per level and tiny mutation/chat waves were used: short-run warm-up, timing noise, database state, and other local activity can materially affect the result. Latency percentiles use nearest-rank over full response completion, including error responses, with no warm-up exclusion.

This covers real local HTTP transport, seeded authentication, route validation, row-locked mutation behavior, idempotency and explicit offline chat. It does not test many independent user identities, browser or Android rendering, distributed clients, long-running load, uploads, worker capacity, Hermes/model inference, clinical answer quality, or production infrastructure. All generated names and context are explicitly synthetic.

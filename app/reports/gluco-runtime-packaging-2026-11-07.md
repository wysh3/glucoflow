# Gluco runtime source and configuration audit — 7 November 2026

## Delivered

The repository now contains the full tracked source of the pinned runtime foundation as `hermes/vendor/gluco-runtime-source.tar.gz` (86 MiB; 22,551 regular files). The archive was produced from clean release commit `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19` with `git archive`, not a filesystem copy. Its SHA-256 is `c863835bdba04434f8ac8cbb58935923c1d4f8f1f0a82d01bf391b848383a28d`.

`hermes/vendor/manifest.json` records provenance and reproduction. The archive includes the upstream MIT license, dependency lock and documentation, with no `.git`, real `.env`, `node_modules`, `.local` or `__pycache__` path. The application policy, adapter and reviewed care routines remain ordinary source files outside that immutable dependency archive. Internal module/environment names and required upstream notices retain their original names for compatibility and attribution; product branding is Gluco.

`hermes/unpack_source.py` verifies the checksum, validates the archive root, uses Python's safe data extraction filter, writes the source commit marker and refuses to overwrite an existing checkout. `deploy/hermes.Dockerfile` now copies and expands this local archive instead of installing Git and cloning GitHub. Local Python instructions use the same included source. Compose names the runtime service `gluco` and uses `.local/care-gluco.env`; API compatibility environment names remain unchanged.

The first build still installs frozen Python packages and pulls container base images. Live model and Sarvam calls require their configured services. No claim of an entirely offline model or air-gapped dependency distribution is made.

## Configuration trace

Authoritative reference is the exact included upstream `cli-config.yaml.example`, not an unpinned current website:

- Example model at line 81: `anthropic/claude-opus-4.6`; provider defaults to automatic selection. There is no GPT default to copy.
- Example reasoning at line 1367: `medium`.
- Gluco constructs `AIAgent` with an explicit custom Chat Completions provider, operator-configured `MODEL_NAME`, no fallback provider, no session persistence, no background review, no memory/context discovery and no checkpoints.
- Current checked-in example model is `gpt-6-luna`. Chat output cap is 650 tokens, at most three wire dispatches, two for the normal source-read/accepted-response sequence, eight-second HTTP timeout, 25-second model loop budget and 60-second total isolated subprocess deadline. The HTTP client has zero automatic retries; the adapter bounds the upstream loop separately.
- Extraction is a separate one-call path with up to 4,096 output tokens and low reasoning for `gpt-6-luna`; record planning has a 900-token cap and explicit `none` effort for that model.
- **Discovered gap:** passing `reasoning_config={enabled: false}` alone does not guarantee a `reasoning_effort: none` wire field on unknown custom endpoints. The upstream legacy transport gates reasoning on route capabilities. The runtime implementer added an explicit `reasoning_effort: none` override for `gpt-6-luna` care chat, enforced it in the outgoing wire guard, and added a native mock-provider wire regression. Provider-side default reasoning cannot be inferred from the old configuration alone; this release makes the requested effort explicit.

The official GitHub URL fetch failed in the web tool; all statements above were checked against the clean pinned local source included in the archive, not an assumed latest release.

## Verification

- SHA-256 verification and archive content scan: passed; 22,551 source files, license and lock present, zero forbidden local-state paths.
- Four `test_source_bundle.py` regressions: passed (valid extraction, tampered archive rejection, unexpected root rejection, preserving existing local edits).
- Linux/amd64 Docker builds from the bundled source: passed before and after bytecode preparation.
- Final prepared image imports its pinned agent successfully with `docker run --network none` (no credential or provider request).
- Compose config validation with synthetic token and empty env-file placeholders: passed. This verifies configuration shape, not a full hosted deployment.

## Import timing experiment

Three isolated `upstream_ready()` checks per local Linux/amd64 Docker image:

| Build | Run 1 | Run 2 | Run 3 | Median |
|---|---:|---:|---:|---:|
| Bundled source, no explicit bytecode preparation | 5,004 ms | 3,831 ms | 3,617 ms | 3,831 ms |
| Frozen dependencies compiled; actual agent import precompiled at build | 4,980 ms | 3,488 ms | 3,612 ms | 3,612 ms |

Raw results: `gluco-runtime-import-before.json` and `gluco-runtime-import-after.json`. The cold run is essentially unchanged; the 5.7% median difference is exploratory, not a proven hosted latency improvement. Precompilation preserves process isolation and does not keep patient state or credentials warm. Remaining import/provider latency needs hosted tracing; instant feedback from actual progress events is separate from model completion latency. No sustained-capacity or p95 performance claim follows from this small check.

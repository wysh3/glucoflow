# Gluco runtime

Gluco's bounded care agent runs from source included in this repository. Its
foundation is Hermes Agent **v0.23.0**, commit
`2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`, under the MIT license. The full
tracked upstream source is bundled in `vendor/gluco-runtime-source.tar.gz`;
`vendor/manifest.json` records its SHA-256, provenance and reproduction command.
The application-specific adapter, operational policy and reviewed care routines
are ordinary editable source beside it. Upstream names in internal modules,
license notices and compatibility settings are intentionally retained.

No build or startup clones the upstream repository. Docker and local setup verify
and expand the included source. Normal Python/npm packages and container base
images still need their package registries on a first build; live model and
speech features need their configured providers. This is not an offline AI claim.
The archive includes the upstream license, dependency lock and documentation.

## Run

From the repository root:

```sh
docker build -f app/deploy/hermes.Dockerfile -t gluco-runtime app
cp app/hermes/runtime.env.example app/hermes/.env
# Configure the service token and model credential in the ignored file.
docker run --rm --env-file app/hermes/.env -p 127.0.0.1:8080:8080 gluco-runtime
```

The API still accepts `HERMES_URL=http://127.0.0.1:8080` and
`HERMES_SERVICE_TOKEN` as compatibility configuration names. Set the same token
as the runtime's `GLUCO_SERVICE_TOKEN`. Keep the runtime private to the API.
`GLUCO_BIND_HOST` and `PORT` configure its listener. A service token must contain
at least 24 characters. `GLUCO_MAX_CONCURRENT` and
`GLUCO_MAX_PROVIDER_CALLS_PER_HOUR` configure admission. The hourly allowance defaults to `0` (unlimited); concurrency remains bounded. Legacy `HERMES_*` runtime
settings remain accepted so existing deployment secrets keep working.

Use an OpenAI-compatible provider supporting function calls on
`/chat/completions` and the configured `MODEL_NAME`. HTTPS and loopback HTTP
(local model server) are supported. The existing `GUIDE_MODE=live` configuration
can supply `GUIDE_API_KEY`, `GUIDE_BASE_URL` and `GUIDE_MODEL_NAME` when the
corresponding `MODEL_*` setting is absent.

For local Python development, use Python 3.14 and uv:

```sh
# Verify the bundled archive without extracting or making network requests.
python3 app/hermes/unpack_source.py --check-only
# On a fresh checkout, expand the included source (no git clone).
python3 app/hermes/unpack_source.py
(
  cd app/hermes/vendor/hermes-agent
  UV_PROJECT_ENVIRONMENT="$(pwd)/../../.venv" uv sync --frozen --no-dev --no-install-project --python 3.14
)
app/hermes/.venv/bin/python -m unittest discover -s app/hermes/tests -v
# Export runtime settings from your secret store or trusted local config.
app/hermes/.venv/bin/python app/hermes/server.py
```

The unpacker refuses to overwrite an existing source directory. For inspection,
use `--destination /path/to/empty-directory`; preserve any existing local edits.
The unexpanded archive is the shipped dependency source of truth. Changes to the
Gluco adapter belong in `runtime.py`, `server.py`, `policy.py` and `skills/`;
changing the vendor foundation requires regenerating the archive and its manifest.

The local process defaults to `127.0.0.1:8080`. The test suite uses the actual
pinned Hermes agent with a local protocol-compatible model stub and synthetic
data. It needs no model key.

## Model configuration and latency

The pinned upstream `cli-config.yaml.example` chooses
`anthropic/claude-opus-4.6` and a medium reasoning setting. There is no upstream
GPT default that this application inherits: Gluco constructs the agent with an
explicit model/provider and a private profile. Our checked-in example selects
`gpt-6-luna`; the deployed model remains operator configuration.

Care chat explicitly requests `reasoning_effort: none` for `gpt-6-luna` and disables
background review, memory, local context files,
checkpoints and session persistence. It limits output to 650 tokens, HTTP calls
to eight seconds, retries to zero at the HTTP client, and provider dispatches to
three. A normal source-read and accepted response takes two dispatches. Document
extraction has a distinct one-call budget and low reasoning for compatible
OpenAI models; record planning uses none. No setting promises instant replies.
The isolated process cold-import cost and provider time remain measurable phases;
phase events provide honest progress while the accepted reply is validated.

## Behavior

- `GET /health` reports the upstream version, commit, configured model name,
  configuration state and whether the pinned code and dependencies can be
  imported. `extractionAvailable` and `recordPlanAvailable` also check for the
  installed native skill files. A successful live turn verifies model connectivity.
- `POST /chat` requires `Authorization: Bearer <internal token>` and a JSON
  body containing `message`, `workspace`, `history` and `requestId`. The API
  supplies an authorized workspace marked `synthetic: true`. Use only
  synthetic patient and staff data in the simulator and in chat.
- The worker runs the upstream `AIAgent.run_conversation` tool loop. Its
  two registered tools read the supplied snapshot and submit a typed
  operational intent. The adapter ends the native turn immediately after a
  successful, scope-validated `care_respond` tool execution. It does not make
  another provider request for a discarded acknowledgement. GlucoFlow renders
  the response from source events and verified identifiers. A monitor, handover or playbook proposal is a draft
  for review in the authenticated app. The API owns all persistent state,
  event validation, authorization, approval and task execution.
- The agent can read literal notes attributed to their synthetic encounter record.
  HIS and LIS evidence links identify independently recorded simulator events.
  A current approved clinic skill match loads the trusted `source-handoff`
  instruction through native Hermes `skill_view`. The application tests,
  approves and versions reusable procedures and verifies the new encounter's
  evidence before proposing reuse.
- `POST /extract` and `POST /record-plan` are private one-call Hermes agent
  routes with the same bearer authorization. They accept approved prompt hashes
  and load reviewed `SKILL.md` instructions through upstream `skill_view`.
  Extraction receives bounded prepared text and up to two PNG page images in
  the upstream agent's native multimodal message. The document worker handles
  preparation, source mapping, durable spending reservations and review drafts.
  Record planning receives bounded text and returns a plan for the API to
  validate and render. Each route allows one provider wire call.
  `/extract` allows 24 MiB and at most 4,096 output tokens within 55 seconds.
  `/record-plan` allows 32 KiB and at most 900 output tokens within 30 seconds.
- The worker runs each turn in a new process and private temporary Hermes
  profile. The model tool surface is limited to those two operations, and
  context files, memory, plugins, session persistence and background review
  are disabled for the worker. The service returns an error if a configured
  provider or Hermes run fails. The app presents its deterministic helper
  separately as offline mode.
- Each chat request is limited to 128 KiB, eight prior turns and 60 seconds including
  the isolated process startup. The conversation loop has a 25-second budget,
  two tool executions and at most three outbound provider calls (including
  unsuccessful attempts). A normal read → accepted response uses two calls. Each provider call
  has an 8-second HTTP timeout and a 56 KiB wire input cap, and requests at most
  650 output tokens. The service reserves the route's full wire allowance at
  admission only when an optional hourly allowance is configured. `GLUCO_MAX_PROVIDER_CALLS_PER_HOUR=0`
  (the default) disables the aggregate allowance; positive values enable a sliding hourly
  allowance per process. `GLUCO_MAX_CONCURRENT` still bounds concurrent workers.
  Hosted deployments use zero aggregate allowances. Provider account quotas still apply.
- The private `X-Hermes-Timing` header contains phase durations and the number
  of provider requests dispatched. The care bridge records the bounded numeric
  fields with the HTTP status and bridge duration.

- A disconnected `/chat` caller cancels its isolated process group and releases
  the admission slot. Cancellation does not refund reserved provider calls or
  reverse an already accepted provider request. `/extract` and `/record-plan`
  retain their independent job lifecycles. The Node bridge accepts a caller
  AbortSignal and does not save a cancelled reply; the route must check the
  signal before opening its append transaction. It remains a bounded complete
  response, not token streaming of unvalidated output.

# GlucoFlow care workspace setup

Open `/clinic/care` after signing in as a clinic member. Each new workspace starts with synthetic encounters, orders and HIS/LIS events. The four roles inside the simulator exercise different workflow actions within that workspace. The API uses the signed-in identity and clinic membership to authorize access. Public demo sign-ins are shared synthetic identities. Use separately provisioned accounts when verifying access separation.

The API owns commands, approval, task state and evidence. Gluco reads the authorized synthetic snapshot and can return source references and proposals. Apply a proposal through the explicit human action in the workspace. The **Offline helper** is a separately labelled deterministic mode. A live runtime or provider failure remains visible in **Ask**.

The server reconciles monitoring when a workspace is read, a command runs, or a simulated source event arrives. The visible client refreshes periodically. The simulator has no external HIS/LIS poller. A disconnected or stale simulated feed leaves unresolved evidence unknown.

## Bundled runtime source

The runtime foundation is included as a checksum-verified source archive in
`hermes/vendor/`; Docker expands it locally and never clones upstream. See the
[runtime setup and provenance](../hermes/README.md) for local Python setup and
an inspectable source expansion. The compatibility filename
`deploy/hermes.Dockerfile`, deployment flags and API environment names remain
stable for existing releases. First-time package installation/base-image pulls,
model calls and speech still require their respective services.

## Local development

From `app/`, follow [the local setup guide](SETUP.md) to start PostgreSQL, apply migrations and create the synthetic demo accounts. Run `pnpm dev` and open `http://127.0.0.1:5173/clinic/care`. Use the offline helper when running without a configured Gluco service.

For live chat, put your authorized provider settings in ignored `.local/care-gluco.env`, readable only by your account. The Python service expects an OpenAI-compatible Chat Completions base URL and a model supporting function calls. Use a provider account authorized for this demo.

```dotenv
MODEL_BASE_URL=https://provider.example/v1
MODEL_NAME=your-tool-capable-model
MODEL_API_KEY=replace-locally
```

Start the runtime and then the existing local app in the same shell. The token stays in the environment and is shared by the two processes.

```bash
export HERMES_SERVICE_TOKEN="$(openssl rand -hex 32)"
export HERMES_URL=http://127.0.0.1:8642
docker build -f deploy/hermes.Dockerfile -t gluco-runtime:local .
docker run -d --rm --name glucoflow-care-runtime \
  --env-file .local/care-gluco.env --env HERMES_SERVICE_TOKEN \
  --env PORT=8642 --env HERMES_MAX_PROVIDER_CALLS_PER_HOUR=60 \
  --env HERMES_MAX_CONCURRENT=1 --publish 127.0.0.1:8642:8642 gluco-runtime:local
pnpm dev
```

`curl http://127.0.0.1:8642/health` checks the pinned runtime import and provider configuration. A successful **Ask** response from Gluco verifies that the provider accepted a live turn. Stop the local runtime with `docker stop glucoflow-care-runtime`.

## Portable containers

`deploy/compose.care.yaml` builds the API and Gluco services. It publishes the API on local port 8787 and connects the API to Gluco over the Compose network. It expects an existing migrated PostgreSQL database and the authentication and storage settings in [the API setup guide](SETUP.md). Configure the database URL with a hostname reachable from the containers. The native development database listens on the host loopback interface.

Put API-only settings in `.local/care-api.env` and model-only settings in `.local/care-gluco.env`. Set the same `HERMES_SERVICE_TOKEN` as above and run from `app/`.

```bash
docker compose -f deploy/compose.care.yaml config --quiet
docker compose -f deploy/compose.care.yaml up --build -d
curl http://127.0.0.1:8787/health/ready
```

Enable the `documents` profile to start the upload and export worker. Put its database, storage and extraction-budget settings in `.local/care-worker.env`. Set `EXTRACTION_MODEL` to the runtime's `MODEL_NAME`. The worker uses the service token over the private network and the model key belongs in the Gluco environment file.

```bash
docker compose --profile documents -f deploy/compose.care.yaml up --build -d
```

Serve the Vite client with the target API URL in `VITE_API_BASE_URL`. For Supabase sign-in, also set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Browser and Capacitor origins must appear in the API's `ALLOWED_ORIGINS` setting.

## Hosted demo release

The release uses Azure Container Apps, private ACR, Supabase services and Vercel. The API and private Gluco sidecar share a revision; only API port 8787 is public. The runtime listens on port 8642 with a separate shared service token. Provider credentials remain server-side as `MODEL_API_KEY`. Replica counts, resource allocations and provider-call budgets are deployment settings: inspect the current configuration with `python3 scripts/deploy-care-azure.py inspect --component api` rather than relying on historical release defaults. Per-process budgets reset when a replica restarts and are not an account-wide spending limit.

A live turn has a 60-second subprocess deadline including its cold import. The API bridge waits up to 65 seconds. The model loop has a 25-second conversation budget and each provider request has an 8-second HTTP timeout.

For document processing, the worker runs a second private instance of the same Gluco image. It sends prepared PDF or photo batches over authenticated loopback `/extract` and owns durable processing, validation and draft review. Deployment call caps and document budgets can stop processing early. Inspect the worker with `python3 scripts/deploy-care-azure.py inspect --component worker`; the final 7 November deployment uses a two-call document cap. Earlier audit resource and ten-call examples are historical, not current capacity promises.

From `app/`, sign in to the existing Azure subscription and Vercel team. Use authenticated operator access and the ignored hosted configuration from [Hosted demo operations](HOSTED.md). Docker BuildKit uses the service-specific context allowlists.

```bash
az acr login --name glucoflowwysh2026
registry=glucoflowwysh2026.azurecr.io
release="care$(date -u +%y%m%d%H%M%S)"
docker build --platform linux/amd64 --provenance=false -f deploy/api.Dockerfile -t "$registry/glucoflow-api:$release" .
docker build --platform linux/amd64 --provenance=false -f deploy/hermes.Dockerfile -t "$registry/glucoflow-hermes:$release" .
docker build --platform linux/amd64 --provenance=false -f deploy/worker.Dockerfile -t "$registry/glucoflow-worker:$release" .
docker push "$registry/glucoflow-api:$release"
docker push "$registry/glucoflow-hermes:$release"
docker push "$registry/glucoflow-worker:$release"
```

Record the pushed digests. Confirm the integration gates before applying migrations. The hosted helper checks the existing migration history over verified TLS and applies only the care release migrations in one transaction.

```bash
pnpm exec tsx scripts/deploy-care-migrations.ts --check
pnpm exec tsx scripts/deploy-care-migrations.ts --apply
python3 scripts/deploy-care-azure.py deploy-worker \
  --worker-image "$registry/glucoflow-worker@sha256:<worker-digest>" \
  --hermes-image "$registry/glucoflow-hermes@sha256:<hermes-digest>" --suffix "${release}-proof" --document-call-cap 2
pnpm exec tsx scripts/deploy-care-worker-smoke.ts --confirm-live
python3 scripts/deploy-care-azure.py deploy-worker \
  --worker-image "$registry/glucoflow-worker@sha256:<worker-digest>" \
  --hermes-image "$registry/glucoflow-hermes@sha256:<hermes-digest>" --suffix "$release" --document-call-cap 10
python3 scripts/deploy-care-azure.py deploy \
  --api-image "$registry/glucoflow-api@sha256:<api-digest>" \
  --hermes-image "$registry/glucoflow-hermes@sha256:<hermes-digest>" --suffix "$release" --hermes-extraction
pnpm exec tsx scripts/deploy-care-smoke.ts --offline-only
python3 scripts/deploy-care-web.py --deploy
```

The document smoke requires the staged two-call worker revision. It uploads one synthetic PDF and then an ordered pair of synthetic photos, verifies source bytes and order, cross-clinic denial, Hermes provenance and durable usage, and leaves the drafts for human review. Run it once for a maximum of four hosted model requests. If a request is interrupted after the PDF commits, use `--confirm-live --resume-pdf` within 30 minutes to verify the existing job before checking the photos. The care smoke checks source-backed completion, export, stale revision rejection, idempotency, the shared skill lifecycle and isolation. It makes one additional bounded live Hermes turn when run without `--offline-only`. After publishing, verify direct navigation to `https://glucoflow.vercel.app/clinic/care`, authenticated clinic entry, patient entry and the signed Android client.

For an API rollback, run `python3 scripts/deploy-care-azure.py rollback --revision <previous-ready-revision> --suffix <new-rollback-suffix>`. Use `--component worker` and the previous worker revision for worker rollback. The schema migrations are additive and remain applied. If a web rollback is needed, restore the prior production deployment in the existing Vercel project.

### Speech and language update

Apply migrations 048 through 053 using the same hosted checksum runner before starting the API revision. Migration 049 stores cumulative deployment speech reservations in PostgreSQL. The hosted Sarvam setting permits 60 seconds of audio and 1,000 text characters across accounts and replicas. Failed provider calls may consume their reservation. Restarts, ordinary redeploys and rollback leave the ledger in place.

Add `--sarvam-speech` to the API deploy command alongside `--hermes-extraction`. On first use it reads `SARVAM_API_KEY` from the ignored, mode-0600 `app/.env` file and adds the corresponding Azure secret while preserving existing secrets. The new revision references it only in the API container. Later uses reuse the installed secret. Worker, Hermes and browser builds require no Sarvam credential.

For an update limited to the API and its care runtime, keep the existing document worker revision. Run `pnpm exec tsx scripts/deploy-care-smoke.ts --speech-only` after the API is ready. This verifies the advertised Sarvam models, request limits and authorization for the clinic and patient roles without submitting audio or text to the provider.

API rollback sets `RESULT_ESCALATION_DISABLED=true` for compatibility with older images. The migrated database requires explicit clinic scope for escalation and the old background sweep remains disabled.

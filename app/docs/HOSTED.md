# Hosted demo operations

Verified on 3 October 2026. Public site: https://glucoflow.vercel.app.
The site contains synthetic patients and reports. New documents use the live
GPT-6 Luna provider; the six historical seeded documents retain fixture provenance.
Publication always requires a human reviewer.

## Services and cost

| Service | Deployed configuration |
| --- | --- |
| Web | Vercel Hobby, project `glucoflow`, static Vite build with SPA fallback |
| Database/Auth/Storage | Supabase Free, project `fynlsoxyazizblbmhwkn`, Mumbai |
| API | Azure `glucoflow-service`, Consumption, 0.25 vCPU / 0.5 GiB, 0–1 replicas |
| Worker | Azure `glucoflow-worker`, Consumption, 0.5 vCPU / 1 GiB, 0–1 replicas |
| Images | Private ACR `glucoflowwysh2026`, Basic, managed identity pull |
| Environment | `glucoflow-standard`, Central India, no Log Analytics workspace |
| Android | Signed package `in.glucoflow.demo`; APK in root `deliverables/` |

All Azure resources are in the dedicated `glucoflow-demo` resource group. The
subscription remains Azure for Students. No subscription upgrade was made.

ACR Basic was priced at US$0.1666/day in the Azure Retail Prices API: roughly US$5
for 30 days. Consumption compute and requests have monthly free allowances,
shared with other usage in the subscription. This is an estimate, not a promise
of a fixed bill. Traffic, processing duration, storage limits, taxes and currency
conversion can change the total. OpenAI charges are separate. Current extraction
limits are US$0.10/document, four calls/document and 120,000 tokens/document;
these are per-document gates, not a monthly account cap.

The Azure resource-group budget `glucoflow-demo-monthly` is US$10/month through
November 2026, with 80% actual / 100% forecast alerts. **A budget does not stop
spending automatically.** Check Azure Cost Management during the demo month.
Vercel Hobby eligibility and Supabase Free limitations still apply. Supabase can
pause inactive free projects; scale-to-zero causes cold starts.

Sources: [Azure Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing),
[Vercel pricing](https://vercel.com/pricing), [Supabase pricing](https://supabase.com/pricing).

## Access

Credentials are in ignored `app/.local/hosted-demo-credentials.json`, mode 600.
Use `clinician` for the doctor overview, `clinic` or `reviewer` for publication,
and `patient` for report upload and their own records. `other-clinic` and
`other-patient` are isolation-test accounts. Do not publish this file or keys.
Public self-signup is disabled. Roles are database memberships; clients cannot
assign them. No phone OTP provider is configured.

API base URL:
`https://glucoflow-service.lemonpebble-6e1c6c4b.centralindia.azurecontainerapps.io`.
Health checks: `/health/live`, `/health/ready`. `/api/v1/config` exposes only public
configuration. Allowed browser origin is `https://glucoflow.vercel.app`; Android's
bundled origin is `https://localhost`.

## Database and storage

The hosted database uses the 16 existing migrations with checksum tracking. The
managed `postgres` account cannot execute local superuser role alterations. Roles
were pre-created as NOLOGIN, NOSUPERUSER, NOBYPASSRLS, and only the migration's
local bootstrap role block was skipped. Applied migration files were unchanged.
Do not use the unmodified local migration/seed/reset runner against hosted data.

API and worker logins have separate randomly generated credentials and use
`sutra_api` / `sutra_worker` privilege roles per transaction. They do not own
tables or bypass row-level security. The deployment retains internal `sutra`
schema, bucket and role names for compatibility. Browser Auth UUIDs match
`app_users`; the hosted database has no local password hashes.

Database connections use the Mumbai session pooler, port 5432. API and worker
verify TLS using `deploy/supabase-ca.crt` and `NODE_EXTRA_CA_CERTS`. The KEDA
connection is encrypted (`sslmode=require`); its separate `glucoflow_scaler`
role can only execute `sutra.queue_depth()`, not read patient tables. The aggregate
includes queued, retry-wait and running jobs so the worker remains active while
processing. KEDA polls every 15 seconds, with a 120-second idle cooldown.

Buckets `sutra-sources` and `sutra-exports` are private. Signed byte uploads use
PUT; creation of the signed token uses POST. Source access URLs last 60 seconds.
Temporary policy-test tables and failed Express-environment resources were removed.

## Rebuild and update

Container source context must exclude `.env`, `.local`, signing keys, test records
and local databases. `.dockerignore` is provided. Build Linux amd64 images with
`deploy/api.Dockerfile` and `deploy/worker.Dockerfile`, then push to the private
registry. Azure ACR Tasks are unavailable on this student subscription, so images
were built locally. Containers run as `node`. Native worker modules are explicit
worker dependencies, including OCR, PDF, canvas and image processing libraries.

`deploy/azure/*.template.json` records the resource configuration with all secret
values replaced. Fill a copy under ignored `.local/` only; never commit that copy.
Use an explicit **WorkloadProfiles** environment with the Consumption profile.
Azure CLI's default Express environment did not support the required worker scaler
and was removed. Update the existing app with a new revision suffix and preferably
an immutable image digest. Preserve secret references and the managed identity.

Build the frontend with public `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_DEMO_LABEL`. The publishable key belongs
in the client; service-role, database and model keys do not. Vercel prebuilt output
contains only static client assets and the SPA routing/security configuration.
Deploy to project `glucoflow` in `wyshs-projects` and use the public alias above.
The team-suffixed alias requires Vercel SSO and is not the demo link.

Build Android with the same public frontend settings using `pnpm android:apk`.
The hosted APK has been built and signed; installation against the hosted services
on an emulator or physical device has not yet been tested.

## Verify and retire

The dated report under `reports/` contains the actual 25/25 hosted flow and 12/12
policy checks, plus browser screenshots. Repeat synthetic upload → processing →
review → approval → export → patient access after an image/configuration change.
Check that another clinic cannot access the record and that patients cannot approve.
Stop local workers using the hosted database before claiming Azure worker proof.

The demo maintenance logic exists but no automatic hosted retention job was
provisioned. Plan cleanup after recording; do not claim automatic erasure or backup
erasure. Never run the local reset command against this project. When the demo month
ends, remove the dedicated `glucoflow-demo` Azure resource group to stop its registry
and compute charges, then archive or remove the demo Supabase/Vercel projects as
appropriate. Resource deletion must be deliberately authorized at that time.

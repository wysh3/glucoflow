# Glucoflow hosted deployment — 3 October 2026

Public demo: https://glucoflow.vercel.app.
Vercel Hobby frontend, Supabase Free in Mumbai, Azure Container Apps Consumption
API and worker in Central India, private ACR Basic. This is a synthetic demo, not
an independently validated clinical deployment.

## Measured results

| Check | Result |
| --- | --- |
| TypeScript | Both projects clean |
| Tests after the deployment fixes | 126/126 across 19 files |
| Hosted database isolation | 12/12, using the API privilege role |
| Hosted API flow | 25/25 against the public Azure API |
| Extraction worker | Azure worker processed the synthetic upload in 20.5 seconds; identity matched; one HbA1c entry proposed |
| Review and publication | Explicit review, stale revision 409, approval revision 7, repeated approval returned the original batch |
| PDF export | Azure worker rendered; signed download returned a 3,204-byte PDF |
| Cross-clinic protection | Patient record and export access returned 404 to the other clinic; patient approval returned 403 |
| Browser: doctor | Real Supabase sign-in, progression with four HbA1c observations, prescription/examination context, source PDF visible |
| Browser: patient | Sign-in, approved records, report state, own private source PDF visible; sign-out exercised when switching roles |
| Signed source renewal | Expired 60-second link was surfaced; refresh/reopen returned the source page |
| Worker scaling | One running Azure replica handled the upload/export; later replica count was zero |
| Android | Signed release APK built against the hosted API; hash below; no hosted-device installation claimed |
| Public artifact checks | Web assets, Android assets and sanitized infrastructure templates scanned for the service key, owner database password and model key; none found |

The local production test worker was stopped **before** hosted smoke. The local dev
worker uses the separate local database. Azure worker console output recorded the
live `openai-compatible` / `gpt-6-luna` configuration, document processing and export
rendering. This proves one hosted synthetic processing flow; it is not a general
extraction accuracy or latency benchmark.

Raw checks are in [raw/hosted-2026-10-03](raw/hosted-2026-10-03).
Local typecheck/test output is copied there as well. Browser evidence:

- [Doctor progression](evidence/hosted/clinic-progression.png)
- [Doctor source](evidence/hosted/clinic-source.png)
- [Patient records](evidence/hosted/patient-records.png)
- [Patient source](evidence/hosted/patient-source.png)

## Deployment defects found and fixed

1. Supabase signed byte uploads require PUT. The adapter had returned POST, and the
   old stub asserted the same wrong method. A real bucket returned POST 400 / PUT 200.
   The corrected regression test failed before the implementation change and passes
   afterward; it now uploads bytes with the returned method and without service auth.
2. The built worker could not resolve native/PDF/OCR external modules from its own
   package. Runtime dependencies were added explicitly, rebuilt for Linux amd64 and
   checked inside the image. The hosted worker then processed and exported successfully.
3. Azure's default Express environment was incompatible with the required worker
   scaler/private identity image pull. A standard WorkloadProfiles environment with
   Consumption was created explicitly. The failed app and unused Express environment
   were deleted after the working deployment passed.
4. The frontend needed its public Supabase publishable key at build time. It was
   included in the public client configuration; privileged keys remain server-side.
5. Supabase managed database role restrictions and TLS trust required hosted bootstrap
   adjustments, separate rotated login credentials and the official public CA. Applied
   migration files were preserved. An owner credential exposed by the local migration
   command's connection-string output was rotated, and the affected private log was
   redacted before continuing.

## Artifacts and revisions

- API: `glucoflow-service--live2`, immutable image
  `glucoflowwysh2026.azurecr.io/glucoflow-api@sha256:ba48d699966b2d3f35ae87a83ec212958aad2edc2b2f4a14485a4a2f175051b4`.
- Worker: `glucoflow-worker--live1`, image tag `20261003`, pushed image digest
  `sha256:1a2c0eb6d05b6e38aede76653dd2e74bdf126a33c80b0740f0647d0fb5489f47`.
- APK: root `deliverables/Glucoflow_Android.apk`, SHA-256
  `01418f27640f7322c31b0d5952a9f697157bd475206eea89f9a9c7227ee0d3c9`.
- Historical seed: six fixture-processed documents, 17 approved facts, one patient note.
  Hosted smoke added one live-processed approved document and one export. The current
  tenant is **not** the original six-document seed state. Nothing from the successful
  smoke upload is awaiting review.

## Costs and limits

API and worker each have minReplicas=0 and maxReplicas=1. Worker has queue-based KEDA
scaling with a restricted aggregate-only database role. No Log Analytics workspace
or dedicated compute profile was provisioned. ACR Basic's queried price was
US$0.1666/day, approximately US$5/30 days. Azure's US$10 monthly budget is an alert,
not an automatic cap; model charges are separate. See [HOSTED.md](../docs/HOSTED.md)
for controls, access, cold-start/free-plan limitations and retirement instructions.

## Remaining verification

The hosted APK has not been installed on an emulator or physical phone. Camera,
native session recovery and Android source/export opening against the hosted stack
remain pending. Productivity, clinical outcomes and real-world extraction accuracy
remain unmeasured. Live ABHA and phone OTP are not implemented. Automatic hosted
retention has not been scheduled; backup erasure is not claimed.

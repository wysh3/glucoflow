# Care workspace deployment evidence

Date 7 November 2026. All records exercised here were synthetic. See [care setup](../docs/CARE_SETUP.md) for release commands and [care verification](care-verification-2026-11-07.md) for application checks.

| Preflight | Observed result |
| --- | --- |
| Prior hosted revision | `glucoflow-service--closure`. API readiness and public web returned HTTP 200 |
| Hosted schema before rollout | 42 checksum matches through `043_obligation_read_grants.sql`. Only 044 and 045 pending |
| Closure read before migration 045 | Seeded clinician line opened. Its obligation detail returned HTTP 404 |
| Provider preflight | Existing hosted model credential authenticated metadata for `gpt-6-luna`, HTTP 200 |
| Portable Compose | `docker compose config --quiet` passed |
| Linux Hermes image | Pinned 0.23.0 import passed as a non-root user at 0.25 vCPU and 512 MiB. Health reported available, and unauthenticated `/chat` returned HTTP 401 |
| Runtime tests | 14 passed after the readiness change. An invalid pinned commit returned readiness HTTP 503 in the Linux image |
| Live provider from final Linux image | `gpt-6-luna` turn returned HTTP 200 in 19.1 s, with the requested monitoring proposal and the exact synthetic source citation. Container startup took 8.1 s at 0.5 vCPU and 512 MiB under local emulation |

The initial Docker image could not resolve a home directory for its numeric runtime user. The image now provisions that user, and the constrained health probe passed. A later cold import under emulation took longer than the original internal import deadline, so readiness was made more tolerant before rollout.

## Hosted rollout

Migration 044 created the owner-scoped simulator tables and migration 045 restored authorized result detail and proof reads for the hosted API role. Both applied in one TLS-verified transaction. A second check verified all 44 migration checksums and reported zero pending migrations.

The two Linux amd64 images were confirmed in the private ACR by digest.

| Image | SHA-256 manifest |
| --- | --- |
| API | `dc5e2e6c51817652975bf51cb629997d057aa05eeb71af8ff115676dffba3921` |
| Hermes | `d48368c2ed0be1bf66017b602ecc1869666baf392339c0e18e6e52a3a0182047` |

Azure marked `glucoflow-service--care20261107` active and healthy. Six hosted checks passed, including closure detail and proof access for the owning clinician with other-clinic denial, care authorization, persistent command receipts, source confirmation, export, and explicit offline chat. The live turn returned HTTP 504 after 30,198 ms. This matched the sidecar's 30-second subprocess deadline. The successor revision increases the subprocess deadline to 60 seconds and the API bridge deadline to 65 seconds to cover cold process import. The conversation retains its 25-second budget and the three-call provider cap.

## Active Azure revision

`glucoflow-service--care20261107b` is active, provisioned and healthy. API readiness returned HTTP 200. The API and private sidecar run together at 0.25 vCPU and 0.5 GiB each, with a scale range of zero to one replica.

| Image | SHA-256 manifest |
| --- | --- |
| API | `aef77e98c389dc9dbc4574337aebf01c6501d39bd69defa4c92962ea6b870cda` |
| Hermes | `3133f4d7329d5179d6f5ee9e8ac6abc1c9f9dfbff4702b9881844bef1f16ef9c` |

After the timeout change, 12 care API integration tests, 14 Hermes tests and TypeScript checks passed locally. All seven hosted smoke checks passed. The authenticated live Hermes turn returned HTTP 200 in 44,203 ms. Its response cited the exact synthetic LIS receipt and left tasks and source events intact. The release used three bounded live attempts across local and hosted checks.

## Vercel production

Vercel marked deployment `dpl_HCmpugRKseF1f4GkfjBdqnj1eYUG` ready and assigned the [public GlucoFlow alias](https://glucoflow.vercel.app). The static client build passed the scan for known privileged database, storage and provider values. Vite reported the main bundle size and mixed Capacitor import warnings.

Public `/`, `/clinic/care` and `/patient/master` each returned HTTP 200 with the same current SPA document and its security headers. The JavaScript asset returned its JavaScript MIME type and immutable cache policy. Azure returned CORS preflight HTTP 204 for both the production web origin and the Android `https://localhost` origin.

These HTTP checks completed at 12:40:52 IST, 36 minutes and 27 seconds after the 12:04:25 IST start of the coordinated implementation pass.

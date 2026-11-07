# GlucoFlow web coherence deployment

7 November 2026. Hosted verification used synthetic demo records. The [application verification report](web-coherence-verification-2026-11-07.md) records the local release gate and separates fixture tests from model calls.

## Images and schema

The Linux amd64 images were built locally and their manifests verified in the existing private Azure Container Registry.

| Image | SHA-256 manifest |
| --- | --- |
| API | `6c975fa311b9ac446cf3028d548df19cce408eb2536b30cb1487f13f9fd511b3` |
| Native Hermes 0.23.0 | `610565ce8b7762cf2d205851d85580cb816d5dda6b40f52d2c07381291066311` |
| Staged worker | `977e9d37c260c2958b20d27ad5825369b367790c2f5b3cc116cc04141d416b1d` |
| Final worker with per-job scratch cleanup | `ef2f5283a8a38955896eebd0a19866432744e13b547bc0e0e6bddd24f8c02f73` |

The final Hermes image reported extraction ready in 23.1 seconds under local amd64 emulation at 0.25 vCPU and 512 MiB. Bare and correctly authenticated readiness returned HTTP 200. An invalid bearer returned HTTP 401.

The hosted database applied `046_care_operational_skills.sql` and `047_document_source_authorization.sql` in one verified TLS transaction. A post-apply check verified all 46 migration checksums and zero pending migrations.

The worker's Hermes process is a private sidecar in the existing Central India Consumption app. The two containers share 0.75 vCPU and 1.5 GiB, with the existing PostgreSQL scaler at zero to one replica. Readiness is checked before the worker leases a job. The staged proof revision `glucoflow-worker--native20261107-proof` limits each synthetic job to two provider calls. The production cap of ten supports five two-page batches and one retry or repair per batch. The existing USD 0.10, 120,000-token and five-minute document budgets remain in force.

The hosted database reports both application buckets as private. The PostgreSQL pooler hostname identifies `ap-south-1`. Supabase management metadata was unavailable in the current CLI session, so storage residency was not independently verified.

## Hosted live document proof

The proof used the ordinary OCR and source-validation worker. Both jobs produced an unpublished, unreleased draft with Hermes 0.23.0, GPT-6 Luna and live extraction provenance. Each draft contained the exact synthetic HbA1c value of 7.8 with evidence linked to a page of the current document version. The patient could download the original PDF and both original photos in their uploaded order. The PDF matched the upload-completion checksum and the photos matched both submitted byte sequences. The other-clinic account received HTTP 404 for review and source access. No result was published.

| Upload | Job creation to completion | Provider calls | Input tokens | Output tokens | Configured ledger estimate |
| --- | ---: | ---: | ---: | ---: | ---: |
| One-page PDF | 56.090 s | 1 | 4,985 | 325 | USD 0.000786 |
| Two ordered JPEG photos | 78.798 s | 1 | 5,493 | 1,567 | USD 0.001470 |
| Total |  | 2 | 10,478 | 1,892 | USD 0.002256 |

The first smoke client timed out while polling the PDF job. A read-only ledger check found the committed successful job, and the resumed check verified its draft and original checksum before dispatching the photos. It sent no second PDF request. The two hosted requests plus three local extraction requests and one local record-planning request total six model calls for this native transport proof. The reported tokens came from the provider. The worker's estimate uses its existing USD 0.125 per million input tokens and USD 0.50 per million output tokens. Public Standard list rates imply approximately USD 0.001994 before any cache discount for the two hosted calls. [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)

## Active Azure revisions

Azure marked `glucoflow-worker--native20261107` and `glucoflow-service--native20261107` ready. The worker uses the scratch-cleanup image and its verified configuration has OCR enabled, provider `hermes`, ten calls, USD 0.10 and 120,000 tokens per document. Both apps keep zero to one replicas. The API reports `hermes / gpt-6-luna / live`, its database readiness returned HTTP 200 and CORS preflights for the web and Android origins returned HTTP 204.

All nine hosted API checks passed with no additional model calls. The filtered awaiting-review queue returned HTTP 200 in 173 ms. The synthetic LIS receipt completed the watch with the exact source event and persisted in export. The approved operational skill was shared within the demo clinic, remained ineligible on the new order before a fresh HIS collection, and created a persisted awaiting-approval proposal citing only that exact target event. The synthetic smoke skill was retired after verification.

The deployed Guide routes use the private Hermes record-planning bridge. `GUIDE_MODE=live` is configured and the Node API container no longer receives the direct provider key. The hosted clinical-request guard returned its deterministic response. The provider-backed record-plan path was verified locally with one authorized model call in 13.009 seconds.

## Vercel production

Vercel marked `dpl_6trejatiER5CsWtvNTEhcqbDEZGY` ready and assigned the [production alias](https://glucoflow.vercel.app). The build included the public [privacy and data-use page](https://glucoflow.vercel.app/privacy) and synthetic-only upload notice. The static files passed the scan for known privileged values. Vite reported the existing large-bundle and mixed Capacitor import warnings.

Direct requests to `/`, `/privacy`, `/clinic/care`, `/patient/add-report` and `/clinic/queue` returned HTTP 200 with the new SPA entry and security header. The production JavaScript asset returned HTTP 200 with the JavaScript MIME type and immutable caching. These checks completed at 13:49:09 IST.

The previous Azure API and worker templates remain available for revision rollback. The previous Vercel production deployment was `dpl_HCmpugRKseF1f4GkfjBdqnj1eYUG`. The additive migrations remain applied. See the [release and rollback instructions](../docs/CARE_SETUP.md).

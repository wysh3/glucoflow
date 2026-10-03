# Glucoflow MVP build documents

Prepared 2 October 2026. Status: consolidated pre-build specification. No application has been built by this documentation task. These documents are the proposed implementation baseline; the user reviews them before application work begins.

## Read order

1. [Product scope and decisions](01-product.md)
2. [Screens and design system](02-screens-and-design.md)
3. [System architecture](03-architecture.md)
4. [Extraction engine](04-extraction-engine.md)
5. [Data, permissions and API](05-data-and-api.md)
6. [Build plan](06-build-plan.md)
7. [Evaluation and demo](07-evaluation-and-demo.md)
8. [Deployment and operations](08-deployment.md)
9. [Fixed contracts](09-fixed-contracts.md)
10. [Build acceptance checklist](10-acceptance-checklist.md)

## Main decisions

- Patient and clinic experiences are available on both the web and an installable Android application.
- One Vite/React/TypeScript frontend, shadcn components and Capacitor Android packaging.
- Fastify TypeScript API, separate Node document worker, Supabase PostgreSQL/Auth/private Storage. Deploy web on Vercel and API/worker on Railway.
- AI proposes facts with evidence. Deterministic validation and a human review transaction control publication.
- Progression is the main clinical workspace. Missing values remain gaps. Patient notes remain patient-reported.
- Apple-inspired spacing and restrained surfaces with medical clarity. Inter Variable and Lucide Animated. No slogans, promotional subtitles, health scores or simulated live AI.
- Proposed performance targets are acceptance criteria, not measured results.

## Current submission materials

The current deck and written answers in `../../deliverables/` now describe the same shared web/Android stack and scope. Earlier Next.js proposals, other deck versions and past judge ratings are archived and must not guide implementation.

## Inputs still needed for execution

- Access to chosen hosting, Supabase and model-provider projects; never put secrets in these documents.
- An Android device or emulator for camera, back-button and keyboard verification.
- Verified team names and practising-doctor participation before external claims.
- A model-provider budget. The extraction provider is selected by the bounded evaluation in document 04; no provider or model has already won that test.

These dependencies do not block implementing local synthetic fixtures and a provider adapter. A fixture adapter must always identify itself as a fixture.

## Boundary

The hackathon permits assistive workflow tools and excludes clinical interpretation and clinical decision support. This product prepares and displays source records. It does not decide diagnosis, medication changes, screening intervals or clinical risk. Demonstrations use synthetic records. Real clinical deployment requires a separate operational and security review.

The current workspace is not a Git repository. Documentation is saved locally; no commit or remote repository was created.

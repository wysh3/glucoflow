# India operational validation — execution contract

Requested 7 November 2026. Synthetic testing, not real-world adoption research.

## Purpose
Exercise GlucoFlow's actual operational state machines under variation in staffing, arrivals, connectivity, source delays, duplicate events, correction, cancellation and handovers. Use findings to repair defects and choose a narrow paid-pilot hypothesis. No diagnosis, treatment selection, severity score or inferred clinical deadline.

## Test layers
1. Seeded virtual-time 90-day scenarios across four facility archetypes, repeated seeds. Archetypes are assumptions, not representative samples of India. Change workload and reliability independently of geography.
2. Local HTTP concurrency tests for reads, contested commands, idempotency and explicitly offline chat. These test backend behavior, not model performance or real-user cognition.
3. Existing authenticated integration tests for clinic boundaries, approvals, skill provenance and worker row locking.
4. Browser interaction checks for the repaired coordination flow. A complete usability study requires actual intended operators.
5. Independent review of skills, market assumptions, costs and pilot gates.

## Decisions
Keep the existing Hermes/React/Fastify/PostgreSQL implementation. Avoid a new framework or a wholesale replacement during reliability testing. Keep constrained operational skills; prioritize specimen receipt, result acknowledgement, responsibility transfer and human-directed bed logistics. Broader disease workflows follow evidence from a focused pilot. Generating application code remains a reviewed deployment process.

## Meaning of learning
Simulation failures produce software fixes and regression tests. Source-confirmed synthetic workflows can produce approved versions of the existing fixed skill patterns. Neither mechanism constitutes clinical learning, model training, measured human adoption, or proof of autonomous invention. A 90-day virtual clock does not establish 90 days of uptime or retention.

## Release gates
No untested deployment and no claim of production readiness. Check changed state-machine behavior, worker recovery, tenant permissions, build, active backend configuration and browser flows. Preserve shared demo labels. Current simulated role changes cannot replace verified staff identity and team authorization in a customer deployment.

## Expected artifacts
- Reproducible simulation script, seed/config and raw outcomes.
- Local HTTP latency/error report with test conditions and engine clearly labelled.
- Skills and agent audit with a prioritized operational catalog.
- India customer economics and 60–90-day real pilot plan with sourced facts and explicit assumptions.
- Consolidated findings, repairs, verification and remaining shipping gates.

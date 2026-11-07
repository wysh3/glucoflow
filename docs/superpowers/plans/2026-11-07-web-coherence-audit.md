# Web coherence and governed workflow reuse plan

> Execution: direct implementation with the previously authorized GPT-6.1 agents. The user requested a complete web audit and corrective work, preserving the earlier instruction to proceed without approval loops.

**Goal:** Audit all PDF pages and web journeys, repair misleading navigation and controls, and provide an inspectable operational outcome → reviewed skill → new encounter proposal loop.

**Architecture:** Retain React/Fastify/PostgreSQL and the pinned Hermes service. Separate care coordination, patient records and historical result-closure surfaces. Store shared workflow templates separately from patient/encounter state with clinic authorization. A shared approved operational template may generate a new task proposal; it never transfers another patient's evidence, approves its own task or changes clinical rules.

## Findings driving changes

The existing release is a functional synthetic prototype, not full PDF compliance. Current playbooks only select handover section order. Hermes memory/skill writing is disabled; no learned cross-patient workflow or collective intelligence exists. Primary navigation exposes several earlier products at once. Account switching can return to an unauthorized old role route. Simulator defaults offer invalid source events. Old workspaces lack a recovery list. Steady task checks are mislabeled as last checked. PDF appointment preview and a first-class episode view are absent.

## Scope and ownership

- Root: full web regression, scope map, episode drawer/history, appointment logistics preview (static, synthetic, never sent), integration, final browser checks and evidence.
- UI agent: navigation hierarchy, legacy labels/entry hub, account switching, not-found recovery, safe eligible simulator choices, command success feedback, persistent explicit assistant mode, accessibility/empty/error states. Preserve original record workflows and authorized routes. Hide disabled experimental Delta/body-map links rather than enabling unavailable derived clinical features.
- Backend agent: owner workspace discovery/reopen; clinic-scoped typed operational skill library with RLS; source-confirmed outcome provenance, fixed nonclinical pattern extraction, genuine positive/negative sandbox cases, actual clinician approval, versioning/retirement/rollback and source-free task proposals on another encounter. Existing patient source facts never become shared memory. Cross-account raw workspaces remain private. Coordinate exact contracts with skill UI and runtime agent before edits.
- Skill UI agent: recover saved workspaces; separate reusable operational skills from handover display preferences; show origin, permitted actions, stop conditions, scope, tests, approver/version and current-encounter applicability. Capture outcome from task details and apply only through explicit preview/approval.
- Runtime agent: report actual memory architecture and current research; evaluate bounded unseen operational cases with actual provider; expose approved matching workflow summaries to read tool and annotate applicable proposals with trusted skill references, if supported by backend contract. No change of model on name alone: transport capability must match. Up to six bounded real-provider test turns, no clinical decisions.
- Independent reviewer: full26-page compliance matrix and recheck critical fixes. Separate implemented prototype requirements from deferred hospital governance, live integration and clinical validation.

## Verification gates

1. Existing full Playwright run establishes previously untested regressions. Record initial failures rather than hiding them.
2. Add failing tests for account switching, safe simulator defaults, workspace recovery and approved skill reuse.
3. Prove A→draft→test→approve→B proposal with fresh B evidence; reject foreign clinic, unsupported clinical rules, wrong-stage B, retired skill and unauthorized publisher. Human attestation alone is not source evidence.
4. Validate desktop/mobile real clicks, keyboard dialogs, browser back, reload, no horizontal overflow, source provenance and error recovery.
5. Measure actual provider behavior and latency on synthetic unseen scenarios. A fixture test is not a model-quality evaluation. Keep Luna unless comparative evidence justifies migration; Sol needs a separately validated Responses adapter.
6. Deploy only verified changes to the previously authorized Azure/Vercel resources. Web is this pass's release target; no new Android acceptance claim.

## Explicit boundaries

No automatic diagnosis/treatment skill transfer, broad medical collective intelligence, live hospital messaging, clinical risk scoring or unvalidated care-rule learning. The shared library is governed reuse of predefined operational patterns; no claim that it autonomously invents or validates medical knowledge. Hospital identity/assignment, external connectors, retention and prospective benefit require separate institutional work.

## User clarification during implementation: native Hermes processing

The user explicitly clarified that Hermes should run the core agent workflows, not just chat. Consolidate cognitive calls through the pinned upstream `AIAgent`: care intent/tools, document extraction and retained patient-record retrieval planning. Keep the durable worker, source preparation, deterministic output validators, authorization and human publication gate. A completed model call is not a completed upload or approved record.

- Backend: a `hermes` extraction provider reuses the existing bounded two-page batches, durable call/token/dollar reservations, repair limit and source checks. One private `/extract` request corresponds to one provider wire call. Never silently substitute fixtures.
- Runtime: authenticated fixed-purpose `/extract` and `/record-plan` paths invoke the actual upstream agent with native image input where supported, trusted read-only skills, one bounded call per processing attempt and usage reporting. No arbitrary shell, skill installation, global patient memory or implicit auxiliary provider.
- Record UI/API: retained conversation planners use the Hermes record-plan path; source facts are still retrieved under the authenticated actor and rendered from accepted records.
- Release: worker gets an isolated private Hermes sidecar; preserve its durable queue, failure recovery and scale-to-zero trigger. API Hermes continues serving bounded care/record turns. Verify exact images and actual provider paths before switching production configuration.
- Native video: pinned Hermes exposes an auxiliary-model `video_analyze` tool. It is not verified with the configured Luna provider and has no current application media/evidence contract. Do not route uploaded videos into a PDF/image extractor or claim video processing. Current intake explicitly rejects unsupported media.

Additional verification: native skill loader tests with preprocessing disabled, one-wire budget accounting, image-page identity/evidence binding, malformed/unauthorized runtime rejection, genuine synthetic Hermes extraction, real draft review and the complete web regression.

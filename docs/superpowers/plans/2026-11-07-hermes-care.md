# Hermes care workspace implementation plan

> For agentic workers: use superpowers:subagent-driven-development with the user's explicitly requested GPT-6.1 agents. The user requested immediate execution without further design confirmation.

## Goal and scope authority

Implement the 7 November GlucoFlow Product, Novelty & UX Blueprint as a freely explorable synthetic inpatient coordination application. The current user explicitly authorizes stable Hermes code reuse, GPT-6.1 implementation delegation and Azure deployment. This supersedes the earlier restriction on delegation and the older result-ledger-only product direction. Original source evidence, authorization, human review, patient/clinic web and Android support remain binding. PDF stage-2+ roadmap capabilities are future work, not current MVP promises.

## Architecture and decisions

Reuse the existing React/Capacitor client, Fastify service and PostgreSQL. Add a care workspace at /clinic/care with Ask, Worklist, Activity, Care Teams and workflow review. Hermes v0.23.0 is a separately deployable Python service, pinned to its release commit. The app verifies user access, persists all commands, and verifies completion from independently emitted synthetic HIS/LIS events. Hermes reads permitted synthetic context and proposes work. Human-approved commands are executed by the app. Model text cannot write source events or approve itself.

Each browser can create a separately identified workspace owned by its authenticated user. PostgreSQL owns revisions and transaction locks. Four explicitly labelled simulation roles exercise care-team interactions without granting real clinic capabilities. All data in the simulator is labelled synthetic. Existing patient and clinic record functions remain available.

Conversation persistence belongs to the app. The Hermes runtime exposes /health and authenticated /chat. Explicit offline mode is labelled a deterministic helper. Runtime errors are visible and never silently presented as live Hermes output. No clinical decisions, prescription suggestions, clinical urgency inference or emergency dispatch.

## Shared interface

Types live in app/packages/contracts/src/care.ts. API base /api/v1/care:
- GET /runtime -> CareRuntimeStatus
- POST /workspaces -> CareWorkspace
- GET /workspaces/:id -> CareWorkspace
- POST /workspaces/:id/commands with {expectedRevision,command:CareCommand} -> CareWorkspace
- POST /workspaces/:id/chat with {message,mode:'hermes'|'offline'} -> CareWorkspace (append stored messages)
- GET /workspaces/:id/export -> JSON snapshot with source events and activity

Commands require Idempotency-Key, reject stale revisions, validate event relationships and role actions, cap arrays/body lengths, and apply state transitions transactionally. Reads reconcile expiries and source evidence even after a restart. The monitor also reconciles on new events. Active feed failure produces unknown status in the view and prevents source confirmation from missing data.

## Work ownership and gates

- [x] Runtime agent owns app/hermes/** and app/deploy/hermes.Dockerfile. Pin/download official upstream, implement real Hermes restricted tools, budgets and timeouts, local smoke, container setup and upstream license provenance.
- [x] Backend agent owns app/apps/api/src/care/**, migration 044, API registration and backend tests. Persistent workspace, simulator, monitor transitions, playbook lifecycle, idempotency, auth and Hermes bridge. Test actor isolation, stale/repeated writes, wrong source, cancelled/corrected orders, approval and expiry.
- [x] UI agent owns app/apps/client/src/features/care/** plus routes/nav/home entry. Deliver a modern responsive accessible interface using actual APIs, freeform chat, structured proposal approval, simulator, worklist/activity, teams, handover export and reviewable learning. No static feature placeholders.
- [x] Root integrates, builds, migrates local/hosted database, exercises browser workflows at desktop/mobile, deploys API/runtime/client to existing resources, rebuilds Android, writes setup and measured acceptance evidence.
- [x] Independent GPT-6.1 reviewer checks auth, state transitions, reset/isolation, stale feeds, runtime failure and new UI before release.

## Review focus

Permission checks on every API action; model cannot approve tools; synthetic role changes cannot cross clinic boundaries; concurrent commands preserve state; duplicate source events do not double-complete; corrected/cancelled orders retain evidence; stale feeds do not imply completion; monitoring expires with a server clock; playbook approval requires real validation and preserves past versions; no PHI or keys in logs.

## Delivery and evidence

Target one 60-minute coordinated build/verification pass, with no completion claims until measured. Prefer existing Azure resource group glucoflow-demo and static web hosting. Record actual elapsed time and any overruns. Map source isolation to R02/R19, UI to R01/R03/R15, original evidence to R08/R12, durable work to R14, web/Android to R16/R17, and honest claims to R18/R20 in docs/mvp/10-acceptance-checklist.md.

## Added scope: interactive answers

During implementation the user explicitly requested Open Intelligent UI. Integrate the OpenUI renderer as a constrained interactive view over authorized source IDs already returned by Ask, with encounter/timeline selection and source inspection. Reuse existing approval commands; no generated HTML, executable scripts, clinical calculations or extra model provider. Keep the existing React/Vite/Node 22 stack rather than replacing it with the upstream Next/Node 24 demonstration shell. Pinned upstream reference: thesysdev/open-intelligent-ui commit 9df2e64bc44282f6305a47eb6dbbbd8f28139138 (MIT). These are source-backed app-composed interactive answers; do not claim ChatGPT's proprietary Intelligent UI feature is embedded.

# Emergency coordination: shared concept versus current GlucoFlow

Reviewed 7 November 2026. Source: https://chatgpt.com/s/t_6aef3cdcafc08191a8f7d782df58736f?mweb_fallback=1 . The initial share renderer failed; its complete-conversation fallback exposed all ten sections and the full Python listing. This is a source/code review, not verification of the linked studies or execution of that downloaded prototype. Research percentages in the share must not be used as GlucoFlow outcomes.

## Decision

Extend the existing React/Fastify/PostgreSQL/Gluco system. Do not replace it with the single-file FastAPI example or introduce a second backend. The concept is an episode-level coordination loop: authorized work progresses while placement is pending, responsibility stays explicit, and clinical history remains inspectable. The application should make unresolved dependencies visible and keep work moving through accountable human actions. It must not choose diagnosis, care level, treatment or staffing competence.

Keep three product surfaces: Care desk, encounter workspace, and chat. A contextual drawer handles sources, assignments and handover acceptance. Settings, audit history and care routines stay secondary. A user should answer “what is pending, who owns it, what can I do?” without switching between separate dashboards.

## Current implementation and gaps

| Intent | Verified current foundation | Extension required |
| --- | --- | --- |
| Current team owns unresolved work | `care/commands.ts` retains task owner during pending transfer, handles acceptance/rejection, and does not complete work on acceptance | Stable team/user IDs rather than owner labels; episode-level accountable team and scoped recipients |
| Qualified staff can accept authorized work | `care/team.ts` resolves server-authorized same-clinic membership and role | Staff roster, capability attestations, shift intervals, capacity validity, offers, reservations, acceptance/decline/expiry and charge-nurse authority |
| Collection, receipt, result and review differ | Contract has separate HIS/LIS events; monitor keeps human attestation distinct from source confirmation | Connector provenance, out-of-order reconciliation, correction/supersession, duplicate replay and explicit review disposition |
| Placement and responsibility differ | `bed_transfer` tracks requested → allocated → arrived independently of lab-task completion | Staffed/equipped readiness, receiving team acceptance, movement history, cancellation, rerouting and repeated transfers |
| Episode view shows relevant records | Care encounters and separate source-linked patient records exist | Authorized patient↔encounter mapping, episode observations with units/time/source, documented care timeline; no inferred severity |
| Prior case retrieval | Record/evidence search and saved workspace revision history exist | These are not cross-patient case matching. Build scoped, explicit-filter archival search separately, subject to hackathon scope and privacy review |
| Operational learning | Versioned tested and approved Care routines for receipt/acknowledgement | Additional restricted operational templates, evaluation against held-out scenarios, audit, rollback and drift measurement |
| Continuity after transfer | Task transfer and archived simulation successor links exist | Clinical episode continuity must not be represented by starting another synthetic workspace; persistent episode/team ownership and outpatient handoff are separate work |
| Reliable hospital operation | PostgreSQL transactions, workspace locking, access controls, audit and worker infrastructure | Replace bounded simulation JSON as the primary hospital event store with normalized episode/assignment/source tables; integration and downtime controls |

Code examined: `packages/contracts/src/care.ts`, `apps/api/src/care/{commands,team,repository}.ts`, bed-transfer and responsibility-transfer tests. Eight focused existing tests passed on this review (see `emergency-workflow-review-tests-2026-11-07.txt`). Those tests prove current boundaries, not completion of these extensions.

## Important flaws in the shared sample

1. Identity is supplied by `x_actor`, with privileged defaults. `/api/state` has no authorization. This is demonstration plumbing, not deployable authentication.
2. In-memory dictionaries and lists lose state on restart and diverge across workers. Its `RLock` covers only some operations and cannot protect multiple processes.
3. Candidate selection checks accepted tasks but not outstanding offers. Two offers can select the same nurse; acceptance rechecks a capacity flag but not active workload. Capacity has no timestamp or expiry, and acceptance does not recheck shift/qualification/unit.
4. All tasks implicitly require the same `sample` capability. Arbitrary task titles therefore receive an unsuitable generic staffing rule. The nurse remains marked busy until physician review, even if their own task is already finished.
5. Handover changes episode ownership to a hardcoded ICU, while already-created tasks retain their earlier `team_owner`. Responsibility can split inconsistently. There is no specific receiving-team invitation or acceptance version.
6. A simulated result requires a prior local performance attestation. Real feeds can arrive out of order; record the source fact and expose the missing step rather than rejecting truth to preserve a linear demo.
7. Bed readiness is one flag; it does not prove equipment, staffing, freshness or a valid reservation. Repeated transfers and withdrawal are not modeled.
8. The historical search is a few equality/range filters over three fictional cases. It is not Gower/BM25/time-series retrieval, clinical validation, or an outcome-based treatment recommender.

Our existing bed-arrival command currently requires allocation and matching destination but does not require receiving-team acceptance. That is a genuine gap against the new concept. Record observed physical arrival even if handover evidence is absent; show the unresolved responsibility gap. Gate a proposed planned transfer on approved prerequisites, but never falsify actual movement or prevent recording an emergency override.

## Recommended domain model

Use separate linked state machines rather than one enormous task status:

- **Assignment:** team-owned → offered → accepted; decline, expiry and withdrawal return work to team ownership. Acceptance atomically validates actor, current team, shift, qualifications and reserved capacity.
- **Execution/evidence:** authorized source order → observed collection → receipt → released result. Missing earlier facts remain visible; corrected events supersede earlier versions without erasing history.
- **Acknowledgement:** available → reviewed, bound to result version, reviewer and disposition. A corrected result creates a new acknowledgement obligation under approved policy.
- **Placement:** request → capability/readiness confirmation → reservation → recorded departure/arrival. Responsibility acceptance is a separate record with its own actors and timestamps.

Candidate entities: `care_episodes`, `care_episode_team_assignments`, `care_staff_capabilities`, `care_capacity_confirmations`, `care_task_offers`, `care_task_acceptances`, `care_placement_requests`, `care_handover_acceptances`, `care_source_events`, and `care_review_receipts`. Prefer existing identity, clinic, document and audit tables over duplicate copies. Every write needs tenant scope, actor, version/precondition, idempotency key, source reference and timestamp. Preserve observed-at versus ingested-at.

## What Gluco should and should not own

SQL/domain rules enforce ownership, capacity, transitions and permissions. Ordinary statistics compute workload and operational duration distributions. Gluco interprets a request, retrieves authorized evidence, drafts a handover, explains missing information and renders typed UI cards. It may suggest an operational action; the deterministic API validates it and the authorized user approves it. Rendering cannot grant permissions.

Immediate task acceptance, decline and acknowledgement should go directly to the API, without waiting for a language model. Chat shows genuine tool-stage progress. UI updates subscribe to durable events with reconnect/resume; refresh is a fallback. Background reconciliation and urgent hospital communication cannot depend on a chat session or model being online.

Care routines can improve a handover checklist, document mapping or approved operational routing pattern. A proposed routine is de-identified, versioned, evaluated, reviewed, activated and monitored, with rollback. Learning must not transfer patient facts between episodes or convert an observed treatment into a general instruction. No unrestricted self-editing production code, permission changes or autonomous treatment-rule creation.

## Implementation sequence and acceptance gates

### 1. Complete one episode coordination loop first

Add explicit team identity and receiving-team acceptance to placement; preserve ongoing responsibility until acceptance. Implement stale/cancelled/reassigned handovers and repeated transfers. Use the current encounter view and a single action drawer. Tests must cover two users accepting simultaneously, revoked access, stale versions, duplicate commands, changed destination and arrival with missing acceptance. Keep all data synthetic in the public demo.

### 2. Add verified task offers and capacity

Introduce time-bounded capacity confirmations and reservations, capability requirements per task, shift membership, decline reasons and expiration. A qualified team lead approves a proposed offer. Acceptance performs a transaction-level workload recheck. Do not infer availability from online status. Test double offers, acceptance races, expired capacity, leave/off-shift changes and no-capacity fallback.

### 3. Connect the episode evidence canvas

Join authorized existing records into the encounter. Show observed values exactly as recorded with units/time/source and distinguish corrected, missing and stale information. Keep clinician-entered diagnosis/care level descriptive. Add source/order correlation and connector replay tests before live integration. Do not add clinical interpretation, treatment recommendations or autonomous deadlines.

### 4. Add bounded learning and operational measurement

Extend Care routines only after the new workflow has reliable event data. Measure offer-to-acceptance, result-to-acknowledgement, responsibility handover lag, missing-owner time and staff interaction burden. Report median and p90, sample size, unresolved cases and missing-event coverage. These are operational measures, not proxies proving mortality reduction. A 60–90 day pilot needs a baseline, phased rollout, predefined comparison and safety/workload review; simulation only tests engineering behavior.

### 5. Evaluate historical retrieval as a separate gated module

Begin with physician-selected, authorized record filters and source links. Display matched, different and missing criteria; do not rank treatments or imply that similar outcomes predict a new patient's outcome. The competition excludes clinical decision support: adding clinical similarity/recommendation under a different name does not resolve that exclusion. Keep it out of the submission unless organizers confirm the intended use is permitted. Defer weighted similarity and longitudinal matching until episode data, access controls and clinician relevance evaluation exist.

## Demonstration to build toward

One fictional clinician-authorized episode, one laboratory order and one placement request. The care desk shows work proceeding in parallel. A lead confirms capacity; a nurse receives and accepts an offer. A source event confirms receipt; a released result creates a separate acknowledgement. The doctor asks Gluco for unresolved work and sees owner/source cards. A receiving team explicitly accepts the handover; movement is recorded separately. A second fictional episode reuses an approved operational routine, with its version and test evidence visible. Inject stale capacity, delayed source events and a declined offer to demonstrate recovery honestly.

This demonstrates the central value: preventing responsibility and evidence from disappearing between departments. It does not claim diagnosis, treatment optimization, real hospital integration or proven clinical outcomes.

# GlucoFlow web coherence verification

7 November 2026. This report covers the follow-up audit and corrective implementation, not the earlier APK release. All supplied PDF pages were reviewed. The [26-page matrix](pdf-compliance-audit-2026-11-07.md) distinguishes implemented prototype behavior, partial requirements, external validation and roadmap work.

## Decision

Continue the current application with the pinned native Hermes engine. Rebuilding the web app or replacing its authoritative storage and job queue would discard functioning authorization, provenance and review workflows. Native Hermes now handles the three cognitive paths: care intent/tool execution, document extraction, and record-retrieval planning. The application owns durable custody, patient/clinic access, source validation, task approval and publication.

The strongest demo is a source-confirmed handoff followed by governed reuse on a different encounter. It is demonstrable operational memory, not automatic diagnosis learning or validated clinical intelligence. Public healthcare skills are useful references; curate a small, scoped set rather than importing broad clinical or shell-enabled packs. [Public skill and model research](public-skills-model-options-2026-11-07.md)

## Corrections made

| Area | Verified change |
| --- | --- |
| Main navigation | Care, Patient records, Result closure and Account are consistent at desktop/mobile widths. Closure stages are nested and labelled by task. Disabled experimental links no longer divert the normal patient journey. |
| Accounts and context | Intentional account switching clears the previous role's destination. Patient entry opens the overview; the sample hero selects the intended synthetic patient. Trailing-slash paths keep the correct navigation and guide visibility. |
| Care workspace | Assistant mode survives reload. Saved simulations can be recovered with unique references. An encounter view connects documented context, current feed state, tasks, history and sources. |
| Simulator and task feedback | Initial choices respect event prerequisites. Successful completion has a visible receipt/action. Lost-response retries preserve the command's idempotency. |
| Skills | Two fixed operational patterns are captured from exact source-confirmed outcomes, tested, reviewed by an authenticated clinic clinician, versioned and shared within a clinic. New applications require the target order's own fresh evidence and create an awaiting-approval task. |
| Source boundaries | A skill proposal cannot cite another encounter's event as its prerequisite. Origin pointers remain owner-private. Patients cannot open clinic-uploaded originals before release, while their own eligible pending uploads remain accessible. |
| Native processing | Prepared PDF/image batches execute through the actual upstream Hermes `AIAgent`. Native read-only skills load with preprocessing disabled. Every extraction request permits one provider wire call, with bounded repair controlled by the durable worker. |
| Upload recovery | Successful processing of a quarantined file no longer links to a nonexistent review. The API checks declared byte count and detected type. Missing bytes can arrive later; repeated completion returns the same document/job. |
| Worker reliability | Readiness is checked before database access or leasing. Bounded startup waits verify private authentication, runtime version, model and extraction support. Authentication/schema/budget failures preserve terminal classification. |
| Processing privacy | Each attempt uses a private scratch directory. Success/failure cleanup removes generated processing files while preserving immutable originals and unrelated directories. Public data-use and pre-upload notices explain shared demo identities, synthetic-only use and provider processing. |
| Review queue | Indexed ID lookups replace repeated table scans under the same RLS and state rules. Measured populated-database query time fell from 12,207 ms to 27 ms; authenticated API returned 25 items in 38 ms. Patient access remained 403. |
| Visual integrity | Unreachable receipts do not tick “contacted” or “next step completed.” Toasts no longer cover modal actions. Episode/source dialogs and skill previews preserve the selected encounter and fresh evidence. |
| PDF continuity preview | A manually entered appointment can produce a reviewed, static logistics message. Changing details clears preview approval. No appointment is scheduled and no message is sent. |

## Measured local verification

- **251/251 automated tests**, 40 files, 11.85 seconds in the final integrated Vitest run. This includes API authorization, job recovery, extraction budgets, scratch cleanup, the queue regression, source permissions and client policies.
- **152 distinct desktop/mobile Playwright cases have passing results.** The initial 144-case full run had 139 passes and five failures. One failure exposed the real queue timeout. Four were obsolete account-copy or ambiguous navigation selectors. A 10-case focused rerun passed both viewports, covering all five failures and four new trailing-slash cases. A six-case privacy/sign-in check passed, adding four new privacy cases and rechecking two existing cases. This is not described as one untouched 152-case green run.
- **22/22 Python Hermes tests** passed in the final 30.87-second run. These execute the pinned runtime against a local protocol fixture; they are not model-quality scores.
- TypeScript checks, client/API/worker builds, `git diff --check`, and database isolation/constraint checks passed. Container builds and hosted checks are recorded separately in the release evidence.
- The baseline navigation audit visited **66 surfaces** across 1440×900 and 390×844. Follow-up genuine API browser checks verified skill capture/review/application, saved workspace recovery, episode reload, source inspection and modal interaction. [Navigation audit](navigation-audit-2026-11-07.md)

The test runner uses labelled fixture extraction for the broad browser regression. Live model checks below are distinct. Android physical-device behavior was not retested in this web-focused pass.

## Agent and learning evidence

Six live Luna care scenarios passed using 17 actual provider calls: source context, missing receipt, ambiguous encounter, clinical request refusal, corrected evidence and approved A-to-B skill reuse. Local wall times were approximately 6.5–10 seconds. These six scenarios do not establish zero failures across all future inputs. [Full timing and memory audit](agent-memory-audit-2026-11-07.md)

An independent local API test used two authenticated clinic actors. A non-clinician captured and tested A's source-confirmed pattern but received 403 on approval. A different clinician could not read A's workspace, could approve the scoped procedure, and used B's own evidence to create a pending task. B completed only after human approval and its own independent receipt. The implementation does not enforce a universal two-person rule: a clinician may also be a draft author. [Independent review](care-followup-review-2026-11-07.md)

The native record planner was tested against the real provider in one call, returning the correct latest-HbA1c intent in 13.009 seconds. Three additional local extraction calls exercised native PDF/image transport and budget reconciliation. Two had post-call harness errors, and the corrected photo run intentionally disabled OCR: six model-proposed facts yielded zero evidence-linked facts. Those calls do not prove a normal source-backed upload. Hosted verification must use the ordinary OCR/source pipeline and inspect the persisted draft. [Native runtime audit](hermes-native-runtime-audit-2026-11-07.md)

## Model and skills recommendation

Keep **GPT-6 Luna** for the bounded interactive agent while collecting a larger held-out evaluation. It is the current measured model. Published Standard uncached-input/output prices per million tokens are $0.10/$0.50 for Luna, $2/$10 for GPT-6 Sol and GPT-6.1 Sol, and $0.30/$1.20 peak or $0.15/$0.60 off-peak for DeepSeek Flash. Cache behavior, reasoning and calls per accepted result affect real cost. These price comparisons are not measured quality comparisons. [OpenAI pricing](https://developers.openai.com/api/docs/pricing) · [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/)

Current care/record planning uses no reasoning; document extraction uses low reasoning. GPT-6 Sol supports no-reasoning Chat tool calls; GPT-6.1 Sol requires Responses for tools. DeepSeek's thinking-enabled tool history has additional requirements. Do not change the model name alone or set high/max reasoning globally. Compare disabled/low configurations on the same source/permission cases before adopting an alternative. [Detailed comparison and exact model IDs](public-skills-model-options-2026-11-07.md)

Anthropic's memory research supports separating source history, curated representations and a small task context, with offline consolidation rechecking sources. Apply that architectural idea to operational procedures, with tests, approval, versioning and rollback. It is not a drop-in healthcare memory system or evidence that cross-patient medical conclusions are safe. [Components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)

## Remaining limits and submission wording

- The library reuses two predefined coordination patterns. It does not autonomously discover novel medical procedures, retrain a model or continuously rewrite its own skills.
- Monitoring reconciles on API reads and source commands, with visible-page refresh. Durable unattended hospital polling, real connectors and external notifications remain open work.
- Hospital assignment/consent, institutional governance, legal readiness, retention, real-world clinical validation and benefit measurement are not established by synthetic tests.
- Video is unavailable. The user confirmed no video-capable provider is configured. Upstream Hermes's auxiliary video tool requires a capable provider plus an application output, media and evidence contract; the current PDF/JPEG/PNG intake rejects video.
- Public demo identities are shared. Saved workspaces are account-scoped, not private to every visitor using the same public account.
- Novelty remains a hypothesis. The strongest claim is bounded cross-system coordination with exact source closure and reviewed operational reuse. Do not claim first/only, autonomous diagnosis or proven staff/clinical outcome improvements.

## India and ABDM clarification

The current application is not ABHA-native and cannot retrieve ABDM-linked documents. ABHA identity and consented health-information exchange are separate capabilities. A real integration requires the relevant sandbox/HIU/HIP work, consent artifacts and revocation/expiry enforcement, validated source formats, secure exchange and production onboarding. A generic ABHA text field or simulated identifier would not establish any of these.

Azure resources in Central India do not prove the entire processing chain stays in India. Storage, backups, model inference, provider logging and subprocessors require their own verified scope. Model `store:false` is not a zero-retention commitment. The Luna cost recommendation above applies to the current synthetic demo; real patient processing needs an approved data-flow and provider assessment first.

See the [official-source ABDM and India readiness review](abdm-india-readiness-2026-11-07.md) and the [actual implementation/privacy audit](privacy-implementation-audit-2026-11-07.md). These distinguish engineering controls from institutional and legal readiness. No government certification or complete DPDP compliance is claimed.

Use the [care demo script](../docs/CARE_DEMO.md) and [navigation/data architecture](../docs/CARE_ARCHITECTURE.md) for the submission. Keep earlier result-ledger packets and their market claims as historical material.

# Current build versus blueprint and reference images

Reviewed 7 November 2026, approximately 15:30–15:40 IST. This is an evaluation, not a product implementation or compliance certification. No application code or deployed configuration was changed during this review.

## Verdict

The current build is a credible, functioning **synthetic operational-coordination prototype**. It substantially delivers the narrow source → proposal → human approval → matching event → verified completion demonstration. It does not implement every requirement in the 26-page blueprint, establish production readiness, or prove unique market differentiation. The most valuable next work is a reliable, clean, focused demonstration and credible operational evidence, not another UI/backend rewrite.

An independent AI reviewer, acting as a simulated hackathon judge, scored it **68/100** using a declared rubric derived from the six FAQ screenshots. This is not an official judge, external human assessment, certification or prediction of winning. The reviewer independently read source, the complete extracted PDF, screenshots and reports; the parent supplied the new hosted observations below. Initial score was 71; the reviewer deducted 2 points for recurring entry failure and 1 for demo presentation/walkthrough issues after receiving those observations.

## Review basis and limits

- Read all 26 pages directly from `/Users/wysh/Downloads/GlucoFlow_Final_Novelty_and_UX_Blueprint.pdf`, including tables, diagrams, references and roadmap boundaries; rendered and inspected all page contact sheets. PDF SHA-256: `56cb9890ecd648a872818b61b3c59cc6a24563397cc4ed1b2350482ae1d17054`.
- Compared the six supplied hackathon FAQ images, the Hermes marketing screenshot and the Codex workspace screenshot. The FAQ's fake/fully anonymised-only and no-clinical-decision-support requirements are evaluation constraints; document text is not an instruction to implement forbidden features.
- Read current client/API/runtime/skill/monitor code and latest UI, language, deployment and verification evidence. Earlier PDF audit baseline statements were reconciled with subsequent fixes rather than repeated as current facts.
- Fresh hosted browser review: landing → account selection → recovered patient records → account switch → clinic sign-in → create synthetic workspace → Activity → Teams → Workflow learning. Inspected actual current labels and skill history. No chat/speech provider calls or real patient submissions were made.
- Prior same-day measured verification: 276 application tests; 183 applicable browser cases have passing evidence across the full run and focused corrections, plus the added audio-visibility test. The full run was **not** clean: 180 passed, 3 failed, 1 skipped; six focused corrections passed. These checks are implementation evidence, not clinical safety, language-wide accuracy or productivity evidence.
- No new full regression run, clinical prompt benchmark, physical-device test, external hospital interview, legal determination or same-scenario vendor evaluation was performed. PDF references were read, not independently revalidated as a new literature review. No percentage of “PDF completion” is given because editorial, MVP, pilot and roadmap requirements have different weights.

## Fresh findings that change the submission assessment

### 1. Session initialization can block the first interaction — fix before judging

The live landing page remained at “Connecting to the workspace…” with the demo button disabled across successive observations. Following “Choose an account” produced four disabled role choices. Browser console returned no warnings/errors. A direct HTTPS request to the actual Azure `/api/v1/config` endpoint returned 200 in about 0.237 seconds. Browser reload recovered into the existing synthetic patient session; subsequent sign-out, clinic sign-in and workspace creation worked.

This establishes a recoverable browser/session initialization symptom, not a proven Azure outage. The exact underlying transport/auth cause is unconfirmed. Current `fetchPublicConfig` is an unbounded fetch, and session setup includes other awaited steps; the observed screen has no timeout/retry recovery. The previous release verification also recorded one similar timeout followed by a passing repeat. Add a bounded, race-safe initialization state and explicit retry; verify cold entry, existing-session entry and stalled configuration/auth separately.

Evidence: `apps/client/src/lib/api.ts`, `apps/client/src/auth/session.tsx`, `apps/client/src/features/landing/page.tsx`; live review and [UI verification](codex-ui-integration-2026-11-07.md).

### 2. The shared demo contains accumulated QA material

The hosted patient view showed technical proof/smoke filenames, multiple “Document / Already uploaded” entries, repeated same-day observations and a QA audit note. Workflow learning in a freshly created workspace showed a clinic-shared receipt skill already retired from an earlier exercise. These can be valid retained history, but a new judge should not need to distinguish old tests from the intended scenario.

Use an isolated clean synthetic demo cohort and predictable starting skill state. Do not blindly delete or deduplicate legitimate source history. Workspace isolation is not the same as private identity or an isolated clinic-wide library: the public demo accounts are shared.

### 3. Public intake does not enforce the fake-only requirement

Warnings, synthetic labels and file type validation exist. Arbitrary files, notes and chat can still contain real information, and live processing can send it to configured providers. No real-data violation was observed; nevertheless “fully compliant with fake-only use” is not demonstrated. A judged public environment should gate arbitrary intake or use allowlisted fictional materials and a clearly supervised free-text exercise. The private pilot and public demo should be separate environments.

### 4. The walkthrough demonstrates the weaker learning example

`features/showcase/page.tsx` step 6 still promotes source-first handover layout changes. The stronger implemented story is the separate operational skill library: verified outcome A → tested approved template → B-specific evidence and new approval → B-specific receipt. Update the walkthrough and submission language to match it. Layout ordering is a preference, not a learned operational procedure.

## Independent simulated judge rubric

| Category | Score | Basis |
| --- | ---: | --- |
| Relevant operational problem | 14/15 | Clear handoff pain and evidence semantics; local discovery not yet demonstrated. |
| Working implementation and demonstration | 15/20 | Real app, constrained Hermes, approvals, persistence and reuse; entry stall and simulated/request-triggered monitoring limit confidence. |
| Differentiation and governed learning | 12/20 | Strong combination to investigate; two fixed templates, no comparative proof or cross-vendor deployment. |
| Assistive scope, human control and data discipline | 12/15 | Operational guardrails and evidence controls; arbitrary public inputs/shared identities leave a fake-only handling gap. |
| Usability, accessibility and India fit | 7/10 | Improved desktop/mobile canvas and speech; dense mobile chrome, QA clutter and partial language coverage. |
| Operational KPI and measurement | 5/10 | Good proposed KPI; no measured baseline or improvement. |
| 60–90 day execution credibility | 3/10 | Proposed protocol without evidenced committed site, named sponsor or agreed source access. |
| **Total** | **68/100** | **Promising prototype; incomplete validation and submission readiness.** |

Judge's central observation: the valuable part is distinguishing a click or attestation from authoritative source completion. The forked UI and model brand are not the healthcare novelty.

## All six FAQ screenshots against the current build

| Supplied screenshot | Current alignment | Remaining requirement / presentation decision |
| --- | --- | --- |
| What may teams build? | Core is assistive operational coordination. Clinical thresholds/derived flags were removed. Human approvals, source inspection, pause/cancel and audit exist. | No blanket all-prompts safety claim. Enforce/supervise fictional inputs. Never present diagnosis, dosing, clinical urgency or treatment-learning features. |
| What makes a strong entry? | Clear handoff problem, deployable demo, source verification, human override, useful speech and existing record intake. | Frequency/pain not yet validated with target staff; no measured near-term impact or cost per completed workflow. Three product areas dilute the core story. |
| Do we need a measurable KPI? | Documented primary metric: median verified collection-to-receipt lag, with coverage/missingness/cancellations/clock checks. | No baseline, intervention result or dedicated current Care KPI view. Show definition and planned measurement; do not substitute test counts or synthetic timings for improvement. |
| How much system integration? | Light frontend over bounded backend; PDF/photo record ingestion works. Live HIS/LIS integration correctly deferred. | Upload extraction does not feed the core handoff monitor. Demonstrate a small fictional collection/receipt register import into that same monitor to prove a light-touch path. |
| Must solutions be multilingual? | English/Hindi patient catalog; 12 partial previews; Sarvam STT/TTS integration and one measured Hindi round trip. | Clinic workflow is largely English, translations need review, nine additional languages are catalog-only, caregiver authorization absent. Staff-only first workflow avoids pretending caregiver support is complete. |
| Pilot results in 60–90 days? | Written staged discovery/baseline/shadow/pilot proposal exists. | No evidenced named site sponsor, agreed data source, baseline or actual effect. Say “proposed pilot,” not “pilot ready” or “validated.” |

## Page-by-page current comparison

“Demo implemented” means available at a synthetic prototype level. “Partial” means an important requirement remains missing. “Roadmap” is intentionally deferred and is not automatically a hackathon defect. These statuses supersede obsolete baseline gaps in the earlier PDF audit.

| PDF page | Requirement | Current verdict and remaining gap |
| --- | --- | --- |
| 1 | Brand, persistent diabetes companion, documented renal complexity | **Partial.** GlucoFlow brand and persistent workspace exist. DKA/CKD source descriptions are synthetic. Full AKI/dialysis scenario coverage and continuity are not evidenced. Cover still describes a proposed concept; submission needs a dated implemented-status section. |
| 2 | Cross-system ownership, source completion, scoped memory, learning, continuity | **Partial.** Source-confirmed versus attested completion and application-persisted context work. Two simulated feeds are not two independently managed systems; continuity and uniqueness remain hypotheses. |
| 3 | Observe → correction → draft → sandbox → approve → scoped version → monitor/rollback | **Partial.** Source-outcome capture, fixed-pattern sandbox, clinician approval, clinic sharing, version retirement/restore exist. No new procedure invention from corrections, unit-level governance or measured improvement feedback. Clinician authors can approve themselves. |
| 4 | Contents and separation of build-now/validation/future | **Editorial.** Preserve those distinctions; this is not a feature checklist item. |
| 5 | One operational assistant; DKA wedge; no replacement EHR | **Partial.** Care assistant is central. Patient records and result closure are separate cohorts/workflows; record Guide and Care are separate experiences, not one unified hospital context. |
| 6 | Reduce chasing/duplicate entry, ownership, India constraints | **Partial.** Clear elapsed-time/owner/source exceptions and stale handling. No measured workload reduction or real-site ingestion; duplicate entry is simulated rather than proven removed. |
| 7 | Real identity/role/assignment/encounter/consent; distinct user experiences | **Partial.** Server/DB authorization is real. Simulator role switching is not authenticated ward/lab staffing or assigned-shift access. Caregiver delegation is absent. |
| 8 | Agent lifecycle, bounded task execution, source report, memory | **Demo implemented with limits.** Native Hermes retrieves and proposes; backend owns mutations and expiry. General tools/memory disabled. No autonomous external-action runner or always-on care scheduler. |
| 9 | Three governed stores; complete delegation and completion states | **Partial.** Explicit workspace context, tasks and versioned templates exist; approval, expiry, source confirmation, attestation, cancellation exist. Shift assignments/renewal, recipient scope, action-sent ledger and complete failure states are incomplete. Logical separation does not establish production retention governance. |
| 10 | Four areas, persistent conversation/voice, day summary, learning, episode drawer | **Mostly demo implemented.** Actual shared canvas, four areas, summaries, speech draft, episode/source view, learning panel. Post-release outcome measurement and full governed change generation remain absent. |
| 11 | Preview → approval → execution → evidence; quiet UX; admission-to-lab chain | **Partial.** Core monitored handoff, sources and stale behavior work. Admission context is simulated text; transport, processing and result-availability stages are not separately implemented source events. |
| 12 | Handover, receiving acknowledgement, discharge logistics, exception actions | **Partial.** Source-linked handover and receipt-type event exist. No draft-bound delivery/recipient receipt chain, real discharge flow or configured external supervisor notification. Appointment preview is explicitly static. |
| 13 | Assigned-shift multi-patient delegation; editable reviewed handover export | **Partial.** One encounter/order monitor with explicit window works. No actual shift assignment/end linkage or full multi-patient contract. Handover preview lacks a proper persisted editing/approval workflow; export is a workspace JSON snapshot. |
| 14 | Doctor/nurse/lab/coordinator views; accessible multilingual UX | **Partial.** Common responsive workspace and scoped actions; episode access and speech improved. Dedicated lab queue, nurse shift view, coordinator view, complete clinic localization and human usability review remain open. |
| 15 | Full event chain, deterministic status model, edge cases | **Partial.** Order/collection/receipt/validation/ack, cancellation/correction, duplicate matching and stale data are handled. No processing/availability/rejection/recollection/transfer/merge coverage or complete at-risk/grace/breached model. Do not add prediction without data. |
| 16 | Build-now MVP and six-step demo | **Mostly narrow demo implemented.** Core loop and static reviewed appointment preview exist. Static non-punitive supervisor workload concept and full doctor/nurse/lab experiences remain missing. This page explicitly defers live integration and a full patient app. |
| 17 | Staged continuity and network roadmap | **Roadmap.** Full patient/caregiver communications, referrals, ambient notes and multi-facility workflows are not required to pretend this MVP is complete. Retained older record screens do not establish connected continuity. |
| 18 | Distinguish KCDD CMS versus hospital EMR; audit real installation | **External evidence gap.** No local hospital inventory, identified connector availability or site-specific validation supplied. Do not describe programme membership as proof of integrations. |
| 19 | Competitor overlap and bounded differentiation | **Unproven.** PDF correctly acknowledges overlap. No same-scenario vendor demonstrations. Do not claim “first/only/no competitor.” |
| 20 | Same-scenario competitive protocol and governed update proof | **Partial.** GlucoFlow-side synthetic receipt and approved A→B reuse are testable. Vendor-side execution and comparison are not completed. |
| 21 | Research motivates problem, not product outcomes | **Editorial boundary satisfied if retained.** No GlucoFlow productivity/clinical outcome evaluation. Do not transfer study effects to this product. |
| 22 | India governance, consent, privacy, reliability, clinical restraint | **Partial technical implementation; no certification.** Auth, source access and scoped runtime exist. No live ABHA/ABDM, caregiver consent flow or demonstrated full retention/deletion/incident/provider-governance programme. Session recovery is a current UX defect. |
| 23 | Operational KPI, baseline, usability, safety and novelty measurement | **Planned, not achieved.** Proposed metric is defensible; no real baseline, staff-time study, partner pilot or same-scenario comparison. No full cost/latency benchmark across representative workflow cases. |
| 24 | Discovery group, site/source/permissions decisions, shadow go/no-go | **Not evidenced externally.** Build/demo exists, but interviews and hospital sign-offs cannot be replaced with software tests. |
| 25 | References, agent attribution and evidence limits | **Reference material.** Hermes and CodexApp attribution exists in repo. Upstream feature marketing does not describe our configured permissions. References were read, not newly independently verified. |
| 26 | Remaining governance/vendor references; evidence-use rules | **Reference material.** Keep citations and the hypothesis/validation boundary. Does not itself establish compliance or clinical suitability. |

## Other supplied image references

### Hermes marketing image

The screenshot promises skill creation from experience, improving skills during use, persistent knowledge and a deepening user model. Our configured runtime does not inherit that behavior merely by using Hermes. `hermes/runtime.py` disables upstream general memory/background review/session persistence and bounds provider calls; three approved native skill documents support extraction, record planning and handoffs. The application separately persists authorized workspaces and implements two fixed reusable task patterns.

Correct answer to the earlier patient A/B question: **A source-confirmed operational outcome can produce an approved reusable template that proposes a task for B using B's evidence. A diagnosis is not learned and transferred to B; that would violate the intended scope.** Limited clinic-shared procedural reuse exists; generalized collective intelligence, model learning and autonomous continuous improvement do not.

### Codex desktop/canvas image and repository references

The build now uses an attributed React port of actual upstream CodexApp presentation and original scoped CSS: sidebar, header, conversation and composer. It preserves draft state and opens adjacent work panels when space permits, with a mobile return path. This meets the principal structural request. It is not the unmodified desktop Codex application, an infinite-canvas editor or a full dark-theme replica. The supplied light clinical design constraints were retained. Open WebUI source was not added.

Remaining UX issues: two navigation levels plus panel headers consume mobile height; engineering labels such as runtime/model name and raw JSON export are prominent; “My Worklist” and “assigned encounters” overstate real-user assignment semantics unless read with the synthetic labels. Care is a canvas, but patient record and result-closure pages remain routed forms/views. There is no reason to fork another UI now.

## Priority order before submission

1. **Reliable entry:** bounded session/config initialization, explicit retry and cold-start/stored-session checks. Preserve auth correctness; do not bypass authorization to make the demo appear available.
2. **Clean, controlled demo:** isolated fictional cohort/library, known starting state, gated arbitrary intake and honest shared-account notices. Preserve existing historical records rather than deleting indiscriminately.
3. **One guided story:** make the walkthrough showcase source verification and approved A→B template reuse. Keep records/result closure discoverable as secondary capabilities rather than taking the judge through every page.
4. **A visible operational metric:** show its definition, source-pair coverage and a labelled synthetic calculation; state baseline/pilot outcome as not yet measured. The primary metric is median verified collection-to-receipt lag, not model accuracy or test count.
5. **One light integration proof:** fictional CSV/register collection and receipt rows mapped into the existing event contract, with duplicate/mismatch/missing-time handling. This directly addresses the FAQ's existing-workflow requirement.
6. **Finish the core handover:** reviewed editable output, clear approved status and usable export; distinguish export from delivery/receipt. Add the page-16 workload concept only as a small clearly static, non-punitive example if needed for full MVP checklist coverage.
7. **External evidence:** secure a ward/lab owner and document discovery/source mapping/baseline collection plan. This improves judging credibility more than changing model brands.
8. **Language depth:** review the actual selected staff/patient journey in English/Hindi and one relevant regional language; avoid claiming universal coverage from a selector.

Do not spend the final submission window on a new rewrite, live ABHA, video, autonomous medical skills, predicted clinical risk or more provider swapping. These are either out of scope, external-gated, or weaker than completing the core story.

## Submission and PDF edits recommended

Keep the full blueprint as an appendix/reference. Add a short current-build cover/status section, the live demo link, one operational problem, the exact implemented loop, the judge route, the KPI/pilot plan and a concise known-limits table. Update the cover's “not deployed” statement to “deployed synthetic prototype; not clinically validated.” Separate implemented features from roadmap. Update the learning description to two fixed approved patterns until actual constrained procedure generation is built and evaluated. Disclose read/event-triggered monitoring and simulated HIS/LIS, rather than an always-on hospital agent.

Suggested current claim:

> GlucoFlow demonstrates a human-supervised diabetes workflow assistant that proposes bounded monitoring, distinguishes attestation from source-confirmed completion, and reuses tested, approved operational templates across synthetic encounters. We are validating whether this reduces handoff chasing in fragmented workflows.

Do not claim government compliance, ABHA integration, all-language support, autonomous learning, market exclusivity or measured staff-hour savings.

## Strongest five-minute demonstration

- 0:00–0:30: explain fictional data and one specimen handoff problem.
- 0:30–1:15: ask for pending work, inspect the exact source and owner.
- 1:15–2:00: preview/approve a bounded monitor; show pause/cancel and expiry.
- 2:00–2:40: disconnect the feed to show unknown; restore it and emit the matching receipt. Inspect source-confirmed completion.
- 2:40–4:20: capture A's operational template, run sandbox checks and approve it; use prepared fictional B with its own eligible evidence, approve B's task separately and close only on B's receipt.
- 4:20–5:00: show source-linked handover, the KPI definition and the proposed site/pilot next step.

This is a suggested rehearsal allocation, not a measured five-minute usability result. If live model calls fail, explicitly select the labelled deterministic helper; never pass it off as live AI.

## Evidence links

- [Current UI implementation and test accounting](codex-ui-integration-2026-11-07.md)
- [Current UI deployment](codex-ui-deployment-2026-11-07.md)
- [Assistive scope and speech verification](removal-and-assistive-verification-2026-11-07.md)
- [FAQ mapping, KPI definition and proposed pilot](hackathon-scope-audit-2026-11-07.md)
- [Earlier PDF matrix with superseding follow-up](pdf-compliance-audit-2026-11-07.md)
- [Language coverage](../docs/LOCALIZATION.md)
- [Demo procedure and limits](../docs/CARE_DEMO.md)
- Source: `apps/api/src/care/skills.ts`, `monitor.ts`, `events.ts`; `hermes/runtime.py`; `apps/client/src/features/care/teams.tsx`, `features/showcase/page.tsx`, `auth/session.tsx`, `lib/api.ts`.

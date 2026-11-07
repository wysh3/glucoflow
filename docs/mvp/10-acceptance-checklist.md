# Build acceptance checklist

Each requirement must be traceable to a task and observable behavior. The requirement table defines evidence obligations, not an automatic pass. Current implementation exists; only dated execution evidence below establishes verification.

| ID | Requirement | Build task | Required evidence |
|---|---|---|---|
| R01 | Patient and clinic roles on web and Android | 1, 9 | Separate accounts complete their workflows on both |
| R02 | Identity and tenant isolation | 1, 5 | API/DB tests reject cross-patient and cross-clinic access |
| R03 | Apple/medical UI, exact font stack, shadcn, Lucide Animated | 1, 2, 9 | Desktop/mobile visual and accessibility review |
| R04 | Consolidated progression overview | 2 | Correct date spacing, units, table equivalent, visible actions |
| R05 | Patient-specific report search | 7 | Correct source result, no draft or unauthorized snippet |
| R06 | PDF/image/camera intake | 3, 9 | Actual bytes uploaded, page order retained, limits enforced |
| R07 | Bounded extraction with evidence | 4 | Held-out source matching and unresolved-field behavior |
| R08 | Human approval before chart publication | 5 | Direct API bypass fails; approved facts persist |
| R09 | Duplicate, mixed identity and stale-review handling | 3, 5 | No repeated points; no generic mismatch override; 409 conflict |
| R10 | Prescriptions and patient notes remain contextual | 2, 6 | Labels distinguish prescriptions, measurements and patient reports |
| R11 | Missing record language stays factual | 2, 7 | No diagnosis, inferred overdue test or risk indicator |
| R12 | Amendments and corrections preserve history | 5 | Retain/supersede/withdraw decisions and immutable prior snapshots |
| R13 | Authorized summary export | 8 | Correct source references, frozen note/fact versions, private download |
| R14 | Durable jobs and bounded model spend | 3, 4 | Crash recovery, fenced writes, preserved call ledger |
| R15 | Loading, empty, failed and offline states | 3, 7, 9 | Retry/cancel/resume behavior and honest process-loss limitations |
| R16 | Android APK works without dev server | 9 | Installed signed APK, camera/back/keyboard/device results |
| R17 | Actual functional demo and disclosed fixtures | 10 | Live phone-to-clinic-to-phone sequence and labelled fallback |
| R18 | Measured operational evaluation | 10 | First/return visits separated; combined role time and accuracy |
| R19 | Retention, cache and private storage controls | 1, 10 | Cleanup dry-run, no-store headers, expiring source URLs |
| R20 | Current pitch and submission match implementation | 10 | Claims updated from verified results; no stale stack |

## Before recording the demo

- [ ] Signed APK and deployed web app use the same API/schema version.
- [ ] Seeded accounts and sources are synthetic; a fresh reset passes smoke tests.
- [ ] Live extraction adapter is selected, funded and verified; no silent fixture fallback.
- [ ] Queue, review, chart, search, export and patient update all work.
- [ ] Clinic Android review is demonstrated, not merely promised.
- [ ] Video timing is not used as a fabricated processing benchmark.

## Before final submission

- [ ] Practising doctor and team details are real and complete.
- [ ] Authenticated portal field/file limits have been checked.
- [ ] Deck, written answers, video and actual implementation agree.
- [ ] Proposed targets and measured results are clearly separated.
- [ ] No unsupported guarantees about diagnosis, complications, zero data loss or adoption.

## Scope change rule

If a proposed implementation changes a locked behavior, update the product specification, its API/data implications and the matching checklist row before proceeding. Routine implementation choices may follow the fixed contracts. New clinical interpretation, live integrations or unrelated product modules require explicit user direction. Archives are historical evidence and cannot override these active files.

## 4 October 2026 UI and demo revision

R03: warm clinical tokens, semantic navigation icons, responsive role/sample controls and mobile-safe form text. R06/R17: three bundled labelled synthetic PDFs enter the ordinary authenticated upload pipeline; repeated samples open the original report. R08/R09: publication displays success, locks draft mutation controls and links the approved record. R10/R12: corrected visit notes require editable text and explicit preview/send, preserving earlier versions. R13: unambiguous systolic/diastolic PDF labels and authorized frozen JSON downloads. Timestamp-derived dates use the local calendar day; source date-only fields retain their printed date.

Measured results, deployment identities, APK signature/hash and limitations are in `app/reports/polish-2026-10-04.md`. This revision does not claim a new physical-device installation or clinical validation.

## 4 October 2026 contextual conversation revision

R01/R03: animated, reduced-motion-aware Gluco companion with readable responsive conversation, stable patient badge and source cards. R02/R19: verified actor/RLS context every turn, cross-tenant denial, session-only history and scope reset. R08/R10/R11: published retained facts only, current reported entries labelled separately, explicit gaps/date precision, historical prescription language and clinical refusal. R14/R15: shared bounded Luna calls, strict retrieval plans and honest local/error states. R16/R17: matching signed APK and deployed synthetic doctor/patient conversations; physical-phone behavior remains unverified. Measured checks and artifact identities: `app/reports/record-chat-2026-10-04.md`.

## 7 November 2026 — source-backed inpatient care and OpenUI

The user-authorized PDF scope extends the original record workspace with the care app described in `../superpowers/plans/2026-11-07-hermes-care.md`. Fresh measurements and limitations are in `../../app/reports/care-verification-2026-11-07.md` and `../../app/reports/care-deployment-2026-11-07.md`.

R01/R03/R15: responsive clinic care surfaces, preserved patient navigation, explicit empty/error/runtime modes, and interactive source inspection. R02/R19: authenticated owner+clinic RLS, other-owner/clinic denial, account-bound state, private runtime token and no source URLs invented by the model. R08/R12: human task/playbook approval, source-linked completion, correction/cancellation history and immutable version references. R14: persisted revisions, transaction locks, idempotent commands and bounded provider calls; monitoring is on-read/on-event, not an unattended hospital poller. R16/R17: signed Android care APK built with native JSON saving; physical-device acceptance remains open. R18/R20: 225 automated tests and 24 desktop/mobile browser checks passed in the integrated local run; Hermes fixture tests and real-provider preflight are distinguished. Synthetic hospital feeds, simulation-only team roles, limited approved layout learning and later PDF roadmap work are disclosed.

## 7 November 2026 — web coherence and native processing follow-up

R01/R03/R15: unified task-oriented navigation, accessible responsive dialogs, explicit episode/source views, saved workspace recovery, persistent assistant mode, truthful upload/quarantine/receipt feedback and a public demo data-use page. R02/R19: exact target-encounter skill citations, clinic-scoped sharing with private origin pointers, separate authenticated publication authority, tightened original-source access and temporary processing-file cleanup. R06/R13/R14: native Hermes extraction preserves the durable upload/worker/evidence pipeline; readiness before leasing, typed terminal errors, byte/type validation and bounded per-attempt wire calls. R08/R12: source-confirmed outcome → fixed procedure draft → sandbox → clinician approval → fresh B proposal → separate task approval → B source completion, with version history/retirement/rollback. R18/R20: 251/251 integrated automated tests, 22/22 Python tests and passing results for 152 distinct desktop/mobile browser cases across the full run and documented focused corrections. Six real care turns, native record planning and extraction checks are distinguished from fixture tests in the [verification report](../../app/reports/web-coherence-verification-2026-11-07.md).

This pass is web-focused. It makes no new physical-device, ABHA/ABDM integration, video, government certification or clinical validation claim. Full PDF scope and remaining institutional/roadmap work are in the [26-page matrix](../../app/reports/pdf-compliance-audit-2026-11-07.md).

## 7 November 2026 — removal, assistive scope and speech

R01/R03/R15: removed obsolete Delta/body-map frontend and ornamental companion UI; retained protected same-patient redirects, keyboard skip navigation, compact paginated measurements and source date precision. R02/R19: internal event-writer ACLs and membership-scoped escalation; no global API sweep. R08/R12: no inferred follow-up date or derived clinical alert, with explicit human actions and actual audit actor. R10/R14: bounded Sarvam speech becomes an editable draft, with durable reservation limits and explicit reviewed playback. R18/R20: fresh 276 application tests, 26 native Hermes tests and 12 SQL checks; all 176 distinct desktop/mobile cases have passing evidence across the full run and the documented two-case assertion correction; deployed both-viewport checks passed. Results are recorded in the [current report](../../app/reports/removal-and-assistive-verification-2026-11-07.md).

Static patient language catalogs include English/Hindi plus twelve visibly partial previews; remaining language coverage and human review are open. The current controlled Hermes renderer has English/Hindi support, not universal translation. R16/R17 physical Android acceptance is not newly verified by this web-focused pass. The six FAQ requirements and proposed KPI/pilot are mapped in the [scope audit](../../app/reports/hackathon-scope-audit-2026-11-07.md); no real-setting outcome or Indian-government certification is claimed.

## 7 November 2026 — attributed CodexApp web UI

R01/R03/R15: actual upstream shell, conversation and composer presentation ported to React with original scoped CSS and distributed MIT attribution; persistent/resizable navigation, mobile drawer, conversation draft retention and available-width split panels. Public entry and sign-in use the same shell. R02/R19 and R08/R12: existing identity, role/patient authorization, source actions and human approval handlers retained. R18/R20: TypeScript, 276 application tests and production builds passed. Full browser run: 180 passed, 3 failed, 1 intentional skip; the two outdated drawer assertions and one trace-cleanup collision were resolved with 6/6 focused reruns. All 183 applicable original cases have passing evidence, plus the separately added audio-visibility regression. Hosted desktop/mobile checks passed; one nonreproducing session initialization timeout is disclosed. No new Android verification or backend deployment. See [UI integration and verification](../../app/reports/codex-ui-integration-2026-11-07.md) and [deployment](../../app/reports/codex-ui-deployment-2026-11-07.md).


## 7 November chat-first simplification

The user superseded the multi-bar Care layout and expanded speech review forms with a minimal chat-first interface. See `app/reports/ux-product-review-2026-11-07.md` for observed screens, shipped changes and unresolved production gates. R01/R03/R16/R17: three primary clinic/patient destinations, contextual tools, compact task rows and responsive canvas. R14/R19: bounded browser requests, identity transport deadlines and non-overlapping workspace refresh. Speech uses an explicit mic/speaker action; transcription inserts an editable draft and never submits it. Clinical publication and operational human approval remain unchanged. Latest measured checks are in the dated report, not implied by this mapping.

## 7 November welcome and independent judge

R01/R03/R15/R20: root welcome, legacy sign-in alias, clearly labelled illustrative preview and primary clinic/secondary patient actions. Fresh typecheck/build and hosted desktop/mobile route checks are in `app/reports/welcome-correction-2026-11-07.md`. Independent review is `app/reports/independent-product-judge-2026-11-07.md`; it does not certify production readiness.

## 7 November New chat and operational scenario presets

R01/R03/R15: visible accessible New chat and explicit saved-workspace semantics; DKA/HHS editable fictional encounter presets. R11/R20: clinical-context notes mapped to handoff/ownership/documentation demonstration only. Fresh 15-test care integration, typecheck, deployment and desktop/mobile browser evidence: `app/reports/dka-hhs-demo-2026-11-07.md`.

## 7 November submission and reference home

R03/R15/R20: official two-page and 12-slide templates filled with evidence-backed content, user-requested omissions, and explicitly hypothetical pilot/cost assumptions. R01/R03: source-backed home summary, sidebar navigation and continuous composer adapted to the supplied Treasury reference. Appointment preview removed from the core demo. Verification is in `app/reports/submission-and-reference-home-2026-11-07.md`.

## 7 November video-reference UI revision
- [x] Full video decoded to frames; selected full-window views and frame viewer saved in app/reports/evidence/video-reference-2026-11-07.
- [x] Reference proportions applied to existing home/composer; saved sidebar preferences preserved.
- [x] Overview/conversation toggle retains messages and draft in browser verification.
- [x] Typecheck and desktop/mobile layout checks completed; see app/reports/video-reference-redesign-2026-11-07.md for scope and limits.

## 7 November final visual simplification
- [x] Shared neutral palette, one-screen home at 1280×720, compact record rows and no stacked desktop toolbar.
- [x] Native summary triangles removed with expand/collapse preserved.
- [x] Shared orb loading component with preserved licence, readable status labels and reduced-motion fallback.
- [x] API warm replica verified Healthy; sign-in verified. See app/reports/light-canvas-and-runtime-2026-11-07.md.

## 7 November: chat latency investigation
R14/R19: measured hosted Hermes startup/model/tool timing; sidecar increased from 0.25 CPU/0.5 GiB to 1 CPU/2 GiB with isolated workers and call/deadline bounds retained. R03/R15: consistent pending/completed chat layout, cleared/restored draft and accessible shared healthcare loading orb. See `app/reports/chat-latency-investigation-2026-11-07.md` for individual measurements, rejected experiment, rollout failures and remaining latency limits. This does not establish production readiness or p95 performance.

## 7 November: original orb and primary interactive replies
R03/R15: original neutral orb eyes restored, smaller care cap, bounded pointer gaze, blinking/swaying and reduced-motion handling. English workspace-snapshot replies now present compact OpenUI encounter rows, one historical stale-feed warning, expandable scoped evidence and preserved full text/timestamps. Other reply formats/languages retain their original prose. Six compiler/rendering/source-isolation tests and TypeScript typecheck passed. No additional model call or arbitrary generated executable UI is introduced.

## 7 November: shared dialog placement
R03/R15: shared header grid keeps close actions beside titles and descriptions below, including long descriptions and mobile layouts. Audited 15 header uses, including the wrapper for 13 care dialogs. Verified hosted confirmation plus local mobile, source/task dialogs, Escape and focus return. Typecheck/build passed. Scope and evidence: `app/reports/dialog-header-audit-2026-11-07.md`.

## 7 November India-context hardening evidence

See [India readiness report](../../app/reports/india-readiness-2026-11-07.md) for the bounded synthetic release, 312 passing integrated tests, seeded 90-day scenario assumptions, local HTTP contention, hosted worker expiry without browser reads, deployment identifiers and remaining shipping gates. This adds verification for ownership transfer, rejected-command atomicity, background reconciliation and skill rollback validation. It does not mark real hospital connectors, national-scale usage, actual human adoption, autonomous skill invention, independent language quality or physical Android verification complete.

## 7 November completion release mapping

See [fresh release evidence](../../app/reports/completion-release-2026-11-07.md) and [remaining gates](../../app/docs/SHIP_CHECKLIST.md). R02 has new explicit team authorization/revocation and cross-clinic regression coverage; R03/R15 have desktop/mobile composer, close-control, cancellation and streamed-progress checks; R12 has durable care revision evidence and read-only archival; R14 has bounded runtime cancellation and immutable routine evaluations. This does not pass R01/R16 physical Android checks or R18 real-user outcomes by inference.

## 7 November: emergency coordination extension
- [x] Duplicate monitoring reuses the saved task and preserves approval/owner/evidence.
- [x] Staff capacity, offers and named acceptance are enforced server-side.
- [x] Receiving responsibility remains distinct from physical transfer and lab evidence.
- [x] Owner-managed enrollment of existing clinic accounts; cross-clinic and nonowner changes rejected.
- [x] Source-backed operational pipeline and top-right sign out.
- [x] Full suite: 376 tests passed; TypeScript and production builds passed.
- [x] Local browser checks: fresh workspace, team form, pipeline, source-record save, duplicate-task shortcut and sign out.
- [ ] External hospital readiness: real identity provisioning/connectors, security/recovery validation, sustained multi-user capacity and supervised pilot evidence. Not established by this demo.

Evidence: `app/reports/emergency-coordination-suite-2026-11-07.txt`, `app/reports/episode-coordination-2026-11-07.md`; architecture: `app/docs/CARE_PIPELINE.md`.

## 7 November: visual Gluco and usage settings
- [x] Department-lane pipeline canvas with encounter/order selection, source inspector and zoom/fit.
- [x] Visual greeting links to saved tasks, encounters and pipeline; operational prompts are not classified as greetings.
- [x] Assistant and workspace wordmark display Gluco.
- [x] Zero/unlimited aggregate speech, guide, runtime and document monetary settings deployed; bounded execution retained.
- [x] 381 tests across 70 files passed; typecheck and production build passed. Desktop/mobile and hosted greeting/pipeline controls checked.
- [ ] Reference extension: real medication administration feeds, cross-encounter identity and live hospital/ABDM integrations remain outside this release.

Evidence: `app/reports/visual-gluco-release-2026-11-07.md`.


## 7 November — hospital authority and visual evidence

R02/R19: managed role ceiling, live revocation, no implicit record access, optimistic administrator assignment, operator-only orphan recovery. R03/R15: named demo persona switching, role-focused home, compact pipeline stage attribution, correct encounter navigation and mobile checks. R08/R10/R11/R12: explicit unverified episode transcriptions, multi-analyte references, dimensionless values, selectable point metadata, append-only corrections/disputes and no inferred measurements. R17/R18/R20: 406 automated tests in 76 files, 12 database checks, four hospital UI fixture browser cases and six real-local visual cases; simulated review and real institutional validation remain distinct. See [release evidence](../../app/reports/hospital-authority-release-2026-11-07.md). No fresh physical Android acceptance is claimed.

### Final-four PDF demo workflow mapping

- Bounded delegation: fixed encounter/source/rule/recipient/expiry preview, separate versioned approval, pause/edit/reapprove/stop, durable source checks.
- Role workflow and handover: nurse soft acknowledgement stays separate from completion; lab processing absence remains unknown; edited immutable handover versions have named exact-version receipt.
- Static prototypes: reachable synthetic supervisor and appointment previews; every changed appointment detail clears approval.
- Evidence: see `app/reports/pdf-compliance-audit-2026-11-07.md` final-four section and the final release report. No new hospital-production or Android-device claim is implied.


### 7 November — cross-team application simulation

R02/R19: separately authenticated hospital users, role/tenant denial, live revocation and named-recipient boundaries. R08/R12: unchanged monitor checks no longer advance revisions; worker batches cannot reconcile newer state backward; corrected source results reopen work. R03/R15: delayed guide initialization retains the user's open request; navigation and speech tests follow the simplified UI. R18/R20: fresh 420-test run plus desktop/mobile workflow evidence recorded in [cross-team verification](../../app/reports/cross-team-application-2026-11-07.md). Simulated feeds are the authorized demo scope; these checks are not real staff feedback or live ABDM integration.

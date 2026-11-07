# GlucoFlow: complete screen review and chat-first correction

7 November 2026. Review of the hosted synthetic build, the 26-page Final Novelty and UX Blueprint, the six hackathon FAQ screenshots, the Codex interface references, and the user's subsequent simplification requests. Screenshot gallery: [open gallery](ux-screen-gallery-2026-11-07.html). The numbered captures show the original build, an intermediate consolidation, then the simplified build; do not mistake every capture for the current interface.

## Verdict

The strongest product is a source-backed coordination assistant for an existing DKA episode. Its job is to reduce uncertainty about handoffs, ownership and completion. It must not diagnose DKA, determine treatment or infer clinical urgency. The biggest UX failure was displaying the implementation's modules as the user's navigation: chat, worklist, activity, teams, simulator, learning, records and result closure all competed for attention.

A tense clinician wants five answers: what is waiting, who owns the next step, what evidence supports it, how fresh is that evidence, and what action can I take. Chat should provide the short answer. Evidence, timelines and approvals should be available on demand. Do not require a clinician to understand Hermes, agent memory, JSON, skill versions or source-event simulation to do normal work.

## Changes made in this session

- Three primary clinic destinations: Care, Patient records, Account. Result closure is a contextual Record tool. Patient navigation is reduced to Records, Home readings and Account; upload and note actions remain reachable from their relevant views.
- Care has one compact Chat / Worklist / Encounters strip. Removed its repeated header, second action bar and permanent simulator footer. Saved workspaces, learning, activity, export and demo controls are in one menu.
- Worklist uses short rows rather than large cards. Filters and exception evidence expand on request. All three seeded tasks fit in the first desktop viewport. Task detail still exposes the original source, deadline, approval, pause/cancel and attestation controls.
- Chat remains the default. Work can take the whole canvas; optional conversation alongside it is in the menu. The intelligent evidence explorer starts collapsed; direct source chips remain available.
- A small mic button starts recording; tapping stop transcribes and inserts text into the editable draft. It never submits a message or clinical note. Cancel discards the recording. No audio-review checkbox, upload form or separate Insert step.
- A small speaker button requests read-aloud; its loading/stop state replaces the icon. No text-review checkbox or Generate audio form. Longer text is segmented within the server limit, with a six-segment cap. Unsupported languages, budget exhaustion and playback errors remain visible.
- Speech remains Sarvam-backed and server-authorized. The existing synthesis API's `reviewed: true` compatibility field is now sent by the user's explicit speaker action; it no longer represents a separate checkbox. This does not alter clinical publication or operational approval.
- Voice insertion preserves the current Care draft and refuses overflow rather than silently replacing or truncating it.
- Browser requests have deadlines and distinct cancellation/timeout/network errors. Initial configuration is bounded to 10 seconds; identity transport to 15 seconds; ordinary API requests to 30 seconds; care chat to 75 seconds; speech to 65 seconds. These are maximum waits, not measured latency claims. Failed writes are not automatically retried.
- Workspace and runtime polling no longer overlap their own pending requests. A pending chat shows the submitted question and elapsed time. The UI does not invent intermediate reasoning or pretend to stream unvalidated source claims.

## Original screen findings and disposition

| Captures | User job | Pain / risk | Disposition |
|---|---|---|---|
| 01–05, 40 | Enter the correct workspace | Waiting/disabled controls without a clear recovery path; vague role choice | Added bounded startup and reconnect state. Further shorten persona explanations after user testing. |
| 06–08 | Find the next handoff | Empty chat occupied most of the canvas; task panel too narrow | Corrected layout; work is focused and chat remains optional. |
| 09–10 | Approve a bounded action | Generic action dropdown; new-task form requires the user to translate the job | Preserve explicit approval; next refinement is a directly labelled primary action and contextual prefill. |
| 11–12 | Understand work / assigned encounters | Activity duplicates task cards; “Care Teams” actually lists encounters | Activity moved into menu; renamed Encounters. |
| 13 | Understand one episode | Good source and owner context, but long lists obscure the handoff sequence | Keep as contextual detail. A compact order→collection→receipt→validation→acknowledgement strip is a worthwhile next improvement. |
| 14 | Hand over safely | Draft appears in conversation and separate panel; raw references dominate | Keep one primary draft with expandable sources; this further consolidation is outstanding. |
| 15–17 | Demonstrate governed reuse / recover a session | Simulator and learning competed with daily work; saved workspaces have indistinguishable titles | Moved tools into menu. Meaningful saved-session names and clean demo fixtures remain outstanding. |
| 18–22, 26, 39 | Review the patient's documented history | Patient context is strong; repeated navigation/headings, QA filenames and repeated examples increase noise | Keep Records secondary to the inpatient story. Do not silently merge the Asha Shah care encounter with the separate Asha Rao record cohort. |
| 23–25 | Upload, inspect and publish facts | Evidence-first review is useful, but dense controls and technical copy slow review | Retain source review and publication gates. Remove explanatory clutter progressively, not the safety action. |
| 27, 46 | Home reporting and tracking | Broad legacy dashboard, unconfigured fields and old QA events distract from the inpatient problem | Secondary record capability, not the main DKA demo. Keep patient reports labelled as such. |
| 28–36 | Result custody, acknowledgement and contact | Separate workflow and vocabulary; clinical-looking protocol labels, very old demo clocks and legal-style certificate can confuse the scope | Moved under Records. Exclude certificate and protocol claims from the primary pitch; no legal compliance claim follows from this screen. |
| 37 | Show operational impact | Large synthetic comparative numbers visually overpower caveats | Do not use as pilot evidence or headline benefit. Replace with actual prospective operational measurements when available. |
| 38, 48 | Manage account and privacy | Technical details are useful but not daily work | Keep in Account. |
| 41–45, 47, 49–50 | Patient records, notes and voice | Too many navigation destinations; voice processing exposed as a multi-step form | Reduced top-level navigation and replaced speech form with direct icons. Note submission still remains separate. |
| 51–52 | First consolidation attempt | Still too many stacked controls, correctly rejected by the user | Superseded by 53 onward. |
| 53 onward | Minimal task/chat canvas | Fewer controls, first-viewport tasks, contextual evidence | Current direction; inspect actual final captures in gallery. |

## PDF alignment and unresolved gaps

| Blueprint theme | What is real today | What must not be claimed / remains |
|---|---|---|
| pp. 2–4: bounded, governed improvement | Versioned operational templates, source references and approval workflow | No autonomous medical learning, no cross-patient diagnostic transfer, no measured continual-quality improvement. |
| pp. 5–9: one assistant and task contract | Hermes-backed authorized context; explicit owner, evidence condition, expiry and human action | The existing source/permission boundary must survive further simplification. |
| pp. 10–15: DKA coordination | Synthetic encounters, source events, monitoring, exception and handover views | No real HIS/LIS connectors, unattended hospital polling, clinical triage or notification dispatch. |
| pp. 16–17: demo now / continuity later | A replayable bounded synthetic handoff and record workflow | Broader appointments, staffing and continuity concepts are not all production features. |
| pp. 18–24: evidence, governance, KPI, pilot | Traceable audit/source concepts and proposed evaluation | No completed clinical pilot, measured staff-time savings or safety validation. |
| FAQ screenshots | Assistive scope, synthetic labels, human override and audit | Do not turn a human approval label into permission for diagnostic/CDS functionality. |
| Indian requirements | Language selection, Hindi/English content and other language previews; Sarvam integration; honest ABHA absence | ABDM is not registered/integrated. Preview languages are not fully reviewed localization. Caregiver delegation and legal compliance are not established. |

## Five-minute demo

1. **0:00–0:30 — One question.** Open a clean fictional DKA episode and ask what handoff is waiting. State that this is operational coordination using synthetic hospital feeds.
2. **0:30–1:15 — Source discrepancy.** Show that collection is recorded, receipt is not. Open the exact evidence. Absence of receipt is an operational unknown, not a diagnosis or clinical risk score.
3. **1:15–2:00 — Bounded ownership.** Prepare a monitoring request. Show owner, expected source event and expiry; a human approves it.
4. **2:00–2:45 — Verified closure.** In the explicitly labelled demo controls, emit the matching receipt event. Show that source evidence, not the assistant's confident wording, closes the task.
5. **2:45–3:30 — Honest uncertainty.** Disconnect a feed and show unknown status. Restore it. This is a stronger trust demonstration than an always-green dashboard.
6. **3:30–4:15 — Continuity.** Draft one short handover with pending owner and evidence. Avoid reading raw IDs aloud.
7. **4:15–5:00 — Governed reuse.** Show a reviewed operational template from case A applied against case B's own evidence, producing another approval request. Close with the operational KPI and pilot plan, not fabricated benefit numbers.

Speech can be a short interaction within this story; it should not become a separate product tour. If the live model fails, show the failure and explicitly select the deterministic helper. Never call that helper live AI. Do not include diagnosis, dosing, automatic protocol selection, live ABHA retrieval, real emergency dispatch, or a broad tour through every legacy screen.

## KPI and proposed UX acceptance

Primary proposed KPI: median verified collection-to-lab-receipt lag. Report the denominator, missing receipts, source freshness and distribution; do not silently drop unresolved cases. Human measurements should also record time to identify the waiting step, correct owner and evidence. Proposed UX targets: next action understandable without visiting another top-level page; source reachable in one action; no loss of draft on view changes; no hidden approval; no horizontal overflow at 390 px; no unbounded pending request. These are targets, not a completed clinician usability study.

## Verification and limits

Fresh TypeScript checks passed. The application test run passed **282 tests across 50 files** in 12.96 seconds. Six focused request/speech-segmentation checks passed; initial regressions failed before their respective fixes. Production client/API/worker builds passed, including a final build after presentation refinements. Deployment also performed a client build and privileged-value scan. Published deployment: `dpl_9ppWmYfZ4DhY3hWMADoDUud9bR2K`.

Configuration endpoint samples were 202, 197 and 142 ms. They do not measure model completion latency, cold starts or user-perceived total sign-in. Hermes inspection found a maximum of three provider calls, an eight-second per-call transport timeout, a 25-second agent budget and a 60-second sidecar process deadline. No unbounded agent loop was identified. This session did not benchmark alternative models or prove that every live turn is fast.

Browser evidence covers major route families and representative interaction states, plus desktop and 390×844 layouts. It is not exhaustive coverage of every permission/error state, every scroll position, Safari/Android microphone behavior or real clinical use. The previous browser suite targets the superseded speech forms and navigation; it is not claimed as a fresh passing suite for this release. Physical-device mic capture, autoplay restrictions, full browser regression rebaselining, fresh live extraction/video tests, security review and clinician usability testing remain release gates.

The screenshot inventory and PDF review do **not** make this production-ready healthcare software. This is a deployed synthetic prototype with a simpler interface and tested reliability fixes. No database data was deleted and no real patient information was used.

### Final verification addendum

The final client/API/worker production builds passed after the presentation changes. The native Hermes suite passed **26 tests in 26.064 seconds** using `hermes/.venv/bin/python`. An initial invocation with the system Python failed seven runtime-dependent tests because that interpreter lacked the configured Hermes environment; rerunning in the documented project environment resolved all seven without product changes. The failures were extraction, health, wire-budget refusal, source-handoff skill loading, validated proposal loop, record planning and selected-language system instruction.

Published browser verification opened the new workspace from the menu, checked the three navigation destinations, opened the compact worklist and its source-aware task dialog, and checked Chat/Encounters switching at 390×844. The unsent synthetic draft was preserved and measured document width did not exceed viewport width. Final hosted captures are 57–61. The gallery contains **61 screenshots**. Viewport overrides were restored. One local synthetic read-aloud request was initiated; this is not an acoustic-quality or cross-browser playback certification. No actual microphone recording was made during this browser audit.

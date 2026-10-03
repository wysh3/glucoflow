# Evaluation and demonstration

## Synthetic cases

Use P0482 as the demonstration patient. Approved reset history: HbA1c 8.2% on 12 January 2026, 7.9% on 10 April and 7.5% on 9 July. New report: 7.8% on 14 September 2026. Medication and examination events retain their actual synthetic source dates. A diet/activity note is patient-reported. These values illustrate data handling and carry no clinical interpretation.

Create original synthetic source PDFs and phone-photo variants with conspicuous synthetic labels. Keep an independent reference manifest prepared from the source documents, not from model output. Existing deck mockups can guide the example, but must not masquerade as actual application screenshots.

## Functional acceptance

| Case | Expected result |
|---|---|
| Patient uploads new report | Correct clinic sees pending work; patient sees actual status |
| Clean extraction | Reviewer can inspect every proposed fact and approve |
| Wrong or unreadable unit | Requires correction/exclusion; no silent inference |
| Duplicate file | Existing document reference, no repeated chart point |
| Wrong patient | Identity hold, blocked publication |
| Two simultaneous reviewers | One succeeds; stale reviewer gets conflict |
| Revised source | Pending-amendment label; explicit supersession after approval |
| Model timeout | Bounded retry then a visible failure; no fake success |
| Unsupported document | Clear unsupported status and request a supported/unlocked source; no fake extraction |
| Android camera denied | File upload remains usable |
| Lost network after upload | Resume fetches server status without duplicating work |
| Patient tries reviewer API | Server rejects |
| Second clinic requests source | No access or existence leakage |
| Export then amend | Old export unchanged; new export gets new revision |

## Datasets

12 development bundles for routing/prompt/provider choice. Separate 30 held-out patient histories for final evaluation, each with initial and return-visit tasks. Include mixed layouts, clean PDFs, scans, rotated pages, ambiguous dates, duplicate reports, amendments and identity conflicts. Publish the composition and unsupported cases. Keep the demo patient outside the held-out set.

Freeze source files, reference manifest, scoring rules, model ID, prompt hash and schema version before final evaluation. Do not tune on held-out results and continue calling them held-out. Corrections after evaluation require a new test set or a clearly labelled regression rerun.

## Metrics

- Extraction precision/recall at the fact level: exact tuple of patient, test, date, value and unit, after only predeclared formatting normalization.
- Separately count wrong-patient associations, wrong dates, wrong units, unsupported outputs and omitted source facts.
- Final approved-record precision/recall against independent references.
- Human active time summed across intake reviewer and doctor lookup. Also record end-to-end elapsed time including processing waits. Report these separately.
- First intake and return visit separately; median and spread, with task counts and participant numbers.
- Extraction p50/p95 wall time, retries, tokens and measured API cost per document and approved record.
- Reviewer edits/exclusions and source-opening actions.

Use the same source bundles across manual and Sutra workflows with separate participants assigned to each case/workflow combination, and balance task order. Avoid a participant reviewing a case manually and then recalling it in Sutra. Compare current workflow and structured manual timeline; use the better manual baseline for the primary gate. Participant recruitment is an execution dependency. Automated synthetic benchmarks alone do not establish clinician productivity.

Proposed primary gate: at least 30% lower median combined return-visit task time with no worse final-record precision or recall. All injected unresolved identity conflicts must block release. Every exported fact must have authorized source evidence. If gates fail, report the result and narrow the product before claiming savings.

## Video sequence

Target approximately 3–4 minutes, subject to actual submission limits.

1. Show patient Android with synthetic identity. Select a report and upload. Submit and show a patient visit note. Notes are optional for patients, but this feature is required in the build and demo.
2. Switch to clinic web. The document appears in the queue from the backend. Open it.
3. Show the source and extracted facts. Review an actual issue if one occurs. A deliberately seeded test error must be labelled as a test case, never claimed as spontaneous model output.
4. Approve reviewed entries. Open progression and select the new point. Open its source. Show the dated patient note separately.
5. Export and reload. Show saved history on patient Android.
6. Briefly demonstrate clinic Android opening the queue/review screen, proving both roles work there.
7. End with the measured workflow result if available, clearly identifying sample size and synthetic data. Otherwise state that measurement remains pending.

No dramatic music, generated clinical alarm, fake typing animation or invented progress bar is needed. Narration describes the task in ordinary language. Do not speed up a processing wait and then quote the edited video duration as latency.

## Demo resilience

Prepare three labelled synthetic cases: normal return visit, duplicate and identity conflict. Use separate patient and clinic sessions. Seed script creates users without exposing passwords in public source or video. Demo reset is a local authenticated CLI, never an unauthenticated public button. Reset only the isolated demo tenant, then re-run smoke checks.

Have a backup recording with its date and software revision. If live infrastructure fails, state that it is a recording. Fixture mode is suitable for development and must display “Fixture data”; it must never silently replace a failed live model call during judging.

## Evidence to retain

Commit synthetic source/reference hashes, evaluation configuration and redacted results. Record APK checksum, frontend/API/worker build revisions and device test details. Store no real patient data. Turn timings and screenshots into the next deck revision only after verification.

## Retrieval addition

After opening progression in the video, search for the eye examination record, inspect its dated result and open the source. Separately show a category with no matching uploaded record using neutral availability wording. Do not claim this detects hidden disease or proves a missed screening.

Add a timed retrieval task to the workflow evaluation: locate a specified historical test or prescription and verify its date against the original. Count incorrect document selections as retrieval errors. Include retrieval time in doctor lookup rather than double-counting it as a separate productivity gain.

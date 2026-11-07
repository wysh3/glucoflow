# Care workspace verification — 7 November 2026

This report records the current implementation pass. Archived screenshots and earlier test counts are not evidence for this release. Final release checks are recorded below after they run.

## Scope

The user adopted all 26 pages of `GlucoFlow_Final_Novelty_and_UX_Blueprint.pdf` as the product baseline and requested stable Hermes reuse, GPT-6.1 implementation agents, a testable custom web application and Azure deployment. During implementation they added OpenUI interactive answers. The original patient/clinic record features are retained. Scope authority and implementation ownership are documented in `docs/superpowers/plans/2026-11-07-hermes-care.md`.

Hermes upstream release: v0.23.0, commit `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`. The app uses its actual Python AIAgent loop with only authorized care-read and response/proposal tools. Human approvals and durable execution remain in the Fastify/PostgreSQL application. The independent Open Intelligent UI source reference is `9df2e64bc44282f6305a47eb6dbbbd8f28139138` (MIT).

## Observed preexisting defect and repair

The hosted closure list returned records but individual source/proof requests returned 404. Read-only database inspection confirmed `results`, `result_events` and `result_attempts` read policies applied to `authenticated`; the API uses `sutra_api`, which does not inherit that role. Migration 045 adds the same clinic-membership policy to the actual API role without widening access. The regression reproduces the original missing read inside a transaction, applies the migration, verifies source and proof access, and verifies another clinic still receives no row. It passed locally.

## Verification observations

- Initial full suite during implementation: 213 existing tests passed; 8 new care route tests were still red before route registration. This was a baseline checkpoint, not a release pass.
- New source-policy regression: 1/1 passed, including cross-clinic denial.
- No physical Android device was attached to ADB during this pass. Building an APK does not establish device behavior.
- Hermes protocol tests use a local OpenAI-compatible test double. A separate real-provider smoke is required to claim hosted model operation.

## Operational boundaries

- HIS/LIS events are explicitly emitted synthetic events. There is no live hospital integration.
- Reconciliation occurs on API reads, commands and source-event arrival. The visible browser polls; this is not unattended hospital polling or external notification delivery.
- Simulation roles exercise team interactions inside an owner-scoped workspace. They do not modify actual clinic membership or provide production multi-user team collaboration.
- Model output cannot approve tasks, emit source evidence, decide clinical urgency, prescribe, or alter clinical rules.
- Workflow learning is a tested, approved choice of handover section ordering. It is not autonomous skill-code rewriting or model training.
- OpenUI views are app-composed from authorized references, not arbitrary model-generated HTML or an embedding of ChatGPT's proprietary UI.
- Full production use, real patient ingestion, live HIS/LIS connectors and the PDF's later roadmap remain separate work.

## Release checks

Integrated local results are recorded below. Hosted rollout details are recorded separately in the deployment report.

### Integrated local release results

- Full Vitest run: **35 files, 225 tests passed** in 12.50 s. Includes 12 care integration cases and the source-policy regression.
- Combined Playwright care/landing/retained-obligation run: **24/24 passed**, 58.4 s, at desktop 1440×900 and mobile 390×844.
- OpenUI focused renderer/compiler tests: **5/5 passed**, including unresolvable references, literal escaping and the OpenUI delimiter case.
- Hermes Python protocol/reducer tests: **14/14 passed** locally and in the Linux amd64 container. These tests use a local provider fixture.
- TypeScript: passed after all UI and native bridge source changes. API, client and worker production builds passed; bundle-size and existing Gradle deprecation warnings remain.
- Database isolation/constraint suite: all checks passed.
- Independent browser review: same-tab account switching showed no prior-owner conversation; failed-response replay after polling retained the original request revision/key and created one encounter.
- Android: signed release compiled successfully in 19 s; APK Signature Scheme v2 verifies. Artifact `deliverables/Glucoflow_Care_2026-11-07.apk`; SHA-256 `ea623c67acf8522e2dba9ad382b35266d3186eee6c6d1931fcdf107ddf2713ff`. It bundles the hosted API configuration. Native file saving is implemented with Android's document picker; installation, camera, keyboard and picker behavior remain unmeasured without a physical device.
- Real provider preflight: the final Hermes Linux container returned HTTP 200 from the existing `gpt-6-luna` model in 19.1 s, with the requested operational proposal and exact synthetic citation. See the deployment report for hosted checks and image digests.

The current branch was created at **12:04:25 IST**. Final hosted completion time is recorded below; the target was one 60-minute implementation/verification pass, with OpenUI added during that pass.

Additional session regression run: **14/14 passed** in 23.2 s across desktop/mobile, including patient entry, clinic navigation, denied permissions and sign-out clearing. Total final local browser checks across the selected suites: **38 passed**. The desktop synthetic-data label expectation was updated to include the explicit fixture suffix.

### Hosted completion — 12:41 IST

The active Azure revision is `glucoflow-service--care20261107b`; Vercel production deployment `dpl_HCmpugRKseF1f4GkfjBdqnj1eYUG` serves https://glucoflow.vercel.app. All seven hosted API smoke groups passed, including ownership denial, repaired source/proof reads, matching LIS completion and a real Hermes turn. The hosted live turn took **44,203 ms** on the small demo allocation; the first 30-second attempt timed out and was repaired with a 60-second outer subprocess/65-second API deadline, retaining the existing per-turn call/token bounds.

Independent Chromium checks against the public site passed at 1440×1000 and 390×844: clinic entry, workspace creation, configured Hermes health, explicitly selected offline response, OpenUI encounter switching, exact LIS source inspection, monitoring-status selection, persisted messages after reload, no horizontal overflow and no development inspector. Zero page errors at both sizes. A separate patient sign-in opened My records and was redirected away from clinic care. Screenshots: `evidence/care-2026-11-07/hosted-ask-desktop.png` and `hosted-ask-mobile.png`. No additional paid model turn was used for browser checks.

The measured implementation/release window from branch creation to hosted browser completion was approximately **37 minutes**, within the 60-minute target. This does not include earlier product research. Live hospital connections and physical Android acceptance remain explicitly outside these measured results.

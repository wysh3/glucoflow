# Hospital authority: reference review

Read on 7 November 2026. This is a source-code comparison and implementation checklist, not a test report or a claim of deployment.

## References read completely

- [Doctor authority, hospital deployment and historical case search](https://chatgpt.com/s/t_6aef5074b2b8819194c0321eefafb022)
- [Complete manual prototype, workflow, dashboard and source code](https://chatgpt.com/s/t_6aef4fa6cafc8191bc7ef70274c020bd), including all embedded Python/HTML/JavaScript and its limitations.

The references describe a continuous patient journey with independently accountable activities. Their embedded prototype uses an untrusted role header and in-memory storage; it explicitly is not hospital-ready. It is product context, not code to substitute for the existing authenticated Fastify/PostgreSQL application. Its reported tests are not verification of this repository.

## What must remain distinct

1. Hospital membership, administrative authority, clinical qualification, workspace access, and task ownership.
2. Patient identity checks, technical source validation, and physician review. A laboratory validation is not physician sign-off.
3. A signed source order, acceptance of work, staff-reported performance, and independently sourced completion.
4. Current clinical responsibility, a request to another team, receiving-person acceptance, bed readiness, and physical arrival.
5. Source-reported history, reviewed records, disputed versions, patient reports, and missing information.
6. Demo persona selection and authenticated account authority.

## Responsibility model

| Person | Handles | Does not gain automatically |
| --- | --- | --- |
| Hospital administrator | Hospital setup, verified account enrollment, role assignment and revocation | Physician authority or clinical sign-off |
| Admission/coordination staff | Registration, documented location, placement coordination, administrative handoff | Diagnosis, prescription, clinical urgency or result sign-off |
| Treating doctor | Clinical decisions in the authorized source system; authorized review and acknowledgement; requesting handover | Authority to impersonate the receiving doctor |
| Nurse | Acceptance of assigned work, collection/performance documentation, communication of recorded activity | Lab validation or physician acknowledgement |
| Laboratory staff | Receipt, processing and source-validated laboratory events | Claiming the doctor reviewed a result |
| Receiving doctor | Accepting or declining named clinical responsibility | Implicit responsibility merely because a bed is ready |
| Patient | Own permitted uploads, patient reports and history | Staff permissions or silently verified clinical assertions |

Charge-nurse and bed-coordinator responsibilities need explicit capability mapping; they should not be introduced as cosmetic labels with unrestricted coordinator powers.

## Current implementation compared with the references

| Area | Source-code finding | Work required |
| --- | --- | --- |
| Shared account permissions | `care/team.ts`, migrations 057/059 and repository checks enforce workspace membership; clinician permission is checked for doctor roles | Hospital-level provisioning and role ceilings for all staff roles; prevent workspace-level promotion beyond hospital authority |
| Demo switching | `set_role` changes a private simulation role; shared workspaces reject it | Named bounded demo profiles, several per role; clearly labelled simulation; same encounter retained on switching |
| Named task acceptance | `coordination.ts` checks named authenticated recipients in shared workspaces | Bind private demo acceptance to the selected persona too; do not let a second nurse accept the first nurse's work |
| New admission | `commands.ts` assigns every added encounter to `Dr Mira Rao` | Remove fabricated ownership; explicitly select or record a responsible team and preserve admission actor/time |
| Pipeline ownership | `pipeline.tsx` uses generic team labels and a specimen-follow-up task owner for collection/receipt | Separate stage performer, current clinical owner, follow-up assignee and pending recipient; show unassigned/unknown when missing |
| Placement versus responsibility | Bed transfer and episode handover are separate state structures | Keep this separation and show current owner until accepted, even if a bed is allocated |
| Source evidence | Order events, acknowledgement and newer corrected results have separate evidence handling | Preserve actor attribution as well as source identity; never infer missing stages from later events |
| Records and observations | Existing reviewed-record workspace plus source-linked episode transcriptions | Integrate views without silently treating episode transcription as physician-verified data |
| Treatment administration | No verified live eMAR integration found | Source-backed order/administration contracts and connectors are separate work; no invented doses, administration or treatment rules |
| Historical case retrieval | No complete verified cross-case retrieval implementation found | Separate scoped design with access control, verification eligibility and explicit missingness; assess against hackathon's prohibition on clinical decision support before exposing comparative ranking |
| Long-term continuity | Existing patient records and episode follow-up records | Explicit patient/encounter linkage and provenance across inpatient/outpatient views; avoid merging unrelated seeded identities |
| ABDM/ABHA | Privacy page correctly says not connected | Keep truthful status; approved onboarding, consent and record-exchange integration remain external gates |

## Scope reconciliation

- Keep the existing Fastify/PostgreSQL implementation. The reference's suggested FastAPI stack is an illustrative prototype choice, not a migration requirement.
- Retain the user's compact chat/canvas navigation. The reference's seven screens are information domains to present contextually, not a requirement to add seven permanent navigation destinations.
- The user has explicitly requested hospital administration and named demo role switching. These supersede the original October exclusion of an administration UI, but not server authorization or the separation of administrative and clinical authority.
- Keep the official hackathon assistive-only boundary. The references' treatment values, diagnostic categories and historical comparisons must not become diagnostic or prescribing agent routines. Physician control alone does not establish eligibility under a rule excluding clinical decision support.
- Do not reuse the reference's `x-role` header as authorization, its global in-memory database, its hard-coded signatory names or its placeholder hospital integrations.
- Do not copy the prototype's combined “not matched or undocumented” output: different, missing and disputed must remain separate.
- The reference describes a future hospital product. It does not make the existing demo production-ready or validate clinical effectiveness.

## Acceptance scenarios for the active implementation

- Two nurses share role permissions but have distinct profiles; only the assigned recipient can accept an offer.
- Switching demo persona preserves the encounter and work history, changes available actions, and records simulated identity distinctly from the authenticated account.
- A lab account cannot place a physician order or acknowledge a result on behalf of a doctor.
- An administrator can manage staff but cannot acquire clinical authority merely by being an administrator.
- Revocation and role changes apply on the next server request, including saved/shared workspaces.
- Registration without a selected responsible person shows an explicit unassigned state, never a seeded doctor's name.
- A pending receiving-team handover leaves the current team responsible. Decline/expiry retains that responsibility.
- Bed readiness, accepted responsibility and actual arrival each require their own event.
- The pipeline displays who recorded an event, who owns follow-up, and who is being asked to accept work; unknown identity remains unknown.
- Order acceptance and performed-work attestations never silently create laboratory evidence or medication-administration evidence.
- Duplicate requests, stale revisions, corrections, missing source events and cross-clinic access attempts retain their existing failure semantics.
- Browser verification covers each role/person and restricted action, not only the doctor happy path.

Implementation is tracked in `docs/superpowers/plans/2026-11-07-hospital-authority.md`. No new runtime implementation or deployment is claimed by this review.


## Final master blueprint reference

Read the complete rendered shared conversation on 7 November 2026: https://chatgpt.com/s/t_6aef537cb1b4819194c82ab7403018e0 (16 sections, patient journey, six modules and staged roadmap). The web text fetch returned only a shell; the full browser-rendered text was read.

Adopted in this implementation: named role/person authority, accepted responsibility distinct from physical transfer, factual source-linked numerical plots, unknown data preserved, compact role-focused workspace, actor attribution and auditable hospital assignments. Charts contain no invented intermediate points or treatment-effect claims. Admission registration is distinct from clinical acceptance.

Preserved product areas: reviewed longitudinal records and contextual prescriptions, configurable monitoring domains/schedules, patient reports, operational routines and synthetic coordination. Existing record permissions remain separate from a care role.

Explicit roadmap rather than shipped claims: consent-authorized ABDM retrieval; real EHR/LIS/eMAR adapters; patient/encounter identity reconciliation across systems; historical case eligibility, ranking and comparison; validated glucose variability/CGM calculations; medication execution records; supervised clinical pilot. Historical treatment ranking needs an eligibility decision against the hackathon exclusion of clinical decision support before it becomes a demo feature. The proposed FastAPI stack does not require replacing the working Fastify API.

The reference's educational numerical case is not imported as a verified patient or silently merged with existing synthetic identities. Published study outcome figures are not GlucoFlow results. A full master-blueprint roadmap is not a production certification.

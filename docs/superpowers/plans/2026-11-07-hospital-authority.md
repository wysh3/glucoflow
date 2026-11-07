# Hospital authority and staff setup

User authorizes direct implementation. Extend the existing authenticated membership model instead of creating a second identity system. Hospital administrators manage staff; clinical authority remains a separate role. Existing synthetic/private demos stay isolated and role switching remains demo-only. Identity provisioning is an operator-controlled IdP step, never an unrestricted public signup that grants hospital access.

- [x] Hospital directory with administrator-gated role assignment/revocation, active membership checks, audit and last-admin protection.
- [x] Hospital role ceiling on shared workspaces; no workspace-owner promotion above assigned hospital authority.
- [x] Hospital setup/provisioning command and setup guide for existing verified identities.
- [x] Staff-facing hospital/team view, role descriptions and clear entry into shared workspaces.
- [x] Admission provenance and explicit admitting responsibility; remove fabricated default doctor on new encounters.
- [x] Role-focused care desk and server-side refusal tests for nurse/lab/admission actions.
- [x] Fresh database tests, full suite/typecheck/build and browser checks.
- [ ] Hosted API verification and commit/push.

No real patient deployment or prescribing is introduced. Hospital membership is not inferred from an email domain. Admin is not a clinical qualification. Care simulation remains explicitly synthetic.

## Additional references and demo requirements

Both shared references were read completely, including the longer reference's embedded prototype. See [source comparison and acceptance scenarios](../../../app/reports/hospital-authority-reference-review-2026-11-07.md).

- [x] Read both references and compare role, admission, coordination and pipeline implementations.
- [x] Add several named fictional people per demo role with one visible role/person switcher. Keep the same encounter across switches.
- [x] Bind demo task acceptance to the selected person, not merely a matching role. Reject persona switching in authenticated shared workspaces.
- [x] Show stage performer, clinical owner, follow-up assignee and pending recipient separately in the pipeline; do not label a lab follow-up owner as the specimen collector.
- [x] Preserve event actor and admission provenance; unknown actors and unassigned responsibility remain explicit.

The reference's seven screens are contextual information domains within the requested compact canvas, not seven new permanent destinations. Its FastAPI example does not supersede the current Fastify implementation. Its role header and in-memory storage must not replace existing authentication or persistence. Historical clinical case ranking and real treatment/ABDM connectors require separate scope and validation; they are not included silently in staff authorization work.

Current verification and limits: [release report](../../../app/reports/hospital-authority-release-2026-11-07.md).

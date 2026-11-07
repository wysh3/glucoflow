# Explicit synthetic team collaboration

Implemented in migrations 057 and 059 and `apps/api/src/care/team.ts`, with repository integration by the durable-history workstream.

- Workspaces remain owner-private by default. An owner explicitly enrolls another active member of the same clinic. Enrollment assigns one server-held operational role; doctor assignment also requires the clinic's clinician permission.
- First enrollment adds the owner as a team member. Shared workspaces reject the simulation role switch, including for their owner. Read responses project the caller's assigned role; writes temporarily use that role without overwriting the canonical workspace role.
- The database's row policies allow only active enrolled members who still have active clinic membership. Cross-clinic identities and patient-only identities cannot join. An enrolled teammate cannot invite others or self-promote.
- Enrollment/revocation and repository mutations lock the same workspace row. Revocation takes effect on the next access. Shared command idempotency includes actor identity.
- Team actions retain database-derived actor ID, assigned role, action, revision and timestamp in an append-only API audit table. Clients cannot update/delete membership or audit rows. Audit retrieval is paginated by numeric ID. Doctor access rechecks the underlying clinician capability on every request, including the workspace owner; removing it invalidates that assigned role until the owner assigns an allowed role or membership is restored.

## Fresh validation

`pnpm --pm-on-fail=ignore exec vitest run tests/integration/care-team.test.ts`: **8/8 pass**, 594 ms total test run on 7 November 2026. Tests execute through the actual local PostgreSQL API role and RLS; owner access is used only to construct or revoke test fixtures and inspect canonical state.

Covered private defaults, explicit sharing, cross-clinic/patient denial, self-promotion refusal, immutable audit grants, immediate revocation, impersonation refusal, clinic-membership revocation, shared role-switch refusal, successful nurse source recording, refusal of a doctor-only action, single audit on retry, per-actor idempotency audit pagination and doctor capability downgrade while clinic membership remains active.

`pnpm --pm-on-fail=ignore exec tsc -p tsconfig.node.json --noEmit`: passes.

## Limits

This remains synthetic care coordination. It does not provision real hospital staff, verify professional credentials, implement enterprise invitation/identity governance, or authorize real patient data. Shared demo login identities are not proof of separate staff identity. The new API foundation needs its route/browser integration validated in the release. Skill promotion continues to require its independent clinic clinician capability; operational team assignment does not grant that capability. This migration was applied locally; hosted deployment is owned by the root release workflow.

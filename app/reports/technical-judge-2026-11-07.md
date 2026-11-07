# Independent technical review — hospital authority release

7 November 2026. Simulated technical-panel review by an AI agent, not a security certification or clinical validation. Scope: current source changes in hospital authority, workspace membership, role-only entry, provenance, setup and migration delivery. The application was changing concurrently; the release owner must run final checks against the frozen combined revision.

## Verdict

The architecture has credible foundations for a synthetic, testable demonstration: server-enforced role checks, database row-level authorization, independent administrator and clinician permissions, named identities, audit records and restricted provisioning. It is not sufficient evidence to claim unrestricted hospital production readiness. Real identity-provider onboarding, clinical-system connectors, operating procedures, disaster recovery and supervised institution-specific validation remain external deployment gates.

## Findings and disposition

### P1 — A stale administrator editor could reactivate revoked access (fixed locally)

Evidence: `apps/api/src/routes/hospitals.ts` originally accepted only desired administrator/role/active fields; `StaffEditor` in `apps/client/src/features/hospital/page.tsx` always submitted active=true for Save. `assign_hospital_staff` serialized writes but did not compare the assignment the administrator had reviewed. An editor opened before another administrator's revocation could therefore restore access on Save.

Implemented a required `expectedAssignment` contract and a database comparison after locking the membership, in migration `065_hospital_assignment_concurrency.sql`. Mismatches raise SQLSTATE 40001, surfaced as HTTP 409. The UI snapshots the reviewed assignment when the editor opens; a stale response closes that editor, refreshes the directory and asks the administrator to review current access. It does not silently retry the security change.

Verification: `hospital-assignment-concurrency.test.ts` first failed before implementation (422 because the required new field did not exist). After the implementation, one integration test passed: revocation returned 200, stale reactivation returned 409 and left membership inactive, then a fresh explicitly based-on-current assignment returned 200. This uses the real API and local database, not mocked authorization.

### P1 — Revoking the workspace owner orphaned management (recovery added by implementation agent)

Evidence: `configure_care_team_member` is owner-only and `continueWorkspace` in `apps/api/src/care/repository.ts` also requires the owner. Revoked owners correctly lose access, but remaining staff could not enroll replacements or continue the settled workspace.

Migration `064_hospital_workspace_recovery.sql` now defines an operator-only recovery path. It requires the old owner to be ineligible, the replacement to already be an eligible enrolled member, and an audit reference; it changes management ownership without granting new care access or changing care records. The implementation agent owns the matching operator tooling/tests. Final release review must verify those tests and the setup guide. A hospital-facing admin recovery UI is not implemented; operator support remains necessary.

### P1 — Hosted migration runner rejected the new release (allowlist fixed)

Evidence: `scripts/deploy-care-migrations.ts` originally allowed release migrations only through 062. Its deliberate unknown-pending guard would reject 063 before deployment. Added 063, 064 and 065 to the explicit allowlist. Run hosted `--check` and `--apply` before deploying the API using the six-argument assignment function. No hosted migration or deployment was performed by this reviewer.

### P2 — Hospital staff assignment and patient-record capabilities are separate

The code intentionally makes Care role changes independent of separately provisioned clinician/reviewer capabilities. This prevents an administrator checkbox from becoming clinical authority. It also means changing a doctor Care role to another role is not equivalent to revoking all record permissions. Full membership revocation does remove hospital access. Keep this distinction explicit in operator onboarding and the evaluation script; do not advertise the Care dropdown as the sole control over every record permission.

### P2 — Owner-only workspace enrollment remains a support constraint

Even with audited operator recovery, ordinary hospital administrators cannot directly manage arbitrary workspaces. This protects against automatic administrator access to patient material but must be documented. Hospital deployment needs a named support owner, a recovery process and reviewed operator authorization; a shared demonstration account is not a replacement.

## Positive controls inspected

- Managed hospital creation is opt-in and does not convert existing demo clinics.
- Provisioning requires an existing verified identity; email-domain inference does not grant membership.
- Doctor assignment requires independently provisioned clinician eligibility.
- Administrators cannot change their own Care role; the last active administrator is protected under a serialized hospital lock.
- Directory reads hide email addresses and inactive accounts from non-administrators; audit reads require active administration.
- Shared workspace enrollment matches exact active hospital authority. Server access rechecks membership rather than trusting the UI role selector.
- Managed care-only users obtain Care navigation without being given legacy patient-record access merely to make the UI work.
- Private demo personas are separate from shared authenticated authority.
- Patient-visible or clinical effectiveness claims cannot be inferred from synthetic fixture success.

## Verification limits

The focused concurrency regression, standalone web TypeScript check and `git diff --check` passed locally. A whole-project typecheck attempted during review was blocked by concurrent, unfinished episode-record correction tests; no hospital-guard compilation error appeared in that output. Final suite, complete typecheck/build, browser click-through, hosted health and migration checks are the release owner's remaining evidence. No statement here establishes that all screens, all workflows or real hospital integrations have been validated.

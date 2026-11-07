# Governed skill artifact hardening — 7 November 2026

## Implemented

- Each captured operational skill now stores immutable, data-only semantics: engine revision, pattern, monitoring duration, freshness requirement, human approval requirement, source-only completion, and cancellation behavior.
- The supported interpreter accepts exactly the two existing allowlisted patterns. Unknown fields, changed safety requirements and unknown engine revisions fail closed. This does not introduce executable generated code.
- Sandbox test results are bound to the stored artifact. Approval reruns the current sandbox instead of trusting historical booleans alone.
- Rollback evaluates and copies the exact historical artifact into a new version. It never silently substitutes today's default semantics. Unsupported artifacts require a new captured version.
- PostgreSQL enforces immutable artifact/version identity and blocks publication without a matching artifact test attestation. Existing clinic RLS and human review remain in force.
- Proposals use the stored monitoring duration and remain proposed tasks requiring approval. The target encounter's own source evidence is still required.

## Legacy migration behavior

Migration055 snapshots the existing v1 fixed semantics for old rows. It cannot reconstruct historical executable code and does not pretend to do so. Old tests are not retroactively attested. An old approved skill is visible but cannot propose work until a clinician retires and restores it, which runs the current sandbox. Existing tasks are unchanged. The migration was applied locally, not deployed by this subtask.

## Fresh verification

16 tests passed across three files on 7 November at19:38 IST; node TypeScript check passed.

- Nine artifact unit checks: both supported patterns; future engines, missing artifacts, altered safety gates, changed duration, cross-pattern semantics and arbitrary executable fields refused.
- Three rollback checks: historical passing booleans cannot override a failing current sandbox; current sandbox executes; stored semantics are copied.
- Four real PostgreSQL integration checks: test/approve/retire/rollback round trip; semantic mutation refused even via owner connection; direct publication with passing booleans but no artifact attestation refused; cross-clinic artifact invisibility and patient publication refusal.

Command: `pnpm --pm-on-fail=ignore exec vitest run tests/integration/care-skill-artifact.test.ts apps/api/src/care/skill-artifact.test.ts tests/integration/care-skill-rollback.test.ts`

## Remaining limits

These are governed versions of two fixed operational templates, not autonomous learning or clinical knowledge transfer. Learned candidate generation, independent reviewer separation, broad held-out evaluation and observed production outcome feedback remain separate work. No claim of autonomous medical learning, customer readiness or improved patient outcomes is warranted by these tests. No provider calls or patient data were used.

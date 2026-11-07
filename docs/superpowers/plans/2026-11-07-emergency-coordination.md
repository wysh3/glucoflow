# Emergency coordination implementation checklist

Scope: implement the operational parts of the shared emergency workflow proposal using existing authenticated, source-linked workspace commands. Synthetic demo only; no diagnosis, prescription, severity scoring, inferred monitoring intervals or automatic clinical task generation.

- [x] Reproduce duplicate seeded monitoring error; reuse covered task without changing approval or evidence.
- [x] Add capacity-confirmed, capability-matched staff offers, expiry and named acceptance.
- [x] Separate staff work completion from source confirmation.
- [x] Separate receiving clinician responsibility from physical placement.
- [x] Record sourced observations/follow-up without interpreting clinical values.
- [x] Reconcile out-of-order LIS facts and corrected results without inventing missing stages.
- [x] Add compact episode coordination and evidence pipeline UI.
- [x] Add owner-controlled team enrollment and role changes with server authorization.
- [x] Verify fresh build, full suite and browser click-through.
- [x] Deploy verified API/client, document evidence and push.

External hospital launch gates remain: clinic identity provisioning, validated connectors, privacy/security review, backup/recovery/load evidence and real operational pilot. No unbounded staff capacity or validated hospital-readiness claim follows from a synthetic demonstration.

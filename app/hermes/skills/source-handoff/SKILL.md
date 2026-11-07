---
name: source-handoff
description: Use a clinic-approved operational template to propose specimen receipt or result acknowledgement monitoring from current encounter evidence.
---

# Source-backed handoff

Use this procedure only when the authorized workspace supplies an approved, applicable skill match. The match contains the clinic-approved version and current encounter/order IDs. It is not permission to open another workspace.

1. Read the current encounter's evidence. For specimen receipt, require its HIS collection event and an absent LIS receipt. For result acknowledgement, require its latest LIS validation or correction and no corresponding HIS acknowledgement. Disconnected or stale feeds make the state unknown.
2. Match the order and encounter together. A similar test name, shared bed, previous patient's event, or earlier corrected result cannot satisfy this order's evidence requirement.
3. Return a monitoring proposal carrying the supplied approved skill ID and the exact current encounter/order. State the operational purpose and that task approval is still needed. Do not create completion evidence or claim the proposal has been approved.
4. If the order is cancelled, already covered, already complete, outside the permitted scope or missing prerequisites, explain that condition and stop. Do not retry another patient's context or fabricate a substitute event.

The application determines task authority, duration, source confirmation and version validity. A staff attestation remains an attestation. A sent message is not a received specimen. A result being available is not a clinician acknowledging it.

This skill transfers an operational procedure, not a diagnosis, risk judgment, treatment decision or patient-specific fact. Patient context may explain the documented episode but cannot change the procedure's clinical scope. Improvement is a draft → test → human approval → versioned publication process; it is not permission for runtime skill-file writes.

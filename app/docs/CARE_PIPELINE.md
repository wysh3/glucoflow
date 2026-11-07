# Care coordination pipeline

GlucoFlow assists operational follow-up. The demo uses fictional records. A displayed stage means a recorded fact, not proof of clinical quality or treatment effectiveness.

```mermaid
flowchart LR
  A[Authenticated clinic account] --> B[Workspace membership and role]
  B --> C[Chat or direct action]
  C --> D[Validate scope, role and revision]
  D --> E[Locked database transaction]
  E --> F[Evidence timeline and audit history]
  F --> G[Pipeline and encounter view]
  G --> C
```

```mermaid
flowchart LR
  O[Order recorded] --> C[Collection recorded]
  C --> R[Lab receipt recorded]
  R --> V[Result available]
  V --> A[Current result acknowledged]
  V --> X[Corrected result]
  X --> N[New acknowledgement required]
```

Stages are displayed independently. Later lab evidence can arrive before collection evidence; the earlier stage stays unverified. A duplicate source reference is a replay only if its payload matches. A cancelled order can receive late evidence without restarting its task.

```mermaid
flowchart TD
  P[Human-approved operational task] --> K[Check capability, shift and confirmed capacity]
  K --> O[Offer reserves a slot]
  O --> A[Named staff member accepts]
  O --> D[Declined or expired: release reservation]
  A --> W[Work completion recorded with source]
  W --> L[Release capacity]
  W --> E[Lab evidence and acknowledgement remain separate]
  H[Receiving clinician requested] --> R[Named clinician accepts responsibility]
  B[Bed requested] --> BA[Bed allocated] --> AR[Arrival recorded]
```

Workspace owners can add existing active clinic accounts through **Team**, assign Doctor, Nurse, Lab staff or Coordinator, and revoke access. Doctor access requires existing clinician eligibility. This is workspace enrollment, not account creation or an email invitation. Shared workspaces bind actions to the authenticated user; the private demo's role selector cannot impersonate a member in a shared workspace.

**Pipeline** opens all encounter stages. **Coordinate** opens staff offers, receiving responsibility, placement and sourced records. Signing out is available at the workspace's top right.

Current scale is bounded by workspace storage limits and measured demo load. Hospital rollout still requires identity provisioning, validated connectors, monitoring, recovery verification and a supervised operational pilot. The app does not promise unlimited concurrent staff.

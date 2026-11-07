# Durable revision evidence and authenticated team repository

Implemented 7 November 2026. Synthetic care workspaces only; this is not an unlimited hospital database or a retention/compliance certification.

## Changes

- Migration 056 adds `care_workspace_history`. An insert/update trigger captures every changed source-bearing workspace state in the same transaction as the state change. Background-worker transitions are included. Scheduling-only updates do not create duplicate snapshots.
- Existing workspace states are imported with `baseline=true`. No historical revisions are invented.
- Application roles receive SELECT only. RLS derives visibility from the workspace, so an unenrolled colleague or another clinic cannot inspect it. The privileged trigger has a fixed search path and is not callable by PUBLIC.
- Summary pagination returns 30 revisions plus a cursor; full source-bearing snapshots are fetched individually. Invalid or out-of-range bigint cursors are rejected. The reader returns 404 for inaccessible workspaces.
- Repository operations now use authenticated explicit team membership supplied by `team.ts`. Shared workspaces project the caller's assigned role without rewriting the canonical stored role on a read. Role switching is rejected in shared mode, including for the owner. Commands execute under the assigned role, restore canonical state role before persistence, and append authenticated actor audit entries.
- Shared command idempotency hashes include the actor identity. Reusing another person's key does not silently claim their action. Private workspace hashes remain compatible with previous receipts.

## Verification

`care-history-red.txt` records the initial expected failure (history relation did not exist).
`care-history-green.txt`: 10/10 tests across history, continuation and background suites passed. Tests cover initial snapshots, worker snapshots, transaction rollback, no duplicate scheduler snapshots, denied update/delete, cross-clinic and unenrolled-colleague isolation, 33 revisions over two pages without omissions, snapshot retrieval and invalid cursors. Node typecheck passed after repository integration. Team authorization agent owns additional role-assignment tests.

## Remaining work

The active-workspace size and entity caps remain intact. Migration 058 now provides an explicit owner-only archive/continuation lifecycle for settled episodes: it refuses open tasks, pending handovers and pending bed transfers, atomically creates one linked fresh synthetic demo, carries active enrolled members, and retains the previous source-bearing state read-only. Repeated continuation requests return the same successor. Archived workspaces are excluded from background monitoring; chat is refused before provider dispatch as well as persistence. This supports repeated bounded demonstration episodes, not continuous hospital intake. Normalized entity storage remains necessary for that broader scope. Snapshot storage grows with changed revisions and requires a measured storage/retention strategy before production scale. Database-owner maintenance can remove snapshots when the parent clinic is deliberately deleted; this is application immutability, not independent tamper-proof/WORM storage. Earlier pre-migration revisions are unavailable. No hosted deployment was performed by this task.

## Continuation verification

`care-continuation-red.txt` captures the missing-export initial red test. The final combined suite verifies refusal of active work, one linked successor under retries, preserved source events and tasks, read-only repository/SQL behavior, and monitor exclusion. History pagination includes a controlled bigint digit-boundary case: numeric ordering is qualified with the source table, avoiding lexical ordering of the string output alias.

Migration 060 additionally rechecks the owner’s current shared-workspace capability before SQL continuation and excludes enrolled doctor roles whose clinic clinician capability has been revoked. A red/green regression demonstrates that revoked doctor assignments are not copied and an invalid shared owner cannot bypass repository checks through the SQL function. Final focused suite: 10/10; Node typecheck passed.

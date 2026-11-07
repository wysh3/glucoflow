# lintapple audit — 7 November 2026

Ran installed lintapple 0.1.24 against https://glucoflow.vercel.app/. Source: https://github.com/gholtzap/lintapple. No product changes were made in this audit.

## Completed runs

| Run | Coverage | Unique groups | Failed occurrences | Unresolved occurrences |
|---|---|---:|---:|---:|
| [Existing policy entry](lintapple-entry-2026-11-07.json) | 390×844 and 1440×900 | 5 | 8 | 2 |
| [Strict entry](lintapple-strict-entry-2026-11-07.json) | Same viewports; 44px targets, no exceptions | 8 | 14 | 2 |
| [Clinic flow](lintapple-flow-2026-11-07.json) | 1440×900; entry, workspace home, worklist, encounters, records | 67 | 63 | 8 |

All completed scans exited 1 (findings), not 0. Initial flow attempts exited 2 due to audit selector configuration; corrected run completed. Counts are rule/element/state groups, not necessarily independent user-facing defects. Existing policy allows 15px controls and includes historical exceptions; it is not a rigorous accessibility pass. Strict entry flags intentional screen-reader-only clipping because exceptions were removed.

## Priorities

1. Fix actual contrast failures and unsupported ARIA labels.
2. Enlarge small disclosure hit targets without adding visual weight; provide horizontal content insets.
3. Reconcile inconsistent typography with a deliberate design scale (do not blindly shrink or enlarge all text).
4. Address icon-button help and label-consistency findings. Native title help has coverage limitations.
5. Review unresolved contrast and intentional accessibility-label clipping manually.

## Clinic flow rule groups

- font-size: 25 groups; 26 failed / 0 unresolved occurrences.
- content-inset: 21 groups; 23 failed / 0 unresolved occurrences.
- control-state: 2 groups; 0 failed / 2 unresolved occurrences.
- icon-button-tooltip: 9 groups; 10 failed / 0 unresolved occurrences.
- control-gap: 3 groups; 3 failed / 0 unresolved occurrences.
- text-contrast: 4 groups; 1 failed / 3 unresolved occurrences.
- label-consistency: 3 groups; 0 failed / 3 unresolved occurrences.

## Coverage limits

No Android execution, live-model quality, backend security audit, nested dialogs, every patient-detail route or complete mobile clinic flow. This is an automated UI audit, not Apple certification. Reported spacing/contrast measurements should be reviewed in context before repair.

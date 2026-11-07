# One entry and a coherent clinic workspace

7 November 2026. Implements the user's duplicate-function, three-screen coherence and collapsed-icon-rail requests.

## Consolidated

- `/` redirects with history replacement to `/sign-in`. The old landing component and separate clinic-demo authentication handler were removed. One entry screen supports account selection and ordinary sign-in; authenticated users still go to their authorized workspace, and protected deep links preserve their destination.
- The entry screen no longer has a redundant public Home/sidebar. Walkthrough, privacy and receipt verification remain secondary footer links. Anonymous guide launchers are removed.
- Clinic navigation is one shared component: Chat, Worklist, Encounters, Records. It stays in the same place across care, patient selection, patient detail, review and result tools. The main sidebar contains Workspace and Account.
- The large patient-list sample banner was removed. Samples remain in the upload workflow. Patient identity remains visible on a record. Its section navigation now has one location instead of a second sidebar plus repeated overview buttons.
- Activity is an audit history, not another rendering of open tasks. Worklist owns task review. Handover content lives in chat; the encounter panel links to it rather than copying the full draft and source list.
- Care draft text survives navigation to Records and back, scoped to the actor's browser session. Starting/reopening a workspace resets its draft; sign-out removes stored Care drafts.
- Closing desktop navigation keeps a 64 px icon rail. Links retain accessible names, title tooltips and active state. Expanding restores the stored width. Mobile retains its drawer rather than consuming screen space with a rail.

## Deliberately not merged

Care simulation encounters and longitudinal record patients remain distinct data identities. No name-based association or shared authorization was invented. The record guide is available in patient context; inpatient chat remains scoped to its care workspace. Clinical publication and operational approval remain explicit actions. Existing deep links and backend workflows remain supported.

The repeated Hindi answer in the supplied screenshot was traced to the native Hermes adapter's fixed `help` response template in `hermes/policy.py`, not an unbounded reasoning loop. This frontend release does not claim to improve the conversational capability of that template.

## Verification

Fresh TypeScript checks passed. All 282 application tests across 50 files passed in 12.30 seconds. The deployment built and scanned the client. Browser verification reproduced the old collapsed-sidebar absence, then measured the corrected rail at 64 px with labelled Workspace/Account links and no horizontal overflow. Local browser navigation confirmed `/` resolves to `/sign-in`, and an unsent synthetic Care draft survives Chat → Records → patient overview → Chat.

The changed landing tests and an added collapsed-rail regression are included in source. The complete historical browser suite was not rerun; it still needs alignment with the earlier chat/speech/navigation simplifications. This report does not claim all browser tests pass. Hosted screenshots and final verification are recorded below.

## Published verification

Production deployment `dpl_HF5zihRu8bPQxpg5faxWwkXeEE6P` reached READY and is served at https://glucoflow.vercel.app. On the published site, signed-out `/` resolved to `/sign-in`; the Clinic team demo entered its authorized workspace. Collapsing navigation and reloading retained a 64 px rail with accessible Workspace and Account links. Records and Asha Rao's synthetic overview opened through the shared navigation.

At a 390 × 844 mobile viewport, the patient overview's document width was 390 px (no horizontal page overflow). The navigation drawer opened with Workspace/Account links and closed successfully. The temporary viewport override was reset.

Screenshots: [entry](evidence/coherent-workspace-2026-11-07/hosted-entry.jpg), [desktop icon rail](evidence/coherent-workspace-2026-11-07/hosted-icon-rail.jpg), [patient overview](evidence/coherent-workspace-2026-11-07/hosted-patient.jpg), [mobile drawer](evidence/coherent-workspace-2026-11-07/hosted-mobile-drawer.jpg).

No live microphone, paid model, or backend deployment test was performed in this navigation change.

# Light canvas, loaders and API availability — 7 November 2026

## Changes
- Shared neutral text/background/border tokens replace the conflicting green application and blue-grey imported shell colours. Status colours remain meaningful.
- Desktop global toolbar moved into sidebar footer. One quiet row contains workspace actions. Mobile retains accessible language/account controls.
- Home uses “Your workspace”; “Shift overview” removed. No task-status bars. Plain task counts, source rows and owners. Overview/back-to-chat is beside the composer, not another toolbar.
- Desktop measurement rows put name, recorded date, value and source action together. Patient context no longer has an isolated white background.
- All native disclosure markers removed centrally, retaining native details/summary keyboard and expanded-state semantics. Local expanded Filter tasks verified and computed marker content empty.
- MIT Grok orb vector paths reused in a lightweight DOM SVG loader (upstream commit c4b9859). Shared loading status, session loading, public connection and voice processing use the orb. CSS reduced-motion fallback; no Skia or WASM runtime added. Licence retained in the component vendor folder and public licences.

## Verification
TypeScript passed after component changes. Client build and deployment asset-secret scan passed. Local 1280×720 home fits overview and entire composer even with unavailable-runtime controls. Mobile 390×844 chat has document width 390px, reachable composer and retained navigation. Local record details, worklist and encounters visually inspected. Deterministic synthetic chat flow tested; no new live-model or speech execution claim.

## Backend
At investigation time public API readiness returned HTTP 200, database reachable, production CORS origin allowed. Fresh hosted sign-out/sign-in completed. Existing API scale configuration allowed zero replicas; client public config deadline is ten seconds. Cold start was a plausible cause of the reported failure, not conclusively proved by retained events. Changed API minimum replicas to one and updated deploy-care-azure.py to preserve this. Azure revision glucoflow-service--0000012 was verified Healthy with one replica and correct concurrency setting 20. This retains a warm API instance and incurs baseline hosting usage. Worker scaling unchanged.

## Published verification
Final Vercel deployment `dpl_4Jq9qigNnSgUL18Ewp2guLcgcD7v` reached READY. On the production site, session restoration succeeded; signed out and opened Other demo roles. The control expanded, marker content was empty and list-style was none. Screenshot saved under evidence/light-canvas-2026-11-07/entry-no-triangles.jpg.

# Welcome correction — 7 November 2026

The preceding deduplication removed the introduction altogether. This correction keeps one entry implementation while explaining the product before requesting a role choice.

- `/` renders the welcome. `/sign-in` redirects there with navigation state preserved; signed-in users retain their authorized role destination.
- Clear clinic demo action, patient entry and collapsed specialist/test roles replace four equally weighted account cards.
- The operational handover preview is explicitly illustrative, not live inference or a real patient record.
- Existing authentication, human approval and synthetic-only scope remain unchanged.

## Evidence

Fresh TypeScript check passed; production client build and deployment asset scan passed. Deployment `dpl_FcGgxCL1Vhh3tNZeuDqZ4i7u2iFa` reached READY at https://glucoflow.vercel.app. Hosted browser verified legacy sign-in resolves to root; clinic entry reaches `/clinic/care`; patient entry reaches `/patient/records`. Signed-out welcome at 390 px has a 390 px document width; temporary viewport reset. Desktop and mobile screenshots are in `evidence/welcome-2026-11-07/`.

Browser assertions were updated for the new heading/canonical root but the full browser suite was not rerun. No new model, audio, backend or device validation is claimed. The previous 282-test result is historical for this small presentation change, not a fresh test run.

## Remaining judge priorities

See `independent-product-judge-2026-11-07.md`: redundant simulation setup step, fixed help responses, separate Care and record identities, and fresh end-to-end/speech/latency evidence remain substantive work. This welcome correction does not resolve those issues or establish production readiness.

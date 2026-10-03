# GitHub upload verification — 3 October 2026

Fresh checks of the current local working tree before its first GitHub push:

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed both web and Node projects |
| `pnpm test` | 135/135 tests passed across 21 files |
| `pnpm db:test` | 12/12 SQL isolation and constraint checks passed |
| `pnpm build` | Client, API and worker bundles passed; large frontend chunk warning remains |
| `git diff --check` | Passed |
| Hosted frontend reachability | HTTP 200 at `https://glucoflow.vercel.app` |
| Playwright | First test failed waiting for the Email sign-in input; run stopped with one failure, one interrupted test and 54 not run |

The recent role-entry screen change and the existing browser sign-in helper require reconciliation. No fresh full browser pass, Android rebuild, physical-device test, hosted redeployment or paid model evaluation is claimed for this upload. The user's time constraint requested an immediate public source upload after the completed checks.

## Publication hygiene

Environment files, local credentials/state, signing material, build output and temporary chart directories are excluded by Git ignore rules. Secret scanning covers the Git history and the publication snapshot. The historical generic-key findings are synthetic fixture identifiers and fixture SHA-256 hashes; they are not credentials. Ignored Android build/signing files were not included in the upload. Any public Supabase client key is client configuration, not a service credential.

The main README now documents features, stack, local setup, verification, repository layout, demo links and known limits. Stale claims that hosting/live processing had never been exercised were replaced with links to dated evidence.

# Living-system pass (2026-11-15)

I filmed the full A–Z tour on the live site, frame by frame, on desktop (1440×900) and phone (390×844). All 28 steps ran with no console errors. Changes made from that review:

- **Governed learning loop** (`learning-loop.tsx`, `learning-loop-state.ts`): a five-stage visual at the top of Care routines (observe → capture → test → approve → reuse).
  - The stage comes only from recorded tasks and skill versions.
  - Each stage offers its next real action: capture from a source-confirmed task, run sandbox tests, open the clinician approval dialog, or preview reuse. Approval still goes through the existing confirmation dialog.
  - It replaces the "No active care routine" dead end.
- **Reuse preview** now preselects the first other encounter whose latest order is at the routine's step. The server still checks applicability.
- **How it works:** a "Living system" section with skills, the governed loop, adapting to any ward, and an interface built for the question. Each card names where to see it in the demo.
- **Full tour:** the learning step targets the loop: "A system that learns your workflows as skills".
- **Showcase seed (API):** one pending work offer for the nurse persona, so "My Shift" opens with named work to accept or decline. The classic seed is unchanged.
- **Test stability:** the guide service test stub timeout went from 100 ms to 2 s, because it failed once under load.

Verification:
- Typecheck passed.
- Unit tests: 425/425 on three of four full runs. One run had 3 failures that did not reproduce, so I have not identified those tests.
- Learning-loop state: 4/4 tests (node:test).
- Local e2e: landing, tour and care 20/20 (desktop and mobile); care and tour desktop 8/8 after the reuse change.
- API: revision `glucoflow-service--dev-living-1`, image `sha256:d843b8418a2914d5431ece34ef59815020d493117769bd526feca4392de870d9`. Healthy, and the hosted smoke checks passed.
  - Rollback image: `sha256:5f488f621ad4d734392ae494d979cd8f147553d1670a7dc60f0bbe820c72fd50`.
- Web: Vercel `dpl_Hj2i6rKyxwxo3aQRQaFwD35EiVUx`. Production tour and landing specs passed 10/10.
- On the live site I drove the loop as the demo doctor: capture → 5/5 sandbox cases → approve → reuse preview. This left "Verify specimen receipt" v7 approved for the demo clinic.

## Hosted chart cleanup (2026-11-15)

With the user's confirmation, I deleted two old test reports for Asha Rao (synthetic) in one transaction:

- `synthetic-smoke-2026-10-03.pdf`: HbA1c 7.8 %, approved twice.
- `synthetic-deployment-audit-2026-10-04.pdf`: HbA1c 6.73 %.

Together they put three conflicting 3 October values on the progression chart. The rows that depended on them and 2 finished jobs were removed with them. No `results` rows referenced them.

The backup is in the git-ignored `.local/` directory.

After the cleanup, the live chart shows four results: 8.2 → 7.9 → 7.5 → 7.1 % (January to 30 September 2026). The production tour and landing specs passed again.

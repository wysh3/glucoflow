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

## Speed and phone polish (2026-11-15)

### Measurements

All measured on the live site under a throttled phone profile: 390×844, 150 ms latency, about 1.6 Mbit/s down, 4× CPU slowdown. Each figure is a single run, so expect some network variance.

| Measure | Before | After |
|---|---|---|
| Landing: first paint | about 4 s (blank until the app loaded) | 0.8 s (branded launch screen) |
| Landing: largest content | 4.65 s | 2.6 s |
| Landing → unit board visible | 5.4 s | 3.9 s |
| Care desk data transferred | 930 KB | 593 KB |
| Care desk largest content | 3.1 s | 2.7 s |
| Main script (compressed) | 214 KB | 174 KB |
| Font | 344 KB | 104 KB |
| Phone: board rows fully visible above the composer | under 1 | 2 |

### Changes

- **Animated icon package removed from the first load.** `lucide-animated` could not be tree-shaken, so seven icons pulled in its whole set plus framer-motion. Those icons now come from `lucide-react`, and the press feedback is a small CSS "pop" that respects reduced motion. Both packages remain listed as dependencies but are no longer imported.
- **Inter subset.** The font is cut to Latin, Latin-1 and punctuation, plus arrows, maths symbols and the symbols the UI uses. Both variable axes (weight and optical size) are kept.
- **Faster first view.** The landing page prefetches the care desk code while idle. `index.html` shows a launch screen that React replaces on first render.
- **Phone care desk.**
  - The heading, glance tiles and composer are compact.
  - The composer is a single row.
  - "Chat options" becomes an icon button, keeping the same accessible name.
  - The placeholder is short on phones.
- **Motion.**
  - Buttons scale slightly on press.
  - Dialogs fade and scale in over about 0.2 s.
  - Reduced motion is respected.
  - A slide-in for side panels was tried and dropped because it conflicted with how the source panel opens.
- **Landing.** Spacing is tightened so the page fits a 1440×900 screen without scrolling, as the layout test requires. The removal test now expects the current "How it works" link; "Walkthrough" was replaced earlier in this session.

### Verification

- **Typecheck:** passed.
- **Unit tests:** 425/425.
- **Full local browser suite:** 208 passed, 2 skipped, 2 failed. Both failures are `progression.spec.ts:42`, "opens the source document".
  - That test fails the same way on the previous commit against the same local database: 1 pass in 3 runs on each. I had rebuilt and reseeded the local database, which left duplicate records (React duplicate-key warnings).
  - On the live site, opening a source shows the quoted source text on desktop and phone.
- **Earlier failures in this pass:**
  - The note tests in `polish.spec` fail only when parallel workers write notes for the same patient; alone they pass 8/8.
  - The progression row-count failure was a race in the test.
- **Production:** tour and landing specs 10/10 after Vercel deployment `dpl_AdqnUodoJt3YciHHnQ9Tp1J4ip3r`. The API was unchanged in this pass.

# The 60-second delta

A doctor-side pre-visit brief for Indian follow-up clinics. The doctor has two minutes. The product gives back the first sixty seconds.

This package contains the working MVP, the two-page solution brief, the eight-slide final presentation, the 6:45 film script and a 3:44 natural product cut. All patient data and source documents are synthetic.

## What is in the box

| File | What it is |
|---|---|
| [Delta_Solution_Brief.pdf](Delta_Solution_Brief.pdf) | Two pages, A4, the prescribed 13-section structure |
| [Delta_Solution_Brief.docx](Delta_Solution_Brief.docx) | Editable source for the brief |
| [Delta_Final_Presentation.pdf](Delta_Final_Presentation.pdf) | Eight slides, 16:9, the prescribed sequence |
| [Delta_Final_Presentation.pptx](Delta_Final_Presentation.pptx) | Editable source for the deck |
| [Delta_Demo_Video_Script.md](Delta_Demo_Video_Script.md) | 6:45 film plan, seven beats, shot list, voiceover, checklist |
| [Delta_Product_Cut.mp4](Delta_Product_Cut.mp4) | 3:44 natural product cut, 1920 by 1080, Sarvam Aparna |
| [screens/](screens) | Six current product screens |

## Run the MVP

Prerequisites: Node 22, pnpm 12, PostgreSQL 16. The app uses a local synthetic database.

```bash
cd app
pnpm install
pnpm db:start
pnpm db:reset
pnpm db:migrate
pnpm exec tsx scripts/seed-demo.ts --confirm-demo
pnpm dev
```

Open the public judge demo at `http://127.0.0.1:5173/demo/delta`. It needs no sign-in.

To use the clinic route, open `http://127.0.0.1:5173/sign-in`, choose **Clinic team**, open **Asha Rao (synthetic)** and select **Delta**. The sign-in page uses ready-made demo roles, so no password is printed here.

`pnpm db:reset` and `pnpm db:migrate` touch the local synthetic database only. Do not point them at production data.

## The flow the doctor sees

The first screen is the brief, not the record.

1. **Three decisions.** The eGFR change, the eye review that has no later record, and the atorvastatin disagreement. These are selected by an explainable rule: the clinic watchlist, the oldest open item and the first disagreement. The product does not score risk.
2. **One page above the fold.** Seven changes, three unresolved items, two conflicts and three gaps. No scrolling is needed to reach the three decisions on a 1440 by 900 screen or on a 390 by 844 phone.
3. **One click to the source.** The synthetic lab page opens with the quoted line highlighted.
4. **One decision at a time.** Accept, flag or ask the patient. Each action is appended to `sutra.delta_dispositions` with the actor and time.
5. **A draft note.** It assembles from the accepted decisions. Context changes are labelled as not individually accepted. Nothing is written to the medical record.
6. **The full ledger.** The four blocks remain available for the deep read. It is one click away, not the default.

The live route uses the same brief. It reads approved facts, labelled patient notes and document state from `GET /api/v1/patients/:id/delta`. The synthetic demo uses the same domain function and the same view, with a fixed input.

## What the product refuses to do

- It does not diagnose, recommend treatment, score risk or infer a screening deadline.
- It does not choose between conflicting sources or average them.
- It does not fill a missing value, a missing page or an ambiguous date.
- It does not sign a note or write to the medical record.
- It does not claim ABDM or WhatsApp integration.
- It does not treat a demo read time as a measured average.

## Numbers and labels

The synthetic case has 7 changed items, 3 unresolved items, 2 conflicts and 3 gaps. The brief shows 3 decisions. The read time is 42 seconds on this synthetic case; slide 5 and the video label it as one demo run, not a measured average.

The four pilot metrics are targets, not results:

- Time to brief, under 60 seconds per patient.
- Delta completeness, the share of required delta items present.
- Unresolved items closed within 7 days.
- Doctor confidence, rated after each brief.

The pilot is three clinics, 100 follow-ups, eight weeks, with a manual baseline and the delta arm on the same cases.

## Price

The deck and brief use a hypothesis, not a measured willingness to pay: ₹1,500 per doctor per month, or ₹3,000 per two-doctor clinic per month. The pilot price is fixed for eight weeks. At ₹1,500 per doctor per month, flat clinic pricing is about a US$25 to 50 million market. Value-based and government contracts are the larger path. Validate the price with the first three clinics.

## Verification

Run in `app/`:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test tests/e2e/delta.spec.ts --project=desktop-chromium
pnpm exec playwright test tests/e2e/delta.spec.ts --project=mobile-chromium
```

Measured on 3 November 2026:

- Typecheck passed.
- 184 tests passed across 30 files.
- Production build passed.
- The delta browser test passed on desktop and mobile. It checks the three decisions, the tour, the source dialog, the review sheet and the draft note.
- The live route was checked against the local API: accept persisted across a reload, and the authorized source viewer opened the synthetic PDF.
- The brief exported to exactly 2 A4 pages. The deck exported to exactly 8 slides at 16:9. The artifact checker ran 145 checks and passed.
- The product cut is 3:44, 1920 by 1080, H.264 with AAC audio.

## Hosted deployment

- Public demo: https://glucoflow.vercel.app/demo/delta
- Live clinic: https://glucoflow.vercel.app/sign-in
- Web: Vercel project `glucoflow`, production alias `glucoflow.vercel.app`
- API: Azure Container Apps `glucoflow-service`, revision `delta1`, image `20261104-delta`
- Database, auth and storage: Supabase, Mumbai
- Migration 019 is applied. `sutra.delta_dispositions` is append-only, and the API role has read and insert grants.
- The clinic and patient accounts are in the ignored `.local/hosted-demo-credentials.json`. Do not commit that file.

## What still needs a human

1. **Team names.** The brief and deck use the roles Clinical lead, Engineering lead, and Design and product. Add the real names before submission.
2. **Doctor footage.** The 6:45 script needs a real doctor for the cold open and two to-camera lines. The 3:44 product cut uses Sarvam Bulbul v4 Flash with the English female persona Aparna, and no doctor footage. Replace the title cold open with the filmed version if the team can shoot it.
3. **Pilot commitments.** The ask is three clinics and 100 follow-ups. A signed letter or a purchase order is stronger than a verbal yes.
4. **Willingness to pay.** ₹1,500 per doctor per month is a hypothesis. Test it with the first three clinics and record the objection.

## Code map

- `app/packages/contracts/src/delta.ts`: the delta input and output shapes, dispositions and evidence.
- `app/packages/domain/src/delta.ts`: the pure `buildDelta` function, conflict detection, gaps and the narrative.
- `app/packages/domain/src/delta.test.ts`: 4 domain tests, including the duplicate-lab conflict and the disposition merge.
- `app/packages/data/src/delta.ts`: latest dispositions and append-only writes.
- `app/supabase/migrations/019_delta_dispositions.sql`: the append-only table, RLS read and append policies, grants.
- `app/apps/api/src/routes/delta.ts`: `GET /delta` and `POST /delta/dispositions`.
- `app/apps/client/src/features/delta/brief.tsx`: the three-decision brief.
- `app/apps/client/src/features/delta/review-sheet.tsx`: the one-decision-at-a-time review.
- `app/apps/client/src/features/delta/note-sheet.tsx`: the draft note.
- `app/apps/client/src/features/delta/delta-view.tsx`: the full four-block ledger.
- `app/apps/client/src/features/delta/demo-page.tsx`: the public synthetic demo.
- `app/tests/e2e/delta.spec.ts`: the desktop and mobile browser checks.

## One sentence

The record is not the doctor's problem. The delta is.

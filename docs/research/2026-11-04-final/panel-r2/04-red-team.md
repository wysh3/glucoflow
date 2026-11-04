# Red team, round 2

**Reviewer.** Red team. **Date.** 4 November 2026, 18:16–18:40 IST.
**What I attacked.** The running client at `127.0.0.1:5173`, the API at `8787`, the local Postgres, and the code the packet points at. I did not modify the repository. I made no state-changing writes: every mutation I attempted was an expected refusal, and the two pause/resume attempts returned 404 against stale IDs after a concurrent reseed, so nothing was paused.

**State caveat, stated up front.** The demo database is shared and was re-seeded at least twice during my session (receipt codes changed at 18:22 and 18:24). The line card was empty, then populated, then empty again as other reviewers ran the demo. Some observations are therefore about *a* state, not *the* state. I mark these. Everything I call a defect is reproducible from the seed file or the code, not only from the churn.

---

## 1. Score: 72 / 100

| Dimension | Weight | Score | Why |
|---|---|---|---|
| Doctor usability | 20 | 15 | It really is one card, one tap, no patient-side fields, three buttons. The clock does not blame her. But the echo is pre-filled by the client (`line.tsx:79` sends `valueEcho: row.valueText`), so the guard proves nothing about what she read. And the line holds exactly one card. |
| Trust and safety | 15 | 11 | The guards are real, server-side and typed. I watched three refusals (below). Cross-tenant read is blocked (404). But the public receipt breaks on any superseded code, and pause has no terminal guard. |
| Technical substance | 15 | 12 | A real phase union with 20 passing unit tests (I ran them), mirrored in PL/pgSQL, one audit chain, zod at the boundary, RLS. Deductions: the domain does not model pause/resume but calls itself the authoritative table; legacy `status` is still a second writer. |
| Demo readiness | 15 | 9 | Every screen loads on a fresh device and the Clinic team card lands on `/clinic/line`. But the hero screen is single-use with no reset in the product, the register currently shows duplicate rows, and `/verify/<code>` fails with a raw database error. |
| Differentiation | 15 | 11 | The obligation plus a no-login public receipt plus a surveyor register is not a care-loop dashboard. It is the most defensible thing here. The receipt's failure path undercuts it. |
| Completeness | 10 | 6 | Four roles, four screens. But the completed-loop close (`actions.close`) is wired only in the **old ledger** at `/clinic/results`, never in the new workspace. Pause/resume and reassign have no UI at all. The Exceptions tab ignores its own date inputs. |
| Claim honesty | 10 | 8 | Synthetic is labelled on every screen, the replay says "not a measurement" and tells you to replace it, no fake customer. The deduction is the replay's headline number being an echo of its own assumptions. |
| **Total** | **100** | **72** | Strong engine, fragile opening, one broken promise in the exact moment of differentiation. |

---

## 2. What I actually tried

**Through the browser** (Playwright, 1440×900, the Clinic team card):

- Signed in from `/sign-in`. The card list is Doctor / Clinic team / Reviewer / Patient. It lands on `/clinic/line` as the packet says.
- `/clinic/line` rendered one card: `Potassium 5.9 mmol/L`, critical, Asha Rao · P0482, "flagged 05:49 PM · 1 h to breach", buttons Seen / Correct value / Source. This matches `evidence/line.png`. At 18:18 and again at 18:30 the same screen rendered the empty state, "Nothing needs you before patient one."
- `/clinic/calls` rendered the critical Potassium card with the inline warning "A critical result cannot be recorded as informed without the read-back." and the **Record contact** button disabled. The read-back guard is visible *before* the click, which is the right design. The card also said "2 attempts on record".
- `/clinic/intake` rendered three received reports, each with **Accept custody**. Sodium 128 (unmatched, critical) carries a clinician name in "Custody: received · Dr Meera Nair" without being matched — cosmetically odd.
- `/clinic/register` rendered 15 rows, `OPEN 11`, `INFORMED 5`, `UNREACHABLE 1`, with a working `Print A4 register`. Under `emulateMedia('print')` the sidebar disappears (`.no-print`) and `@page { size: A4; margin: 10mm }` applies. Print survives.
- `/clinic/replay` rendered 86.7% vs 37.7%, "+49.0 points", median handoff 10 min vs 68, and the assumptions list.
- `/showcase` routed and rendered (no `<main>`, so my text scrape was empty — not a product fault).
- `/verify/GLF-E35B503219` and `/verify/GLF-862FF5D22D` both rendered **"The check did not complete. invalid input syntax for type uuid: \"1\""**. A currently-valid code (`GLF-91F63E60D1`) returned `{"found":true,"valid":true,"stage":"received"}`.

**Through the API** (clinic account, then other-clinic, then reviewer):

- `POST /obligations/:id/assign` on an unmatched, received report → `409 state_conflict`, "accept custody before assigning a clinician".
- `POST /obligations/:id/close-unreachable` with one attempt → `409 state_conflict`, "record at least two attempts before closing as unreachable".
- `POST /obligations/:id/informed` with `readBack:false` on a critical → `422 validation_failed`, "a critical result needs a recorded read-back".
- `GET /obligations/:id` as the other clinic → `404`, and its register view is empty. Tenant isolation holds.
- `pnpm exec vitest run packages/domain/src/obligation.test.ts` → **20 passed**.
- `GET /api/v1/public/receipts/GLF-E35B503219` → `422 validation_failed`, raw Postgres text.

**Read, not run:** `obligation.ts` (411 lines), `obligations.ts` route and data layer, migrations 035/036/037, the seed, all four screens plus the drawer, `replay.ts`, `replay-data.json`.

---

## 3. The eight answers

### 1. The single strongest argument that this fails as a company

**There is no way for a report to get in, and that is the product.**

The obligation engine assumes a result exists as structured data with a flag and a value. In the real clinic the report is a PDF on WhatsApp from one of four labs, a paper slip, or a portal login. The packet is explicit: "No live WhatsApp, portal or lab-feed ingestion. The demo seed and the CSV import are the inputs." `sourceChannel` is a seeded string, not an adapter. So every unit of value sits behind a manual step the clinic already fails to do — which is precisely why results are missed.

The second half is the buyer. The person who would pay is the owner-doctor, and his current belief is "we don't miss criticals; we're careful." The product's proof of value is a 300-report audit he has not agreed to give you. Until an adverse event or an accreditation visit, there is no trigger to buy. So: no ingestion → no deployment → no audit → no proof → no sale, and the loop cannot be entered at step one because step zero is not built. That is a company-level failure, not a feature gap.

### 2. The single strongest argument that this fails at the finale

**The judge breaks the one thing no competitor has, in under sixty seconds, twice.**

The differentiator is the tamper-evident receipt. The public page for it returns `invalid input syntax for type uuid: "1"` — an unauthenticated leak of a Postgres cast error — for **every superseded receipt code**, and this database currently holds **282 tombstones**. The cause is one character: migration `032_result_integrity.sql:241` does `select 1 into v_result` where `v_result` is `uuid`. It only evaluates when a tombstone matches, which is why unknown codes return a polite `not_found` and stale codes explode. The designed and nicely-written `revoked` state in `verify/page.tsx` can never render.

Any code on the slide deck, in a screenshot, or from the previous rehearsal is stale. A judge who asks "let me type that" gets a database error on the screen whose entire job is to prove integrity.

The second break is the opening screen. The seed contains exactly one line card (`demo-res-01`, status `owned`). One tap on **Seen** consumes it. There is no reset in the product and no second critical queued, so a second run — a judge saying "show me again", or a presenter who fumbled — opens on "Nothing needs you before patient one." I watched that exact screen render empty twice today.

Add the register showing **15 rows where the seed defines 12**, including two identical `Potassium 5.9` rows for Asha Rao at the same timestamp in contradictory states ("In intake" and "Awaiting contact"). The surveyor's page has duplicate patients in it.

### 3. The assumption the team is most likely lying to itself about

**That the state machine is the hard part.**

The obligation engine is genuinely good — better than most funded seed-stage work. The team has then assumed that because the enforcement is correct, adoption follows. It does not. The two hard, uncontrolled facts are (a) how a report physically arrives and (b) whether a human answers the phone. The replay is the confession: it assumes "86% reachability" and "4 minutes per call", and then reports **86.7% closed within SLA** as the outcome. That number is not a result; it is the input, resampled. Median handoff is not simulated either — `simulate()` sets `seen = received + 4 min + 6 min` for every row, so it is *always* 10, and the "68 → 10" improvement is a subtraction of two constants. Four outputs, one random draw. They have modelled away the only uncertain part and are calling the residue evidence, then telling themselves the remaining risk is engineering.

### 4. A cheap test that would expose the lie within 7 days

**Sit in one clinic for two days with a stopwatch and a counter.**

Measure two things, no code, no product: (a) from the moment a report lands in the lab's WhatsApp or on the desk, how many minutes and how many human actions until it exists as a row with a value and a flag; (b) five real closure calls, timed, recording whether the patient answered on the first attempt. Then replace `deskMinutes + reviewMinutes` and `reachProbability` in `scripts/replay.ts` with the measured values and re-run the script.

If reachability is under ~60%, or intake is more than about 6 minutes of staff time per report, the 86.7% collapses and the unit economics with it. Cost: two days of one person's time and a spreadsheet. The team has instead spent that time on a 300-row synthetic cohort whose baseline was invented by `buildSyntheticCohort`. That is the tell.

### 5. The exact question I would ask on stage, and whether it survives

> "You say a receipt survives every handoff. Here is the code from your own slide — will you check it in front of us?"

Then, after it fails:

> "Your receipt does not survive a re-seed. What else in this chain is an assumption?"

**Does the product survive it? Not as it stands today — no.** The failure is deterministic and the fix is roughly twenty minutes: `select 1` → `select id` in `032_result_integrity.sql`, redeploy, then verify three codes (live, stale, revoked) before the demo. If they fix it, the answer becomes strong, because the designed `revoked` state and the "it is not an opinion about the result" copy are unusually mature. Asked today, in public, it is fatal.

### 6. The three fixes that most reduce the chance of public failure

1. **Fix the tombstone cast and rehearse the receipt as a moment.** `select 1 into v_result` → `select id into v_result`, then test `/verify` against a live code, a superseded code, and a tombstoned code. Then deliberately carry one *revoked* code in the deck: "this one was deleted, and here is what that looks like." Turn the bug into the strongest 20 seconds available.
2. **Make the demo re-armable and re-shoot from a reset state.** Seed three line cards (one critical, one abnormal, one household-name collision), add a one-click "reset synthetic demo" to the clinic header, and delete the duplicate register rows so the surveyor's page shows 12 rows, not 15. Re-take the four evidence screenshots from the reset state so the packet's evidence and the product agree.
3. **Close the loop in the new product.** Put **Close receipt** in the obligation workspace (after a recorded contact, with a disposition) or auto-close on next-step completion. Today the only close button in the shipped product is in the legacy ledger at `/clinic/results`, which the packet itself says "is not the new product". Right now the loop the whole pitch describes cannot reach `closed` on the screens the pitch shows. If it cannot be fixed, demote the claim from "closes the loop" to "records and hands off".

### 7. Survival probability

**As a company in three years: 10%.** The engineering is above the bar; the distribution is not built (no ingestion, no channel, no buyer, no measured cohort), and the buyer's willingness to pay is unproven until an adverse event forces the conversation. A pivot to selling the audit instrument to accreditation consultants is the plausible survival path, and it is not the current pitch.

**As a finale winner: 20%.** Differentiation is real and the honesty labels are better than the field. Demo readiness and completeness are the weakest two dimensions on the rubric, and the two most likely judge actions — "show me again" and "let me check that code" — both currently break.

### 8. One-sentence verdict

A genuinely engineered accountability engine, wrapped in a demo that can be performed exactly once and a public receipt that fails on every code from a previous run — fix the one character and re-arm the seed, or the judge will break the only thing no competitor has.

---

## 4. Things I checked and found honest

- The three refusals are server-side, typed, and human-readable. Not client-side theatre.
- Cross-tenant read is blocked; the other clinic's register is empty.
- `pnpm exec vitest run packages/domain/src/obligation.test.ts` → 20 passed, in this session.
- The register's print path is real: `.no-print` on the shell, `@page { size: A4; margin: 10mm }`, table at 10px.
- The public receipt does not leak patient data for a valid code — stage and validity only.
- The replay screen honestly says "Synthetic cohort, not a measurement" and instructs the team to replace it before quoting a number. The dishonesty is in the *title of the metric*, not in the label.

## 5. What I did not verify

- **Pause/resume live.** The route exists and the procedure shifts all three deadlines, but there is no UI anywhere (`actions.pause`/`resume` are defined in `lib/obligations.ts` and used in no screen), and my two API attempts hit stale IDs after a concurrent reseed. Code-level, `pause_result` also lacks a terminal-state check, so a closed obligation can be paused and given a `paused` event. Untested.
- **Server-rendered PDF.** There is none; the register is browser print. The packet says so.
- **A4 fidelity in a real browser dialog.** I emulated print media, not a print-to-PDF round trip.
- **The 300-report audit.** It does not exist. Both sides of the replay are generated by `replay.ts` from constants.

# Jury chair, round 2

**Reviewer.** Jury chair, 20 health-hackathon finals. Two clinicians and one technologist in the room; I am scoring what those three would do with this build.
**Date.** 4 November 2026, 18:16–18:35 IST.
**Build.** `f7cc839` on `8a6d83a`, client `127.0.0.1:5173`, API `127.0.0.1:8787`.
**Method.** Chromium 1.63 via Playwright at 1440×900 and 794×1123 (A4), locale `en-IN`, `Asia/Kolkata`, signed in through the **Clinic team** card, then through the **Reviewer** card. Screenshots saved beside this memo in `evidence/`. I read `app/packages/domain/src/obligation.ts`, `app/apps/api/src/routes/obligations.ts`, the four obligation screens, the detail drawer, `supabase/migrations/035`–`037`, and `packages/data/src/obligations.ts`. No code changed. I clicked one control that writes: **Accept custody** on the first intake card; the demo database was also being re-seeded by someone else mid-session (new 5:49 p.m. rows appeared between two captures), so treat all counts as of a moment.

---

## 1. Score

| Dimension | Weight | Score | Why |
|---|---|---|---|
| Doctor usability | 20 | **15** | The line is the right shape: one card per result, value, flag, breach, patient, one primary **Seen**, a **Correct value** path that requires a reason, and copy that protects the clock ("The clock does not run while you are in theatre"). It is not a form, not a dashboard. Deductions: the line was empty when I arrived, the one tap does not finish the loop, and the value echo is pre-filled from the row the client already holds, so it can never catch a transcription error on this screen. |
| Trust and safety | 15 | **10** | Real guards, loudly: assign before match is refused in the database (037), a critical cannot be recorded informed without read-back, an unreachable close needs two attempts on two different days, the drawer says what the chain does not prove. Deductions: the calls screen defaults the outcome to "Patient reached" and leaves **Record contact** enabled — an abnormal result can be recorded informed with no read-back and no teach-back; read-back is only enforced for critical; and the new UI never calls `close`, so the register's green terminal state is not reachable from the new screens. |
| Technical substance | 15 | **12** | A genuine phase union with typed refusals, one transition table, SQL procedures as the only writers, `security definer` + `is_clinic_member` + owner checks, stage-scoped breach clock (036), pause/resume arithmetic, events with `actor_role` and source-span hash, 212 unit tests, 12/12 isolation checks, 17 Playwright. Above the field by a distance. Deductions: SLA constants live twice (TypeScript and SQL), the legacy `status` dual-write survives, no server PDF. |
| Demo readiness | 15 | **9** | Every route loads, no console errors, no failed requests, the showcase page gives an eight-step path, the replay is labelled. But the front door I was given was empty, the A4 print clips, and the state depends on who last ran the seed. |
| Differentiation | 15 | **11** | The obligation — one object, one owner, one clock, one receipt, one register — is not a care-loop dashboard. The refusal (a report held until a human matches identity) and the exception ("Not informed" printed as a status, not a green tick) are ideas the public entries do not show. The moat the team claims (lab countersignature) is absent, and the replay overlaps RAD-SMART. |
| Completeness | 10 | **7** | Four role homes, four screens, a drawer, a public verifier. Missing: the close action in the new flow; the reviewer's route gating; a diabetes-shaped register. |
| Claim honesty | 10 | **8** | Best in class on labelling: "Synthetic cohort, not a measurement", "the baseline is an assumption", "replace it with 100 to 300 consecutive reports", the receipt page states its own limits. Deductions: "MEDIAN HANDOFF 10 min" is arithmetic from stated assumptions presented as a headline result, and the third replay card reads "Baseline baseline" with no comparator. |
| **Total** | **100** | **72** | Strong bones, unfinished last mile, one visible print failure. |

Band: a competent finals entry with a real idea; not yet a winner's demo. Reseeded queue and a working close would move this to 78–80 without new code in the domain.

---

## 2. The 40-second moment

**What I actually saw live:** the public receipt. `/verify/GLF-B046A26336` — no login — says "Chain intact", shows the recorded stage, and then prints the sentence that makes the room trust it: *"It does not prove that a diagnosis or treatment was correct, and it is not a clinical outcome."* That is the moment a clinician judge leans forward, because every other team is claiming more than it can prove.

**What the design intends, and what the room should see if the queue is seeded:** the register, scrolled to the red status. One row — *Meena Kulkarni · Potassium 6.2 · "Not informed"* — beside eleven rows that say Informed, Closed or Awaiting contact. The line to say out loud is "we print the failure, we do not fake the closure", then open the drawer and show the chain head. That is a better 40 seconds than the one-tap See, because it is the one thing no dashboard in this competition can show.

**What did not happen:** I could not tap See, because `/api/v1/obligations?view=line` returned `count: 0` for the whole session. The intended one-tap moment is corroborated only by the team's `line.png` and by `tests/e2e/obligations.spec.ts`, not by my hands. That is itself the finding in §3.

---

## 3. What a skeptical judge breaks first

**First, before any argument: the empty front door.** Sign in, land on the line, read "Nothing needs you before patient one." A judge who has not been told to run a seed does not know the demo is one rehearsal away from blank. This is the cheapest possible failure and it is live today, because the team's own Playwright run consumes the queue and nothing refills it.

**The first substantive break: print.** A quality-head judge will ask for the register on paper. At true A4 width the nine-column table is 965 px wide on a 794 px page: the **Informed** and **Status** columns are clipped, and the mobile bottom tab bar prints across the page. The register survives on screen and fails on the one artefact the surveyor files. The screen hides its toolbar under `@media print` but not the paper width.

**The one that does not survive the follow-up: "so who closes it?"** After the nurse records an informed contact, `communication_state` becomes `informed` but `terminal_state` stays null; `close_result_v2` exists and is exposed at `/api/v1/obligations/:id/close`, but **no client screen calls it** — `actions.close` is defined in `lib/obligations.ts` and never used. So the register keeps an amber "Informed" row forever, and every green "Closed" row in the demo came from the old ledger's `status` writer. The claim is "the loop closes"; the new loop stops one step short and the old writer supplies the evidence.

**The role bypass.** With the **Reviewer** account, the nav correctly shows only Replay, Ledger, Patients and Review queue — but pasting `/clinic/line` renders the clinician shell (empty state, not a refusal), and `/clinic/calls`, `/clinic/register` and `/clinic/intake` all render. Reads are clinic-scoped and writes are refused in SQL by capability, so nothing leaks and nothing is written; but "role-separated workspace" is a claim the route does not honour. A technologist finds this in thirty seconds.

**Does it survive?** The engineering survives: the guards are in the database, the refusals are typed, the audit chain is real. The *story* does not survive the close question, and the *demo* does not survive a cold start.

---

## 4. Differentiation against the public entries

| Entry | What it is | What this build has that it does not | What it lacks against it |
|---|---|---|---|
| **RetinaX** (diabetes, care-loop dashboard) | Cohort dashboard, retinopathy loop | An object with a state machine, not a chart; per-result accountability and a printable exception register | A diabetic cohort view, any clinical outcome, any screening logic |
| **Liv2care** (diabetes, liver pathway prototype) | Pathway prototype | A working lifecycle with a named owner and a clock the database enforces | A pathway at all — no liver, no staging, no guideline |
| **Setu** (cancer follow-up) | Follow-up coordination | Refusal as a first-class outcome (held report, "Not informed" register row) | Setu's clinical specificity; cancer follow-up has a clearer owner |
| **Cara** (maternal closure) | Closure of the maternal episode | The receipt: tamper-evident chain, public verification, stated limits | Cara's episode model is closer to a real closure event |
| **RAD-SMART** (cancer, measured replay) | Measured replay | Honesty about the replay (labelled simulation, assumptions printed), and the register | RAD-SMART's number is measured; this one is modelled — a judge will prefer theirs unless ours is framed as the audit *instrument* |

The defensible wedge is narrow and real: **"the last mile has an owner, a clock and a receipt"** is not a dashboard and not a scribe. It is also, today, the only entry whose central artefact is a *refusal*. Lead with the refusal and the printed exception, not with the tap.

---

## 5. The three fixes, in order

**1. Close the loop in the new UI (≈ +5–6 points).** Put a **Close** action on an informed obligation (calls card and register row) wired to `POST /close`, show the disposition, and let the register say Closed. In the same pass, stop defaulting the contact outcome to "Patient reached" and require read-back **or** teach-back before an informed record on any abnormal result — default the outcome to an attempt, not a closure. This converts the central claim from "half a loop" to "a loop", and it is the difference between 7 and 9 on completeness and 10 and 12 on trust.

**2. Make the demo state self-healing (≈ +4 points).** A "Start the demo" control that re-seeds and lands on a full line, plus an empty-state action on `/clinic/line` that loads the demo cohort. Right now the judge's first screen is whatever the last test run left behind. This is not a feature; it is insurance against the only failure that cannot be recovered in the room.

**3. Fit the register to A4 (≈ +3–4 points).** Nine columns do not fit portrait A4 at this type size. Drop the clinician column on paper, widen value/status, and hide the bottom tab bar in print CSS. A quality head who prints and loses the Status column will not believe the rest of the governance story.

**Cheap extras, in the same afternoon:** redirect the four `/clinic/*` routes when the capability is missing (30 lines, closes the reviewer bypass); link the receipt code in the drawer to `/verify/<code>` — it exists and is good, and no judge will type it; fix "Baseline baseline" and relabel "Median handoff" as "modelled handoff".

---

## 6. Is this on the right path to win the diabetes track?

**The thesis is right; the costume is wrong.** The obligation is a real answer to a real diabetes-clinic problem: the abnormal HbA1c or eGFR that arrives, is seen, and is never called back. Nothing about the mechanism is diabetes-specific, which is the strength of the engineering and the weakness of the pitch. In the product I saw, "diabetes" appears in three seeded test names; there is no HbA1c trend, no repeat-test window, no ACR/eGFR panel, no cohort register, no guideline-mapped next step. A diabetes panel will ask "why is this a diabetes product?" and the current screens answer "it isn't, yet."

To win rather than place: keep the substrate, dress it in the vertical for the first sixty seconds — a diabetes register (HbA1c, ACR, eGFR, creatinine) with the three-month repeat clock and the "next step" as a repeat test, then the obligation line and the exception. The replay should be framed as the audit instrument the clinic runs on its own 300 reports, not as a result. If the panel is clinician-heavy, expect them to discount the modelled 86.7%; if it is ops/quality-heavy, the register and the refusal will carry the room.

**Would I use it in my clinic tomorrow?** The line, yes, as a prototype with a seeded feed. Not the register until print is fixed, and not the loop until a nurse can close it and the receipt proves the closure. What stops me is not the idea; it is that the last step is missing and the paper does not fit.

---

## 7. Verdict

**A genuinely novel accountability object with database-enforced guards and an honest receipt, shown through a demo whose front door is empty and whose loop stops one step before closure — fix the close, the seed and the A4 page and this is a finalist; leave them and the room remembers the blank line, not the idea.**

---

## Evidence actually seen

Saved in `docs/research/2026-11-04-final/panel-r2/evidence/`:

| File | What it shows |
|---|---|
| `r2-01-signin.png` | Four role cards; the Clinic team card signs in without typing |
| `r2-02-landing.png`, `r2-03-line.png` | The line, empty: "Nothing needs you before patient one." |
| `r2-05-calls.png` | Two abnormal calls, default "Patient reached", two unticked read-backs, no close-unreachable |
| `r2-07-intake.png` | Three reports; unmatched Sodium offers Match patient; no "held" badge |
| `r2-09-register.png` | 12 rows; Rows 12 / Open 8 / Informed 6 / Unreachable 1; statuses Informed, Awaiting contact, In intake, Closed, Not informed |
| `r2-10-register-print.png` | Print media at 1440: chrome hidden, so it looks fine until the paper width is set |
| `r2-12-replay.png`, `r2-12-showcase.png` | The replay (86.7% vs 37.7%, "Baseline baseline") and the 8-step judge path |
| `r2-13-source-drawer.png` | Chain intact, 1 event, receipt code, limitation sentence, **no** verify link |
| `r2-15-verify.png` | Public receipt page, no login, stage progress, stated limits |
| `r2-16-reviewer-landing.png`, `r2-17-reviewer-line.png` | Reviewer nav without role homes; `/clinic/line` still renders |
| `r2-18-register-a4-print.png` | A4 width: Informed and Status columns clipped, mobile tab bar printed |
| `r2-19-mobile-register.png` | No horizontal overflow at 390 px |

Code read: `obligation.ts` (phase union, guards, SLA table, `valuesMatch`, clock arithmetic); `obligations.ts` routes (eleven endpoints, coarse `clinic` capability, actor-scoped transactions); `line.tsx` (pre-filled `valueEcho`); `calls.tsx` (default informed, critical-only read-back, no close); `intake.tsx` (match panel, assign-to-me); `register.tsx` (client-side KPI arithmetic); `detail.tsx` (no verify link); migrations 035–037 (procedures, views, backfill). `actions.close` is wired in `lib/obligations.ts` and used by no screen.

**What I could not see:** a live one-tap See (line empty all session), a completed closure, the Exceptions tab's own content (the route reuses the register), or the demo after a clean seed (the database changed under me at 5:49 p.m. from another process). I did not run the seed myself.

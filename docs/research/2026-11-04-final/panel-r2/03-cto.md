# CTO panel, round 2 — the deliverable

**Reviewer.** CTO, 200-hospital clinical deployments. **Date.** 4 November 2026, ~18:15–19:00 IST.
**Scope.** The running product at `127.0.0.1:5173`, the API at `:8787`, the code at `f7cc839` (dirty tree), and the two screens added mid-review (`/clinic/replay`, `/showcase`).

---

## 1. Score

**75 / 100.** Craft is well above this field. The four things that hold it back are one false-closure rule, two clocks that disagree, a register that omits the clock, and a demo whose only workable account holds all four roles at once.

| Dimension | Weight | Score | Why |
|---|---:|---:|---|
| Doctor usability | 20 | **15** | The line is genuinely one card and one tap, sorted by breach, with the stage-scoped clock so she is not blamed for the desk's delay (`036`). Lost points: the fast-path "Seen" button echoes the value the server just sent (`line.tsx:79`), so the value-echo is a copy, not a confirmation; no one-handed/keyboard affordance; the drawer is heavy for a clinician. |
| Trust and safety | 15 | **11** | Visible refusals are real and server-enforced: read-back for criticals, two-attempt rule, patient-match before assign, non-owner cannot see. Lost points: the two-attempt rule is a calendar bucket, not an interval (§2); `reassign` erases seen-state and resets the clock; pause is invisible in the printed register. |
| Technical substance | 15 | **13** | A real state machine in PL/pgSQL with row locks, a select-only API role, `security definer` with pinned `search_path`, a hash-chained append-only audit with an anchor and a tombstone, and a TypeScript mirror pinned by 20 tests. Lost points: `db:test` never exercises the obligation procedures; no concurrency test; the TS table and the SQL table already disagree. |
| Demo readiness | 15 | **10** | Every route loads, print CSS is real, `/showcase` indexes the eight beats, `/clinic/replay` is new and honest. Lost points: at 18:20 IST the **line was empty** — the flagship "one tap" cannot be demonstrated on the running site; there is no self-resetting seed; "Assign to me" is a 403 for the clinician-only account. |
| Differentiation | 15 | **12** | Obligation + stage clock + receipt chain + an exception register that prints "Not informed" is not a care-loop dashboard. Lost points: the nav still presents two products (Ledger/Patients/Review queue beside Line/Calls/Intake/Register); with an empty line there is no 40-second moment. |
| Completeness | 10 | **6** | The four screens and the register work end to end **for one account that holds all four roles**. A real desk cannot assign to another clinician (there is no roster and no picker); a clinician-only user gets a dead button. |
| Claim honesty | 10 | **8** | Synthetic labelled everywhere, `demoLabel` served in `/api/v1/config`, the replay page says "not a measurement", the drawer says what the chain does not prove, no invented customer. Lost points: "Visible to a surveyor, a lab or a court" (`showcase/page.tsx:34`); assumption 0 calls the baseline "recorded" while the footer calls it an assumption. |

Verdict on the score: **75, ±4** depending on whether the judges see a reseeded line and whether they ask "who is the assigned clinician?" before or after the pitch.

---

## 2. What is genuinely engineered

Not a wrapper. Four mechanisms carry the product:

**1. The phase union is the schema.** `packages/domain/src/obligation.ts` (411 lines, 20 tests) is one discriminated union — `received | accepted | assigned | seen | attempted | informed | closed | closed_unreachable` — and `applyAction` is the only transition table. Impossible states are unrepresentable ("informed but never seen" cannot be constructed). Repeats are handled deliberately: a second `accept` by the same actor returns `changed: false` (`obligation.ts:137-139`), `resumeClocks` is idempotent (`:388-390`), and pause-twice is a no-op (`035:672`). That is state-machine thinking, not form validation.

**2. The clock belongs to the stage that owns the work.** `036_obligation_active_clock.sql` is 22 lines and it is the best decision in the product. `obligation_breach()` returns the *active* deadline: custody while the desk holds it, review once assigned, communication once seen. Before `036` the earliest deadline ever set owned the row, so a doctor inherited the desk's delay. This is the engineering answer to "the clock does not blame her", and it is in the database, not the UI.

**3. The API cannot write.** `grant select on sutra.results, sutra.result_events to :api_role` (`021:87`). Every mutation is a `security definer` procedure with `set search_path = sutra, pg_temp` and `select ... for update` on the result row (`035:311, 361, 412, 478, 528, 581, 622`). Actor identity is transaction-local — `set_config('app.actor_id', …, true)` and `set local role` (`packages/data/src/pool.ts:55-62`) — so a pooled connection cannot leak one clinic's identity into the next request. A compromised route handler cannot produce a bad transition; it can only fail to produce a good one. Verified live: a reviewer's `POST /assign` returns `403 desk capability required` and the row is unchanged.

**4. The receipt is a chain with an anchor, not a hash column.** `026` builds SHA-256 over `result_id|clinic_id|type|actor|from|to|note|detail|created_at|prev`, a before-insert trigger links each event to the previous head, and an update/delete trigger raises `42501` (`026:118-127`). `032` adds the anchor (`chain_event_count`, `chain_head`) maintained by an after-insert trigger, a tombstone on delete, immutability on the core report fields, and a guard that refuses to delete a user named in the trail. Both verifiers — clinic-side and the public one — recompute from `GENESIS` **and** compare the stored anchor (`032:170-206, 258-262`), so trimming the tail is detectable, not just editing the middle. The public verifier returns no patient fields, no values, and distinguishes *revoked* from *invalid* (`032:250-256`).

Measured this session: `pnpm typecheck` clean; `pnpm test` **212 passed / 33 files**; `pnpm db:test` **12/12**; `tests/e2e/obligations.spec.ts` 4 tests (the four named e2e files hold 17: 4+4+2+7). Live tenancy check: another clinic's result id returns 404 on `/obligations/:id`, `/results/:id` and `/results/:id/proof`.

Also real: `037` makes assignment impossible before the patient is bound (`patient_id is null` → raise). That is the identity hold the pitch claims, and it is one `if`, in the right place.

---

## 3. Where the shortest path to a wrong closure is

**Door one — the two-attempt rule is a calendar date, not an interval.** `035:631-636`:

```sql
select count(distinct (attempted_at at time zone 'UTC')::date) into v_days ...
if v_days < 2 then raise exception 'two attempts on different days are required';
```

The UTC date rolls over at **05:30 IST**. A night-shift nurse who calls at 05:25 and again at 05:35 IST produces `23:55Z` and `00:05Z` — two "days", ten minutes of effort — and `close_result_unreachable` accepts. The domain has the identical rule (`obligation.ts:315`) and `obligation.test.ts` has a test literally named *"counts distinct UTC dates, not attempts"*. So the guard exists, is tested, and **tests the wrong invariant**. The UI even offers the button after any two attempts regardless of date (`calls.tsx:196`), so the database is the only thing standing between a tired nurse and a false "unreachable".

Is it guarded? **No.** It is belt-and-braces on the wrong idea. The claim "never a false closure" is one night shift away from false. Fix is a `min(attempted_at)`/`max(attempted_at)` interval, not a date bucket — and it is four lines.

**Door two — `reassign` silently un-does the loop.** `035:755-762` sets `review_state = 'pending'`, `review_actor_id = null`, `review_due_at = now() + SLA` while leaving `acknowledged_at/by` and `communication_state` untouched. Consequences, all with no guard:
- a **breached** result becomes "freshly assigned" with a new clock — the breach disappears from the worklist;
- a **seen** result becomes unseen, so a second clinician can re-see it;
- an **`attempted`** result drops out of `obligation_calls` (which requires `review_state = 'seen'`), so the patient is never told and the record is not an exception either;
- the row now says `acknowledged_at` is set *and* `review_state` is `pending` — two contradictory facts on one row, on screen.

The domain table has the same shape (`obligation.ts:268-286`): `reassign` from `attempted` returns `assigned` and **drops the attempts array**. Both layers forget. This is the quiet path: nobody gets an error, the obligation just evaporates.

**Door three — pause is an unaccountable clock kill switch.** `035:656-684` lets *any* clinic member pause; the reason is optional at the DB layer (`nullif(btrim(...))`) and the API's 3-character minimum is the only constraint (`contracts/obligation.ts:66`). `036:14-15` returns `null` while paused, and every worklist sorts `nulls last` (`035:227, 244`), so a paused critical sinks to the bottom. The printed register has **no paused column** (`register.tsx:110-120`). So the one artefact the surveyor files cannot show that the clock was stopped. The event log records it; the page does not.

Ranking for the finale: door one is the reputational risk (it falsifies the headline). Door two is the operational risk (an obligation can vanish). Door three is the audit risk (the register can be true and still not tell you the clock was paused).

---

## 4. Is the receipt chain real, and what does it actually prove?

**Real.** Hash-per-event, linked by `prev_hash`, appended by trigger, immutable by trigger, anchored by count and head, tombstones on delete, attribution survives user deletion, and both verifiers compare the anchor. It is more than most regulated products I have audited at seed stage. It is not a blockchain and does not pretend to be.

**What it proves, exactly:**
1. The events that remain for this receipt are internally consistent: every hash recomputes from its own fields and its predecessor.
2. No event was edited, removed, reordered, or trimmed **after the anchor was written**, unless the anchor was rewritten in the same act.
3. The actor named on each event is a user who existed and could not be deleted while named.
4. The counts and head the verifier reports match the anchor stored on the result.

**What it does not prove — the threat model, stated plainly:**

| Adversary | Does the chain hold? |
|---|---|
| A bug in the clinic's application writing a wrong event | **No.** The chain anchors the bug faithfully. |
| An authorised human recording a false statement ("patient reached") | **No.** The chain is a proof of integrity, not of truth. This is the honest limit and it is the one a judge will probe. |
| A stolen API session editing a row | **Yes.** `api_role` has no INSERT/UPDATE on the tables; triggers raise. |
| An insider with `UPDATE` on `sutra.results` | **No.** `chain_head`/`chain_event_count` are ordinary columns; the digest is **unkeyed** SHA-256 over public fields, so a determined insider recomputes a consistent chain and a matching anchor. |
| The database owner / superuser / a restored backup | **No.** The owner is the root of trust. No HMAC key, no external witness, no signature, no off-box anchor. |
| Cross-clinic forgery | **Yes.** RLS plus `is_clinic_member`; verified live with a second clinic (404). |

So the receipt proves **"this clinic's own database has not been quietly edited by anyone weaker than its owner, since it last wrote the anchor"**. It does not prove the events are true, and it does not prove a court would accept it. The drawer's sentence — *"the chain proves the events were written in this order and have not changed since. It is not an opinion about the result"* — is accurate and unusually well judged. Protect that sentence; do not let marketing upgrade it.

One live demonstration of the limit: at 12:52:28Z the chain recorded `auto_escalated — Overdue receipt escalated to medical superintendent` for a row whose own screen said **"24 h to breach"** (§5). The chain is intact. The event is false. That is the whole threat model in one row.

---

## 5. What breaks first at 50 clinics and 10,000 reports a day

Not the row count. **The two clocks.**

There are two deadlines on the same row and they are not the same number:
- `due_at` — the legacy single deadline from lab release (`031:209-215`: 15 min / 24 h / 48 h), overridable per assignment;
- `obligation_breach(r)` — the stage-aware clock the UI shows (`036`).

The escalation timer runs on the **legacy** one: `apps/api/src/server.ts:117-127` calls `sutra.escalate_overdue_results(null)` every 60 s, and that function filters `status in (...) and due_at < now()` (`031:630-636`). It does not call `obligation_breach`, it does not know the phase, and **it ignores `paused_at`**. `resume_result` shifts the three phase deadlines but never `due_at` (`035:711-715`), so a pause moves the worklist clock and leaves the pager clock behind.

I watched it happen while reviewing. Row *HbA1c 8.7 %* (Ramesh Patil): `dueAt = 2026-11-04T10:21Z`, `breachAt = 2026-11-05T12:52Z` — **26 hours apart** — and at `2026-11-04T12:52:28Z` the audit trail recorded `auto_escalated … escalated to medical superintendent`. The line said 24 hours to breach; the product paged a superintendent. At 10k reports/day that is alarm fatigue with a hash-chained paper trail, and it is the fastest way to lose a quality head's trust.

Three more that break in order:

**B. The last mile has no clock.** `obligation_breach` returns `null` once `communication_state = 'informed'` (`036:9-19`, else-branch). "Patient informed, never closed" is a legal state with no deadline, no escalation and no colour. On the running register the first row is exactly that. At 10k/day this is the queue that grows in silence, and it is the one the surveyor will find.

**C. The register has no ceiling.** `obligation_register` takes a date range and no limit (`035:263-281`), the client defaults to **90 days** (`register.tsx:31`), and the projection adds `obligation_breach(r)` plus two `result_attempts` subqueries per row (`data/obligations.ts:22-28`). At 10k/day a 90-day window is 900k rows of `select r.*` into one JSON response and one DOM table. The first hospital month ends the register.

**D. `clinicIdFor` takes `clinicIds[0]`** (`routes/obligations.ts:31-35`). A doctor who works at two hospitals silently gets one. This breaks at clinic 2, not 50. The line is also per-person (`obligation_line(p_clinic, p_clinician)` filters `owner_id = actor`), so a rounding doctor's backlog is invisible to everyone and a doctor on leave has no handover.

**E. No idempotency on the commands.** `idempotencyKey` exists (`routes/helpers.ts:57-77`) and the obligation routes never use it. A double-tapped "Seen" converges (`035:426-428`); a double-tapped "Record contact" writes two attempts — and two attempts an hour apart across a UTC midnight is exactly what unlocks door one on a flaky ward connection.

What does *not* break: cross-clinic isolation (RLS holds, verified), the audit chain (it is per-result, no global bottleneck, and the anchor makes the read cost independent of chain length), and the domain table (it is the same transitions at 1 or 100,000 rows).

---

## 6. Where is the AI, and is it necessary?

**In the obligation product: nowhere.** No model in the state machine, the clock, the receipt or the register. That is the correct architecture and I would defend it in the room. A closure decision must not be probabilistic.

**In ingestion: yes, at the edge.** `/api/v1/config` on the running site reports `extraction.mode = "live"`, `provider = "openai-compatible"`, `model = "gpt-6-luna"`, `label = "Live extraction model"`. That path turns an uploaded photo or PDF into candidate facts for a human to approve. It earns its cost **only if the wedge is "the lab report arrives as a photo"**. If the lab sends a CSV, the loop needs no model at all.

**The intake matcher is not AI.** It is a deterministic score with reasons and an explicit hold (`intake.tsx:159-160`), and the packet is honest that it is not calibrated and makes no abstention claim. Good. Do not let anyone call it "AI matching" in the pitch; a judge who asks "what's the AUC?" will end the segment badly.

**Is it necessary?** For the claim on the slide — owner, clock, tamper-evident receipt — the AI is **not** necessary, and that is a strength: the demo cannot fail because a model hallucinated. For distribution — the reason a small lab's report is a photo rather than a feed — it is necessary, and it is the only place it should live. The correct sentence in the pitch: *"the model reads the report; it never decides anything."* Today's demo does not even need it, and the demo should not show it unless a judge asks.

---

## 7. What I would cut, and what I would refuse to fake

**Cut before the finale:**
1. **The legacy Ledger, Patients and Review queue from the primary nav.** Two products in one sidebar costs the 40-second differentiator. Move them under one "Legacy ledger" link. The packet already says `/clinic/results` "is not the new product" — then stop showing it as a peer of the new one.
2. **"Ask Gluco" from the judged path.** A chat surface in a clinic workspace invites exactly the clinical question the product must refuse. It is not part of the claim; hide it for the demo.
3. **The replay delta as a headline.** Keep the page and the assumptions list; demote "86.7 % vs 37.7 %" to illustrative. The simulated closed-rate is numerically the reachability parameter (0.867 ≈ 0.86) and the baseline is drawn from `ackProbability` constants (`scripts/replay.ts:79-88`). It is arithmetic on a guess, and the page already says so — let the page say it louder than the number.
4. **The "Assign to me" button for accounts that cannot assign.** It 403s today for `clinician@` (verified). Either build the picker or hide the button; do not ship a control that fails on camera.

**Refuse to fake:**
- **The 300-report number as a measurement.** Keep "synthetic cohort, not a measurement" attached to every appearance of it, or replace it with a real 100–300 consecutive reports and publish the CSV. The instrument (`--input cohort.csv`) is honest; let it be used.
- **A customer, a pilot, or a lab logo.** None exists. The register's credibility comes from the fact that it is not adorned.
- **"Visible to a court."** Say "verifiable by a surveyor or a lab without trusting the clinic's application" — which is what it does. A court needs identity and key custody; that is a real project, not a sentence.
- **The read-back as human verification on the one-tap path.** The button sends `valueEcho: row.valueText` (`line.tsx:79`) — the server's own value. It is a staleness check, not a confirmation. Either make her type the number for criticals, or stop calling it a value echo in the pitch. The DB guard is real; the *human* step is the one being implied.
- **Household identity as solved.** It is a candidate list with a human and a hold. Say that.

---

## 8. The three fixes, in order

**1. Turn the false-closure rule into an interval, and stop `reassign` erasing state.** *(1 migration, 3 tests, ~1 day)*
`close_result_unreachable`: require `max(attempted_at) - min(attempted_at) >= interval '20 hours'` in addition to two attempts, computed from `result_attempts`, not from a date bucket. Mirror it in `attemptDayCount`. Add a DB test that seeds 05:25/05:35 IST and asserts refusal — that test is the proof the headline is now true. In the same migration, restrict `reassign_result` to `review_state = 'pending'` (or carry `review_actor_id` and `acknowledged_at` forward and never reset a breached `review_due_at` to `now()`). This is the fix that makes "never a false closure" a fact rather than a slogan, and it closes the quiet path where an obligation evaporates.

**2. One clock.** *(1 migration, 1 test, ~1 day)*
Make `escalate_overdue_results` call `obligation_breach(r)` instead of `due_at`, and skip `paused_at is not null`. Add the missing fourth deadline: `close_due_at` after `informed` (the register's silent queue). Then a paused row does not page, an informed-but-unclosed row has a deadline, and the number on the screen is the number that escalates. This is the fix that stops the false superintendent page I watched at 12:52 and makes the demo's own promise true on its own data.

**3. Give the register the clock.** *(no backend change, ~half a day)*
Add two columns to the printed artefact: `Due` (from `breach_at`, already on the row) and `Paused`. Add a `within SLA` rollup to the four stat cards. The register is the only screen a buyer keeps, and right now it is the only screen in the product that omits the metric the product exists to move. This is the cheapest point-per-hour in the entire backlog.

Runner-up if there is a fourth day: server-side pagination for the register (fix the 90-day unbounded fetch before the first real month), and idempotency keys on `/attempt` and `/seen`.

---

## 9. Would I use it in my own clinic tomorrow?

No — and not because of the state machine, which I would happily review in a design authority. Because: the pager fires on a clock the screen does not show; the two-attempt rule cannot tell ten minutes from two days; no lab feed exists, so intake is a CSV; and the only account that can complete the loop is the one holding desk, nurse, clinician and quality at once. With fixes 1 and 2, an assignee picker, and a lab feed, I would pilot it in a two-doctor clinic in six weeks — the register alone is worth the pilot, because "Not informed" is a column most systems hide.

---

## 10. Verdict

**A real state machine with a real audit chain, undermined by a closure rule that counts calendar days instead of hours and a second clock that pages people the product says are on time — fix those two before the finale, because this is the rare entry that plays better to an auditor than to a judge, and auditors are the ones who will call.**

---

## Appendix A — commands run

All from `/Users/wysh/coding/thon/iitb-health/app` unless noted.

```
pnpm typecheck            -> exit 0 (tsc node + web, noEmit)
pnpm test                 -> 33 files, 212 passed, 11.41 s, exit 0
pnpm db:test              -> isolation.sql, 12/12 checks passed, exit 0
grep -c "test(" tests/e2e/*.spec.ts   -> obligations 4, results 4, landing 2, session 7 (= 17)
git log/status            -> HEAD f7cc839, 17 modified paths (uncommitted)
curl :8787/health/live    -> {"status":"ok"}
curl :8787/health/ready   -> {"status":"ok","database":"reachable"}
curl :8787/api/v1/config  -> extraction live / openai-compatible / gpt-6-luna; demoLabel "Synthetic demo"
```

Live probes (read-only; each mutation attempt was refused before writing, and the row was re-read to confirm no change):

```
POST /api/v1/auth/local-sign-in   (clinic, reviewer, clinician demo accounts)
GET  /api/v1/me                   -> capabilities: clinic=all; reviewer=canReview only; clinician=canClinician only
GET  /api/v1/obligations?view=line|calls|intake|register
     clinic     line 0, calls 2, intake 3, register 12
     reviewer   line 0, calls 2, intake 3, register 12   <-- read access is membership-scoped, not capability-scoped
     clinician  line 0, calls 2, intake 3, register 12
POST /obligations/:id/assign  as reviewer   -> 403 "desk capability required", custody unchanged
POST /obligations/:id/assign  as clinician  -> 403 "desk capability required"  (the "Assign to me" button 403s)
GET  /api/v1/obligations/:id  as other-clinic -> 404
GET  /api/v1/results/:id      as other-clinic -> 404
GET  /api/v1/results/:id/proof as other-clinic -> 404
GET  /api/v1/results/:id      -> timeline shows auto_escalated at 12:52:28Z for a row with breachAt +24 h
```

Files read in full: `REVIEW-PACKET-R2.md`; `packages/domain/src/obligation.ts`; migrations `035`, `036`, `037`, `026`, `029`, `032` (plus `031` escalation and `021` grants); `apps/api/src/routes/obligations.ts`, `routes/helpers.ts`, `routes/auth-local.ts`, `routes/health.ts`; `packages/data/src/obligations.ts`, `src/pool.ts`; `packages/contracts/src/obligation.ts`; all six files under `apps/client/src/features/clinic/obligations/`; `routes.tsx`; `features/clinic/replay/page.tsx`, `features/showcase/page.tsx`; `scripts/replay.ts`; `tests/integration/obligation-lifecycle.test.ts`; `packages/domain/src/obligation.test.ts`; `supabase/tests/isolation.sql` via `scripts/db-test.ts`. Screenshots `line.png`, `calls.png`, `register.png` inspected at full size.

## Appendix B — what I could not verify

- **The 17-test Playwright claim.** The four named spec files contain exactly 17 tests (4+4+2+7), which is consistent, but the report committed at `HEAD` is an **88-test run from 4 October** and the report in the working tree is a **4-test obligations run from today** (`reports/playwright-report.json`). I did not run Playwright, because the specs sign in and click through the shared demo data and other reviewers were mutating it concurrently. The claim is plausible; the artefact is not in the tree.
- **A real 300-report audit.** No measured cohort exists; the replay is `source: "synthetic"`.
- **Live extraction against the configured provider.** Not exercised; the obligation demo does not use it.
- **Concurrency.** Not load-tested. I read the locks (`for update` on every command) and the transaction-local actor setting; I did not race two commands against one row. The chain's per-result head read in `chain_result_event` is safe only because every command holds the row lock — a future caller that inserts an event without locking can fork the chain into a permanent `valid: false`.
- **The dirty tree.** 17 paths are modified but uncommitted, including `results.ts`, `verify/page.tsx` and `contracts`. The site I reviewed is not exactly `f7cc839`. The obligation files themselves are clean at HEAD.
- **Demo reproducibility.** While I reviewed, another session moved a result from `accepted` to `assigned`+`seen` between two of my calls, and the line was empty by 18:20 IST. The state I describe is a moving target; `/clinic/replay` and `/showcase` were added at 18:17–18:20.

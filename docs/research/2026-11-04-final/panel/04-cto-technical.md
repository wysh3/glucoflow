# CTO / technical head — scorecard

## Stance (one line)

One of these five is a system and four are memos; I would back the system, but it is a 68, not a 90, because the obligation it sells stops one step before the thing it promises.

## Scores

| Thesis | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | TOTAL |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 Closure Ledger | 9 | 9 | 5 | 6 | 9 | 9 | 8 | 5 | 8 | 68 |
| T2 90-Day Recheck | 9 | 7 | 6 | 3 | 4 | 8 | 9 | 4 | 6 | 56 |
| T3 Annual Review Pack | 8 | 7 | 5 | 5 | 3 | 8 | 7 | 5 | 5 | 53 |
| T4 Bag Reconciliation | 6 | 4 | 4 | 2 | 5 | 4 | 6 | 3 | 7 | 41 |
| T5 Identity Firewall | 8 | 8 | 5 | 6 | 8 | 4 | 7 | 4 | 2 | 52 |

No thesis clears 70. T3 and T5 are within noise; T5 loses the tiebreak because its buyer is not in the room.

## Why the winner wins (top 3 reasons, evidence-backed)

**1. The enforcement is in the database, and the API cannot go around it.** The six-state machine is nine `security definer` procedures that each lock the row (`select … for update`) and re-check the precondition before mutating (`app/supabase/migrations/021_result_ledger.sql`, rewritten and extended in `031_result_closure.sql`). The API role holds `select` only on `sutra.results` and `sutra.result_events` — there is no `insert`, `update` or `delete` grant to bypass a transition (`021_result_ledger.sql:87`), and the internal event writer is revoked from `PUBLIC` (`022_result_event_guard.sql`). Two concurrent acknowledgements cannot both win: the second re-reads the committed row after the lock and sees `status <> 'owned'`. That is the correct pattern, not a demo pattern. A blind acknowledgement is refused — wrong value, wrong flag and missing notifier all return `22023` — and I ran that suite myself today: `tests/integration/result-closure.test.ts` 4/4 pass in 84 ms.

**2. The artefact is new; the dashboard is not.** The unit is a receipt with a public code, a QR, a patient slip, a §63(4) Bharatiya Sakshya Adhiniyam draft certificate and a NABH/NABL-shaped register export. Nobody in the competitor scan owns the clinic-side proof that a named clinician saw a specific abnormal result and told a specific patient. That is the only genuine white space in the brief, and the build actually produces the artefact: `certificate.tsx`, `patient-slip.tsx`, `qr.tsx`, `GET /api/v1/public/receipts/:code` with a 30/min limit and no auth, returning stage only.

**3. The honesty discipline is real and it is measured.** `app/reports/acceptance.md` states the unfamiliar-layout extraction result (0.24 complete-field), states that no model has ever been called, and marks R20 "Not met" because the pitch deck does not match the build. `certificate.tsx:141` says the chain "is not externally anchored yet". A team that publishes its own 24% is fundable. That is rarer than the code, and it is the reason I trust the rest of the numbers.

## Fatal flaw of each thesis (one line each)

- **T1 Closure Ledger** — the clock stops at "patient contacted": `next_step_due_at` is never escalated and `close_result` never requires the next step, so "nothing closes without…" is one step short of its own promise (`031_result_closure.sql:569–630`), and a mis-stored `lab_flag` is permanently unfixable because the flag is immutable (`032`) while acknowledgement must echo it (`031`).
- **T2 90-Day Recheck** — the moat is a call list in a market where the call list is free (Yuktii, Clinizy at ₹1,499) and the buyer's KPI is revenue recovery that any CRM can report.
- **T3 Annual Review Pack** — it needs many providers to stamp one pack, which is a coordination problem a five-person team cannot survive before the money runs out.
- **T4 Bag Reconciliation** — extraction is the product, and the product's own eval says 24% complete-field on layouts it has not seen.
- **T5 Identity Firewall** — invisible in seven minutes, sold to an IT buyer who is not on the panel, and its "calibrated abstention" is currently a Jaro-Winkler score with an advisory flag over the first 200 patients by name (`packages/data/src/results.ts:626–683`), not a calibration.

## What would make the winner 95+

1. **Finish the obligation.** Escalate `next_step_due_at` and require either completion or an explicit disposition before `closed`. Two migrations, one test; it converts the claim into the product.
2. **Take the clock away from the client.** `lab_released_at`, `report_received_at` and `attempted_at` are all caller-supplied (`packages/contracts/src/results.ts:338–339`, `:310`) with no skew bound, and `lab_released_at` is then frozen by the immutability trigger. Store claimed and received times separately and compute every KPI on the server time. Right now a clinic can make its median contact time look good by editing one field.
3. **One real buyer artefact.** Twenty receipts from one clinic, a register exported from that clinic, a measured median acknowledgement time. That single slide moves dimension 3 from 5 to 8 and is worth more than any feature.
4. **Anchor the head outside the database.** A daily signed digest mailed to the quality head, or an RFC 3161 timestamp. Then "tamper-evident" means "against your own DBA", which is what the buyer thinks they are buying.
5. **Test the security claims.** Four integration tests for nine procedures. There is no tamper test, no tail-truncation test, no cross-tenant escalation test, no idempotency test, and no concurrency test. The claims are stronger than the evidence.

## The one question I would ask at the finale

"A lab prints potassium 6.1 critical; extraction stores `abnormal`. Your acknowledgement requires echoing the stored flag, and `032` makes the stored flag immutable. Walk me through the clinician's screen — because as written, I think that receipt can never be acknowledged and will escalate every ten minutes forever."

## Verdict (one sentence)

T1 is the only thesis I would fund, and I would fund it as an audit-and-liability product rather than an AI product — but not until the obligation clock covers the next step and the timestamp is no longer authored by the customer.

## Confidence and what I could not verify

- I read `021`–`033`, the route, the data layer, the contracts, both client pages, the demo seed and `app/reports/acceptance.md`; I ran one test file (4/4 pass, 84 ms). I did not run the other ~180 tests, the browser suite or the SQL isolation checks, and I did not call a model.
- `034_result_owner_role.sql` exists but is outside the range I was authorised to read; it may change owner semantics.
- The brief's 4 November counts are not recorded in any report in the repo — the newest report is 4 October and says 157 tests. The static count today is 184, which matches the brief, so the brief is right and `acceptance.md` is stale. The 12 seeded receipts are accurate (`supabase/seed/results-demo.sql`).
- No buyer, pilot, price or willingness-to-pay evidence exists anywhere; every commercial number in my scoring is inference and is scored as such.
- I did not verify RLS on tables outside the ledger, DPDP consent handling, or the Android build.

---

# Technical appendix — the eight questions, answered

## 1. What is genuinely engineered, what is a demo shell

**Engineered.** The state machine and its locking discipline (`021`, `031`); append-only events with no write grant for the API role (`021:87`, `022`); immutable core report fields (`032`); per-receipt SHA-256 chain with an anchored count and head so tail truncation is detectable (`026`, `032`); strict event ordering via `clock_timestamp()` so two events in one transaction cannot verify out of order (`033`); lab-to-clinician value echo and a patient-side outcome model with attempt counting (`031`); an escalation timer that writes an event and an outbox row and explicitly does not claim delivery (`apps/api/src/server.ts:112–124`); a public verifier that returns stage only (`032`); a real per-status action panel in `page.tsx`; honest synthetic labelling at `page.tsx:508`; and an extraction harness with a frozen corpus, an ablation and a provenance manifest.

**Shell.** The demo seed writes receipts *and then inserts `result_events` directly with backdated `created_at`* (`supabase/seed/results-demo.sql:173–231`), bypassing every procedure. The chains therefore validate a fabricated history. That is acceptable for synthetic data and it is labelled, but it is not evidence that the workflow ran. "Ingestion" is a textarea parsed client-side by `line.split(',')` — no quoting, so a comma in a name corrupts the row — posted to a batch endpoint that aborts the whole batch on one duplicate. `source_channel` is a label, not a channel. Identity matching is string similarity over the first 200 patients. There is no AI in the ledger at all. The escalation timer lives in the API process, so it fans out per replica and dies with the API. `POST /api/v1/results` has no `Idempotency-Key` even though `withIdempotency` exists and is used on uploads and patients. Every route pins the caller to `capabilities.clinicIds[0]` (`routes/results.ts:43`), so a clinician in two clinics silently loses the second.

## 2. Is the hash-chained receipt real, and what does it prove

Real cryptography, correctly built, and it proves less than a judge will hear. It proves: these rows were written in this order and have not been altered since, and the stored count and head match the recomputed chain. It does not prove the events happened. **Covers:** accidental corruption; an application bug rewriting the audit table; interior deletion (anchor mismatch); reordering; API-layer forgery (no grants; helper revoked). **Does not cover:** the database owner or service role, who can rewrite the events *and* `chain_event_count`/`chain_head` and recompute a fully valid chain — the anchor is in the same trust domain as the data, so this is an integrity check, not tamper-proofing; `030` removed the delete guard; `result_tombstones` has no delete guard, so the record of a deletion can itself be deleted; the read-back is self-attested by the same actor who benefits; actor identity is whatever the API put in `current_actor_id()`; and a receipt for a visit that never happened will verify perfectly. The team knows this and says so on the certificate. That candour is worth more than the claim would have been.

## 3. Where is the AI, and what happens when extraction is wrong

Three places: a live OpenAI-compatible extraction provider with a page image and a 75-line prompt (`packages/extraction/src/providers/`), a 640-line deterministic rule engine used in the demo, and a GPT-6 Luna app-help assistant. The flagship ledger uses none of it — deliberately, and correctly. The AI is necessary only for T4 and for T1's intake edge, which does not exist yet.

When extraction is wrong today: in the document pipeline, wrong facts land in `draft_facts` with evidence spans, an `identity_hold` or quarantine, and publication is blocked without review — that part is good. In the ledger it dead-ends: a wrong `lab_flag` is immutable and must be echoed to acknowledge, so the clinician can neither correct it nor proceed, and there is no corrected-receipt procedure or linkage to void the original. The safety net that does work is the value echo — a wrong *value* is caught because the clinician cannot type the stored number. A wrong *flag* is not caught; it is frozen.

## 4. Hardest problem in the winning thesis — moat or maintenance

The hardest real problem is making the receipt independently verifiable while disclosing nothing: external anchoring plus minimal disclosure, without shipping patient data to a witness. That is genuinely hard and it is the only part that could become a standard labs accept. The hash plumbing is not hard, and the migration history shows it: nine result migrations between 09:38 and 15:38, including two near-identical `search_path` fixes (`027`, `028`) and a delete-guard reversal (`030` then `032`). The final design is better than the first, but ~250 lines of PL/pgSQL is copyable in a day. **Verdict: currently hard in the way that creates maintenance burden. It becomes a moat only when a lab agrees to verify, not when the chain gets longer.**

## 5. What breaks first at 50 clinics and 10,000 reports a day

1. **Identity matching.** 200 patients ordered by name, scored in JavaScript per request. Any real clinic has more; the rest can never be matched. The unmatched queue becomes the product.
2. **The register export.** `resultExport` selects every result for the clinic with five joins, no date range, no pagination, no streaming. The first NABH export is a timeout.
3. **The dashboard.** `resultStats` runs a `percentile_cont` over the whole clinic plus four list queries per page view, with no covering index for the filters as written.
4. **The escalation timer.** Global `p_clinic = null`, every 60 s, no batch cap, one transaction per tick, and it runs on every replica. `skip locked` protects correctness, not latency.
5. **The list endpoint.** `limit ≤ 100` with no cursor: the 60-second unclosed list silently truncates.
6. **Idempotency.** Retries create duplicate receipts unless the caller supplied `external_ref`; the unique index is the only backstop and it is optional.
7. **A latent one.** `Promise.all` over a single `pg` client already emits the "client is already executing a query" deprecation warning on every request path; it is a `pg@9` landmine, not a bug today.

## 6. What I would cut, what I would refuse to fake

**Cut:** monitoring protocols (guideline clocks are scope creep and the only regulatory surface in the build); next-step completion *unless it is finished this week*; the verifier's progress animation; certificate polish; Android clinic parity; the multilingual fields until a call is actually made. **Refuse to fake:** live lab ingestion (say "structured entry and CSV paste"); message delivery (outbox only — say so); calibrated AI (do not show extraction when no model has been called); external tamper-proofing (say "inside this database"); and any KPI not computed by `result_closure_stats`. **Ship instead:** one clinic, twenty receipts, the morning list, one QR scanned on a judge's phone, one exported register, one wrong-flag case handled honestly.

## 7. Is there a patentable technical core

Not the chain — hash-chained audit logs are prior art (RFC 6962, notarisation, every EHR audit table). Filing it would be a wasted provisional and an obviousness rejection. The fileable core is T5's binding: a two-stage method in which candidate document-to-patient pairs are generated under clinic-scoped identifiers and shared-household-phone collision sets, an abstention threshold is derived from a held-out calibration set, abstained pairs enter a review queue ordered by expected information gain, and only non-abstained bindings may create an obligation. That has a technical effect — error-rate control at a fixed human review budget — which is what §3(k) of the Indian Patents Act requires. I would file that provisional *only if* the calibration data exists; today it does not, so I would defensive-publish and spend the money on the pilot.

## 8. Which I would back, which I would call a wrapper

Back **T1**, with the scope narrowed to the receipt and the register. Call **T4** the wrapper — with the qualification that its code is not a wrapper (real rules engine, real eval harness); its *product* is a model call over a photograph, in a category Eka and HealthPlix already ship, with the team's own eval at 24% complete-field on unfamiliar layouts. T2, T3 and T5 are credible companies on paper and have no build behind them; T5 is the one I would incubate if the identity calibration could be demonstrated, because it is the only thesis with a defensible technical secret.

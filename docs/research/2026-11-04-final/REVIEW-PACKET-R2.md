# Review packet, round 2

**Date.** 4 November 2026. **What is being reviewed.** The working product, not the thesis. The previous panel scored the strategy. This panel scores the deliverable a judge would see at the finale.

**The claim.** Every abnormal lab result becomes an obligation with a named owner, a clock and a tamper-evident receipt. The doctor sees one line and taps once. The nurse records the read-back. The desk resolves identity. The quality head prints the register.

**The rule.** Judge what exists. Separate built, simulated and absent. Do not credit the plan. Do not penalise the absence of a customer the team has not met, but do penalise a false claim about one.

---

## 1. How to see it

- Client: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787` (health at `/health/live`)
- Sign-in: open `/sign-in`, click the **Clinic team** card. It signs in without a password and lands on `/clinic/line`. The account has every clinic role, so the nav shows every home.
- The data is synthetic. The account is `clinic@glucoflow.demo`; the display name is synthetic.

**Screens to open.**

| Route | What it proves |
|---|---|
| `/clinic/line` | One card per pending result, one tap **Seen**, a correction path with a reason, the source drawer |
| `/clinic/calls` | Read-back, teach-back, outcome, next step, **Close as unreachable** after two attempts |
| `/clinic/intake` | Accept custody, candidate matching with evidence, assign to me |
| `/clinic/register` | Date range, Exceptions tab, A4 print, the surveyor's view |
| `/clinic/results` | The older ledger, still shipped. It is not the new product |
| `/verify/<receipt code>` | The public receipt. A code is on a detail drawer's Receipt block |

**Static evidence.** `docs/research/2026-11-04-final/evidence/` holds four screenshots at 1440 by 900 (`line.png`, `calls.png`, `intake.png`, `register.png`).

---

## 2. What is built

**Domain.** `app/packages/domain/src/obligation.ts` is one phase union (received, accepted, assigned, seen, attempted, informed, closed, closed_unreachable), one transition table, guards, the legacy status projection and the clock arithmetic. 20 unit tests.

**Database.** Migrations `035`, `036`, `037` add the phase columns, the role worklists and ten procedures. `036` makes the breach clock follow the active stage. `037` refuses assignment before the patient is matched. The procedures are the only writers; the API role holds select only.

**API.** `app/apps/api/src/routes/obligations.ts` exposes eleven routes under `/api/v1/obligations`, with zod contracts and actor-scoped transactions.

**Client.** `app/apps/client/src/features/clinic/obligations/` holds the four screens and the detail drawer. Capabilities are `canDesk`, `canNurse`, `canClinician`, `canQuality`. The nav and the landing route follow the role.

**Measured evidence.**
- `pnpm test`: 212 passed across 33 files.
- `pnpm db:test`: 12 of 12 isolation and constraint checks.
- `pnpm build`: clean.
- Playwright: 17 passed across obligations, results, landing and session. The obligation file covers the one-tap review, the source drawer, the nurse contact, the register and intake.

**What is not built.**
- No live WhatsApp, portal or lab-feed ingestion. The demo seed and the CSV import are the inputs.
- No household-aware identity model. Intake shows candidates with a score and reasons, and a human decides. It does not claim calibrated abstention.
- No 300-report replay screen yet. The audit instrument and replay are the next unit.
- No ABDM, no Android parity, no server-rendered PDF (the register uses browser print).
- No customer, no pilot, no paid contract.

---

## 3. What to test yourself

1. Sign in. Land on the line. Count the taps to close one result.
2. Open **Source** on a card. Is the timeline and receipt legible? Does it say what the chain proves and what it does not?
3. Go to calls. Record a contact with a read-back. Does the card leave the queue?
4. Go to register. Print preview. Does the table survive A4? Are the exceptions visible?
5. Go to intake. Can you accept custody? Can you assign an unmatched report? (It should refuse.)
6. Sign out and sign in as **Reviewer only**. Does the nav remove the role homes? Does `/clinic/line` still open? It should refuse or redirect.

---

## 4. The gaps that matter

| Gap | Why it matters | What would close it |
|---|---|---|
| Synthetic data only | The numbers are illustrative, not measured | The 300-report audit |
| No replay screen | The panel asked for a measured number. The tool exists in the plan, not in the product | The replay unit |
| Household identity is a candidate list | The hardest technical claim is not built | Calibration on real registrations |
| The old ledger still writes `status` | Two writers during the transition | Migrate the old routes, then add the constraint |
| Browser print, not server PDF | A district hospital may want the file | A worker job |
| No lab countersignature | The network moat is a plan | One lab agreement |

---

## 5. Scoring rubric, current deliverable

Score the product you can touch. 100 points.

| Dimension | Weight | A 9 or 10 looks like | A 1 to 3 looks like |
|---|---|---|---|
| Doctor usability | 20 | One line, one tap, no patient-side fields, the clock does not blame her | A form, a dashboard, or a step that adds minutes |
| Trust and safety | 15 | A visible refusal, a read-back guard, an exception that is not a closure | A claim the code does not support |
| Technical substance | 15 | A state machine in the database, one audit chain, typed boundaries, real tests | A wrapper, a mock, or seeded data presented as ingestion |
| Demo readiness | 15 | Every screen loads on a fresh device, the key moments are clickable, a backup exists | A broken flow, a dead link, a screen that needs setup |
| Differentiation | 15 | Something no competing entry has, visible in 40 seconds | A care-loop dashboard, a records timeline, an ambient scribe |
| Completeness | 10 | The four roles and the register work end to end | Half a flow behind a disabled button |
| Claim honesty | 10 | Synthetic labelled, limits stated, no fake customer | One invented number or logo |

---

## 6. What every judge must answer

1. Score out of 100, with the dimension table.
2. What is the single strongest moment you saw, and where?
3. What is the first thing a judge will break or question, and does it survive?
4. Is this on the right path to win the diabetes track, or is the thesis wrong for this panel?
5. What are the three fixes, in order, that would raise the score most?
6. Would you use it in your own clinic tomorrow? If not, what stops you?
7. Verdict in one sentence.

Write the memo to `docs/research/2026-11-04-final/panel-r2/<your-name>.md` and return a compressed version under 600 words.

---

## 7. What the judges may assume

- The local site is the current build, committed at `f7cc839` on top of `8a6d83a`.
- The synthetic cohort is labelled. The product does not claim real patient data.
- The tests are real and were run this session. The screenshots were taken this session.
- The strategy documents in the same folder are context, not evidence of demand.

# Architecture and journey: the complete product, A to Z

**Status:** design plan. Nothing here is implemented yet. It is written against the actual repository, not a greenfield.

**What it covers:** every screen and state from the moment a report arrives to the moment the clinic closes the day, plus the judge showcase. It also settles the architecture that makes those screens cheap to build: one obligation aggregate, role-scoped commands, derived worklists, and a print-first register.

---

## 0. The one-paragraph design

A lab report becomes an **obligation**. The obligation has three sequential custodians — the desk (custody), the clinician (review), the nurse (communication) — and one terminal state. Each custodian has one screen, one clock and three actions. The obligation is the only write model; the role worklists are queries over it; the register and the receipt are projections of it. The doctor never fills a form; the nurse never opens the doctor's screen; the quality head never touches the workflow. The proof chain is written by the database, not the client.

---

## 1. Grounding: what exists, what it owns, where it breaks

### 1.1 The current system

| Layer | What exists | Where |
|---|---|---|
| Data | `sutra.results` (one row per report), `result_events` (append-only), `result_attempts`, `result_notifications`, `result_tombstones` | `app/supabase/migrations/021`, `031`–`033` |
| State | A single linear status: `unmatched → matched → owned → acknowledged → patient_informed → closed` | `packages/contracts/src/results.ts:19` |
| Enforcement | Nine `security definer` procedures with `select … for update`, no write grant for the API role | `031`, `032`, `034` |
| Proof | Per-receipt SHA-256 chain, anchored count and head, public verify by code | `032`, `033` |
| Rich fields | Lab release, lab hold, read-back, notifier name/role, communication outcome, next step, disposition, `closed_without_informed` | `031` |
| API | 16 routes under `/api/v1/results` | `apps/api/src/routes/results.ts` |
| Client | One page: hero stats, filter, list, drawer, match candidates, CSV import/export | `features/clinic/results/page.tsx` (≈900 lines) |
| Roles | `reviewer` and `clinician` booleans only | `001_identity.sql:64` |
| Escalation | One global timer every 60 s, `escalate_overdue_results(null)` | `apps/api/src/server.ts:116` |
| Demo | Seeded rows plus events inserted directly, bypassing procedures | `supabase/seed/results-demo.sql:173` |

This is a real system, not a mock. The weakness is not the data model; it is the **interaction model**: every action is a 7–15 field drawer gated on `canClinician`, so the doctor is the clerk, the nurse has no screen, and the desk cannot own custody.

### 1.2 The current journey (what a user actually does today)

1. Sign in. The clinic lands on `/clinic/results`. The hero says "The last mile", with six stat tiles.
2. The report is already in the list (seeded or CSV-pasted). There is no intake screen.
3. Open a row → the drawer → **Match this report to a patient** → choose a candidate.
4. **Assign to me** → status `owned`.
5. **Acknowledge with value echo** → type the value, flag, notifier name, notifier role, read-back value → status `acknowledged`.
6. The patient-side panel → channel, outcome, recipient, relation, language, read-back, teach-back, next step, note → **Record attempt**.
7. **Close** → disposition, note.
8. The register is a CSV download. There is no print view, no exception view, no role home.

**The measured cost:** 14–16 interactions and 4 clicks per critical, 2.5–3.5 minutes; ~90 seconds per abnormal; 25–35 minutes a day at ten abnormal reports. The doctor will route around it.

### 1.3 The seven structural gaps

| # | Gap | Consequence | Design answer |
|---|---|---|---|
| G1 | One linear status; one owner role | The doctor does custody, review and communication | Three sub-states, three custodians |
| G2 | `canClinician` gates every action | The nurse and desk cannot act; the audit becomes a shared login | Role capabilities: desk, nurse, clinician, quality |
| G3 | `closed_without_informed` is a boolean | An unreachable patient looks closed | Terminal state `closed_unreachable`, separate exception register |
| G4 | The clock starts at assignment and never pauses | A doctor is marked overdue for a report that arrived in theatre | Server-authored clocks; pause on custody handover and outside availability |
| G5 | The drawer is the only surface | 14 fields per critical; no one-tap | Command endpoints with minimal fields; three role screens |
| G6 | No print view; CSV only | A district hospital cannot file it | Server-rendered A4 register + browser print CSS |
| G7 | Identity matching is Jaro–Winkler over 200 patients, advisory | A wrong-patient closure is possible | Candidate evidence + explicit hold; household-aware scoring as a later module |

Two correctness bugs sit on top: a mis-extracted `lab_flag` is immutable while acknowledgement must echo it (D1), and `lab_released_at` / `report_received_at` / `attempted_at` are client-authored (D3). Both are fixed in this design.

---

## 2. Two designs and the synthesis

### 2.1 Candidate A — one obligation aggregate, role-scoped projections

One table (`sutra.results`), extended with custody/review/communication sub-states. One set of procedures. One command API. Role worklists are queries over the same aggregate. The UI splits into four role routes, but all read the same object.

**Shape**

```
                 ┌──────────────────────────────┐
   ingest ──────▶│        obligation            │
                 │  custody / review / comms    │
                 │  clocks · events · proof     │
                 └──────┬───────┬───────┬───────┘
                        │       │       │
                   line │  calls│ intake│ register
                        ▼       ▼       ▼
                   clinician  nurse   desk/quality
```

**Strengths:** one source of truth; one audit chain; one state machine; consistency is free; a small team can hold it in their head; the proof is trivially continuous.

**Weaknesses:** one wide table; one large route module; the UI can become a god page if the views are not separated; role logic can leak into queries.

**Mitigation:** a pure domain module for transition rules; thin routes; one query function per view; one client feature folder per role.

### 2.2 Candidate B — three bounded queues with separate write models

Three tables/contexts — custody, review, communication — each with its own queue, its own API, and events coordinating the handoff.

```
intake ──▶ custody ──▶ review ──▶ communication ──▶ terminal
  table      table       table          table
```

**Strengths:** each screen has a small model; teams can work in parallel; each context evolves independently.

**Weaknesses (fatal for this team):**
- Three copies of patient/report identity → the same wrong-patient risk multiplied.
- Cross-context consistency needs sagas/compensation; a stuck handoff is a lost result.
- The audit chain must span three stores; "chain intact" becomes a distributed claim.
- The register needs a join across three tables; the print becomes fragile.
- More code, more migrations, more tests, for a five-person team in a three-week window.

### 2.3 Red-flag screen

Per `references/design-red-flags.md`, judged as if the next contributor is an agent that sees only the file it opened:

| Red flag | Candidate A | Candidate B |
|---|---|---|
| Two sources of truth | No | **Yes** — custody/review/communication each hold state |
| Caller must know internal rules | Avoidable with commands | Worse — the caller must know handoff order |
| Repeated special-case branches | Avoidable with one transition table | Likely — each queue re-implements "is this mine?" |
| Types needing escape hatches | No | Likely — partial rows per context |
| Lock reflex | Already correct (`for update`) | Worse — distributed locks |
| Change that looks right in one file is right for the repo | Yes, one aggregate | No — a local change can break a handoff |
| Interface depth | One command surface, many views | Three surfaces, duplicated |

Candidate B is rejected. Its one good idea — role-specific worklists — is kept as projections over A.

### 2.4 The synthesis: one aggregate, four projections, one command bus

```
                    ┌─────────────────────────────────────────┐
   commands ───────▶│  obligation aggregate (sutra.results)   │
   (intent verbs)   │  custody · review · communication       │
                    │  clocks · events · proof                │
                    └───────────────┬─────────────────────────┘
                                    │  read models (SQL views)
              ┌──────────┬──────────┼──────────┬──────────────┐
              ▼          ▼          ▼          ▼              ▼
           line       calls      intake     register      exceptions
         (clinician) (nurse)     (desk)    (quality)      (quality)
```

**The rules that make it hold:**

1. **The procedures are the only writers.** The API role keeps `select` only. No route writes a status directly.
2. **`status` is derived, never authored.** The procedures set the sub-states and compute `status` in the same transaction; a check constraint asserts the derivation. No dual truth.
3. **Every command is an intent, not a field update.** `see`, not `set review_state`. The command owns its validation.
4. **Every view is a query, not a store.** `line`, `calls`, `intake`, `register`, `exceptions` are SQL functions or views over the aggregate.
5. **The proof chain is written by the database.** The client never supplies a hash.
6. **The clock is server-authored.** Client timestamps are stored as claims, never as the KPI source.

---

## 3. The domain model

### 3.1 The obligation

```ts
type Obligation = {
  id: UUID;
  clinicId: UUID;
  receiptCode: string;              // public verification handle

  // source
  patientId: UUID | null;
  patientNameRaw: string;
  patientIdentifierRaw: string | null;
  documentId: UUID | null;
  sourceChannel: 'pdf' | 'paper' | 'whatsapp' | 'portal' | 'email' | 'lab_qr' | 'other';
  labName: string | null;
  labReleasedAt: ISOInstant | null; // claimed
  reportReceivedAt: ISOInstant;     // server-authoritative
  labHold: boolean;

  // the clinical content (copied, never interpreted)
  testName: string;
  valueText: string;
  unit: string | null;
  labFlag: 'critical' | 'abnormal' | 'normal' | 'unknown';
  flagDisputed: boolean;
  clinicianFlag: 'critical' | 'abnormal' | 'normal' | 'unknown' | null;
  disputeReason: string | null;

  // the three custodians
  custody: 'received' | 'accepted' | 'assigned';
  review: 'pending' | 'seen' | 'confirmed';
  communication: 'pending' | 'in_progress' | 'informed' | 'exception';
  terminal: null | 'closed' | 'closed_unreachable' | 'declined' | 'transferred' | 'deceased';

  // actors
  custodyActorId: UUID | null;      // desk or nurse who accepted
  reviewActorId: UUID | null;       // clinician
  communicationActorId: UUID | null;// nurse

  // clocks (server-authored)
  custodyDueAt: ISOInstant | null;
  reviewDueAt: ISOInstant | null;
  communicationDueAt: ISOInstant | null;
  pausedAt: ISOInstant | null;
  pausedSeconds: number;
  pauseReason: string | null;

  // the result of the loop
  informedAt: ISOInstant | null;
  informedChannel: InformedChannel | null;
  readBackConfirmed: boolean;
  teachBackConfirmed: boolean;
  nextStep: NextStep | null;
  nextStepDueAt: ISOInstant | null;
  nextStepCompletedAt: ISOInstant | null;
  disposition: Disposition | null;
  closedAt: ISOInstant | null;

  // derived for compatibility and lists
  status: ResultStatus;
  breachAt: ISOInstant | null;
};
```

The old `ResultDto` remains as a projection of `Obligation` until the client migrates. Nothing is renamed in the database in this phase; a rename is a later, mechanical migration.

### 3.2 States and transitions

```
                 ┌──────────┐
   ingest ──────▶│ received │
                 └────┬─────┘
              accept  │  (desk/nurse)
                 ┌────▼─────┐
                 │ accepted │
                 └────┬─────┘
             assign   │  (desk)
                 ┌────▼─────┐        pause/resume
                 │ assigned │◀───────────────┐
                 └────┬─────┘                │
              see (clinician, one tap)       │
                 ┌────▼─────┐                │
                 │   seen   │                │
                 └────┬─────┘                │
          communicate │  (nurse)             │
                 ┌────▼─────┐                │
                 │ informed │── close ──▶ closed
                 └────┬─────┘
        two failed attempts, different days
                 ┌────▼──────────────┐
                 │ closed_unreachable│──▶ exception register
                 └───────────────────┘
```

**Transition table (the authority):**

| From | Command | Actor | To | Guard |
|---|---|---|---|---|
| received | `acceptCustody` | desk, nurse | accepted | clinic member |
| accepted | `assignClinician` | desk | assigned | target is active clinician; not on leave |
| assigned | `see` | clinician (assigned) | seen | value echo matches, or a dispute reason is given |
| seen | `recordCommunication` | nurse | in_progress | attempt logged |
| in_progress | `recordCommunication` (informed) | nurse | informed | outcome is informed_*; read-back for criticals; teach-back recorded |
| in_progress | `recordAttempt` (unreachable) | nurse | in_progress | attempt count increments |
| in_progress | `closeUnreachable` | nurse, quality | closed_unreachable | ≥2 attempts on different days; disposition set |
| informed | `close` | nurse, quality | closed | next step completed or explicit disposition |
| any open | `pause` / `resume` | current custodian | same | reason required |
| any open | `reassign` | desk | assigned | new clinician active; old clock paused |
| any open | `escalate` | system, quality | same | writes an event, notifies the next role |

**Forbidden by construction:** `see` by a non-clinician; `informed` without an attempt; `closed` without `seen`; `closed_unreachable` without two attempts; a critical `informed` without a read-back.

### 3.3 Invariants (checked in the procedure and in a DB assertion)

```sql
-- Each is a real check, not a comment.
review = 'seen'        => review_actor_id is not null
communication = 'informed' => exists (attempt with outcome like 'informed%')
terminal = 'closed'    => review = 'seen' and communication = 'informed'
terminal = 'closed_unreachable' => count(distinct attempt_day) >= 2
lab_flag = 'critical' and communication = 'informed' => read_back_confirmed
status = derive(custody, review, communication, terminal)  -- check constraint
```

### 3.4 Clocks and availability

| Clock | Starts | SLA critical | SLA abnormal | Owner |
|---|---|---|---|---|
| Custody | report received | 15 min | 4 h | desk |
| Review | custody accepted | 60 min | 24 h | clinician |
| Communication | review seen | 60 min | 24 h | nurse |

**Pause rules.**
- Outside a clinician's declared availability, the review clock does not run.
- On handover (`reassign`, shift change), the open clock pauses; the new custodian resumes it.
- A `labHold` pauses everything until the lab releases.
- `paused_seconds` is added to every open due date on resume. The arithmetic is a pure function and must be unit-tested for idempotency.

**Availability model.** `sutra.availability_windows (clinic_id, user_id, weekday, start_time, end_time)`. For the demo, seed a window per clinician and one night on-call window. If the table is empty, the clock runs 24×7.

**Derived breach.** `breach_at = least(custody_due_at, review_due_at, communication_due_at)` for open obligations; `null` when paused. The line and call lists order by `breach_at`.

### 3.5 Events and proof

Every transition writes `sutra.result_events` with:

```ts
{
  resultId, clinicId, actorId, actorRole,      // new
  eventType, fromStatus, toStatus,
  note, detail,
  sourceSpanHash: string | null,               // new
  prevHash, hash,                              // existing chain
  createdAt: server clock
}
```

The chain remains `h_j = SHA-256(h_{j-1} ‖ canonical(p_j))`. The API role has `select` only; the event writer is revoked from `PUBLIC`. The daily head is anchored outside the database (a signed digest to the quality head, or an RFC 3161 timestamp) — the certificate must state which.

**The public verifier returns:** `receiptCode`, `stage` (`received | seen | informed | not_informed | closed`), `roles`, `times`, `chainValid`, `anchoredAt`. Never the patient name, the analyte or the value.

---

## 4. The API surface

### 4.1 Commands

All commands are `POST` on the obligation. The body is the minimum needed for the intent; optional detail is a second step.

| Method | Path | Role | Body | Result |
|---|---|---|---|---|
| POST | `/api/v1/results` | desk | source fields + test + value + flag | `{ id, receiptCode }` |
| POST | `/api/v1/results/import` | desk | `{ items[] }` | `{ created[], count, skipped[] }` |
| POST | `/api/v1/results/:id/accept-custody` | desk, nurse | `{}` | obligation |
| POST | `/api/v1/results/:id/assign` | desk | `{ clinicianId, dueAt? }` | obligation |
| POST | `/api/v1/results/:id/see` | clinician | `{ valueConfirmed: boolean, correctedValue?, flagDisputed?, reason? }` | obligation |
| POST | `/api/v1/results/:id/lab-call` | desk, nurse | `{ notifierName, notifierRole, readBackValue }` | obligation |
| POST | `/api/v1/results/:id/communicate` | nurse | `{ channel, outcome, recipient?, relation?, language?, readBack?, teachBack?, nextStep?, nextStepDueAt? }` | obligation |
| POST | `/api/v1/results/:id/attempt` | nurse | `{ channel, outcome, note? }` | obligation |
| POST | `/api/v1/results/:id/close` | nurse, quality | `{ disposition, note }` | obligation |
| POST | `/api/v1/results/:id/close-unreachable` | nurse, quality | `{ disposition, note }` | obligation |
| POST | `/api/v1/results/:id/next-step` | desk | `{ completedAt?, note }` | obligation |
| POST | `/api/v1/results/:id/pause` | custodian | `{ reason }` | obligation |
| POST | `/api/v1/results/:id/resume` | custodian | `{}` | obligation |
| POST | `/api/v1/results/:id/escalate` | quality, system | `{ reason }` | obligation |
| POST | `/api/v1/results/:id/match` | desk | `{ patientId }` | obligation |
| POST | `/api/v1/results/:id/new-patient` | desk | `{ displayName, identifier? }` | obligation |

### 4.2 Queries

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/v1/results?view=line` | clinician | My open reviews, ordered by `breach_at` |
| GET | `/api/v1/results?view=calls` | nurse | Communication queue, ordered by `breach_at` |
| GET | `/api/v1/results?view=intake` | desk | Unmatched / received / accepted |
| GET | `/api/v1/results?view=register&from=&to=` | quality | Full register, paginated |
| GET | `/api/v1/results?view=exceptions` | quality | `closed_unreachable`, `declined`, `transferred`, `deceased` |
| GET | `/api/v1/results?view=next-steps` | desk | Open `next_step_due_at` |
| GET | `/api/v1/results/:id` | clinic | Full aggregate, events, attempts, proof |
| GET | `/api/v1/results/:id/candidates` | desk | Candidate patients with evidence |
| GET | `/api/v1/results/:id/proof` | clinic | Chain head, count, anchored status |
| GET | `/api/v1/results/stats?from=&to=` | clinic | The KPI set |
| GET | `/api/v1/results/export?from=&to=` | quality | CSV, streamed, bounded |
| GET | `/api/v1/results/register.pdf?from=&to=` | quality | Server-rendered A4 |
| GET | `/api/v1/public/receipts/:code` | public | Stage, roles, times, chain validity |
| GET | `/api/v1/scheduler/next?capacity=` | nurse | The next N calls with the reason |

**Route discipline.** One query function per `view` in `packages/data`; one handler per `view` in the route module; no ad-hoc SQL in the route. Pagination is cursor-based for the register, bounded for the export.

### 4.3 Errors and idempotency

- All commands accept `Idempotency-Key`; a repeated key returns the same result.
- A guard failure returns `409` with a typed code: `wrong_role`, `wrong_state`, `value_mismatch`, `readback_required`, `attempts_insufficient`, `clock_paused`, `not_assigned`.
- The client never infers the code; it renders the message and the next action.

---

## 5. The screens, A to Z

### 5.1 Entry: sign-in and role home

**Who:** any clinic member.
**Route:** `/sign-in` → role home by capability.

| Capability | Home | First thing on screen |
|---|---|---|
| `desk` | `/clinic/intake` | "3 reports arrived. 1 needs an identity check." |
| `nurse` | `/clinic/calls` | "2 criticals need a call. Potassium, 08:47, 22 min left." |
| `clinician` | `/clinic/line` | "1 thing before patient one: K 6.2, 22 min to breach." |
| `quality` | `/clinic/register` | "Open 12 · Overdue 2 · Exceptions 3." |

**Rules:** one home per role; the nav shows only that role's screens plus the register if the role has `quality`; a user with several roles sees a role switcher, not a merged screen.

**Exit:** the role home is the day's landing; the user returns there after every action.

### 5.2 Desk: intake

**Purpose:** turn an arriving report into an obligation with a patient.

**Layout:** a queue on the left, a capture panel on the right.
- Sources: **Scan lab QR**, **Upload PDF/photo**, **WhatsApp forward**, **Paste CSV**.
- For each item: lab, test, value, flag (read-only, from the lab), received time, candidate patient, confidence, [Match] [New patient] [Hold].
- The queue header: "5 waiting · oldest 06:40 · 1 critical unassigned".

**Actions:**
1. **Scan/upload** → extract (or manual) → draft obligation.
2. **Match** → candidates with evidence (name, year, phone, last visit) → choose.
3. **Hold** → identity review queue.
4. **Accept custody** → the custody clock starts.
5. **Assign** → a clinician from the rota; the review clock starts.

**States:** empty ("No reports yet. Scan a lab code or upload a PDF."), loading, error ("The report could not be read. Enter the value manually or hold it."), success.

**Edge cases:** duplicate external ref (idempotent, show the existing receipt); multi-patient sheet (split rows); lab hold (no clock); unknown flag (route to clinician review as `unknown`).

**Test:** a QR scan creates an obligation with the lab's flag; a CSV import is idempotent; a hold cannot be assigned.

### 5.3 Desk: identity hold

**Purpose:** decide whether a report belongs to this patient, with evidence.

**Layout:** the raw name and identifier, the candidate list with a match score and the *reasons*, and one primary action.

```
Report says: Sunita Sharma, 58, phone …4421
Candidates
  Sunita Sharma, 58, phone …4421   shared with 3 patients   [evidence]
  Sunita Sharma, 61, phone …4421   shared with 3 patients   [evidence]
  Sunita Sharma, 47, phone …8890                             [evidence]
Confidence 0.61 — below the safe threshold.
[ This one ]  [ The other ]  [ New patient ]  [ Hold for the doctor ]
```

**Rule:** a shared phone discounts the phone evidence; the score is shown as a band, not a false precision. The desk may not auto-match below the threshold. Every hold is logged with the actor and the reason.

**Test:** the two-Sunita case holds; choosing one writes `matched` and records the evidence; no match is possible without an explicit decision.

### 5.4 Clinician: the line

**Purpose:** the doctor's entire morning surface.

**Layout:** one card per obligation, max five visible, ordered by `breach_at`. Each card:

```
K 6.2   critical   flagged 08:47   22 min to breach
Sunita Sharma, 58   Dr Mehta's patient
[ Seen ]   [ Correct value ]   [ Ask nurse to call ]   [ Source ]
```

**Actions:**
- **Seen** — one tap. If the value is critical, the nurse queue is prompted. Writes `review=seen`.
- **Correct value** — two fields (value, reason). The lab flag stays as evidence; the clinician flag is recorded.
- **Ask nurse to call** — creates the communication task without the doctor leaving the line.
- **Source** — opens the span.

**States:** empty ("Nothing needs you before patient one."), critical banner, paused clock ("Paused: in theatre — resumes 14:00"), locked ("Another clinician owns this.").

**Rules:** the clinician cannot see the patient-side fields; cannot close; cannot assign. The line never shows a stat tile.

**Test:** a critical is seen in ≤3 taps and ≤30 seconds; the value echo mismatch opens the correction sheet; the clock pause is visible.

### 5.5 Clinician: the source

**Purpose:** prove the value.

**Layout:** the document page, the highlighted span, the extracted value and unit, the lab's flag, and [Correct] [Next].

**Rule:** every accepted obligation has a span. If the span is missing, the obligation cannot be auto-created; it is a draft.

**Test:** opening a row shows the exact page and span; a missing span blocks the create.

### 5.6 Nurse: the calls

**Purpose:** the calls that were already happening, now recorded.

**Layout:** a ranked list on the left, the call card on the right.

```
Sunita Sharma · 58 · Marathi · …4421
K 6.2, flagged 08:47. Read the value back.
Script: "This is [Clinic]. Dr Mehta has seen your report. The potassium is 6.2.
         Do you understand? Can you come at 11?"
[ Read back: ______ ]  [ Teach-back: yes/no ]
Outcome: [ Informed ] [ No answer ] [ Wrong number ] [ Declined ] [ Deceased ] [ Transferred ]
Next step: [ Book ] [ Repeat test ] [ Specialist ] [ Collect report ] [ Urgent ] [ None ]
```

**Actions:** one tap per outcome; the read-back is one input; the next step is one select; [Record] writes the attempt.

**Rules:** no clinical advice; no interpretation; the script is clinic-approved; the language is the patient's; a red-flag phrase creates a callback task for a human.

**States:** empty, all called, retry scheduled ("Next attempt 14:00"), exception ("Two attempts. Close as unreachable?").

**Test:** an informed call writes the attempt, the read-back and the next step; an unreachable call increments the attempt; after two attempts the exception is offered.

### 5.7 Nurse/desk: the exception

**Purpose:** the honest close.

**Layout:** attempts timeline, the disposition, the owner, and [Close as unreachable] [Escalate to quality].

**Rule:** `closed_unreachable` requires two attempts on different days; the receipt says "not informed"; the register puts it in the exception section; the quality head sees it.

**Test:** one attempt cannot close; two attempts close as an exception; the verifier returns `not_informed`.

### 5.8 Desk: next steps

**Purpose:** the test that was booked but not done; the report not collected.

**Layout:** a due list by `next_step_due_at`, with the patient, the step, the owner and [Done] [Reschedule] [Escalate].

**Test:** a completed next step removes the row; an overdue next step escalates.

### 5.9 Quality: the register

**Purpose:** the survey file, the legal file, the print.

**Layout:** filters (date, flag, state, role), a summary strip (open, overdue, informed, exceptions), the table, and [Print] [Export CSV] [Survey pack].

**Columns:** receipt, received, patient, test, value, flag, clinician, seen at, informed by, informed at, read-back, next step, status.

**Rule:** the exception section is a separate tab with the same columns; the register never hides an unreachable patient.

**Test:** the register prints with every field; the exception tab lists the unreachable; the CSV matches the print.

### 5.10 Quality: print

**Purpose:** the A4 page a district hospital files.

**Layout:** clinic header, month, the register table, the exception table, the signature block, the chain head and the date.

**Rule:** print CSS works when the network is down after load; the server PDF is the durable copy; the page number is "Page X of Y".

**Test:** print preview contains every column; the exception table appears; the chain head matches the proof.

### 5.11 Public: verify and patient slip

**Purpose:** the receipt a judge, a lab or a patient can check.

**Layout:** one line: "Receipt valid · Seen 09:26 · Informed 09:31 · Not a clinical opinion." No name, no value.

**Patient slip:** the clinic name, the date, "Your result was seen by Dr Mehta at 09:26 and you were informed at 09:31", the QR, and the clinic phone.

**Test:** a valid code returns the stage and times; an invalid code returns 404; the response contains no clinical value.

### 5.12 End of day: handover

**Purpose:** the night and the next morning.

**Layout:** a handover card: open criticals, unowned after hours, next steps due tomorrow, exceptions created today, and the on-call clinician.

**Rule:** the night path routes custody to the on-call role, not the ordering doctor; the 08:00 line shows the overnight bucket.

**Test:** an after-hours critical is assigned to the on-call clinician; the 08:00 line shows it with the pause reason.

### 5.13 The edge cases (designed, not discovered)

| Case | Behaviour |
|---|---|
| Duplicate report | `external_ref` unique; the second import returns the existing receipt |
| Multi-patient photographed sheet | The desk splits rows; each row is its own obligation |
| Namesake + shared phone | Hold; the score is a band; a human decides |
| Amended report | A new version supersedes; the old obligation is linked, not deleted |
| Lab hold / recollect | No clock until the lab releases |
| Doctor on leave | Reassign; the old clock pauses |
| Critical after hours | On-call routing; unowned bucket at 08:00 |
| Patient deceased / transferred | Exception; the receipt says so |
| Wrong value | Correct value; the lab flag remains as evidence |
| Wrong flag | Flag dispute; both flags on the record |
| Consent revoked | Messaging stops; the record remains |
| Language mismatch | The nurse records the language and uses the script |
| Report arrives after the visit | Still an obligation; the line shows it |

---

## 6. Module boundaries

| Module | Owns | Must not |
|---|---|---|
| `packages/contracts/obligation.ts` | Types, enums, zod schemas, labels | Import the DB or the UI |
| `packages/domain/obligation.ts` | Pure transition rules, clock arithmetic, derivations | Touch the DB or React |
| `packages/data/obligations.ts` | Queries and command wrappers | Contain business rules |
| `packages/scheduler/` | Ordering (v1 EDF, later index) | Know about React |
| `packages/identity/` | Candidates, household discount, abstention band | Write to the DB |
| `packages/proof/` | Chain verification display, receipt formatting | Sign anything |
| `apps/api/routes/obligations.ts` | HTTP, auth, idempotency, error mapping | Contain SQL |
| `apps/client/features/clinic/line` | The clinician surface | Know the nurse's fields |
| `apps/client/features/clinic/calls` | The nurse surface | Know the clinician's fields |
| `apps/client/features/clinic/intake` | The desk surface | Assign without a clinician |
| `apps/client/features/clinic/register` | The quality surface | Mutate an obligation |
| `apps/client/features/verify` | The public receipt | Reveal a value |

**The dependency rule:** contracts ← domain ← data ← api ← client. Nothing points back. The domain module is pure and is the only place the transition table lives in TypeScript; the PL/pgSQL procedures are the authority and are tested against the same table.

---

## 7. The judge showcase

**Principle:** the showcase is the product, not a demo mode. A `?showcase=1` overlay walks the judge through the same routes and the same data. It can be reset; it never fakes a backend.

**Setup:** a `showcase` clinic with four staged obligations:
1. A critical potassium, received 08:47, unassigned.
2. Two same-name patients with a shared phone, unmatched.
3. A normal HbA1c, closed and informed, with a valid receipt.
4. An unreachable patient with one attempt (to be closed as an exception on stage).

**The eight steps (4 minutes):**

| # | Screen | The judge sees | The sentence |
|---|---|---|---|
| 1 | Intake | Scan the lab QR | "The lab prints a code; the clinic scans it. The flag is the lab's." |
| 2 | Line | The critical, 22 min to breach | "This is the doctor's whole surface." |
| 3 | Line | One tap **Seen** | "One tap. She is back with the patient." |
| 4 | Calls | Read-back, **Informed** | "The nurse makes the call that was already happening." |
| 5 | Verify | The judge scans the QR | "Valid. Seen 09:26. Informed 09:31. No clinical value." |
| 6 | Intake hold | Two Sunitas, refusal | "A phone is not an identity. It refuses." |
| 7 | Exception | Two attempts, **Close unreachable** | "It does not pretend. Not informed, with an owner." |
| 8 | Register | Print, hand it over | "This is what the surveyor files." |

**Fallbacks:** a seeded reset button; a backup video; a printed register; the verifier needs no auth.

**What the showcase does not do:** no fake customer, no fake metric, no fake ingestion. If the data is synthetic, the overlay says so on step 1.

---

## 8. Build sequence and acceptance tests

### Milestone 1 — Roles, states, commands (backend)

**Files:** `034_closure_roles.sql`, `035_flag_dispute.sql`, `036_server_clock.sql`, `037_availability.sql`; `packages/contracts/obligation.ts`; `packages/domain/obligation.ts`; `packages/data/obligations.ts`; `apps/api/routes/obligations.ts`.

**Acceptance:**
- A critical can be created, accepted, assigned, seen, informed and closed through commands alone.
- A non-clinician cannot `see`; a clinician cannot `acceptCustody` for another clinic.
- A disputed flag closes; both flags are on the record.
- A forged client timestamp does not change `breach_at`.
- A critical cannot be informed without a read-back.
- One attempt cannot close as unreachable; two on different days can.
- `status` always equals the derivation.

### Milestone 2 — The three role surfaces

**Files:** `features/clinic/line`, `features/clinic/calls`, `features/clinic/intake`; nav by capability.

**Acceptance:**
- The clinician sees the line, taps once, and never sees a patient-side field.
- The nurse sees the call sheet, records a read-back, and never sees the clinician's correction sheet.
- The desk sees intake, matches, accepts custody, assigns.
- The nav shows one home per role.

### Milestone 3 — Register, print, exceptions, detail

**Files:** `features/clinic/register`, `register.pdf` route, print CSS, `features/clinic/detail`.

**Acceptance:**
- The register prints every column.
- The exception tab lists the unreachable.
- The CSV matches the print.
- The detail timeline shows actor, role and time.

### Milestone 4 — Identity hold, source, scheduler

**Files:** `features/clinic/intake/hold`, `features/clinic/source`, `packages/identity`, `packages/scheduler`.

**Acceptance:**
- The two-Sunita case holds.
- Every accepted obligation opens its span.
- The calls list is ordered by `breach_at`, and the order is explained in the UI.

### Milestone 5 — Showcase and replay

**Files:** `features/showcase`, `features/clinic/replay`, the replay script.

**Acceptance:**
- The eight steps run end to end on a fresh device.
- The replay produces three numbers in under 60 seconds.
- A reset returns the showcase to step 1.

### Milestone 6 — Pilot hardening (after the finale)

On-prem compose, WhatsApp webhook, lab QR, TSA anchor, availability windows, load test at 10k/day.

---

## 9. What we cut

- Recheck and referral obligations: the same aggregate, a later milestone.
- ABDM/ABHA: out.
- Android parity: out of the finale.
- The 3D body map: out.
- A new extraction model: out; the deterministic parser plus manual entry is enough.
- A lab dashboard: out; the lab gets a receipt, not a product.
- Patient login: out; the patient gets a QR and a slip.

---

## 10. The one-paragraph summary

The product is one obligation, three custodians, three clocks and one receipt. The database is the only writer, the procedures are the only state machine, and the four role screens are projections of the same aggregate. The doctor taps once, the nurse records the read-back, the desk resolves identity, the quality head prints. The judge sees the refusal, the tap, the print and the number — in that order. Everything else is a later milestone.

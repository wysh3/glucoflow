# Panel R2 — clinician review

**Reviewer.** Dr Meera Iyer, consultant endocrinologist, 120-bed private hospital, Mumbai. 35–45 OPD patients a day. Paper notes, reports on WhatsApp, previously burnt by a critical potassium that reached the front desk.
**Date.** 4 November 2026, 18:16–18:30 IST.
**Method.** Live product at `http://127.0.0.1:5173`, Chrome via Playwright, 1440×900. Signed in through the **Clinic team** card. Every screen below was opened and clicked; nothing in the repository was modified. Demo state was exercised (one intake item accepted, assigned and marked seen) and one further reseed by another reviewer occurred mid-session — see *Caveats*.

---

## 1. Score

| Dimension | Weight | Score | Why |
|---|---|---|---|
| Doctor usability | 20 | **15** | One card per result, one visible **Seen**, no patient-side fields, and the copy is civil ("The clock does not run while you are in theatre"). But the line is **empty on a fresh seed**, the tap is **silent**, and the doctor must come to a browser she was not sent a link to. |
| Trust and safety | 15 | **12** | Visible refusal for the wrong role; critical read-back guard genuinely disables the button; "Close as unreachable" only after two attempts; unmatched assignment is refused; the chain states what it proves and what it does not. Deductions: call outcome defaults to "Patient reached"; no confirmation after Seen; drawer "Source" is a timeline, not the report. |
| Technical substance | 15 | **11** | Real phase transitions I could watch (received → custody accepted → assigned → seen), one audit chain with a head hash, a public receipt page that refuses a bad code, procedures-only writes per the packet. I did not run the 212 tests; I take that as claimed. |
| Demo readiness | 15 | **9** | Every route loads, `/showcase` is an honest 8-step path, all its links resolve. But the hero screen is empty on arrival, the A4 print is broken, and demo state is shared and not resettable from the UI. |
| Differentiation | 15 | **11** | The public receipt, the tamper-evident chain and an exception register that prints a critical as "Not informed" are not a care-loop dashboard. Visible in 40 seconds once the line has a card. |
| Completeness | 10 | **7** | Four roles and the register work end to end; the wrong-role refusal is real. But no lab role, and the register does not survive its own print button. |
| Claim honesty | 10 | **9** | Synthetic labelled on every screen; replay says "not a controlled trial", "the baseline is an assumption"; receipt disclaims diagnosis. Minor: register tiles do not reconcile (11 open + 5 informed + 1 unreachable against 15 rows), and the replay card renders "Baseline baseline". |
| **Total** | **100** | **74** | A credible audit instrument with a product-shaped hole where the doctor's first minute should be. |

---

## 2. What I actually clicked

1. `/sign-in` → **Clinic team** card (`demo-card-clinic`). No password. Landed `/clinic/line` in 893 ms. **Tap 1.**
2. `/clinic/line` — empty: *"Nothing needs you before patient one. Every result in your name has been seen."* No card, no clock, nothing to tap.
3. `/clinic/intake` — three cards: ALT 68 (custody accepted), Sodium 128 **critical** (custody received, unmatched), eGFR 48 (custody received). Clicked **Accept custody** on ALT → clicked **Assign to me**. **Taps 2–3.** Card left intake.
4. `/clinic/line` — ALT card present: *"ALT 68 U/L · flagged 08:27 AM · 24 h to breach · Sanjay Gupta · P0594 · Metropolis Healthcare · Abnormal, lab flagged"*, with **Seen / Correct value / Source**. Clicked **Source** → right drawer. **Tap 4.** Read: received / owner / custody / review / communication / attempts / informed / closed; a timeline of three events; then **"Chain intact · 3 events · head 06b5c9b70f84e780 · Receipt code GLF-229B363022"** and the sentence *"The chain proves the events were written in this order and have not changed since. It is not an opinion about the result."* Clicked **Close**. **Tap 5.**
5. Clicked **Seen**. **Tap 6.** The card vanished instantly. No toast, no receipt code, no "recorded". The page returned to *"Nothing needs you before patient one."* The success string `Review recorded.` lives inside the card that the list refetch unmounts, so it is never seen.
6. `/clinic/intake` → **Match patient** on the Sodium → five candidates with percentages and reasons: Imran Shaikh **100% "Clinic ID matches exactly, Name similarity 100%"**, then Ramesh Patil 20%, Arjun Nair 19%, Asha Rao 18%, Fatima Khan 17%, each marked *"held for a human"* but each carrying an identical **Use this patient** button. Clicked the 100% one. Custody stayed `received`; ownership was set; no Assign button appeared.
7. `/clinic/calls` — two cards. On the **critical potassium** card, **Record contact** was disabled and the page said *"A critical result cannot be recorded as informed without the read-back."* On the abnormal cards the button was enabled with defaults **Channel = Call, Outcome = Patient reached**.
8. `/clinic/register` — **Register** tab (15 rows), **Exceptions** tab (exactly one row: Meena Kulkarni, potassium 6.2, critical, *"Not informed"*). Clicked **Print A4 register** → A4 PDF (2 pages, 595.9 × 842.9 pt).
9. Opened `/verify/GLF-B046A26336` in a **fresh context with no session** → public page: *"A receipt code shows the recorded administrative stage and whether the clinic's event chain is intact. It does not show a patient name, test value, diagnosis or clinical decision."* Stage 1, **Chain intact**, plus *"It does not prove that a diagnosis or treatment was correct."* Then `/verify/GLF-DOESNOTEXIST` → **"No receipt found."**
10. Signed in as **Reviewer** only in a fresh context → landed `/clinic/results`; nav showed only Replay, Ledger, Patients, Review queue, Account. Opened `/clinic/line` → **"This screen belongs to another role. Your account does not hold the clinician capability in this clinic."**
11. `/showcase` — eight steps, all "Open …" links resolve. `/clinic/replay` — 86.7% vs 37.7% closed within SLA, 10 min vs 68 min median handoff, "+49.0 points", with *"Synthetic cohort, not a measurement"*, the four assumptions, and *"Replace it with 100 to 300 consecutive reports from one clinic before quoting any number."*

**Tap count to close one result.** Doctor's own action: **1 tap, about four seconds**. From a cold demo: **4 taps across two roles** (accept custody, assign, then Seen) after the sign-in tap. With the source drawer: **+2 taps** (open, close).

---

## 3. The eight answers

### 1. Would I use this tomorrow? Which screen, and what would I actually do on it?

Yes — but only the **line**, and only once someone else has filled it.

At 9 a.m. and again after lunch I would open `/clinic/line`, read down the cards, and tap **Seen**. That is the entire doctor job, and it is correctly sized: value, unit, flag, time flagged, time to breach, patient, lab, one button. I would use **Correct value** when a lab flag is wrong — one click, the printed value, and a mandatory reason of at least three characters, which is exactly the argument I want recorded. I would open **Source** when a number surprises me.

I would **not** use intake or calls. Those belong to the desk and the nurse, and the product agrees — the reviewer account is refused at my line. If I am asked to do intake as well, this stops being my product.

The condition: it has to reach me without me remembering it exists. Today I would have to keep a tab open. My reports arrive on WhatsApp because that is where I already am.

### 2. Where does it still add work to my day? Name the clicks and minutes.

- **Discovery — the real cost, ~1–2 minutes a day and one habit.** Nothing pushes. No WhatsApp, no SMS, no EMR banner. I must open a browser and sign in. The day I forget is the day the register records a breach against my name. The product has moved the miss from the front desk to my memory.
- **An empty line on arrival — 2 clicks that are not mine.** On a fresh seed there is no card. Someone must **Accept custody** (1 click) and **Assign to me** (1 click) before my one tap exists. In the live demo a critical sodium 128 sat in intake, unmatched and unassigned, while my line said "Nothing needs you before patient one." That is 2 clicks of desk work standing between me and my only reason to open the product.
- **A silent tap — 2 extra clicks and ~30 seconds of doubt, every time.** After **Seen** the card disappears with no confirmation and no receipt code. To know it registered I reopen Register or the patient. For someone burnt by a lost result, silence is the worst possible feedback.
- **The receipt code — 1 copy by hand.** The drawer prints `GLF-229B363022` as text, not a link. If I want to hand a patient the public receipt I copy it manually.
- **The register — ~10 minutes once, and an unusable sheet today.** The A4 print clips the last three columns (**SEEN, INFORMED, STATUS**) off the right edge and prints the app chrome and the bottom tab bar onto the surveyor's page. A register that loses its status column is not a register.
- **The correction path — 4 interactions.** Correct value, type the printed value, type a reason, Record correction. That is fair, not excessive.

### 3. Do you trust it? What would you need to see to trust it more?

I trust the **chain** and I trust the **refusals**. The drawer says "Chain intact · 3 events · head 06b5c9b7…" and then, unprompted, *"It is not an opinion about the result."* That is the sentence that earns trust, because it declines the easy claim. The wrong-role refusal is real, not a hidden button. The critical read-back guard is real, not a tooltip. The register shows a critical potassium as **"Not informed"** instead of closing it. Those four things are more than my current paper process can prove.

What I would need to see:

1. **The original report, in the drawer.** "Source" currently means a JSON timeline. When I doubt a value I need the lab's PDF or the WhatsApp image next to the typed value, with the lab flag as printed. Right now the strongest evidence I can show a colleague is a hash.
2. **A confirmation after my tap**, with the time and the receipt code, that survives on screen.
3. **Proof the nurse cannot close by accident.** The default outcome is already "Patient reached"; a distracted nurse can record "informed" in one tap with no read-back on an abnormal result. The guard only covers criticals.
4. **A lab countersignature** — the lab name is text I could have typed. There is no field where the lab attests it released this value.
5. **Reconciliation on the register.** "11 open, 5 informed, 1 unreachable" over 15 rows does not add up, and a surveyor will ask.

### 4. Does it make you more or less exposed if a result is missed? Why?

**Less exposed — for one specific failure.** A miss becomes a **documented exception with a name and a clock**: the register prints Meena Kulkarni's potassium 6.2 as "Not informed", the Exceptions tab isolates it, and the public receipt shows a stage. Today that result would be a WhatsApp thread I cannot produce in an inquiry. That is the first time a vendor has shown me the miss instead of the dashboard.

**But more exposed in a narrower, nastier way.** If the desk never accepts custody, the result is nobody's: `ownerId` null, status "In intake", my name nowhere on it, and no clock pointed at me. The system's promise — "every abnormal result becomes an obligation with a named owner" — is only true *after* two desk clicks I do not control. I watched a critical sodium sit there while my line said nothing needed me. That is the same failure as the front-desk potassium, wearing a green badge and a chain hash.

The second exposure is the silent tap. The server may have recorded my value echo, but I cannot see it, and the patient receipt for the record I had just handled still read "Clinician value echo: not done". If the chain is my defence, I need to see it move when I move.

### 5. What would your patients think of the call and the receipt?

**The call** is the best copy in the product. *"Read the value back. Ask the patient to say what they understood. Record what happened, not what should have happened."* A patient hears a person confirm a number and then ask them to repeat it — that is respect, and it is rare. Two caveats. First, the default "Patient reached" means one distracted tap can record an informed contact that never happened; if a patient ever learns that, the whole register is worth nothing. Second, there is no script for the patient's side — no sentence for what a critical potassium means, only a next-step dropdown. Good nurses will fill that gap; the product does not help the mediocre ones.

**The receipt** is genuinely good and would reassure a patient: it shows a stage and a chain, hides the name, the value and the diagnosis, and says *"It does not prove that a diagnosis or treatment was correct."* Most hospitals would have printed the value and called it transparency. A patient will not understand "chain", but they will understand "the clinic recorded this and cannot quietly change it." One confusion: a receipt can say "Clinician value echo: not done" for a result I have already acted on in another row of the register, which makes the clinic look slower than it is.

### 6. Would you pay from your own pocket? If the hospital paid, would you still use it?

**My own pocket: no, not at a software price.** The tap saves me nothing I can bill for; the value lands on the quality head, the lab and the insurer. At ₹200–300 a month I might carry it as a personal safety net, the way I carry an indemnity policy. At what a vendor will ask, no — and I would resent being sold the miss I am already afraid of.

**If the hospital paid: yes, I would use the line** — it is less work than scrolling WhatsApp, and the exception register is the first thing I could hand a surveyor without reconstructing a week. But on two conditions: the desk owns intake and the nurse owns calls, and the tap confirms itself. If either slips, this becomes a fourth inbox and I will quietly stop opening it, which is worse than paper because the register will look like I was told.

### 7. The three fixes, in order

1. **Make the line non-empty on arrival, and make the tap answer back.** Seed three pending results on the clinician's line — one critical inside the hour, two abnormal — and after **Seen** show a persistent strip: *"Seen by Dr Meera Nair · 06:24 PM · receipt GLF-229B363022"*. This is the 40-second demo and the daily reason to trust it; today the hero screen is empty and the tap is silent.
2. **Fix the A4 register.** Hide the nav and the top bar in print, fit the nine columns to the page width, and let the Exceptions tab print as the surveyor's page. Right now SEEN, INFORMED and STATUS fall off the sheet — the exact columns that prove the claim.
3. **Put the report in the drawer and make "informed" a decision.** Show the lab's PDF or photo beside the typed value and the printed flag; link the receipt code to `/verify/…`; change the call default outcome from "Patient reached" to an empty, deliberate choice, so no contact is ever recorded informed by momentum.

### 8. One-sentence verdict

*The first system I have seen that treats a missed result as a document with an owner and a clock rather than a message I might scroll past — but until the line is full when I open it, my tap answers back, and the register prints whole, it is a very good audit trail wearing a product's clothes.*

---

## 4. Measured facts behind the score

| Fact | Observed |
|---|---|
| Sign-in to landing | 1 tap, 893 ms, no password |
| Doctor's action per result | 1 tap (`Seen`), ~4 s |
| Cold path to a closed result | 4 taps across doctor + desk |
| Confirmation after `Seen` | **None** — card unmounts, success text never renders |
| Fresh-seed line state | Empty; 3 pending items sit unassigned in intake |
| Critical read-back guard | Button disabled + explicit sentence (verified live) |
| Two-attempt rule | `Close as unreachable` absent at 1 attempt, present at 2 |
| Unmatched assignment | No assign control; held for a human (`status: unmatched`) |
| Wrong-role access | `/clinic/line` → "This screen belongs to another role." |
| Public receipt, no session | Loads; stage + chain; no name/test/value; bad code → "No receipt found" |
| A4 register | Table laid out at 1376 px on a 794 px page: SEEN / INFORMED / STATUS clipped; app chrome and bottom tab bar printed |
| Register tiles | 11 + 5 + 1 against 15 rows |

## 5. Caveats

- I did not run `pnpm test`, `pnpm db:test`, `pnpm build` or the Playwright suite; test counts are the packet's, not mine. Everything above is what I clicked.
- The demo database is shared and mutable. I accepted, assigned and marked one intake item seen, and another reviewer reseeded the tenant mid-session, so row counts and timestamps moved during the review. **Before any live demo, run `pnpm reset:demo -- --clinic demo --confirm-demo`, then `pnpm seed:demo -- --clinic demo --confirm-demo`.** Then confirm the clinician line is not empty; on my two fresh-seed observations it was.
- The replay numbers are a labelled deterministic simulation. I scored the honesty of that label, not the 86.7%.

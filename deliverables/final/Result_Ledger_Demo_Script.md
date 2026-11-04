# Three-minute live demo

The demo is synthetic. Do not use a real patient record, phone number or lab report. Do not claim a live LIS or WhatsApp connection. If the live path fails, use the closing line and the four screenshots. Do not improvise a claim that is not in the build.

## Before the timer

- Run `pnpm seed:demo -- --clinic demo --confirm-demo` from `app/`. The clinic account then holds four standing line cards, two calls and an exception.
- Open `/sign-in` on a clean browser. Have the **Clinic team** card ready. The account holds all four roles for the demo; in production they are separate memberships.
- Open `/showcase` in a second tab. It is the eight-step index and the fallback if a screen fails.
- Keep the synthetic label visible. Do not open `/clinic/results` in the main path. It is the older ledger.

## 0:00 to 0:20  The gap

Open on `/clinic/line`.

**Say:** "The lab calls the doctor. Nobody calls the patient. In an Indian tertiary hospital with a written critical-call policy, only one in four critical values reached the treating clinician. Half went to nursing staff. Nine in ten never-notified values were outpatients. The lab's job ends at delivery. The clinic's patient-side last mile is unowned."

Point at the critical card at the top: "Critical, lab flagged. One hour to breach."

## 0:20 to 0:50  One line, one tap

Press **Seen** on the critical card.

**Say:** "The doctor does not fill a form. She sees one line and taps once. The clock does not run while she is in theatre."

Point at the confirmation banner: "Review recorded for Asha Rao at 6:37 PM. Receipt GLF-4DC55C7480. Verify."

**Say:** "The tap answers back with a time and a receipt code. That banner is the difference between a record and a promise."

## 0:50 to 1:25  The read-back

Open `/clinic/calls`.

**Say:** "The call was already happening. We record it. Read the value back. Ask the patient to say what they understood."

Choose the outcome **Patient reached**. Tick **Value read back and confirmed**. Tick **Patient said back what they understood**. Press **Record contact**.

**Say:** "An informed outcome cannot be recorded without the read-back. The default is not 'patient reached'. The nurse has to say what happened."

## 1:25 to 1:55  The exception and the register

Open `/clinic/register?tab=exceptions`.

**Say:** "This is the page the surveyor asks for. One row is red: not informed. Two attempts, a named owner, a documented disposition. We print the failure instead of hiding it."

Press **Print A4 register**. Show the landscape sheet. Point at the Exceptions tab and the **Close** action on an informed row.

**Say:** "The loop closes here. Not in a dashboard."

## 1:55 to 2:20  The number

Open `/clinic/replay`.

**Say:** "On a 300-report cohort, the baseline closes 37.7 percent within the stage clock. The loop closes 86.7 percent. The page says the cohort is synthetic and the closed share tracks the 86 percent reachability assumption. It is a model, not a trial. The pilot replaces it with 300 real reports."

Point at the badge: "Synthetic cohort, not a measurement."

## 2:20 to 2:45  The receipt

Open a Source drawer, then **Open the public receipt**. Or enter the code at `/verify`.

**Say:** "No login. No name, no value, no diagnosis. Chain intact, and a sentence that says what the chain does not prove. If the patient was unreachable, the page says so. It does not accuse the clinic of tampering."

## 2:45 to 3:00  The ask

Return to `/showcase` or the line.

**Say:** "We start with one lab or diabetes OPD: 100 consecutive abnormal or critical reports, eight weeks, a baseline audit, then a paid continuation. The lab is done when it delivers. The clinic is done when the patient is reached."

Stop. Do not add architecture.

## If the live path fails

Open `/showcase` and walk the four screenshots in `docs/research/2026-11-04-final/evidence/`: line, calls, register, replay. Then use the same closing line.

# Three-minute live demo

The demo is synthetic. Do not use a real patient record, phone number or lab report. Do not claim a live LIS or WhatsApp connection. The backup video is 47 seconds; use it only if the live path fails.

## Before the timer

- Open https://glucoflow.vercel.app/sign-in on a clean browser. Have the clinic demo card ready.
- Open a second tab at https://glucoflow.vercel.app/verify.
- Reseed the demo if you can. The ledger should show 12 receipts, a critical potassium and an unmatched sodium.
- Keep the synthetic label visible.

## 0:00 to 0:20  The gap

Open on the clinic result ledger.

**Say:** "The lab calls the doctor. Nobody calls the patient. In an Indian tertiary hospital with a written critical-call policy, only one in four critical values reached the treating clinician. Half went to nursing staff. Nine in ten never-notified values were outpatients. The lab's job ends at delivery. The clinic's patient-side last mile is unowned."

Point at the hero: 42% closed within 7 days, 8 still in the last mile, 1 documented unreachable.

## 0:20 to 0:50  The intake and the namesake

Press **Import lab feed**. The sample CSV is already loaded. Press **Import and hold unmatched**.

**Say:** "A lab feed creates three receipts. The sodium is a namesake: the name matches, the clinic ID does not. The system does not guess."

Open the Sodium row. Show the candidate list with the printed name and clinic ID. Point at the warning: "Use with review" for the weaker candidate.

**Say:** "The hard part is identity, not another summary. A human makes the match."

## 0:50 to 1:35  The value echo

Open the owned **Potassium 5.9** receipt.

**Say:** "The lab flagged this critical. The due clock started at lab release, not when the PDF reached a phone. The clinician cannot just tap acknowledge."

Type **9.9**, leave the flag as critical, press **Acknowledge with value echo**.

**Say:** "The server refuses the wrong value. That is the control."

Clear it, type **5.9**, enter the lab caller **Lab technician**, role **technician**, read back **5.9**, and press **Acknowledge with value echo**.

**Say:** "The printed value, the caller and the read-back are now in the chain. This is the lab-to-clinician read-back, not the patient conversation."

## 1:35 to 2:20  The honest unreachable

The patient-side panel opens.

Select **Not reachable after attempts**. Press **Record attempt** twice.

**Say:** "Two documented attempts. The patient is not marked informed. The receipt can close as unreachable, but only with the attempts on record."

Select **Closed, patient unreachable**, type a short note, press **Close documented outcome**.

**Say:** "This is the disposition every other tool hides. A patient who cannot be reached is a real outcome, not a false conversation."

Open the **Print closure certificate** link. Show the evidence table and the event timeline.

**Say:** "Every evidence item is present. The certificate maps the evidence. It does not issue a compliance verdict."

## 2:20 to 2:45  The public stage

Scan or open the QR, or switch to the second tab and enter the receipt code.

**Say:** "The patient or the quality team sees the recorded stage and chain validity. No name, no value, no diagnosis. If the patient was unreachable, the page says so. It does not accuse the clinic of tampering."

Show the five-stage progress: received, clinician value echo, patient contacted, next step, closed.

## 2:45 to 3:00  The ask

Return to the ledger. Point at the closure rate.

**Say:** "We start with one lab or diabetes OPD: 100 consecutive abnormal or critical reports, eight weeks, a baseline audit, then a paid continuation. The lab is done when it delivers. The clinic is done when the patient is reached."

Stop. Do not add architecture.

## If the live path fails

Play `Result_Ledger_Demo.mp4` (47 seconds, captioned). Then use the same closing line. Do not improvise a claim that is not in the build.

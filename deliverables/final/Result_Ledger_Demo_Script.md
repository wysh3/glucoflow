# Live demo script

**Length:** 3 minutes.
**Data:** synthetic only. Never use a real patient record in the demo.
**Setup:** signed in as Clinic team, result ledger open, public verifier tab open.

## 0:00 The opening

"This is the result ledger. It is not another record. It is the proof that a lab result was owned, acknowledged and communicated."

Point to the critical alert.

"Two critical results are still open. Ten results are open. Three have no owner. The median acknowledgement is three hours."

## 0:30 The inbound report

Press **Receive sample**.

"A critical potassium result just arrived on WhatsApp. The lab flag is copied from the report. The ledger does not interpret the value."

The receipt opens.

"It is matched to a patient. It has no owner and no clock yet."

## 0:50 The owner and the clock

Press **Assign to me**.

"A named clinician and a due clock. Critical results get fifteen minutes by default."

Press **Acknowledge result**.

"The clinician has now seen it. This is the first human receipt."

## 1:15 The patient conversation

Select **Phone call**. Tick **Read-back confirmed**.

"The patient was called. The read-back is explicit. A critical result cannot be marked informed without it."

Press **Record patient informed**.

"Now the receipt can close. No silent dashboard state."

Press **Close receipt**, add a short note.

## 1:45 The proof

Scroll to **Receipt proof**.

"Every event is hash-chained. Chain verified. Four controls met. The receipt code is public."

Press **Download survey pack**.

"This is the hospital audit file. It maps the evidence to the critical-alert register and the read-back requirement. It is an evidence map, not a certification."

## 2:15 The public verifier

Click the receipt code.

"This is the same code a lab or a patient can check. It returns the event count and chain head. No name, no test value, no clinical decision."

## 2:35 The close

"This is the wedge. A hospital gets a survey pack. A lab gets delivery proof. A patient gets a receipt. The network is the moat, because a single-hospital inbox cannot make a lab receipt portable."

"Three sites, one hundred reports each, eight weeks. A baseline audit, then a paid continuation. The result nobody owns, until someone signs."

## If the live sample fails

Use the seeded Sodium receipt in the ledger. It is already acknowledged and critical. The read-back and close flow are identical. Do not claim the sample receipt was AI-extracted; it is a synthetic inbound receipt.

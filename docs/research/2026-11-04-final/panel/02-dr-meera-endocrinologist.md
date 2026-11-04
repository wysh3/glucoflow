# Dr Meera Iyer, consultant endocrinologist — scorecard

*120-bed private multispecialty hospital, Mumbai (Tier 1). 35–45 OPD patients a day, four days a week, plus inpatient rounds. Notes on paper, labs on WhatsApp, HIS for registration and billing only. I have been burnt once by a critical potassium that reached a receptionist and not me.*

## Stance (one line)

T1 wins, but it wins on my scar tissue and not on its design — and the version on stage today would put fourteen form fields between me and my first patient, which is how a liability shield becomes a second unpaid job.

## Scores

| Thesis | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | TOTAL |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 Closure Ledger | 14 | 9 | 10 | 9 | 8 | 13 | 9 | 5 | 4 | 81 |
| T2 90-Day Recheck | 13 | 7 | 11 | 6 | 5 | 13 | 10 | 5 | 4 | 74 |
| T3 Annual Review Pack | 13 | 7 | 8 | 7 | 4 | 12 | 9 | 4 | 3 | 67 |
| T4 Bag Reconciliation | 15 | 7 | 8 | 6 | 7 | 8 | 8 | 3 | 4 | 66 |
| T5 Identity Firewall | 10 | 7 | 9 | 10 | 9 | 9 | 8 | 4 | 2 | 68 |

Dimensions: 1 problem reality (15), 2 failure cost (10), 3 buyer and WTP (15), 4 defensibility (15), 5 technical depth (10), 6 programme fit (15), 7 India scale (10), 8 regulatory safety (5), 9 demo (5).

## Why the winner wins (top 3 reasons, evidence-backed)

**1. It is the only thesis aimed at the failure I can date.** I can tell you the month the potassium went to the front desk. I cannot tell you the date a recheck was missed, because a missed recheck has no event. T1's unit — an obligation with an owner and a clock — is the first artefact in this whole pack that would have caught that specific incident. The evidence pack supports it: 64.61% of critical values notified 30–120 minutes after sample arrival with outpatient notification as the weak point (§5, row 4), 10.7% unsuccessful notification (row 3), 6.8–62% of abnormal results not followed up (row 5). Those are not my numbers, but they are my Tuesdays.

**2. It is the only one where the AI is small enough to trust.** Extraction and patient matching, with abstention. The lab flag is copied, not computed. Every other thesis asks me to accept a machine's judgement about a drug, a bundle or a body. T1 asks me to accept a machine's judgement about which PDF belongs to which Sharma — and then refuses to decide when it isn't sure. That refusal is the most clinically literate thing in the submission.

**3. It is the only one that survives both other judges.** The technologist will see a state machine, an append-only event table, hash-chained proof and calibrated abstention — a system, not a form. The government doctor will recognise NABH/NABL critical-alert register requirements that already bind a district hospital. T2 loses the technologist ("CRM"), T3 loses both ("checklist"), T5 loses the room entirely.

## Fatal flaw of each thesis (one line each)

- **T1:** Every receipt action is gated on `canClinical` — so the doctor cannot hand the typing to the sister, which means the shield is only real on the days I have time to fill forms, and on the days I don't it silently becomes a record of my failure.
- **T2:** It is the front desk's job sold as the doctor's product, and the moment the hospital buys it for revenue recovery I inherit fifteen unplanned walk-ins a week under my own name.
- **T3:** The pack is a document that proves my care was incomplete — four of six gaps, printed, carried by the patient, timestamped.
- **T4:** I sign the reconciliation, so the first missed stopped-drug is my handwriting on a machine's reading, which is the highest personal liability of the five.
- **T5:** There is no screen. Nothing to open twice, nothing to demo, nothing for a doctor to ask for, and a product a doctor never asks for is a product a hospital buys without asking her.

## What would make the winner 95+

1. **One tap, not fourteen fields.** Prefill the printed value; the doctor confirms, and only the doctor's confirmation is timed. Move the patient-side capture and the read-back to a named nurse or front-desk role so the receipt records *who* told the patient — a receipt proving a doctor saw it, signed by whoever had time, is exactly the incident I had.
2. **At 09:25 the screen says one thing.** "One thing needs you before you start: K 6.1, flagged 08:50, 35 minutes to breach." Not a dashboard, not nine stat tiles. One line, her name, before patient one.
3. **The clock belongs to the clinic until I tap.** Do not stamp Dr Iyer overdue because a report landed at 18:40 while she was in theatre. Attribution after acknowledgement, not before. This is the difference between a shield and a noose.
4. **One real baseline number.** "100 consecutive reports at one site: 23 without a documented acknowledgement." One measured number from one real clinic beats the entire accreditation narrative, and it is the only claim in this pack that would change a hospital's behaviour.
5. **Twenty seconds of abstention on stage.** Two Sunita Sharmas, one shared son's phone number, system refuses both and asks. That is the moment a doctor believes the machine knows its limits.

## The one question I would ask at the finale

**"If I refuse to touch your app, does the receipt still close — and who closes it?"** If the answer is "then it stays open and the quality head sees it", the product is a surveillance tool aimed at me and I will route around it in a fortnight. If the answer is "the sister acknowledges receipt of the report, she records the call, and my name attaches only when I confirm I have seen the value", then you have built the thing I actually need, and I will defend it in a mortality review.

## Verdict (one sentence)

Vote T1: it is the only one of the five that turns a clinical intention I have already formed in my head into an obligation with an owner and a clock, and the only one whose failure mode is a form I resent rather than a patient I have harmed.

## Confidence and what I could not verify

High confidence on the workflow cost, because I counted it: the built receipt drawer requires printed value + printed flag + notifier name + notifier role + value read back + note to acknowledge a critical, then outcome + channel + recipient + relationship + language + teach-back + next step + note to record patient contact, then disposition + note to close. That is roughly 14–16 interactions and 4 clicks for one critical result: **2.5–3.5 minutes per critical, 11 interactions and ~90 seconds per abnormal**. At ten abnormal reports a day, **25–35 minutes — about 10% of a 6.5-hour OPD day** — spent typing about work already done in my head. This is a count of built fields, not a timed usability study.

Medium confidence on the numbers I did not measure. I read §5 of the pack, not the primary papers behind rows 3, 4, 5 and 9. I did not see the deployed product at finale scale; I read the brief and the code paths the brief names. Extraction accuracy figures (0.875/0.56/0.24 internal; 1.00/1.00/0.8834 synthetic) are not clinical validation and I have treated them as zero evidence about my patients.

Low confidence, and this is the honest hole: **my willingness to pay is one doctor's hypothetical.** There is no buyer interview anywhere in this pack, and I am precisely the person §10 warns against treating as a market. What I can assert is narrower: I would pay ₹2,000/month from my own pocket for T4 today and I would not pay a rupee personally for T1, T2, T3 or T5 — but I would use T1 daily if the hospital bought it and my surface stayed at one tap. Whether the quality head signs is not something I can see from my consulting room, only that in my hospital the NABH file exists and a named person owns it.

---

## Appendix: the eight questions, answered as the doctor

### 1. What I would use tomorrow, and what I would not open twice

**Use tomorrow, no permission needed:** T4. I have eight new patients a week and every one of them puts a plastic bag on my desk. I would photograph it before I take a history.

**Use tomorrow if the hospital sets it up:** T1 — the 09:25 unclosed list only. Not the drawer, not the register export, not the dashboard. One line: what arrived overnight that I have not seen.

**Would not open a second time:** T5, because there is nothing to open — that is a compliment to the firewall and a death sentence for the company. T3, because by week two I would know the pack is 40% gaps and I would stop looking at a document that only records what my patients did not do. T2's due-patient ledger, because that is the front desk's list; I would read the three-line brief and nothing else.

### 2. Where each one adds work — clicks, calls, minutes

My arithmetic: 40 patients in a 6.5-hour OPD is 9.7 minutes per patient. That is the denominator for everything below.

**T1 — the only one that adds minutes to my day.**
- Ingest and match: not mine, but 10–20 minutes a day of somebody's — and it is the task that will quietly stop happening in week three when the sister is short-staffed.
- Identity holds: with shared family phones, expect 1–3 a day needing a human. 30 seconds each, in the middle of a consult. **+1.5 minutes.**
- Acknowledge a critical: open the row (1 click), Assign to me (1), type K 6.2, pick the flag, type K 6.2 again for the read-back, Acknowledge (1). **35–45 seconds**, more if I stop to think about the patient, which I will.
- Acknowledge an abnormal (the common case): value + flag + click. **15–20 seconds.**
- Patient side: outcome, channel, recipient, relationship, language, teach-back box, next step, note, submit. **90 seconds** — and it is a phone call I then actually have to make, which is 2–4 minutes I was making anyway, now with a form around it.
- Close: disposition + note. **20 seconds.**

Ten abnormal reports a day is **25–35 minutes of typing**, or 10% of the OPD day. One critical done end to end by me is **2.5–3.5 minutes**. I will do that for a fortnight out of guilt about the potassium and then I will ask the sister to log in as me, and then your audit trail is fiction. The fix is not a faster form; it is a different division of labour.

**T2 — near-zero clicks for me, and a hidden two hours.**
Morning brief, 3 minutes, fine. But every due patient needs a disposition from me — call back, teleconsult, discharge. If the clinic hands me 60 names a month and I spend 20 seconds each, that is 20 minutes a month, which is nothing. The cost is elsewhere: if this is bought to recover revenue, each "recovered" patient is a walk-in I did not plan for. Fifteen extra patients a week at 10 minutes is **two and a half hours of OPD I did not have.** I would take the brief and refuse the queue.

**T3 — 90 seconds a patient-year, and an hour of chasing.**
Confirming the six-item checklist at pack issue: 1–2 minutes per patient-year, 640 patient-years, about 16 hours a year. Trivial. The real cost is that the pack is only true if the eye clinic, the nephrologist and the lab stamp it. Somebody has to chase. If that somebody is me, it is 30 minutes a day and it fails in a week. If it is a coordinator, you have sold a headcount, not software.

**T4 — the only negative delta.**
60–90 seconds to photograph the bag. Work removed: 3–6 minutes of digging through handwritten prescriptions from three other doctors, plus the risk of missing a stopped metformin. Then I edit and sign the reconciliation: 2–3 minutes. **Net: −1 to −3 minutes per new patient**, eight a week, **20–25 minutes a week back**. It is the only thesis where the arithmetic goes my way, and I would still want to see it fail on a bad bag before I trusted the sign-off.

**T5 — five minutes a day, invisible.**
A hold lands in my room: which Sunita Sharma is this one. 30 seconds, once or twice. **5 minutes a day.** Everything else about it is work that happens to somebody else and never reaches me, which is why I will never ask for it.

### 3. Would I trust it enough to act

Not on day one, and not because of the AI. My trust conditions are specific: I need to see the original pixels beside the extracted number in one tap (that exists), and I need the criticality to be the lab's own flag copied verbatim, never inferred (that is how it is built, and I would check it in front of the judges). For identity matching I need to watch it refuse a wrong match once. Twenty seconds of two Sunita Sharmas and a shared phone number, and I will believe the machine knows what it does not know.

What would actually stop me acting is not accuracy. It is **attribution**. If the ledger marks me overdue because a report arrived at 18:40 while I was in theatre, I will not trust a system that reports on me without knowing where I was. I need the clock to attach to the clinic until I tap, and I need "in theatre, 4 hours" to be a state the system understands rather than an excuse I type. A timestamp I cannot explain is worse than no timestamp.

And I need one thing no dashboard gives me: at 11pm, when a relative calls angry, I need to pull that patient's log, that date, that call, in under a minute. If I cannot produce it on demand, the record is for the auditor and not for me.

### 4. My liability, and whether the product makes me more or less exposed

Today my exposure is real but blurred: a paper diary with gaps, a WhatsApp thread I cannot search, and genuine deniability about whether a report ever reached me. That deniability is worth more than doctors admit.

**T1 makes the institution safer and me more exposed.** That is the sentence nobody in this submission has written down. An append-only record that shows a critical flagged at 08:50 and acknowledged at 18:42 is a plaintiff's exhibit. A hash-chained receipt that proves the system knew for nine hours and nothing happened is *worse* for me than a diary nobody can read. And the moment I tap "acknowledge", I have documented that I saw the value — which removes the only defence I currently have, that it may never have reached me.

The fix is structural, not cosmetic: the obligation must belong to the **clinic** until a human accepts it, and the acceptance should be acceptable by the ward sister on my behalf. The receipt then proves the hospital's loop closed, which is what NABH wants, without proving that I personally was slow. If I am the only person who can press the button, the product converts a shared institutional duty into my individual admission.

The other four, briefly. **T2** is low risk if the barrier classification stays non-clinical — "reached / not reached / asked for a later date", never "patient declined care", because a lay caller's note in my file is a clinical statement I did not make. **T3** multiplies T1's problem by six fields: a printed pack with "eye: not done" in a twelve-year diabetic is a document that proves my care was incomplete, and it is in the patient's own bag. **T4** is the only one where I personally sign a machine's interpretation of a medication list — highest personal exposure of the five. **T5** is the only thesis that strictly *reduces* my exposure: catching a wrong-patient report before I act on it can only help me, and it adds nothing to my file.

Net: T1 and T3 make me more exposed, T4 makes me personally exposed, T5 protects me, T2 is neutral if built carefully.

### 5. What my patients would think — care, surveillance, or spam

**T1: care if a human calls, surveillance if the system talks.** "Dr Iyer has seen your report, please come Thursday" from a Marathi-speaking caller is care. "Your report has been received and assigned to a clinician" is a ticket number, and my patients will hear an insurance company. The single most patient-aware line in this whole submission is "never read a value to a patient on a shared phone" — whoever wrote that has sat in an Indian OPD. A 68-year-old retired teacher will accept a read-back as respect; the same man will find a bot asking him to repeat a sentence humiliating.

**T2: spam, and it can be fixed with one word.** An unsolicited hospital call in Mumbai reads as a sales call. "Dr Iyer asked us to call" changes the category entirely, from marketing to medicine. That single sentence is worth more than the multilingual stack.

**T3: care only if it is a paper object.** A booklet the patient carries and the eye surgeon signs is care. A QR code they must produce at four counters is surveillance with extra steps. And a pack that says "overdue for eye check" in the hands of a patient who cannot afford the test is a scare document, not a care document.

**T4: neither, and that is its charm.** The only patient-visible moment is "doctor, can I have my bag back?" and I say "two minutes". Patients read a doctor who goes through the bag properly as thorough. No surveillance, no spam, no new channel.

**T5: neither, until it fails.** "We need to confirm which Sunita Sharma you are" at the registration counter reads as incompetence. Two minutes, and the patient's story becomes "the hospital lost my report".

### 6. Would I pay, and how much

**From my own pocket: T4 only, ₹2,000 a month.** That is my arithmetic, not enthusiasm: 20–25 minutes a week back is 90 minutes a month, my opportunity cost is ₹1,500–2,000 an hour, so ₹2,000 is roughly break-even. I would cancel at ₹3,000, and I would cancel at ₹2,000 if it saved less than fifteen minutes a week.

**For T1 I would pay nothing personally**, and that is not a criticism of the product — it is a statement about who owns the failure. The NABH file, the critical-alert register and the ₹20 lakh consumer award all sit with the hospital. The quality head pays ₹5,000–20,000 a facility. **If the hospital paid, yes, I would use it — but only if my surface is one tap.** If the hospital pays and I am asked for fourteen fields, I will use it for two weeks and then a nurse will have my login, and you will have a beautiful audit trail of a person who was not in the room.

**T2, T3, T5: ₹0 from me.** T2 is the front desk's, T3 is the quality head's, T5 is the lab's. None of the three has a doctor in the buying conversation, which is exactly what the brief says about T1's weakness — and I would point out it is true of four of the five.

### 7. The one screen that makes me say "this is mine"

09:25 on a Monday, before patient one. One line on the screen: **"K 6.1, flagged 08:50, 35 minutes to breach — you have not seen it."** Not a dashboard. Not nine stat tiles. Not "Welcome back, Dr Iyer". One thing, my name, and it is right.

That is the moment, because it tells me something at 09:25 that I would otherwise have discovered at 22:00 on my phone with a glass of wine and a bad feeling. Everything else in T1 follows from whether that line is true on a Monday when three criticals came in overnight.

Runner-up, and the only other screen in the pack I would hold up: T4's signed one-page reconciliation with my own corrections in my own handwriting on top of the machine's reading. That is an artefact I own. The ledger is an artefact that owns me.

### 8. Which thesis I would vote for, knowing the other judges

**T1, and it is the only one I can win for.**

The coalition is the argument. The technologist will not vote for T2 — it is a CRM with a voice model. He will not vote for T3 — it is a checklist with a QR code. He might vote for T5, and I would rather he did not, because T5 dies in the demo hall: there is no forty-second moment, and a judge who cannot see it cannot score it. T1 is the one he can respect as a system: a server-enforced state machine, an append-only event table, hash-chained proof, calibrated abstention. The government doctor will not vote for T4 — no KPI, no scale story, a Tier 1 doctor's convenience. She might vote for T2 or T3 on coverage grounds. But T1 is the only thesis that names an obligation NABH and NABL already require of a district hospital, which means she can defend it to her own medical superintendent on Monday.

So T1 is the intersection: a real system for the technologist, an existing regulatory duty for the government doctor, and for me the one failure I can date to a month.

What would move me: if T2's demo is a real Marathi voice call to a real lapsed patient who says "my eyes are fine" and gets rebooked inside the seven minutes, I would argue for it in the room — but I would lose the technologist's vote doing it, and I know it.

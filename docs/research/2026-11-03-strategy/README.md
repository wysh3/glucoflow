# Strategy pack: from records to the doctor's 60-second delta

3 November 2026. This pack answers the middle-review feedback, the final-deliverables message, and the panel of two doctors and one technology expert.

> **Revision 3, 3 November, 21:45.** The final demands a doctor-side product. The result loop is the stronger white space, but the buyer is the quality or admin desk. The lead for the final is the **60-second delta**: the one-page pre-visit brief that shows the three things that changed, the two things that are unresolved, and what the record cannot tell you. It is doctor-side, it is demoable on the existing backend, and it contains the result loop as the "unresolved" block. Read [the winning plan](14-winning-plan-doctor-side.md) first. The result-loop memo remains the deeper white-space analysis and the fallback.

## The answer in one paragraph

A follow-up visit begins with a reconstruction. The doctor has about two minutes and a bag of reports. The record is not the problem. The doctor needs the delta: the three things that changed since the last visit, the two things that are unresolved, and a source for every line. The product is a one-page pre-visit brief with four blocks: changed, unresolved, conflicts, and what we do not know. The AI reads and reconciles. The doctor decides. The KPI is time-to-brief under 60 seconds, delta completeness, and unresolved items closed within 7 days. The pitch is **"the doctor has two minutes; we give back the first sixty seconds."**

The result-loop analysis is in [the revised recommendation](13-revised-recommendation-result-loop.md). It is the proof underneath the delta's unresolved block, and the fallback if the doctors say they already see every report.

## Read in this order

1. [Winning plan for the final](14-winning-plan-doctor-side.md). The panel psychology, the 20 patterns, the philosophy, the delta product, the MVP, the two-page brief, the deck, the video and the Q&A. Read this first.
2. [Result-loop recommendation](13-revised-recommendation-result-loop.md). The deeper white-space analysis and the fallback. It supplies the "unresolved results" block.
3. [Executive brief](00-executive-brief.md). The first-pass follow-up thesis and the market reality.
4. [Hackathon brief](01-hackathon-brief.md). The full programme: dates, scope, design bar, 13 use cases, FAQ, prizes.
5. [Current state](02-current-state.md). What is built, what is only a deck, and the premise that keeps failing.
6. [Follow-up evidence](03-evidence-followup.md). The Indian measurements, with settings and caveats.
7. [Problem space](04-problem-space.md). Fifteen candidates, the scoring, and the first-pass rationale.
8. [Recommended thesis](05-recommended-thesis.md). The first-pass follow-up thesis.
9. [Validation plan](06-validation-plan.md). The follow-up validation plan; the delta pilot is in the winning plan.
10. [Regulatory map](07-india-regulatory-map.md). Why HIPAA does not apply, what does, and the pilot checklist.
11. [Tier 2/3/rural](08-tier-2-3-rural.md). The pros, the cons, the GTM, the unit economics.
12. [UX, trust and 3D](09-ux-trust-3d.md). Ask for less, show the leak, and the one 3D visual worth building.
13. [Pitch and demo](10-pitch-and-demo.md). The first-pass seven slides and demo.
14. [Four-day build plan](11-build-plan-4-days.md). The first-pass vertical slice.
15. [Evidence ledger](12-evidence-ledger.md). Every claim, its source and grade, and what could not be verified.

## The three sentences to remember

> **The problem:** a follow-up visit begins with a reconstruction, and the doctor has about two minutes.
>
> **The product:** the 60-second delta. Three things that changed, two things unresolved, a source for every line, and what the record does not know.
>
> **The differentiation:** an EMR shows the record; a summary tells the story; the delta tells the doctor what to do next and refuses to guess.

## What changed from the current deck

| Old story | New story |
|---|---|
| AI extracts records; a reviewer checks them | The doctor's first two minutes; the delta is the product |
| The hero is a five-year scenario chart | The hero is a one-page delta with three changes and two unresolved items |
| The KPI is "30% less preparation time" (unmeasured) | The KPI is time-to-brief under 60 seconds and unresolved items closed |
| The buyer is "a clinic" | The buyer is the clinic owner or hospital quality head; the doctor is the hero |
| The expansion is "ABDM later" | The expansion is every follow-up, every specialty, every tier |
| The safety story is "human review" | The safety story is "sources, refusals, what we do not know, human approval" |
| The wow is a dashboard | The wow is the missed eGFR and the unopened referral found in 42 seconds |

## The honest limits

- The delta can be seen as a summary or an EMR feature. The defense is the delta unit, the source link, the "what we do not know" block, and the doctor's measured time. The doctor partner must say on camera that this is not their EMR.
- The Indian baseline for the time saving is thin. The two-minute consultation is a single government-hospital study; the pilot must measure the delta's time and completeness in the target clinic.
- The team has not run a real clinic pilot or measured the delta with doctors. The first three interviews and the doctor partner's rubric are the gate.
- The existing extraction is weak on unfamiliar layouts (0.24 complete fields on the external corpus). The delta must show its uncertainty and must not pretend to be complete.
- The market at flat clinic pricing is small. The path is hospitals, specialties and government OPDs, and it is unproven.
- The incumbents can add a delta view. The differentiation is the source-linked graph, the refusal semantics and the clinical trust, not the model.

## The immediate next step

Read [the winning plan](14-winning-plan-doctor-side.md). Write the delta story and the synthetic patient before writing code. Ask the doctor partner: "Would you use this tomorrow?" If the answer is not an immediate yes, fix the story. Then build the five screens and shoot the video.

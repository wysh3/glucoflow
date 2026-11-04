# The follow-up evidence: what is measured in India, and what it implies

Research note, 3 November 2026. I verified the facts marked "verified here" by fetching the primary source this session. The rest come from the source's abstract or from the research memo and are marked accordingly. I did not run a systematic review.

## The strongest Indian facts

| # | Fact | Setting and sample | Grade | Source |
|---|---|---|---|---|
| 1 | **Only 60.4% of patients had a legible phone number; only 16.4% had a complete, legible address; only 11.2% were "probably trackable" by both.** Among diagnosed smear-positive TB patients, 74.7% had a legible phone, 13.2% a complete address, and 10.2% were trackable by both. | Chennai, 22 RNTCP microscopy centres, 3,696 chest symptomatics, May 2015 registry audit | Measured; verified here | [BMC Infectious Diseases 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5872574/) |
| 2 | **34.4% of 3,696 patients had addresses and phone numbers that were illegible or missing.** Absence of legible contact information was associated with pre-treatment loss to follow-up (OR 4.5, 95% CI 1.3 to 15.1). | Same cohort | Measured; verified here | Same |
| 3 | **Pre-treatment loss to follow-up was 22.1%** (76 of 344 smear-positive patients); 11.6% did not start treatment within 14 days. | Same cohort, tracked 2015 to 16 | Measured; verified here | Same |
| 4 | **Missed visits fell from 66% to 22% in nine months; monthly follow-up rose from 21% to 37%.** The interventions were ASHA home visits for missed visits and triangulation of follow-up records. No app. | District Hospital Seoni, Madhya Pradesh, 2,850 hypertension patients, 2022 | Programme/QI; verified here | [BMJ Open Quality 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC11831276/) |
| 5 | **Pre-treatment loss to follow-up 18% in control vs 9% with mobile voice-call reminders** (risk difference about 9 percentage points). | Tertiary hospital, Puducherry, RCT, n=310 TB patients with a mobile phone | Measured; abstract verified | [J Postgrad Med 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8706537/) |
| 6 | **50 to 60% of hypertension patients in a public program did not attend scheduled follow-up.** The top reasons were "not feeling sick" (24.8%), distance (22.3%), no instructions from the facility (15.3%), acute illness (8.3%), and waiting time (7%). 55.4% continued treatment elsewhere; 54% of those preferred private clinics. | Punjab public health facilities, 300 randomly selected patients who missed more than three consecutive months | Measured; abstract verified via Europe PMC | [J Clin Hypertens 2021](https://pubmed.ncbi.nlm.nih.gov/33458931/) |
| 7 | **50.5% delayed follow-up because "my eyes were okay"; 41.0% had no attender; 38.6% cited cost. 26% progressed to vision-threatening disease during the delay.** | 500 consecutive diabetic retinopathy patients returning after more than twice the advised interval, private tertiary centre, Puducherry | Measured; abstract verified | [Indian J Ophthalmol 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5565887/) |
| 8 | **Childhood cancer treatment abandonment 14.3%** (415 of 2,906 curative-intent patients), higher in females (16.4% vs 13.3%). | AIIMS Delhi and CanKids, 2017 to 22, n=3,284 | Measured; abstract verified | [Indian J Pediatr 2024](https://pubmed.ncbi.nlm.nih.gov/38270753/) |
| 9 | **Paediatric cancer abandonment 27.1%** (161 of 592) and refusal 3.9%. | Regional cancer centre, Assam, 2010 to 17 | Measured; from research memo | [PMC6948912](https://pmc.ncbi.nlm.nih.gov/articles/PMC6948912/) |
| 10 | **Pre-treatment abandonment 23% in the control period vs 16% after a pain quality-improvement intervention.** 41% vs 39% broke off after starting treatment. | Head-and-neck cancer, Northeast India, n=314 | Measured; from research memo | [PMC11866678](https://pmc.ncbi.nlm.nih.gov/articles/PMC11866678/) |
| 11 | **93.8% of women had at least one ANC visit, 63.1% completed four or more, and 62% continued to postnatal care. 38% dropout before PNC.** | NFHS-5, national | Programme data; from research memo | [Dialogues in Health 2025](https://doi.org/10.1016/j.dialog.2025.100226) |
| 12 | **Only 3% of mother-child dyads received all 19 MNCH interventions; 50% received 14 of 19.** | NFHS-5, 40,687 dyads | Programme data; from research memo | [BMC Public Health 2025](https://doi.org/10.1186/s12889-025-23697-x) |
| 13 | **90.6% of obstetric ICU transfers had no prior communication with the receiving facility; 70% arrived without an escort; referral slips were incomplete in about half.** | Five-year referral audit, tertiary India | Measured; from research memo | [IJCCM 2025](https://doi.org/10.5005/jp-journals-10071-24762) |
| 14 | **58.3% of OPD patients waited more than three hours; 80.8% of consultations were 30 minutes or less.** | Tertiary hospital, Jharkhand, n=400 | Measured; from research memo | [Cureus 2026](https://doi.org/10.7759/cureus.116596) |
| 15 | **Missed test results: 6.8% to 62% of laboratory tests were not followed up.** No Indian equivalent found. | Systematic review of 20 studies, mostly US | International; from research memo | [J Gen Intern Med 2012](https://doi.org/10.1007/s11606-011-1949-5) |

## What the evidence says

### The problem is not "forgetting"

The reasons patients give are mostly structural or perceptual:

- "I feel fine" (no symptoms).
- Distance and travel cost.
- No one to accompany them (especially for eye exams, dialysis, chemotherapy).
- Financial cost.
- No clear instructions about what to do next.
- Long waits at the facility.
- They switched to another provider, often private.

A reminder message does not fix any of these. It may even annoy the patient. The product has to ask why, and then route to something that resolves the barrier.

### The first failure happens before the reminder

The Chennai audit is the most important fact in this note. In a public programme in a major city, **only 11.2% of patients were reliably trackable by phone and address**. Among diagnosed TB patients, only 10.2% were trackable by both. That means a reminder product built on the existing register is not reaching "most" patients; it may be reaching a minority, and the patients it misses are the ones with the highest risk of loss.

This is the non-obvious insight: **the follow-up list is not a list of patients; it is a list of contact records, and many of them are broken.** The product's first job is to make the list fit for purpose, at the point of registration and before the first follow-up. That is a data-quality and workflow job, not a messaging job.

### The KPI can move without an app

The Seoni QI is the proof that the operational loop can work in an Indian public hospital: ASHA home visits plus record triangulation cut missed visits from 66% to 22% in nine months. It also sets the bar for software. A judge will ask: "If ASHA visits and a paper register already work, why do we need you?" The honest answer is:

- The QI worked because a team gave ASHA workers a list and followed up. That discipline is hard to sustain across facilities, staff turnover and months.
- The list was assembled by triangulating multiple registers, which is exactly the work software can do reliably.
- The product makes the worklist, the barrier reason, the ASHA assignment, and the outcome auditable. It does not replace the ASHA visit; it makes sure the right patient gets one.
- The product can scale the Seoni playbook to facilities that do not have a QI team.

### The evidence gap on results

There is no Indian study that measures the proportion of ordered tests whose results are never reviewed by a clinician. The best evidence is a US systematic review with a 6.8 to 62% range. That does not mean the problem is absent in India; it means a pitch that leads with results will be asked for a baseline the team does not have. Follow-up has Indian numerators. Results does not. That asymmetry decides the lead wedge.

## What this means for the product

The evidence supports a product with three jobs, in this order:

1. **Make the patient reachable.** Audit the register for missing, illegible, duplicate or invalid phone numbers and addresses; capture a working number and an alternate contact at registration; verify it with a low-cost check; flag the untrackable.
2. **Ask why, then route.** Contact the patient in their language, ask whether they can come, and if not, why. Classify the barrier. Route to a resolution the clinic can actually deliver: a teleconsult, a nearby lab or PHC, an ASHA home visit, a scheme or transport contact, a different slot, or a documented discharge from the list.
3. **Prove the loop closed.** Every due patient has a disposition. The unreached have a named human owner. The clinic sees the barrier map and the escalations; the district sees coverage by facility. The ledger is exportable and auditable.

The product is not a reminder app. It is a **reachability and barrier-resolution layer** for the clinic's follow-up list. The reminder is one small part of it.

## Caveats to state in the pitch

- The Seoni result is a QI site chosen for poor performance; 66% is a bad-case baseline, not a national average.
- The Chennai audit is one mega-city and one programme; the exact percentages will differ elsewhere.
- The Punjab study is public facilities; private clinic no-show rates are vendor-claimed and not independently measured at scale.
- The cancer abandonment figures are hospital-based and vary by cancer, stage and income.
- Maternal continuity figures are definition-dependent; do not compare 3% (19 interventions), 39% (four services), 63.1% (4+ ANC) and 62% (PNC) as if they measured the same thing.
- No Indian time-and-motion study of doctor administrative time was found. Do not claim a time saving without measuring it.

## The one-sentence evidence summary

In Indian clinics, the follow-up list is often not reachable, and the reasons patients do not return are barriers a reminder cannot remove; the product that wins is the one that makes the list reachable, asks why, routes the barrier, and proves every due patient was accounted for.

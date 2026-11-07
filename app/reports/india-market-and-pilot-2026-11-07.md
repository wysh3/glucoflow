# India customer, economics and pilot recommendation

Date: 7 November 2026. Decision memo, not a market-validation or clinical-outcomes report. Repository evidence: `README.md`, `app/docs/CARE_ARCHITECTURE.md`, `docs/mvp/01-product.md`, and the original build/acceptance baseline. Public sources were checked on this date. No hospitals were contacted; no demand, willingness-to-pay or outcome measurements are claimed.

## Start with one operational buyer and one workflow

**Recommended first customer: an independently managed private secondary-care hospital with one general-medicine/diabetes inpatient ward, an in-house laboratory, an accessible HIS/LIS vendor, and a nursing-quality sponsor.** A roughly 50–150-bed institution is a prospecting hypothesis, not an evidence-based market boundary. Qualify actual workflow volume and integration access before choosing a site. Start in one city where the team can observe shifts in person; do not claim national coverage.

The first product is a source-backed specimen collection-to-laboratory-receipt and shift-handover worklist. Diabetes provides a focused service context and clinical champion; the administrative pattern is not diabetes-exclusive. The buyer should pay for less coordination work and inspectable accountability, not for a chatbot or a promised clinical benefit.

| Party | Actual job and authority |
| --- | --- |
| Primary operator | Ward nurse/shift coordinator: inspect pending specimen receipts, verify source status, propose a bounded follow-up, and prepare the next shift's handover. Their work determines whether this helps. |
| Secondary operators | Laboratory accession staff confirm receipt through the existing LIS; treating clinician reviews proposals where required; quality staff inspect the event trail. Do not make lab staff double-enter every receipt. |
| Economic buyer | Hospital administrator/COO with budget authority; nursing superintendent and medical superintendent jointly sponsor workflow change. A physician champion alone is not a purchase order. |
| Integration/security gatekeeper | Hospital IT and HIS/LIS vendor: authorize access, identity mapping, timestamps, support responsibilities and incident procedures. |
| Patient | Data subject and potential user of the existing record surface. Patient app installation is not a condition of receiving ward care and is not required for this initial sale. |

Select a ward with enough routine eligible specimens to measure the workflow, observable existing workarounds, stable accession identifiers, a named owner on every shift, and a written commitment to the evaluation. Reject a first site that needs inferred patient matching, phone screenshots as its only source, autonomous medical decisions, or an unsupported 24/7 service commitment.

Small standalone diabetes clinics are a sensible later customer for reviewed record preparation, but do not generate the same inpatient handover/receipt problem. Large chains bring multi-site procurement, SSO, vendor contracting and support obligations before the first result. Public-sector and district hospitals may have substantial need, but tendering, integration ownership and deployment constraints should be a separate workstream. Direct-to-consumer subscriptions, insurers, employers, pharmacies and laboratories alone are not simultaneous launch segments.

India's diabetes burden supports investigating this domain, not a revenue forecast. The Ministry of Health's 2023 answer cites the ICMR-INDIAB estimate of 10.1 crore people with diabetes; the underlying study is an adult population survey, not a count of reachable hospitals or buyers. Do not multiply prevalence by subscription price. [MoHFW/PIB, 1 August 2023](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1944600); [ICMR-INDIAB-17 publication, 2023](https://pubmed.ncbi.nlm.nih.gov/37301218/).

Before building a sales forecast, conduct permissioned interviews and direct observation with approximately five hospital administrators, five nursing/quality leads and two HIS/LIS vendors. These are proposed discovery counts. Record who owns the budget, the incumbent workflow, data access cost, procurement lead time, and an actual paid-pilot decision. Interest and a demo account are not customers. No contact is authorized or performed by this report.

## What is already present versus what a hospital would buy

The repository demonstrates authorized synthetic encounters, evidence links, bounded proposals, human approval, source-confirmed completion, handover drafts and a versioned operational template library. It also preserves patient/clinic record journeys and shared web/Android surfaces. These are useful foundations.

It does **not** establish live HIS/LIS connectors, hospital-scale durable monitoring validation, external notification dispatch, an independently validated extraction model, physical-device readiness, hospital support coverage or clinical deployment approval. Shared public demo credentials must never receive real patient data. The current hardening pass adds a bounded durable worker to the earlier read/command reconciliation. That is engineering progress, not a hospital availability guarantee; selling an always-on service still requires sustained operational verification. The newer November care scope adds to the original product baseline; it does not remove source evidence, authorization, separate patient/clinic permissions or human approval.

No implementation or acceptance item is marked complete by this strategy document. Connector, background-monitoring, device, security and evaluation work must be mapped to the corresponding authorization, source-evidence, recovery, Android and deployment checks in `docs/mvp/10-acceptance-checklist.md`, with fresh dated results.

## Commercial hypothesis and transparent unit economics

Offer one bounded ward/site subscription, plus a separately priced integration/onboarding statement of work. Include named staff access, an explicit task/turn allowance, training and defined support hours. Avoid charging per diagnosis, patient outcome or model message. Additional wards, integration adapters, stronger recovery requirements and 24/7 support need separate pricing. Prices below are experiments to validate, not observed Indian market tariffs.

All amounts are INR before applicable tax. A planning exchange rate of **₹90/USD** is an assumption, not a current FX quote. The model rates **$1 per million input tokens and $5 per million output tokens** are deliberately parameterized budgeting rates, **not a provider tariff or endorsement**. Neither a model name in this Codex session nor `GPT-6 Luna` in repository configuration proves public API availability, contractual eligibility or cost. Replace both rates with the selected provider's signed/current tariff and measured token usage before a quote.

One turn here means the complete billed model activity for one operational request, including tool-loop context, reasoning tokens where billed, and retries. If instrumentation counts only the final call, these estimates understate spend. No cached/batch discount is assumed.

`model cost = turns × ((input tokens × input rate + output tokens × output rate) / 1,000,000) × FX`

| Monthly per-site assumption | Low workload | Base workload | High workload |
| --- | ---: | ---: | ---: |
| Complete model turns | 1,000 | 3,000 | 10,000 |
| Billed input/output tokens per turn | 3,000 / 500 | 6,000 / 1,000 | 12,000 / 2,000 |
| Model cost at the stated parameters | ₹495 | ₹2,970 | ₹19,800 |
| Hosting/database/storage/backup/log budget | ₹6,000 | ₹10,000 | ₹22,000 |
| Direct support, assumed ₹1,000/hour | ₹6,000 (6 h) | ₹18,000 (18 h) | ₹40,000 (40 h) |
| Site governance/security-maintenance allocation | ₹3,000 | ₹6,000 | ₹15,000 |
| **Recurring delivery cost** | **₹15,495** | **₹36,970** | **₹96,800** |
| Proposed monthly subscription | ₹25,000 | ₹60,000 | ₹1,20,000 |
| **Contribution before central costs** | **₹9,505 (38.0%)** | **₹23,030 (38.4%)** | **₹23,200 (19.3%)** |
| Initial integration/training cost assumption | ₹60,000 | ₹1,20,000 | ₹2,40,000 |

Infrastructure/support/governance figures are budgets, not quotes or observed bills. They include ordinary retention and backup allowances but not a proven high-availability design. For an external tariff anchor, Supabase lists Pro at $25/month including $10 of compute credit for one Micro instance, and point-in-time recovery starts at $100/month; these alone convert to ₹2,250 and ₹9,000 at the assumed FX. Hence a ₹10,000 total infrastructure allowance can be insufficient once PITR, separate production/staging projects and other services are required. A low-cost plan is not hospital compliance certification. [Supabase pricing, retrieved 7 November 2026](https://supabase.com/pricing).

Azure API/worker/sidecar compute, Vercel commercial hosting, OCR or speech where enabled, vendor connector charges, retained source files, egress, observability, backups and notification transport must be priced from the actual deployment. The initial workflow excludes document extraction, speech and SMS from its included usage. If enabled, add measured pages/minutes/messages and current tariffs; do not hide them inside the model-turn estimate. If the hospital requires dedicated hosting, isolation or stronger contractual assurances, reprice before proceeding.

A base 90-day pilot costs approximately **₹2,30,910** (₹1,20,000 setup plus three months at ₹36,970). A proposed ₹1,20,000 setup fee plus ₹60,000/month would collect ₹3,00,000 and leave ₹69,090 before central product engineering, sales, legal setup, taxes and unforeseen vendor work. It is a price test, not a signed deal. A free pilot is an explicit research investment, not recurring revenue.

Do not assume scale makes this attractive automatically. At the base contribution, an assumed ₹9 lakh/month central operating budget needs **40 fully paying equivalent sites** to cover that budget (ceiling of ₹9,00,000 / ₹23,030), excluding acquisition and financing costs. Ten such sites produce ₹6 lakh monthly recurring revenue and ₹2.303 lakh contribution, not operating profit. High workload barely improves contribution at the proposed higher price: cap and meter workload, reduce unnecessary model calls, and renegotiate or decline expensive support promises. If model rates double, base monthly cost increases ₹2,970; if base support doubles, it increases ₹18,000. Integration and support efficiency matter more than a cheap token headline.

Customer value also needs measurement. A ₹60,000 monthly fee would require 120 genuinely redeployable staff-hours at an assumed ₹500/hour merely to match the fee through time alone. That is 4,000 tasks saving 1.8 minutes each, or 1,800 tasks saving four minutes each. These are break-even arithmetic, not expected savings; fewer clicks may not release usable staff capacity. Include staff approval/review/training time and compare against a simpler existing-HIS worklist improvement before attributing value to an agent.

## A 90-day pilot that can reject the hypothesis

**Days 1–14: governance and feasibility.** Name accountable clinical, nursing, lab, IT and privacy owners. Agree the exact specimen/order cohort, source event semantics and time zone, cancellation and transfer handling, downtime process and human escalation policy. Obtain the institution's assessment of whether this is service evaluation or research and any required ethics approval before patient-data collection. Establish the applicable processing basis, understandable notice/consent where required, purpose limits, retention/deletion, access requests, processor contracts and subprocessors. Have Indian legal/privacy counsel check the DPDP Act/Rules commencement provisions and obligations applicable on the actual pilot date; do not describe a prototype as DPDP compliant. The official MeitY Rules page was located, but its operative text was not readable in this research pass, so no clause-level legal conclusion is asserted. [MeitY official DPDP Rules 2025 page](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025).

Use a dedicated real-site environment, individual accounts, minimum necessary context and a reviewed model-provider data-use/retention contract. Keep direct identifiers out of prompts wherever feasible; pseudonymization does not make clinical data anonymous. Validate source matching, least privilege, tenant boundaries, audit exports, deletion, credential rotation, backups/restoration and manual fallback with synthetic adversarial cases first. No real records enter the public demo.

**Days 15–28: prospective baseline and shadow mode.** Observe routine work without changing care. Log all eligible collected specimens and matched accession events from source systems, plus independent staff time samples across day/night/weekend shifts. Keep a simultaneous comparable ward or workflow under usual care if feasible; select it before outcomes are inspected. Shadow proposals remain hidden from operational decisions. Check 100% of proposed completions during shadow mode against independent sources. Measure downtime and duplicate/late/reordered events, rather than removing them from the cohort.

**Days 29–70: controlled assisted operation.** Start only after predefined matching/authorization checks pass and staff can stop the system. Keep existing clinical escalation processes intact. The app proposes bounded administrative actions; humans approve. Stale or unavailable feeds show unknown and route to the manual fallback. Record exposure by ward/shift and all overrides. Prefer a pre-agreed staggered ward rollout with a concurrent comparison where staffing allows; otherwise explicitly label the design a single-site before/after feasibility study. Acknowledge seasonal volume, staffing and Hawthorne effects. Freeze template versions within measurement periods and record changes.

**Days 71–90: independent audit and purchase decision.** A reviewer who did not operate the tool audits source links, mismatches, false completions and missing receipts. Report counts and uncertainty, not only percentages. Obtain buyer, nursing, lab and IT sign-off separately. Estimate recurring support from actual tickets and labor, then offer continuation only if both evidence and economics pass. A 60-day version shortens assisted observation, not governance or baseline; it may only establish feasibility.

### Metrics, denominators and failure rules

- **Primary operational KPI:** median verified collection-to-laboratory-receipt lag for the pre-specified routine specimen cohort. Use source event time, retain ingestion time separately, require exact order/specimen linkage, and report baseline/comparison/intervention N, median and IQR. Completed-pair lag alone is biased when missing receipts increase.
- **Mandatory companion:** receipt recorded within a locally specified administrative observation window / all eligible collected specimens with the full window observable. The hospital defines this measurement window before the pilot; it is not a model-generated clinical deadline. Report right-censored cases separately, cancellations, rejected specimens, unknown timestamps and feed outages. Show all-cohort counts, not just app-engaged cases.
- **Burden:** observed total nurse + lab + clinician minutes per eligible specimen, including checking, approving, interruptions, duplicate entry, training and corrections; report shifts observed and missing observations. Distinguish active task time from elapsed lag.
- **Safety/quality balancing:** wrong-encounter proposals / all proposals; false verified completions / all purported completions; unsupported source citations / audited citations; duplicate actions / approved actions; stale-feed exposure time / monitored time; unowned tasks / all active tasks; manual overrides and missed handovers. Include usual-care incidents under the hospital's existing reporting process; do not infer causation.
- **Adoption and reliability:** weekly active eligible staff / rostered eligible staff; eligible tasks covered / all eligible tasks; successful connector syncs / scheduled syncs; latency percentiles and outage minutes. Staff satisfaction is descriptive, not clinical effectiveness.
- **Commercial:** full delivery cost/site, onboarding hours, vendor fees, support hours, actual paid renewal and payment collection. A letter of interest is not a paying renewal.

Proposed go/no-go thresholds must be signed before outcomes: zero unauthorized disclosures or automatic medical actions; zero unresolved false completions; at least 95% source-linkable eligible events; at least 90% of exposed tasks with a named owner; no material increase in combined staff burden; and a buyer-agreed operational improvement supported by the comparison and uncertainty. These are design targets, not measured results or proof of safety. Any wrong-patient disclosure, false completion capable of misleading care, or autonomous clinical action pauses assisted operation immediately for investigation. Never withhold necessary care to preserve a comparison. Small samples cannot exclude rare harms; commission a power/sample-size plan after baseline variance is known if the goal becomes an effectiveness claim.

## Diabetes operational skill roadmap

A skill is a versioned, bounded operational procedure with prerequisites, allowed reads/proposals, exact completion evidence, owner, expiry, negative tests and human publication approval. It is not a learned diagnosis or a medical protocol. Reuse transfers the template, never another encounter's facts or permissions.

| Order | Skill and useful diabetes context | Evidence and boundary |
| --- | --- | --- |
| 1: first pilot | Ordered specimen collected → laboratory receipt confirmed | Existing authorized order, specimen/accession IDs, collection and LIS receipt events. No selection of tests, urgency inference or interpretation of glucose. |
| 2: same ward after validation | Shift handover of outstanding ordered work | Source-backed encounter context, named next owner and independently recorded acknowledgement. Missing acknowledgement stays unknown; drafting is not sending. |
| 3: next controlled release | Result availability → assigned clinician acknowledgement | Source result exists and the human-selected clinician acknowledges it. No abnormality detection, risk ranking or treatment recommendation. Corrected results require a new explicit review trail. |
| 4: record/clinic adjacency | Prepare a reviewed diabetes visit packet | Approved HbA1c/glucose/ACR/eGFR and prescription records with original units, dates and sources. Do not infer adherence, treatment effects or missing measurements; independent reviewer publishes facts. |
| 5: separately governed outpatient extension | Track a clinician-configured follow-up or referral and receipt of a document | Explicit human-entered interval/order, permitted contact route and actual appointment/document evidence. No inferred eye/foot screening deadline, outreach without consent, or equation of a booked visit with attendance. |
| 6: discharge logistics | Confirm that an approved summary was handed over and education receipt recorded | Human-approved document version and acknowledgement. Receipt does not establish understanding, adherence or clinical readiness for discharge. |

DKA/HHS can remain fictional encounter contexts where documented by a source. Do not turn these into autonomous recognition, severity classification, insulin/fluid/electrolyte dosing, correction targets, triage, treatment timing or emergency dispatch. Human-set administrative task expiry is not a clinical due time. Manually recorded categories remain manual.

Useful later adjacencies are general-medicine specimen logistics, referral-document receipt and post-discharge document handover using the same evidence/acknowledgement machinery. Revalidate workflow ownership, identifiers, permissions, failure modes and support economics in each setting. Avoid simultaneous specialty expansion, patient acquisition and multiple connectors before the first workflow has a paid renewal and independent operational evidence.

## Decision

Fund one integration-ready hospital pilot, with ward nurses as the primary operators and the administrator as buyer. Keep the promise narrow: visible, source-confirmed administrative work with human control. The next decisive evidence is a working authorized connector, acceptable staff burden, independently audited completion accuracy and a paid continuation—not more synthetic personas or a prevalence-derived market size.

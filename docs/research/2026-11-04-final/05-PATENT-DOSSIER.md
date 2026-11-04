# Patent and IP dossier

**Status: strategy memo, not legal advice. Attorney review required before filing.**

This dossier exists because the brief asks for a defensible, patent-worthy core. It answers three questions: what is genuinely new, what has already been disclosed, and what should be filed, when, and in whose name.

The honest framing first: **a patent does not win a hackathon.** The finale is won by a working artefact, a measured result, and a story two doctors recognise. The patent matters after the finale — in a pilot contract, a diligence conversation, or a defence against an incumbent that copies the workflow. It is a 12-month asset, not a 7-day one.

---

## 1. The disclosure problem (read this first)

The repository `github.com/wysh3/glucoflow` is publicly readable as of 4 November 2026 (the raw README returns HTTP 200 without authentication). The hosted demo is public. The public verifier is public.

India follows **absolute novelty**: an invention loses novelty if it is publicly disclosed before the priority date, with only narrow exceptions (e.g., disclosure at a government-recognised exhibition, or by a person other than the inventor without consent). A hackathon demo is not a recognised exhibition. A public GitHub repository is a publication.

**Consequences:**

1. Anything already in the public repository is probably **not patentable now**. That includes the result state machine, the hash-chained event log, the public verifier, the CSV register export, and the role model.
2. The claims that remain patentable are the mechanisms **not yet implemented and not yet published**: household-aware identity resolution, closure-risk-calibrated abstention, deadline-aware escalation scheduling, and role-separated closure attribution with clock suspension.
3. **Any further public disclosure of those mechanisms before filing destroys them.** That includes a public repo commit, a demo video, a slide deck posted publicly, and a conference talk.
4. The first public disclosure date should be recorded (repository creation and first push) because it bounds what can be claimed.

**Actions, in order:**

| When | Action |
|---|---|
| Before 20 November 2026 | File an Indian provisional application covering the four undislosed mechanisms. A provisional secures the priority date for 12 months at low cost |
| Immediately | Move the new mechanism work to a private branch or a private repository until the provisional is filed |
| Before any public demo of the new mechanisms | Confirm the filing date, or demo only the already-disclosed receipt flow |
| Within 12 months | File a complete specification and a PCT application; claim priority |
| Before a pilot contract | Record the chain of title: inventor assignment from every contributor, including the doctor partner |

Indicative cost in India: official fee for a provisional is small (a few thousand rupees for an individual or startup; check the current First Schedule), attorney drafting ₹25,000–60,000. A complete specification and PCT add ₹1.5–4 lakh. This is cheap relative to the value of the option.

---

## 2. What is genuinely new

Four mechanisms survive the disclosure and the prior-art scan. Each is a *method* with a technical effect, not a business rule.

### 2.1 Household-aware identity resolution with harm-calibrated abstention

**Problem.** In India a phone number is often shared by a household. Standard record linkage treats a phone match as strong evidence of identity. In a household of five, a phone match is weak, and a wrong-patient closure is catastrophic. Existing linkage tools (Fellegi–Sunter and its descendants) assume independent identifiers held by one person.

**Mechanism.**

1. Build a phone-to-patient graph from the clinic's own records. For each phone *p*, estimate the number of distinct persons *k(p)* who have used it, using a Dirichlet-multinomial or a simple empirical distribution with shrinkage.
2. Discount the phone's agreement weight: replace the standard *m/u* likelihood ratio with a mixture likelihood
   `L_phone(agree) = (1/k)·m_phone + (1 − 1/k)·u_phone`,
   so that a shared phone contributes less evidence than a private one.
3. Compute the posterior match probability from a Fellegi–Sunter model over name (Indic phonetic key), year of birth, sex, address tokens and the discounted phone.
4. **Abstain** when the posterior lies in an indifference region whose width is derived from the downstream cost of a wrong closure, not from a generic confidence threshold. The region is chosen so that the expected harm of an automatic decision exceeds the cost of a 30-second human review.
5. Order the review queue by expected information gain (the field whose verification would most reduce the posterior entropy).

**Novelty.** The household-discount term and the harm-calibrated abstention region are not in the standard linkage literature. The combination is specific to shared-identifier settings and to a downstream obligation risk.

**Prior art to distinguish.** Fellegi & Sunter (1969); probabilistic record linkage in DHIS2/OpenMRS; Meta's entity resolution; privacy-preserving record linkage (Bloom filters). None discounts a shared identifier by an estimated household size, and none calibrates abstention to a clinical closure cost.

### 2.2 Deadline-aware, capacity-constrained escalation

**Problem.** A clinic has one nurse and 40 open obligations. Which call first? Existing systems use FIFO, earliest-deadline-first, or a static criticality sort. None accounts for the fact that patients differ in how likely they are to answer, and that a missed call changes the state of the obligation.

**Mechanism.**

1. Model each obligation as a restless arm with state (attempts made, time-to-deadline) and a learned hazard of response per attempt, channel, language and hour.
2. Estimate hazards from censored data with a hierarchical survival model (partial pooling across obligation classes) so a new clinic inherits a prior and refines it.
3. Compute a Whittle index for each arm under a deadline. For the two-state case the index has a closed form: with *T* slots remaining and per-play success probability *p*,
   `λ(T) = p·(1 − V(T−1))`, with `V(0) = 0`,
   which is decreasing in *T* — i.e. the index rises as the deadline approaches, which is the correct urgency ordering.
4. For the multi-attempt case, compute the index numerically by dynamic programming over (attempts, slots remaining).
5. Allocate the scarce contact capacity to the top-*C* indices each epoch, and re-plan when an attempt resolves.

**Novelty.** Whittle indices are known. Deadline-aware indices are known in queueing and scheduling. The specific application — a clinical obligation with a guideline clock, a heterogeneous response hazard learned from censored outreach data, and a scarce human caller — is new, and it produces a measurable gain over EDF exactly when hazards are heterogeneous, which is the Indian reality.

**Prior art to distinguish.** Whittle (1988); Weber & Weiss (1990) on indexability; Liu & Zhao (2010) on RMAB; deadline scheduling in real-time systems; call-centre dialer patents. Dialers optimise agent idle time, not obligation closure under a clinical clock.

### 2.3 Role-separated closure with clock suspension

**Problem.** The doctor will not do 14 fields per critical result. If the audit requires the doctor to be the data-entry clerk, the doctor routes around the system (the sister logs in as her), and the audit becomes fiction. If the clock starts when the report lands, the doctor is marked overdue while in theatre — the system becomes a noose, not a shield.

**Mechanism.**

1. Split the closure into **custody**, **clinical review** and **patient communication**, each with a distinct accountable role.
2. The clock is **attribution-aware**: it runs against the role that currently holds custody. It suspends when custody has not yet been accepted, and it pauses outside a role's declared availability window.
3. The doctor's interaction is a single confirmation bound to the extracted source span; the system prefills and the doctor confirms or corrects.
4. Every transition records the actor, role, timestamp, source span hash and the previous event hash.
5. The escalation policy (2.2) operates on custody, not on a person, so a shift change does not orphan an obligation.

**Novelty.** This is a workflow/data-processing method. It is weaker under Section 3(k) than 2.1 and 2.2 and should be claimed as a technical method for maintaining audit integrity under role handover, with the clock-suspension mechanism producing a verifiable state, not as a business rule.

**Prior art to distinguish.** Clinical workflow engines (BPMN), HL7 FHIR Task/Provenance, EHR "result inbox" implementations, hospital shift-handover systems. None suspend a compliance clock on custody handover with a verifiable state.

### 2.4 Privacy-preserving obligation receipt

**Problem.** A receipt that reveals the result is a privacy breach. A receipt that reveals nothing is unverifiable. The clinic, the lab, the patient and an auditor need different views of the same proof.

**Mechanism.**

1. A per-obligation hash chain over canonical event payloads, with the head anchored to an external timestamp (RFC 3161 TSA or a transparency log).
2. A **capability receipt**: a short code that grants a verifier the ability to check *that* a closure occurred, the role that closed it, and the time — without disclosing the analyte, the value or the patient identity.
3. A **zero-knowledge predicate** (optional, later): the verifier learns "the critical flag was acknowledged by a clinician within 15 minutes" and nothing else. A zk-SNARK over the event chain is the long-term version; a signed redacted projection is the MVP version.
4. Selective disclosure: the patient's slip shows the value; the lab's copy shows the chain head; the auditor's copy shows the register line.

**Novelty.** Hash-chained audit logs are well known. The specific construction — a capability receipt over a clinical obligation with selective disclosure and an external anchor — is a narrower claim, and it is the one most likely to be found in prior art (blockchain audit trails in healthcare). Treat it as the weakest of the four and file it as a dependent claim.

---

## 3. Section 3(k): how to avoid "computer programme per se"

Section 3(k) of the Indian Patents Act excludes "a mathematical method or a business method or a computer programme per se". The CRI Guidelines and the *Ferid Allani* line of cases allow a software claim if it shows a **technical effect** on a technical problem, or a combination with hardware.

The strongest technical-effect arguments for this portfolio:

| Mechanism | Technical effect | Why it is not a business method |
|---|---|---|
| 2.1 Identity + abstention | Reduces wrong-record binding in a data-processing pipeline; produces a calibrated rejection region | It is a data-quality method with a measurable error rate, not a pricing or trading rule |
| 2.2 Escalation | Allocates a scarce physical resource (human caller minutes) under deadlines; reduces missed deadlines per unit of capacity | It is a scheduling/control method for a physical resource, analogous to accepted scheduling patents |
| 2.3 Role-separated closure | Maintains a verifiable state across a handover; prevents clock corruption | It is a state-machine integrity method |
| 2.4 Receipt | Detects tampering; enables verification without disclosure | It is a security method with a technical effect |

The specification should include a hardware embodiment: an on-premise appliance (for government facilities), an HSM or TSA for anchoring, and a gateway for messaging. A hardware element materially improves the 3(k) position.

**What not to claim:** diagnosis, treatment selection, risk scoring, triage, or "improving clinical outcomes". Those claims invite both a 3(k) problem and a CDSCO device classification.

---

## 4. Draft claim set (for attorney refinement)

**Independent claim 1 (identity).**
A computer-implemented method for binding a clinical document to a patient record, comprising: constructing a graph of shared identifiers from a facility's records; estimating, for each shared identifier, a number of distinct persons associated with it; computing a match likelihood in which the evidential weight of the shared identifier is reduced as a function of the estimated number of persons; computing a posterior match probability; determining an abstention region whose width is derived from a cost of an incorrect downstream clinical action; and routing a document to automatic binding or to a human review queue according to the posterior and the abstention region.

**Independent claim 2 (escalation).**
A computer-implemented method for allocating a scarce contact resource across a plurality of clinical obligations, comprising: associating each obligation with a deadline and an accountable role; estimating a response hazard for each obligation from censored contact outcomes; computing, for each obligation, an index that depends on a number of attempts made and a time remaining to the deadline; and allocating contact capacity to obligations in order of the index, wherein the index is computed by dynamic programming over a state of attempts and remaining time.

**Independent claim 3 (closure state).**
A computer-implemented method for maintaining a verifiable closure state of a clinical obligation across role handovers, comprising: partitioning the obligation into a custody state, a clinical-review state and a patient-communication state; suspending a compliance clock when custody is unaccepted or outside a declared availability window; recording each transition with an actor, role, source-span hash and previous-event hash; and generating a receipt whose validity is checkable without disclosing the clinical value.

**Dependent claims.** The Indic phonetic key; the Dirichlet-multinomial household estimate; the closed-form two-state index; the hierarchical hazard model; the RFC 3161 anchor; the capability receipt; the zero-knowledge predicate; the on-premise appliance.

---

## 5. Freedom to operate

| Area | Risk | Mitigation |
|---|---|---|
| Record linkage | Fellegi–Sunter is public domain; commercial tools (IBM InfoSphere, SAS) patent specific implementations | The household-discount mechanism is distinct; avoid copying a vendor's scoring pipeline |
| Restless bandits | Academic literature is open; some telecom/ad-tech patents claim index policies | Claim the deadline-aware clinical application, not the index per se |
| Hash-chained audit | Dense patent landscape (IBM, Guardtime, medical audit startups) | Narrow to the capability receipt and the clinical obligation; expect a crowded-art rejection and narrow the claim |
| Conformal prediction | Open academic literature; no known blocking patents | Use as a method step, not as the sole claim |
| Messaging | WhatsApp Business API terms, not patents | Comply with Meta's policy; do not build on unofficial gateways |

A professional prior-art search (₹40,000–80,000) should precede the complete specification. Do not spend it before the provisional; the provisional is cheap and buys 12 months.

---

## 6. What the patent is worth, honestly

A patent portfolio of this shape is worth something in three situations:

1. **A lab or hospital pilot contract** where the buyer asks "what stops Eka from copying this?" A pending application is a better answer than "our speed".
2. **A diligence conversation** where the technical claim needs to be more than a wrapper.
3. **A defence** if an incumbent copies the receipt format after the standard starts to matter.

It is worth nothing at the finale. The finale is won by the measured replay, the one-tap closure, and the abstention moment. Do not let the patent work consume the three weeks that should go into the pilot evidence.

**Recommendation:** file the provisional in the week of 10–14 November, after the final submission and before the finale, covering 2.1–2.4. Spend no more than three days on it. Then return to the product.

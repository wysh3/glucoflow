# The Zero-to-One judge — scorecard

## Stance (one line)

Four of these five theses are software; one is a receipt. Only the receipt can become a monopoly, and the team is currently pitching it as a compliance form.

## Scores

| Thesis | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | TOTAL |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 Closure Ledger | 13 | 9 | 9 | 10 | 8 | 13 | 7 | 5 | 3 | **77** |
| T2 90-Day Recheck | 14 | 7 | 6 | 4 | 6 | 14 | 9 | 4 | 4 | **68** |
| T3 Annual Review Pack | 11 | 9 | 7 | 6 | 5 | 11 | 8 | 5 | 2 | **64** |
| T4 Bag Reconciliation | 9 | 7 | 6 | 4 | 7 | 7 | 8 | 3 | 3 | **54** |
| T5 Identity Firewall | 11 | 9 | 6 | 8 | 9 | 5 | 7 | 4 | 1 | **60** |

Dimensions: 1 problem reality/frequency, 2 failure cost, 3 buyer/WTP, 4 defensibility, 5 technical depth/honest AI, 6 programme fit, 7 India scale, 8 regulatory safety, 9 demo/narrative.

A note on my own instrument: the rubric *rewards T2 and the rubric is wrong*. T2 scores 68 because dimensions 1, 6 and 7 carry 40 points and T2 is excellent at being a problem, a programme fit and a rural channel. It is worthless at being a company (dimension 4 = 4). Anyone who reads this table as a ranking of businesses should read column 4 and column 3 instead.

## Why the winner wins (top 3 reasons, evidence-backed)

**1. T1 is the only thesis whose unit has a legal counterparty, not just a felt pain.** NABH requires a critical-result intimation record and a read-back to confirm understanding (pack #10, Grade B); NABL 112 sets accreditation criteria for labs (#11); a consumer commission ordered ₹20 lakh against a path lab for a "technical glitch" and confirmed the patient is a consumer (#17). You are not selling convenience. You are selling a defence that already has a statute, an accreditation clause and a precedent. Every other thesis sells an improvement.

**2. T1 is the only thesis where the 10x is categorical rather than incremental.** Today a clinic cannot *enumerate* its unclosed obligations — the failure is invisible by construction, which is why 6.8%–62% of abnormal results go unfollowed (#5) and why outpatient notification is the named weak point in an Indian tertiary hospital (#4). Zero-to-one on enumeration beats four-hours-to-one-hour on speed. T2's improvement is real but bounded by a baseline that already exists.

**3. T1 is the only thesis with a structural reason an incumbent cannot copy it.** A receipt is worth nothing unless the *other* side accepts it. Eka, HealthPlix, Practo and every lab LIS are **parties to the transaction** — a lab will not accept an attestation issued by a competing clinic's EMR, and a clinic will not accept one issued by a lab. Their distribution is their disqualification. That is a real secret, and it is the only one on this list.

## Fatal flaw of each thesis (one line each)

- **T1:** It sells a receipt to the party that carries the liability but hands the artefact to the party that feels no pain, so as built it is a NABH register — a commodity compliance form — while the only monopoly asset, a *neutral accepted attestation*, is currently a demo page at `/verify/<code>`.
- **T2:** It is a CRM with better segmentation sold into a category whose price floor is zero (Clinizy ₹1,499 bundles recall; Yuktii gives it free; Eka bundles reminders), so there is no price to defend and no screen an incumbent cannot add in a sprint.
- **T3:** It requires every provider to stamp before any provider gets value — a network that must be seeded on all sides simultaneously, which a five-person team cannot do and a district can only mandate.
- **T4:** The product *is* extraction, extraction is the fastest-falling cost in software, and the team's own numbers (precision 0.875, recall 0.56, complete-field 0.24 on an unfamiliar layout) mean one bad OCR moment in a seven-minute demo ends the company.
- **T5:** It is the best technology and the worst company — an invisible, doctor-less, integration-gated infrastructure sale with a 12-month cycle, judged by two doctors in seven minutes.

## What would make the winner 95+

Not more features. Six refusals and one betrayal:

1. **Change the buyer from the clinic to the lab chain.** One signature covers 200 referring clinics. The lab already eats the ₹20 lakh (#17); the clinic merely risks it.
2. **Price per attested closure, not per seat.** Per-seat puts you in the ₹5,000 software budget. Per-closure puts you in the ₹20 lakh liability budget. That ratio is a defensible 10x; a seat price is not.
3. **Get one LIS to print your QR on its reports.** This is the highest-leverage technical act available to this company and it is not in the build plan. One integration converts you from a vendor into a default.
4. **Publish the receipt schema under CC0 and give the verifier away forever.** Counterintuitive and correct: whoever owns the *format* gets nationalised by NABH; whoever is the first *certified issuer* gets the franchise.
5. **Sell the past before the future.** Reconstruct twelve months of a hospital's paper reports and show the 37 results nobody can prove were seen. That is the 40-second moment, and no competitor can manufacture history.
6. **Delete the dashboard.** Dashboards are where accountability products go to die; the receipt is the product and the register export is the trojan horse.

## The one question I would ask at the finale

*"If NABH mandated this register next quarter and published the schema, what is left of your company?"*

## Verdict (one sentence)

T1 is the only fundable company here — a genuine, legally-backed secret about who pays for proof — but it currently pitches the commodity (a register) instead of the monopoly (a neutral attestation), and it will stay a ₹5,000-a-month compliance tool until it sells the receipt to the lab, not the doctor.

## Confidence and what I could not verify

- **High confidence** in the structural argument (dimension 4) and the regulatory facts; they come from the pack's Grade A/B entries (#10, #11, #13, #17).
- **Low confidence** in all willingness-to-pay claims, including my own. There is no buyer interview, no pilot, no purchase order and no renewal in this asset (pack §3). Every price I reason from — ₹5,000–50,000/site/month, ₹2–10/report — is the team's estimate or mine, not a measurement.
- **Could not verify:** the pack's central competitive claim that no one owns the cross-source clinic-side proof (§4.2). That is a scan of public surfaces on 4 November 2026; CliniKite already sells "order → sample → report → reviewed → shared status" at ₹2,499 and Lifemaan claims 576 hospitals with referral tracking. I cannot see either backlog, and either could ship the acknowledgement step in one quarter. I also could not verify the extraction figures (team's own audit) or the claim that acknowledgement will not be rubber-stamped — that risk is unaddressed by any artefact I have seen.
- **Market arithmetic:** the ₹24 crore beachhead and ₹144 crore accredited-facility estimates are my own arithmetic from pack inputs (#15) and are `unverified`.

---

# Appendix: the eight questions, in order

## 1. What is the secret?

**Nobody in Indian healthcare is paid to close a loop.** The lab is paid per test, the doctor per visit, the hospital per bed-day, the pharmacy per script, the ambulance per trip. Every rupee in the system is earned by *opening* an obligation and none by *discharging* one. That is why an obvious, cheap, legally mandated problem — proving a named clinician saw an abnormal result and told a specific patient — has survived thirty years and 100 crore linked health records (#20). The missing asset was never the record. It is the receipt. And because a receipt is worth nothing unless the counterparty accepts it, the winner is not the best workflow tool; it is the neutral issuer both sides accept.

The contrarian part most Indian healthcare operators would reject: *the doctor is not the customer and never will be.* A fee-for-service sole proprietor gains probabilistically from a returning patient and pays certainly for the system that brings them back. The party that pays is the party that carries the liability — and in India that party now exists, in writing, in NABH's read-back clause and in a ₹20 lakh judgment.

## 2. The narrow market

**The NABH critical-and-abnormal result closure market in roughly 800 accredited private hospitals across two states, one obligation type (the external lab report), one buyer (the quality office), priced per attested closure.**

Small enough: ~4,000 fully NABH-accredited facilities exist in a country of ~80,000 hospitals (#15). A single metro has on the order of 60 accredited hospitals — a market one team can physically visit, and where a 40% share is a *dominance* claim rather than a rounding error. One lab partner, one language pair, one escalation playbook covers the whole beachhead. `unverified: the per-city count is my estimate.`

Large enough: 800 sites × ₹25,000/month ≈ ₹24 crore/year at the beachhead; the full accredited segment at ₹30,000 ≈ ₹144 crore/year (≈US$17M). That is a real company, not a TAM slide. It becomes venture-scale only when the *same receipt* is sold to a second payer — the lab — without a second sale. `estimate: my arithmetic from pack inputs #15.`

Why incumbents will not follow you in: the price point is too high for Clinizy's ₹1,499 buyer, the buyer is not a doctor so HealthPlix and Eka have no one to sell to, and the artefact is an attestation no lab LIS is structurally able to issue about itself.

## 3. The 10x

**Axis: certainty.** And it is real — but only for one customer.

For the quality head, the movement is from *no system whatsoever* to *every obligation provable in seconds*. That is not 10x, it is zero-to-one, which is the only kind of 10x that cannot be competed away by a faster follower. For the doctor, the same product is incremental: it saves a WhatsApp message. Be honest about this asymmetry — it is the whole reason T1 keeps getting marked down by doctor judges.

Secondary axis: **access**, in the sense of accounted-for patients. If 6.8%–62% of abnormal results are unfollowed (#5), the clinic's *effective reach* over its own obligations is a fraction of its nominal reach. A ledger with a named human on every unclosed item moves reach toward 100%. That is a genuine reach 10x, and it is the bridge to T2 and T3 as later modules.

**Cost: false.** Inference is deflating faster than any curve you can build. **Speed: incremental.** Four hours to one hour is good operations, not a secret.

## 4. Where the moat is — and which part is weak

Ranked, honestly:

1. **Brand-as-accepted-authority — strongest, and the only one that compounds.** A receipt is a coordination artefact. Once a lab chain and its referring clinics both accept your stamp, you are the arbiter of "was the patient told" — the shape of a credit bureau or a notary, not a SaaS vendor. This strengthens with adoption instead of being copied by it.
2. **The receipt archive as a compounding dataset — real, and under-claimed by the team.** EMRs store the *clinical act*. Nobody stores the *communication act*: channel, language, attempt count, time-to-acknowledge, which phone number failed. After three years and five million receipts you can answer "what is the probability a patient in this district, on this channel, in this language, is reachable in three attempts" — and that answer is not purchasable anywhere.
3. **Network effects — real but latent.** Lab side, clinic side, patient verifier. At one customer there are zero. You must manufacture the first side by hand, which is a service business wearing a product's clothes for the first year.
4. **Proprietary technology — moderate and decaying.** Hash-chained receipts are ~200 lines of code. Cross-lab normalisation is real today and an LLM approximation in eighteen months. Calibrated abstention is a skill, not an asset.
5. **Economies of scale — weak. Do not claim it.** Per-report marginal cost falls for everyone; your curve is not special.

**The honest weakness:** at 100 customers, none of 1–3 exist. The moat is a *plan*, not an asset. A hash chain only you verify is theatre — it becomes a moat the day a third party refuses to close a file without it.

## 5. Sequencing

**Build first.** The receipt, for exactly one obligation type (external lab result), in exactly one accredited hospital, arriving by paper and WhatsApp only. No EMR integration, no lab feed, no ABDM, no HL7. Then the public verifier — not as a feature but as the standard-setting act, given away free forever. Then the register export in the exact NABH/NABL shape: that artefact is why the quality head signs, even though it is not the product.

**Refuse to build.** Any computed "abnormal" flag (use the lab's flag; the day you compute it, CDSCO owns you, #13). Any clinical interpretation or risk score. Any EMR or record UI beyond opening the source document. Any patient app. Any dashboard. Outbound WhatsApp as a *product* rather than a channel. Anything that saves the doctor time — that is T4, a different company with a different buyer and a lethal demo.

**Build only after the first monopoly is real** — defined as ≥40% of one city's accredited hospitals using you *and* one lab chain printing your QR:

- **The second payer.** Sell the same receipt to the lab. One asset, two payers, zero duplication. This is the move that turns a tool into a network.
- **T2 and T3, as modules.** This is the panel's real question answered: T2 and T3 are not competing theses, they are the ledger's second and third obligation types (recheck due, annual bundle). Build them only when the receipt is trusted enough that a clinic will let you add an obligation.
- **The payer.** Insurers and TPAs as the third buyer of the same receipt, because their entire problem is "did the member actually receive the care we paid for."
- **Never:** the platform. "Platform" is what you call a product with no monopoly.

## 6. Which incumbent kills the winner in 18 months

Two product killers and one standard killer.

**CliniKite** already sells "order → sample → report → reviewed → shared status" at ₹2,499/month to the same buyer. It is one module — read-back and a receipt — from owning T1's clinic segment, and it has the price and the distribution. **Lifemaan** (576+ hospitals claimed) owns the hospital buyer and already tracks referrals; if it ships a NABH-shaped export it kills T1 where T1 wants to live. Eka and HealthPlix can commoditise the *feature* at zero price but can never become the notary.

The real killer, though, is not a company: **NABH or ABDM publishing a mandated digital critical-alert register schema.** That nationalises the format in one circular and hands it to every HIS vendor. Any moat built on "we invented a standard" dies the day the standard becomes free.

**Is that acceptable?** Yes — and it should change the pitch rather than the product. A mandated format with a *certified issuer* is precisely how notaries, e-sign and UPI were created: the state commoditises the format and franchises the attestation. So the correct response is not to defend the schema but to be the first certified issuer and to publish the schema yourself before anyone mandates it. It is acceptable only if you were never selling the format. If you were, it is fatal — and today's pitch is closer to the fatal version.

## 7. The last-mover advantage

**Everyone else can build the ledger. Nobody else can have been there.**

The winner's last move is not a feature; it is a position. When a lab's LIS prints your QR on the report and a hospital's NABH file cites your register as evidence, copying you means copying *citations* — and citations are social, not technical. You become a dependency rather than a vendor.

The unreplicable input is time. In 2028 a funded competitor can have your software in a quarter and your 2026–2027 receipts never. That gives the last mover a permanent forensic capability: for any past date, which results were seen and which were not. Nobody can backfill that, because it was never recorded anywhere.

And the final act of a last mover is a refusal: **stop expanding.** Own obligation closure so completely in one geography that entering the market means paying you. The winner's last product is sameness — the same receipt, accepted by everyone, sold to both sides, unchanging. That is the opposite of the roadmap instinct, and it is the whole game.

## 8. Which is a secret, which is consensus in a new shirt

- **T1 is half a secret wrapped in a commodity.** The secret is neutrality plus the two-sided receipt plus "the liability holder pays." The commodity is the NABH register export, which is a well-understood accreditation-document category with dozens of vendors. The team has not yet separated them, and the pitch currently leads with the commodity.
- **T2 is consensus in a new shirt.** "Reachability audit" is the shirt; a reminder app with a barrier taxonomy is the body. Five Indian vendors ship the body and one gives it away free.
- **T4 is consensus in a trench coat.** "AI reads the bag" is the single most commoditised AI task of 2026 and will be a Sarvam API call in 2027.
- **T3 is a public-health programme wearing a startup's shirt** — a genuinely novel framing (the patient-owned annual pack) that a government should fund, not a five-person team.
- **T5 is a secret that nobody wants to buy, and a category error as a thesis.** The household-phone graph and calibrated abstention are real technical secrets with real monopoly potential. But T5 has no buyer proximity, no demo and no doctor in the room. Its correct fate is not to be a company: **T5 is T1's matching engine.** Judging it as a standalone thesis is asking the wrong question, and the team's error is offering it as one.

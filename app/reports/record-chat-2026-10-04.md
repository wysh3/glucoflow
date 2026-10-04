# Gluco record companion verification — 4 October 2026

The animated guide now supports patient-scoped factual conversations with GPT‑6 Luna retrieval planning, follow-up questions, exact record dates/values, original source buttons, reported-note/home-entry context, and navigation help. The orb expresses idle/listening/thinking/replying/request-error states; reduced motion disables animation. Completed replies open at their beginning and sent questions appear immediately. Clinical interpretation, diagnosis and treatment advice remain excluded.

## Measured verification

| Check | Result |
| --- | --- |
| Node and web TypeScript checks | Passed |
| Vitest full suite | 180 passed, 29 files |
| SQL isolation and constraints | 12 passed |
| Full browser regression | 88 passed across desktop 1440×900 and mobile 390×844 |
| Final focused chat pass | 8 passed after the evidence/visibility/scroll refinements |
| Client/API/worker production builds | Passed; frontend retains the existing large-chunk warning |
| API container health | Ready; database reachable |
| Hosted doctor and patient conversations | Verified through the browser with synthetic records |
| Android release | Signed APK built; v2 signature verified; privileged credential scan passed |

The new server tests cover authentication, cross-patient and cross-clinic denial, reviewer-only denial, deactivated accounts, publication before visibility, separately labelled reported notes, bounded history, follow-up selection, missing/partial dates, same-day ambiguity, explicit year filters, value-specific evidence, malicious provider output, shared call budgets, timeout fallback and medical-request refusal. Browser checks cover context identity/reset, clear chat, keyboard composition, reduced motion, thinking/error/retry, pending-question visibility, readable reply position, source opening and viewport containment.

## Hosted observations

The synthetic clinician asked “What is the latest HbA1c?” and received the two approved entries dated 2026-10-03: 7.8% and 6.73%, with same-day ordering explicitly unestablished. “And the previous one?” returned 7.1% dated 2026-09-30. Original-source access was verified, including refresh of the intentionally expiring source link. The final source selector prefers the fact/value evidence: the 7.8% result opened the matching report with “HbA1c 7.8%” quoted.

The synthetic patient’s mobile chat identified “Your records · P0482” and answered “What dose is documented in my prescription?” with the approved documented prescription history. It explicitly distinguished recorded instructions from confirmed current use or recommended doses. The live answers displayed the GPT‑6 Luna mode label; unavailable/unused model paths are labelled local. Stored patient identity, record values, evidence quotes and note bodies are not sent to the provider. Questions and six prior questions, which may contain anything typed by the user, are sent in live mode.

## Deployment and APK identity

- Web: https://glucoflow.vercel.app
- API image: `glucoflowwysh2026.azurecr.io/glucoflow-api:20261004-chat4`
- API ready revision: `glucoflow-service--0000005`
- Image digest: `sha256:216c46e34df84dc9eef1f07d32a50e9bb203b864d2876e0a09edce642991dc69`
- API/worker migrations unchanged; the document worker was not redeployed for this chat update.
- APK SHA-256: `5d3b85720395b8ccda5794e67889ee802d2c719bec1e238f311ff4a309e8fcf6`
- APK package: current shared hosted client, bundled for release; v2 signature verified.
- Release: [Expressive record companion](https://github.com/wysh3/glucoflow/releases/tag/demo-2026-10-04-chat).

The frontend and decompressed APK were scanned for the privileged database password, storage service key and model credentials; none were found. Public Supabase configuration and labelled synthetic demo accounts remain intentionally available. No provider secrets or signing keys were added to Git.

## Visual evidence

- [Doctor desktop](evidence/record-chat-2026-10-04/doctor-desktop.png)
- [Patient mobile](evidence/record-chat-2026-10-04/patient-mobile.png)
- [Original source from chat](evidence/record-chat-2026-10-04/chat-source.png)

## Review and limits

Implementation and final review were performed directly in the shared workspace, respecting the user's no-delegation preference. Existing navigation API compatibility, role/tenant boundaries, source evidence and human approval were preserved. Unrelated untracked submission decks were left untouched.

Record chat is a bounded retrieval assistant, not unrestricted medical conversation. It reads up to 2,000 current rows per timeline family and 100 home entries, displays at most eight cards and discloses truncation. It does not interpret raw documents or unpublished drafts, execute writes, decide clinical care or treat illustrative Master charts as patient records. Provider limits remain per process (single replica); a shared limiter is required before scaling. Provider retention depends on the configured service despite `store:false`. Chat is session-only and clears when patient/account context changes.

Physical Android phone installation, camera/back-button/keyboard behavior and clinical accuracy have not been newly verified. Browser viewport checks and a signed APK are not physical-device evidence. This report does not claim independent clinical validation.

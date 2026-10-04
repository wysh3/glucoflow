# Gluco contextual conversation

The user explicitly requests a chatty, expressive, patient-aware orb, and previously delegated implementation details, cleanup and publication. Execute directly; the earlier navigation-only data restriction is superseded by this request. Preserve the product's clinical boundaries.

## Experience

Gluco has idle/blink, listening, thinking, replying and error expressions, respecting reduced motion. A persistent patient-context badge and clear-chat control accompany a mobile-safe multiline composer. Replies show exact recorded values, dates and source buttons. Follow-up chips adapt to the reply. Session history resets on patient/account changes and never enters persistent browser storage.

Doctors can ask about the selected patient's approved measurements, recorded prescriptions/examinations, current patient notes and home entries. Patients can ask about their own records. No automatic patient choice for clinic users: open a patient first. On other screens the guide provides navigation help. No diagnosis, interpretation, treatment advice, dose selection, risk scoring or writes.

## Architecture

New authenticated /api/v1/guide/chat accepts a patient UUID, question, and up to six prior questions (600 characters each). Server checks current actor access and PostgreSQL RLS every turn, obtains retained approved facts/current notes and bounded home entries. Reviewer-only actors cannot use approved-record chat. Never include hard-coded illustrative Master scenario measurements as patient records.

GPT-6 Luna chooses a strict structured retrieval plan using the available test catalog and prior questions, not medical prose. Server renders factual conversational answers and source cards exclusively from authorized records. Provider sees bounded questions and test names, not patient identity, values, source quotes, notes or home entries. Unrecognized plans, clinical instructions, provider failure or exhausted limits fall back to labelled local retrieval. No model-generated links, clinical claims or source IDs can reach the UI.

Scope is bounded to 2,000 rows per record family and 100 latest home entries; disclose truncation. Display at most eight cards, latest versus previous is by recorded date, preserve undated entries and date precision. A prescription is documented history, not confirmation of current medication. Missing records do not mean a test was not performed. Sources use existing authenticated source APIs.

## Review focus

Cross-tenant and inactive sessions, reviewer-only access, clinical requests mixed with factual questions, malicious model output, follow-up scope switching, source evidence, unknown/partial dates and coverage, mobile keyboard and reduced motion.

## Acceptance mapping

R01/R03: shared responsive chat and motion accessibility. R02/R19: actor-scoped access and no persisted chat. R08/R10/R11: approved-only facts, separately labelled reported notes, factual missing language. R14/R15: bounded provider calls, honest fallback/error/retry. R16/R17: rebuild signed APK, verify deployed synthetic conversations; physical-device testing remains separately pending.

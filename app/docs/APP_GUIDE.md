# Gluco record companion

Gluco helps navigate the app and have follow-up conversations about authorized records. Open a patient as a doctor, or sign in as a patient for your own context. The header identifies whose records are in scope. Try:

- “Summarize the records.”
- “What is the latest HbA1c?” → “And the previous one?” → “Show the source for that result.”
- “Show HbA1c history in 2025.”
- “What dose is documented in the prescription?”
- “What notes were reported?” or “Show home readings.”

The assistant retrieves facts; it does not diagnose, interpret normality or improvement, predict risk, suggest treatment or choose/change doses. Documented prescriptions are historical instructions, not confirmation of current use. Patient-reported notes/readings are labelled separately from approved report facts. Missing data does not mean a test was not performed. Undated/partial-date results are not called latest; same-day results do not receive an invented chronological order. Notes without an event date retain the complete UTC submission timestamp, instead of presenting a timezone-dependent date as an event date.

## Authorization and grounding

Authenticated `POST /api/v1/guide/chat` accepts a patient UUID, a question of at most 600 characters, screen and up to six prior questions of at most 600 characters. The API rechecks active actor context, patient/clinic access and PostgreSQL RLS each turn. Only the patient and clinician context can use record chat; reviewer-only users retain app guidance. Retained approved timeline facts, current note versions and submitted home entries are read in an actor-scoped transaction. Drafts, withdrawn/superseded facts, illustrative Master charts/medication phases and other patients are not attached.

GPT-6 Luna selects a strictly validated retrieval plan: intent, available test code, literal search term, latest/previous/history selection and optional inclusive date range. Server-owned rendering supplies every displayed value, date and source button from authorized records. Model prose, extra keys, fabricated test codes, invalid dates and URLs are rejected. No model writes or executes actions.

Provider input includes the screen, role, up to 100 available test names/codes, the question and six prior questions. Stored patient identity, record values, evidence quotes, prescriptions, note bodies and home entries are not sent. Anything the user types in a question is sent in live mode; do not enter real identifiers or private health information into this synthetic demo. `store:false` is requested, but provider retention still depends on the configured provider's policy.

The read collection is bounded to 2,000 entries per timeline family and 100 home entries. Truncation is disclosed, as are date filtering and the eight-card answer limit. Older data outside that collection may not be available to chat. Source buttons use the existing authenticated, expiring source API. The older navigation-only `/api/v1/guide` endpoint remains compatible.

## Model and operating bounds

Set `GUIDE_MODE=live`, `GUIDE_API_KEY` and `GUIDE_BASE_URL` on the API only. `GUIDE_MAX_CALLS_PER_HOUR` defaults to 60 per process, shared by navigation and record chat. Maximum concurrent provider requests: 2. Timeout: 15 seconds. Requests: 12/minute per verified actor per endpoint. Output cap: 120 tokens for navigation classification, 300 for record retrieval plans. Invalid output, timeout, provider failures or budget exhaustion produce explicitly labelled local help/retrieval. Keep the current single API replica or introduce a shared limiter before scaling.

No conversation is persisted by Glucoflow. The browser holds the last twelve exchanges in memory, sends only six recent questions, and clears on account/patient changes or the Clear conversation button. Clearing aborts pending replies. Context is checked again for every new request. Closing and reopening the panel retains the current session's conversation.

## Motion and usability

The original lightweight CSS/SVG orb blinks and floats, focuses while listening, tilts/orbits while thinking, smiles/bounces while replying and shows a gentle puzzled expression for request errors. These states reflect interaction only, never patient health. Reduced-motion settings disable animation and pointer tracking. The mobile-safe panel keeps a stable header/context/composer and an internally scrollable conversation. Sent questions appear immediately; completed answers open at their beginning, with the summary and first source card visible. Enter sends; Shift+Enter starts a new line; composition input is respected. Failed requests preserve the question for retry. Source evidence opens through the existing viewer.

Visual inspiration: [23rd Live Orb](https://23rd.dev/docs/components/live-orb) and [Apple design guidance](https://developer.apple.com/design/). No third-party orb source was copied. The implementation uses the existing React/Radix/Lucide stack and adds no runtime animation dependency. The API uses the documented [GPT‑6 Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), with reasoning disabled and bounded JSON output.

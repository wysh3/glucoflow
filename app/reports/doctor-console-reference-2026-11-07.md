# Doctor console reference alignment

Read the full shared “See Cases Treatment” reference on 7 November 2026:
https://chatgpt.com/s/t_6aef4b0f92cc81919964a1b39e5347a9?mweb_fallback=1

Applied to this release:
- One encounter selector scopes the visual workflow, evidence inspector and coordination actions.
- Ordered, collected, received, result available and acknowledged remain separate source states.
- Staff acceptance/completion, receiving responsibility and bed placement remain separate facts.
- Source timestamps, corrections, stale feeds and missing evidence remain visible.
- Existing server polling refreshes the authorized workspace every ten seconds while visible and idle; this is polling, not a connected live hospital event feed.
- Sourced observations/follow-up are recorded through the existing encounter coordination panel. They are staff-supplied records, not new physician-verified clinical measurements.

Not represented as implemented: medication order/administration importing, prescription entry, historical clinical-case matching, unified cross-encounter patient identity, real ABDM retrieval, external eMAR/HIS/LIS ingestion or a normalized hospital clinical schema. The reference's claims of prototype testing are not our verification evidence.

The current submission keeps its assistive operational boundary. A visual greeting is workspace navigation based on current saved data; it is not a model-generated clinical summary. Clinical treatment recommendations and severity inference remain excluded.

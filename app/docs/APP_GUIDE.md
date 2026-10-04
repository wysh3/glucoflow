# Gluco app guide

The guide helps navigate uploads, built-in synthetic samples, source review, notes, exports and workspaces. It never reads patient records or acts on them. Authenticated POST /api/v1/guide accepts only screen and a message of at most 600 characters. The API verifies membership and derives the role.

Live mode uses GPT-6 Luna to classify one allowlisted topic. Only server-owned text and role-filtered actions are returned. Unknown topics, extra keys, free prose and URLs are discarded. Clinical requests receive a fixed refusal. Local fallback is labelled honestly. The classifier is not a clinical model or decision aid.

Set GUIDE_MODE=live, GUIDE_API_KEY and GUIDE_BASE_URL on the API only. GUIDE_MAX_CALLS_PER_HOUR defaults to 60 per process. Output is capped at 120 tokens, requests at 12/minute per verified actor, concurrent calls at 2, timeout at 15 seconds. These are per-process caps; keep the current single API replica or use a shared limiter before scaling. No conversations are stored by Glucoflow; in-memory chat clears on account/session change. Provider retention depends on the configured provider. Do not type health details.

The original CSS orb takes visual inspiration from [23rd Live Orb](https://23rd.dev/docs/components/live-orb). No third-party orb source was copied: its item license was not available. Pointer-following eyes, keyboard-operable dialog and reduced-motion support keep it lightweight. Layout and navigation follow [Apple design guidance](https://developer.apple.com/design/): clear hierarchy, consistent spacing, contextual sidebar, reachable touch targets and safe-area insets.

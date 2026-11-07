# Guide, landing, and localization browser coverage — 7 November 2026

The final scoped Playwright run against the existing local API at 8787 and Vite at 5173 passed **18 of 18 cases in 43.9 seconds**. Its temporary runner configuration was removed after the run, and the console output was not saved to a separate log file. The nine unique test cases below each passed once in the desktop project (1440 × 900) and once in the mobile project (390 × 844):

1. `guide-chat.spec.ts` — Record assistant supports factual follow-ups and clear chat.
2. `guide-chat.spec.ts` — patient chat opens only their own context without ornamental animation.
3. `guide-chat.spec.ts` — changing patient scope clears conversation and draft.
4. `guide-chat.spec.ts` — Gluco recovers from a failed request and opens original evidence.
5. `guide-chat.spec.ts` — first guide click is retained while its code is still loading.
6. `landing.spec.ts` — the public home opens the synthetic inpatient care workspace in one click.
7. `landing.spec.ts` — the demo role cards sign in without a password.
8. `localization.spec.ts` — Hindi follows the patient through records, notes, upload entry and account.
9. `localization.spec.ts` — Urdu preview applies right-to-left direction and explains the English fallback.

The delayed-code guide case failed before the race fix and passed after it. This summary records the final run only; it does not add these cases to any other run's count without deduplication. Tests used synthetic local data and did not cover native Android.

# Removal, assistive scope and Sarvam verification

7 November 2026. This is a synthetic demonstration build, not a declaration of clinical, Indian-government or ABDM compliance. The active product scope incorporates the user's six FAQ images; their assistive-only limits supersede earlier derived clinical dashboard flags. The complete earlier PDF comparison remains in the [26-page scope matrix](pdf-compliance-audit-2026-11-07.md).

## Product decisions

| Keep | Remove | Defer or constrain |
|---|---|---|
| Patient uploads, editable notes, clinic source review, approvals, progression, evidence and exports | Duplicate Delta/body-map frontend, 3D models/decoders, Three.js dependencies, unused UI components | Historical Delta data/migrations retained; server feature stays disabled |
| Source-backed care tasks, encounters, playbook proposals, human approval, audit and bounded Hermes | Animated companion face/orb, decorative rings, hero effects, page indices and duplicate header identity | No autonomous clinical learning or diagnosis transfer between patients |
| Home reports, staff-configured tracking, manual categories, clearly labelled demo SOS | Derived low-glucose/eGFR warnings, diagnostic ranges, automatic seven-day follow-up dates | No inferred screening deadlines, emergency dispatch or live hospital integrations |
| Native language catalogs and useful speech input/output | AI translation of ordinary UI labels | Human translation review, complete remaining screen coverage, authenticated caregiver delegation |

Protected redirects preserve the same patient context for retired URLs. A keyboard skip link avoids repeated navigation. Latest measurements are compact rows with six initially shown, source links and a deliberate Show more action. Same-day disagreement, incompatible units and uncertain dates remain separate. Month/year dates retain their source precision. Synthetic example history is collapsed. Major record/review routes load separately.

The final local main JS chunk is 1,406.13 kB / 306.84 kB gzip, compared with the pre-removal 1,946.38 kB / 462.73 kB gzip. This reduces transferred main-JS size by about 34%; it is not a measured page-speed claim. The remaining large-chunk and mixed dynamic/static Capacitor import warnings are disclosed. Design work follows clarity, consistent navigation and accessibility principles from [Apple HIG](https://developer.apple.com/design/human-interface-guidelines), not a claim of Apple certification.

## Backend corrections

Additive migrations 048–053 revoke direct access to the internal result-event writer, add durable speech admission counters, retain a null follow-up date unless supplied, require clinic membership for explicit escalation, exclude closed legacy rows and use a typed result row in escalation. The unscoped periodic API timer is removed. Escalation records the actual initiating actor; notification queue insertion is not external delivery. Regression coverage now includes a real overdue row, one queued event and no duplicate on immediate repeat.

## Speech and languages

Sarvam is implemented at the speech boundary, with the key kept server-side. STT uses `saaras:v4`; TTS uses `bulbul:v4-flash`. The first deployment cap is a total of 60 reserved transcription seconds and 1,000 synthesis characters, with 30-second/500-character request limits, per-actor admission limits, finite timeouts and no automatic retry loop. Failed provider attempts still consume their reserved allowance.

A real synthetic Hindi synthesis/transcription round trip passed through the authenticated backend: 65 characters, 4.075125 seconds of audio, 1,508 ms TTS and 455 ms STT, two provider calls. The sentence was preserved. No patient note or task was submitted. [Exact measured proof](sarvam-live-proof-2026-11-07.json). This validates one Hindi example, not all language accuracy or physical microphone capture. The provider account's retention setting remains unverified.

Dictation becomes an editable draft. Insert is distinct from Send. Read-aloud requires review and generation, then an explicit playback action. Denied microphone access has a WAV upload fallback. Unconfigured providers and unsupported playback languages are shown honestly. Client tests mock speech responses; they are not paid-provider tests.

English and Hindi have 184 matching patient-workflow catalog keys. Twelve other languages expose 39 translated controls each, labelled Preview with English fallback. Nine further scheduled languages are catalog-only. Source documents are never silently translated. Sign-in provides language selection, persisted into the patient workspace. [Exact language coverage](../docs/LOCALIZATION.md).

The selected language is sent directly to the Hermes system instruction. The controlled reply renderer currently supports English/Hindi and explicitly falls back to English for other languages. Actual reply language is retained for read-aloud. Odia and Punjabi UI/script tags map to accepted service codes at the boundary. Prompting alone does not establish complete localization of the guarded renderer.

## Fresh verification

| Check | Measured result |
|---|---|
| TypeScript, API/client/worker production builds | Passed |
| Vitest unit/integration | 276/276, 48 files, 14.15 seconds |
| SQL isolation and constraints | 12/12 |
| Pinned native Hermes Python suite | 26/26, 38.679 seconds; fixtures, no new model spend |
| Date precision / assistive browser regressions | 6/6, desktop and mobile, 19.3 seconds |
| Full browser suite | 174 passed / 2 failed in 9.1 minutes; both failures were obsolete Account punctuation assertions. Corrected focused rerun: 2/2 passed in 4.8 seconds. All 176 distinct cases have passing evidence; no second full-suite run claimed. |
| Hosted browser smoke | Passed at 1440×900 and 390×844: Hindi sign-in preference, notes/voice controls, role denial, no overflow or page errors; zero speech POSTs |

An initial combined test run overlapped the locale-boundary file being created and failed to import it. After the implementation freeze, the complete suite passed as reported above. Applied migration 052 also exposed a typed-row error on a non-empty queue; migration 053 and the positive regression correct it without rewriting applied migration history.

## Remaining limits and required evidence

The [six-FAQ audit and proposed pilot](hackathon-scope-audit-2026-11-07.md) define one primary KPI: median verified specimen collection-to-receipt lag, accompanied by receipt coverage, missingness, cancellation and clock-quality reporting. No pilot partner, baseline or improvement is fabricated. The proposed 60–90 day schedule is a plan.

The public demo remains synthetic-only. Warnings do not automatically anonymize arbitrary user submissions. Real use still requires separate provisioned identities/infrastructure, agreed provider processing and retention, access/retention/deletion/incident controls and site review. Authenticated caregiver delegation is not implemented. ABHA/ABDM is not registered or connected; no real record fetching is claimed. Video has no configured provider/output contract and remains unsupported. This pass does not produce or validate a new Android APK or physical-device microphone flow.

## Hosted delivery

The latest web build is live at [glucoflow.vercel.app](https://glucoflow.vercel.app). Azure API/Hermes revision `glucoflow-service--voice20261107` is healthy. All 52 hosted migration checksums match, including new 048–053; the worker revision is retained. Vercel deployment `dpl_2DUZyHYgJ6SxqipdutNNohyuu1vk` serves main asset `index-DqXAsGWH.js`. Hosted configuration and authorization checks did not dispatch provider calls. The [desktop/mobile browser evidence](removal-hosted-browser-2026-11-07.json) confirms configured Saaras/Bulbul, Hindi preference before sign-in, retired demo redirect and patient denial of clinic access. Screenshots were inspected; no horizontal overflow or page errors were observed. Fixed mobile navigation remains available while scrolling.

Hosted care navigation also passed on both viewports: source episode inspection, skill library, saved workspace recovery, privacy statement and patient access denial, with zero page errors. The initial helper expected the patient home after signing out from Account; this app preserves the authorized Account return path. The helper was corrected to accept that path before checking clinic access denial; no product change was needed. The release runbook, private-container and ACL checks are in the [deployment report](restraint-voice-deployment-2026-11-07.md).

## Final browser review

Both full-suite failures expected `Session storage:` while the localized UI renders `Session storage · …`. The assertion now checks the label independent of that separator. Its two-viewport rerun passed. The final desktop and mobile overview screenshots confirm compact measurement rows, source links, explicit pagination and preserved role context. The deployed Hindi notes and voice panels were also inspected. All verification here is Chromium desktop/mobile viewport coverage; no Safari, physical microphone or new APK result is inferred.

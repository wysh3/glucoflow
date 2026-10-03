# Build acceptance checklist

Each requirement must be traceable to a task and observable behavior. Check boxes are intentionally empty because the app is not built. Passing the documentation audit does not pass these application checks.

| ID | Requirement | Build task | Required evidence |
|---|---|---|---|
| R01 | Patient and clinic roles on web and Android | 1, 9 | Separate accounts complete their workflows on both |
| R02 | Identity and tenant isolation | 1, 5 | API/DB tests reject cross-patient and cross-clinic access |
| R03 | Apple/medical UI, exact font stack, shadcn, Lucide Animated | 1, 2, 9 | Desktop/mobile visual and accessibility review |
| R04 | Consolidated progression overview | 2 | Correct date spacing, units, table equivalent, visible actions |
| R05 | Patient-specific report search | 7 | Correct source result, no draft or unauthorized snippet |
| R06 | PDF/image/camera intake | 3, 9 | Actual bytes uploaded, page order retained, limits enforced |
| R07 | Bounded extraction with evidence | 4 | Held-out source matching and unresolved-field behavior |
| R08 | Human approval before chart publication | 5 | Direct API bypass fails; approved facts persist |
| R09 | Duplicate, mixed identity and stale-review handling | 3, 5 | No repeated points; no generic mismatch override; 409 conflict |
| R10 | Prescriptions and patient notes remain contextual | 2, 6 | Labels distinguish prescriptions, measurements and patient reports |
| R11 | Missing record language stays factual | 2, 7 | No diagnosis, inferred overdue test or risk indicator |
| R12 | Amendments and corrections preserve history | 5 | Retain/supersede/withdraw decisions and immutable prior snapshots |
| R13 | Authorized summary export | 8 | Correct source references, frozen note/fact versions, private download |
| R14 | Durable jobs and bounded model spend | 3, 4 | Crash recovery, fenced writes, preserved call ledger |
| R15 | Loading, empty, failed and offline states | 3, 7, 9 | Retry/cancel/resume behavior and honest process-loss limitations |
| R16 | Android APK works without dev server | 9 | Installed signed APK, camera/back/keyboard/device results |
| R17 | Actual functional demo and disclosed fixtures | 10 | Live phone-to-clinic-to-phone sequence and labelled fallback |
| R18 | Measured operational evaluation | 10 | First/return visits separated; combined role time and accuracy |
| R19 | Retention, cache and private storage controls | 1, 10 | Cleanup dry-run, no-store headers, expiring source URLs |
| R20 | Current pitch and submission match implementation | 10 | Claims updated from verified results; no stale stack |

## Before recording the demo

- [ ] Signed APK and deployed web app use the same API/schema version.
- [ ] Seeded accounts and sources are synthetic; a fresh reset passes smoke tests.
- [ ] Live extraction adapter is selected, funded and verified; no silent fixture fallback.
- [ ] Queue, review, chart, search, export and patient update all work.
- [ ] Clinic Android review is demonstrated, not merely promised.
- [ ] Video timing is not used as a fabricated processing benchmark.

## Before final submission

- [ ] Practising doctor and team details are real and complete.
- [ ] Authenticated portal field/file limits have been checked.
- [ ] Deck, written answers, video and actual implementation agree.
- [ ] Proposed targets and measured results are clearly separated.
- [ ] No unsupported guarantees about diagnosis, complications, zero data loss or adoption.

## Scope change rule

If a proposed implementation changes a locked behavior, update the product specification, its API/data implications and the matching checklist row before proceeding. Routine implementation choices may follow the fixed contracts. New clinical interpretation, live integrations or unrelated product modules require explicit user direction. Archives are historical evidence and cannot override these active files.

## 4 October 2026 UI and demo revision

R03: warm clinical tokens, semantic navigation icons, responsive role/sample controls and mobile-safe form text. R06/R17: three bundled labelled synthetic PDFs enter the ordinary authenticated upload pipeline; repeated samples open the original report. R08/R09: publication displays success, locks draft mutation controls and links the approved record. R10/R12: corrected visit notes require editable text and explicit preview/send, preserving earlier versions. R13: unambiguous systolic/diastolic PDF labels and authorized frozen JSON downloads. Timestamp-derived dates use the local calendar day; source date-only fields retain their printed date.

Measured results, deployment identities, APK signature/hash and limitations are in `app/reports/polish-2026-10-04.md`. This revision does not claim a new physical-device installation or clinical validation.

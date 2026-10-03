# Screens and design system

## Visual constraints

Apple-inspired restraint means readable typography, spacing, consistent alignment and quiet surfaces. Medical clarity means persistent patient identity, explicit units, source access and distinguishable draft states. Do not imitate Apple trademarks or add ornamental glass layers over records.

Use the font stack `"Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Bundle a licensed Inter Variable font asset and its license so Android and web render consistently. Use shadcn/ui primitives. Use icons from [Lucide Animated](https://lucide-animated.com/), not a similarly named replacement package. Animate an icon once after its associated interaction, 120–200 ms where the icon supports configuration. Respect reduced motion. Do not animate clinical values.

## Tokens

| Token | Value |
|---|---|
| Canvas | #F7F8FA |
| Surface | #FFFFFF |
| Main text | #172B33 |
| Secondary text | #52636C |
| Primary/action | #12606F |
| Primary hover | #0B3C49 |
| Border | #DCE3E8 |
| Review emphasis | #A85B00 on #FFF4E5 |
| Error | #B42318 on #FFF1F0 |
| Success action | #176B46 on #ECF8F1 |
| Spacing scale | 4, 8, 12, 16, 24, 32 px |
| Controls | 10 px radius; at least 44 px mobile hit area |
| Panels | 12 px radius; thin border; minimal shadow |
| Body | 14 px desktop, 16 px mobile |
| Screen title | 22–24 px, weight 600 |
| Table numbers | Tabular numerals |

Verify contrast of actual foreground/background combinations against WCAG AA during implementation. Colour never carries status alone. Use actual labels and icons. Success colour describes completed actions, never a medical result.

No slogan, greeting banner, oversized title followed by a small promotional subtitle, gradient hero, floating AI orb, decorative KPI cards or sparkle branding. Use a single compact page title inside the toolbar. Helper text belongs next to a control only when it helps the user make a choice.

## Navigation

Desktop clinic: left rail 216 px with Patients, Review queue and Account. Patient context remains pinned above record tabs. Desktop content has 24 px padding and expands to available width.

Mobile clinic: bottom navigation Patients, Queue, Account. Patient detail tabs scroll horizontally if necessary. The document reviewer becomes two explicit tabs, Source and Fields, preserving selection and scroll. It must support approval on Android, not just read-only viewing.

Patient navigation on all platforms: Records, Add report, Visit notes, Account. On desktop these can be a compact rail. On mobile they are bottom tabs. No clinic-wide patient list appears in a patient account.

## Screen contracts

| Route | Visible elements | Primary action | Empty/failure behavior |
|---|---|---|---|
| /sign-in | Email, password, submit, session error | Sign in | Explain invalid credentials without revealing account existence |
| /clinic/patients | Search, patient rows, identifier, last record date, pending count | Open patient | No matching patients; clear search |
| /clinic/queue | Upload time, patient, filename, processing/review state | Review document | Processing tasks remain visible; failed row offers retry if authorized |
| /clinic/patients/:id/progression | Patient identity, test selector, date range, plot/table toggle, care lanes | Open source / Export | No approved results for this test; pending count links to review |
| /clinic/patients/:id/documents | Source files, uploader, date, state, version | Upload report | File validation error beside the rejected file |
| /clinic/review/:documentId | Patient identity, source preview, field list, issues, review controls | Approve reviewed entries | Identity hold blocks publication with resolution path |
| /clinic/patients/:id/history | Actor, action, time, correction reason, version | Open version | No prior changes |
| /patient/records | Own approved observations, documents and pending uploads | Open record / view trend | Explain where uploaded reports will appear |
| /patient/add-report | Camera/file choice, page previews, patient identity, selected clinic | Upload | Cancel, permission denial and retry leave recoverable state |
| /patient/visit-notes | Category, optional event date, text, sent notes | Send note | Blank notes rejected; sent notes show timestamp |
| /account | Signed-in identity, active authorized role, clinic, sign out | Sign out | No role switch if only one role |

A reviewer can upload through the patient's Documents tab and capture a photo on Android. Staff must select and confirm the patient before an upload session begins.

## Progression details

Default to HbA1c when available; otherwise choose the first available supported test. Date choices: 6 months, 12 months, All, Custom. Use actual collection dates, with a label if only a report date is known. Separate incompatible units. Default to one test panel; permit up to three synchronized panels with their own y axes. Never overlay unrelated units on one axis.

Show values, units and dates on focus/tap. Connect measured points with straight segments; gaps and line segments must not imply computed measurements. Legend: “Lines connect recorded results.” Same-date duplicates stay separate unless a reviewer has explicitly resolved them. Do not calculate slopes, prognosis or a global improving/declining verdict. Show reference ranges only in the selected source detail and only if the document supplies them.

Medication, examination and patient-note lanes share the date axis on desktop. Mobile uses a chronological list below the chart. Each lane identifies its source type. Dates of notes and reported events remain distinct. A table alternative exposes every plotted observation to keyboard and screen-reader users.

## Review details

Desktop width split approximately 55% source / 45% fields. Patient ID and document name stay visible. Selecting a field opens its evidence page; highlight only verified text coordinates. If coordinates are unavailable, show the page and quote, without a fabricated bounding box.

Each field has Review, Exclude and correction controls. The final action reads “Approve 6 reviewed entries” using the actual selected count. All entries must be explicitly reviewed or excluded; no global unchecked approve-all. Manual transcription requires source page and reviewer reason. Malformed entries and unresolved identity conflicts prevent affected publication. Unsupported units can remain approved as source-only records with explicit exclusion from charts.

A patient note can be marked “Seen by clinic” without becoming a clinically verified claim. Use separate status vocabulary for note acknowledgement and fact approval.

## State copy

Use “Reading document,” “Awaiting review,” “Patient details need checking,” “Could not read this page,” “Changes saved,” “This record changed while you were reviewing it,” and “You are offline. Reconnect to upload.” Avoid human-like agent narration and invented completion percentages. Show bytes uploaded only when measured.

## Accessibility and Android

Keyboard focus, associated labels, visible errors, text resizing, 44 px touch targets, safe-area padding and reduced motion are required. Back closes a sheet before leaving the route. Back with unsent form changes asks whether to discard. Soft keyboard must not obscure Save or Send. Test at 360 px, 390 px, 768 px and 1440 px widths, and one physical Android device. Camera permission denial must offer file upload. Large phone photos must not crash preview rendering.

## Demo visibility

An unobtrusive “Synthetic demo” label appears in the demo tenant. Patient and clinic can stay signed in on separate devices. Queue polling exposes progress without a fake toast on a timer. Essential actions use text labels, not only icon buttons. No hidden keyboard commands are required to follow the demo.

Component references: [shadcn/ui](https://ui.shadcn.com/docs), [Lucide Animated](https://lucide-animated.com/).

## Consolidated overview and report search

The progression route is the clinician's consolidated visit overview. Its first viewport shows patient identity, selected test progression, the most recent recorded value/date, and visible actions for Search records and Open source. Below it show dated prescriptions, reported notes and document availability in compact sections. Avoid forcing the entire history into one physically tiny screen: one page can scroll, and detailed evidence opens in a drawer.

Add a persistent search field in patient context, labelled “Search this patient's records.” Search supported test aliases, prescription names, document filenames and approved evidence text. Results show document date, matching snippet, source filename and page, with an Open source action. Use date/category filters; preserve the patient context. A search for “eye” can retrieve approved examination document entries without making a clinical inference.

Document availability displays “Latest report: [date],” “Awaiting review,” or “No matching report in uploaded records.” State the collection/date-filter scope. Do not infer a missing record from an empty keyword search. Do not label a result Normal, Safe, Risk or Overdue from availability alone. A future task based on a clinician-entered due date must identify that source; the first MVP does not calculate due dates.

Patient search uses only patient-visible approved evidence and document metadata. Pending uploads remain a separate list with upload statuses. On Android the search results occupy a full-height sheet with an explicit Back action and retain the query after opening a source.

## Final interaction rules

Use light mode only for this MVP. Add an explicit “Reject wrong-patient upload” action for reviewer identity holds. Never offer “Approve anyway” for a different patient identifier. A partially represented document shows its coverage note next to Open source. Source-only approved values remain available in search and documents but do not become chart points.

A paused or interrupted upload shows “Upload incomplete” and offers resume or cancel. The app can recover pending sessions from the server after sign-in, but cannot recover an unsent photo or form after the operating system kills the process. Describe that loss honestly. Clinician-only accounts see the approved view and document status; editing/review actions require reviewer capability.

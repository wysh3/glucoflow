# Hosted photo smoke diagnosis — 7 November 2026

The photo smoke failed because it uploaded byte-identical synthetic photos already processed for the same demo patient. The worker correctly finished its duplicate-detection path without calling Hermes. This was not an OCR failure or a zero-call extraction run.

## Read-only hosted evidence

Queried only the configured synthetic demo clinic/patient and the filename `2026-09-14_lab_report_photo_a.jpg`, using `default_transaction_read_only=on`. No production data was changed and no provider calls were made. The first connection timed out; a second connection succeeded.

| Field | Current photo upload | Existing matching upload |
| --- | --- | --- |
| Created at (UTC) | 2026-11-07 13:45:48.326 | 2026-11-07 08:14:23.649 |
| Document ID | `44b324d6-f6ce-49cb-9fa5-db26a5a6525e` | `df603e54-676d-4121-b268-c5f283d20650` |
| Job ID | `a1ada374-da58-474b-ae25-c8d1443bbe76` | `35a076ee-e2db-44f8-a223-cb0b85a977c1` |
| Job state | succeeded | succeeded |
| Duplicate target | existing matching upload | none |
| Ordered source checksum matches target | true | — |
| Own review batches | 0 | 1 |
| Extraction run | absent | Hermes / live / 1 reserved call |
| Released to patient | false | false |

## Cause in code

`app/scripts/deploy-care-worker-smoke.ts` always loads the same two fixture JPEG files. Its recent-photo lookup considers only uploads from the previous 30 minutes. The existing upload was older, so the script uploaded the identical bytes again.

`app/packages/extraction/src/document-job.ts` hashes the ordered source bytes and checks all earlier uploads for that clinic and patient, provided the original already has a review batch. It marks the new document as a duplicate, records the validation-stage output and completes the job before creating an extraction run.

The smoke's usage query returns no row for this valid duplicate path. Its log renders `run?.call_count ?? 0` as “0 durable call reservations”, then fails the requirement for 1–2 reservations. The new job therefore proves duplicate avoidance, not fresh live photo extraction.

## Follow-up

A fresh photo extraction proof must use newly generated synthetic photo bytes while retaining legible, correct synthetic content and ordered source checks. Renaming the same bytes cannot bypass content-based duplicate detection. Alternatively, a duplicate-path smoke can explicitly verify the matching original, but must not claim that the newly deployed worker performed fresh extraction. The older Hermes result is historical evidence only.

No production fix, additional upload or provider call was performed during this diagnosis.

## Smoke repair and measured rerun

Updated `scripts/deploy-care-worker-smoke.ts` to recognize a completed duplicate photo job only after verifying the canonical document belongs to the same synthetic demo patient and clinic. Both stored checksums must equal the ordered fixture-byte checksum. The duplicate must have no extraction run. The proof reads the canonical review through the clinician API, verifies other-clinic review/source denial, then obtains each original source using the patient role and compares the downloaded bytes and page order. Its output explicitly distinguishes deduplication from fresh live photo extraction.

Resume mode now requires an existing photo job and refuses to upload a replacement, preventing a new provider call during this recheck.

Measured command: `pnpm exec tsx scripts/deploy-care-worker-smoke.ts --confirm-live --resume-pdf`, exit 0.

- Existing PDF job: succeeded, original elapsed time 16,034 ms, one durable reservation; ledger retained 4,988 input tokens and 328 output tokens (configured estimate USD 0.000788).
- PDF draft/source checks and cross-clinic denial passed.
- Photo deduplication, canonical ordered source bytes, same patient/clinic, absent new extraction run, authorized canonical review/source, and cross-clinic denial passed.
- This rerun created no uploads or new extraction jobs and made no provider requests. The PDF timing/usage belongs to the earlier processing run, not this read-only verification.

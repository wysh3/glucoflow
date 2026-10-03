# Fixed contracts

This file resolves implementation ambiguities found in the final pre-build audit. It implements the product scope in document 01. If another active document conflicts, correct the inconsistency before coding; do not silently invent another interface.

## Common types

```ts
type UUID = string;
type ISODate = string; // validated YYYY-MM-DD, never timezone-converted
type DateKind = 'collection' | 'report' | 'prescription' | 'examination' | 'reported';
type DatePrecision = 'day' | 'month' | 'year' | 'unknown';
type NoteCategory = 'medication_taking' | 'symptoms' | 'diet_activity' | 'other';
type Context =
  | { kind: 'patient'; clinicId: UUID; patientId: UUID }
  | { kind: 'clinic'; clinicId: UUID; reviewer: boolean; clinician: boolean };
type ActorContext = { userId: UUID; contexts: Context[] };
type EvidenceRef = { evidenceId: UUID; page: number };
type TimelineQuery = { testCodes: string[]; from?: ISODate; to?: ISODate; cursor?: string };
type RecordSearchQuery = { q: string; from?: ISODate; to?: ISODate; category?: string; cursor?: string };
```

Active context is selected by the client only from `GET /me` results and is reauthorized for every request against current DB membership. A supplied patientId or context never confers permission. Patients cannot submit actor IDs or clinic capability flags in a mutation body.

Timeline API uses repeated `testCode` parameters mapped to `testCodes`, at most three codes. `TimelineResult` contains observations, events, notes, coverage, complete and nextCursor. Event pagination is explicit. `RecordSearchResult` uses the fields in document 05. Shared DTOs must preserve numeric nulls and original unit text.

## Supported observation mappings

| Code | Display | Plot units accepted without conversion |
|---|---|---|
| hba1c | HbA1c | %, mmol/mol in separate series |
| glucose_fasting | Fasting glucose | mg/dL, mmol/L in separate series |
| glucose_random | Random glucose | mg/dL, mmol/L in separate series |
| glucose_postmeal | Post-meal glucose | mg/dL, mmol/L in separate series |
| egfr | Reported eGFR | mL/min/1.73 m² |
| urine_acr | Urine albumin/creatinine ratio | mg/g, mg/mmol in separate series |
| cholesterol_total | Total cholesterol | mg/dL, mmol/L in separate series |
| cholesterol_ldl | LDL cholesterol | mg/dL, mmol/L in separate series |
| cholesterol_hdl | HDL cholesterol | mg/dL, mmol/L in separate series |
| triglycerides | Triglycerides | mg/dL, mmol/L in separate series |
| bp_systolic | Systolic BP | mmHg |
| bp_diastolic | Diastolic BP | mmHg |
| weight | Weight | kg, lb in separate series |

These are transcription/display mappings, not diagnostic thresholds. Normalize harmless spelling/spacing aliases only. Never map an unspecified glucose test to fasting. A BP pair creates two observations sharing one source/group ID. A reference range retains the source's literal text. Non-numeric, inequality or unknown-unit results remain searchable source-only facts. No equation derives eGFR, LDL or clinical scores.

## Review and publication

Identity states: `unchecked`, `matched`, `missing_confirmed`, `mismatch`. Only matched/missing_confirmed can publish. `missing_confirmed` needs a reason and source context. Mismatch rejects the assignment and requires a fresh correctly assigned upload. A matching name alone never auto-clears identity.

Each review mutation carries expectedRevision. It contains field edits, manual facts with source evidence, entry/page exclusions, or missing-identity confirmation. Mutations that affect a previously reviewed value mark it unreviewed again. Exclusions require reasons. Source-only acceptance explicitly sets plotEligible=false.

When already published facts need a correction without a new source file, `POST /documents/:id/review-revisions` with expectedApprovalRevision and reason creates a new draft batch copied from that source version. The existing published facts remain current until replacement publication. This requires reviewer capability and has the same conflict and audit rules as an amendment. No inline edit of approved rows is permitted.

## Evidence transport

Model references to existing evidence use worker-supplied IDs. Visual proposals can name a temporary evidence ID only if `newEvidence` contains the corresponding page and quote. Adapter validates membership and remaps the temporary ID to a server UUID. Coordinates come from document processing, not unverified model guesses. Every fact references evidence from its own version.

## Upload limits and lifecycle

15 MiB means 15,728,640 bytes. One PDF or one image uses kind=file; 1–10 ordered images use kind=photos. Total bytes remain within the same limit. EXIF orientation is applied before preview/OCR and recorded. Declare one generated object path per manifest item. Upsert is disabled. Completion freezes the manifest and queues processing once.

Upload session states: `created`, `completed`, `cancelled`, `expired`. A completion after cancellation/expiry is rejected; a repeated successful completion returns its original IDs. Late raw uploads to a still-valid provider token remain orphaned and cannot enter the pipeline. Record the two-hour storage-token lifetime honestly. Application completion expiry is 15 minutes.

## Jobs and budget

Use one job for extraction and one for each export. Durable stage keys are `(job_id, stage)`; extraction sub-batches have `(run_id, batch_index)` outputs. Model call ledger counts every dispatch. Reserve budget with a transaction before each call; cap total calls at 12 per run. Global worker concurrency is 2 documents, page preparation concurrency is 2 per document. A run deadline survives worker restarts.

Retries are at most three attempts for one transient operation and must also fit the run call/time/cost limits. Retry-After never extends the run deadline. A manual retry is a separately recorded run, with at most three manual retry requests per document per hour. No retry bypasses identity, format or authorization checks.

## Permissions for less obvious actions

Patients may export their own released facts and patient-visible note versions. Clinicians and reviewers may export within their authorized clinic context. Review history with staff details is clinic-only. Patients see document status and their own note versions. A clinician-only account cannot acknowledge a fact as reviewed, but may acknowledge reading a patient note.

Download/source issuance checks authorization each time. Signed download URLs last 60 seconds and cannot promise immediate revocation during that interval. Android refreshes authorization for a new URL when a long source view needs another fetch.

## Build-time choices that remain evidence-dependent

Model provider/model ID, compatible dependency versions, and the secure-storage plugin are selected during explicit build gates. Their acceptance criteria are documented; no package or model is claimed as tested yet. Funding/accounts and real clinician participation must come from actual user-provided access. These are dependencies, not permission to change product scope.

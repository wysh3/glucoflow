# Data model, authorization and API

## Shared conventions

IDs are UUIDs. Instants use UTC ISO 8601. Clinical dates use ISO date strings plus `dateKind` and `datePrecision`. Money/cost uses decimal units with currency. Every tenant-owned row includes `clinic_id`. All foreign keys between tenant-owned tables include compatible clinic scope, preventing cross-tenant references.

## Tables

| Table | Main fields and constraints |
|---|---|
| clinics | id, display_name, is_demo |
| memberships | clinic_id, user_id, reviewer, clinician, administrator, active; unique clinic/user |
| patients | id, clinic_id, clinic_identifier, display_name, birth_date nullable, approval_revision default 0; unique clinic/identifier |
| patient_accounts | clinic_id, patient_id, user_id, active; one active self-link per patient for MVP |
| upload_sessions | id, clinic_id, patient_id, actor_id, manifest_json, state, completion_expires_at, completed_at, idempotency_key |
| documents | id, clinic_id, patient_id, uploader_id, current_version_id, assignment_state |
| document_versions | id, document_id, clinic_id, source_manifest_json, sha256, bytes, page_count, version_number, supersedes_version_id |
| jobs | id, clinic_id, kind, target_id, state, stage, attempt, started_at, lease_token, lease_until, available_at, error_code |
| job_stage_outputs | job_id, document_version_id, stage, output_ref, completed_at; unique job/stage |
| provider_calls | run_id, ordinal, state, reserved_cost_usd, actual_cost_usd, token_count; unique run/ordinal |
| extraction_runs | id, version_id, clinic_id, provider, model, prompt_hash, schema_version, usage_json, state, first_leased_at, deadline_at, call_count, reserved_cost_usd |
| evidence_spans | id, clinic_id, document_version_id, page, quote, bbox nullable, origin |
| draft_facts | id, clinic_id, patient_id, document_version_id, kind, raw_json, normalized_json, issues_json, review_state, revision, review_batch_id |
| draft_fact_evidence | draft_fact_id, evidence_id, clinic_id; many-to-many references |
| approved_facts | id, clinic_id, patient_id, kind, payload_json, document_version_id, approval_revision, approved_by, approved_at, supersedes_fact_id |
| fact_status_events | fact_id, clinic_id, approval_revision, status, reason; versioned retain/supersede/withdraw decisions |
| approved_fact_evidence | fact_id, evidence_id, clinic_id |
| patient_notes | id, clinic_id, patient_id, author_id, category, body, event_date nullable, submitted_at, seen_by nullable, seen_at nullable, supersedes_note_id |
| review_batches | id, clinic_id, document_version_id, revision, identity_state, identity_reason, state, supersedes_batch_id nullable |
| approval_batches | id, clinic_id, patient_id, revision, actor_id, source_review_revision, coverage_json, created_at |
| audit_events | id, clinic_id, actor_id, entity_type, entity_id, action, revision, reason, created_at |
| exports | id, clinic_id, patient_id, approval_revision, state, object_path, snapshot_manifest_json, created_by, created_at |
| idempotency_keys | clinic_id, actor_id, route, key, request_hash, response_json, expires_at |

Use DB constraints for enumerations and uniqueness. JSON payloads are schema-validated on input and publication. One approved fact can have multiple evidence spans. Do not put all clinical facts into an opaque patient JSON blob.

Exact duplicates are detected after worker checksums, scoped to clinic and patient. A duplicate is retained as an upload receipt referencing the existing document and creates no second extraction. Similar documents require reviewer judgment. A unique publication key prevents a retried transaction from duplicating an approval batch.

## Fact contract

`DraftFactInput` contains `kind: observation | prescription | examination`, `rawLabel`, `rawValue`, `rawUnit`, `eventDate`, `dateRaw`, `dateKind`, `datePrecision`, `normalized`, and `evidenceIds`. Nullable values are explicit. Normalized observation includes `testCode`, `numericValue`, `unitCode`; prescription includes `name`, `strength`, `instructions`, each nullable; examination includes document category and literal source text without a generated clinical assessment.

A draft stores issue codes separately: `identity_missing`, `identity_mismatch`, `date_ambiguous`, `unit_missing`, `unit_unsupported`, `evidence_unmatched`, `possible_duplicate`, `page_unreadable`. No generated clinical severity.

Review states: `unreviewed`, `reviewed`, `excluded`. Batch states: `draft`, `identity_hold`, `ready`, `published`, `superseded`. Only the server computes readiness. A field correction increments the batch revision. Publication requires an `expectedRevision`, no unresolved identity hold, and an explicit review/exclusion for every entry and unreadable page.

## Authorization

Patient can read only their linked approved facts, own notes and permitted source documents for their clinic record. They can upload and submit notes for themselves, and see processing status of their uploads. They cannot read clinic review comments, other patients, internal model output or audit metadata about other users.

Reviewer can process records within assigned clinic membership and read the approved context needed for that review. Clinician can view approved clinic records. Operator scripts manage links/memberships; no runtime admin UI is included. All link changes produce audit events; a patient must never enter an arbitrary patient ID to claim access.

Use server verification plus explicit DB role grants and RLS on exposed tables. Direct clients have no write grants to draft/approved facts, jobs, audits or storage listing. API operations use a scoped DB role with per-transaction actor/clinic context and enforced policies. Scope must be derived from verified identity, never a client-supplied tenant claim. Set actor/clinic context transaction-locally on the same connection as its queries and clear it by transaction completion; test pool reuse between different actors. The API database role must not own the protected tables or have BYPASSRLS. Elevated worker credentials stay in a private worker environment and operate only on leased scoped jobs. No elevated key in frontend bundles.

Storage buckets are private. Signed upload grants are object-specific and valid for the provider's two-hour lifetime. The application upload session expires for completion after 15 minutes. These are different lifetimes. Disable overwrite/upsert. Reauthorize completion and reject incomplete, expired or cancelled sessions. Unclaimed source objects are removed by an authenticated cleanup job after at least 3 hours; a late raw upload never enters the clinical pipeline. Authorized source/download URLs expire after 60 seconds; the UI reauthorizes when they expire. Access revocation prevents issuance of new URLs; already issued URLs may remain usable until expiry. Never promise immediate revocation of an already downloaded file.

## API conventions

Base `/api/v1`. Bearer access token required. Server resolves actor and allowed context. JSON errors: `{error:{code,message,requestId,fields?}}`. Use 401 for invalid session, 403 for disallowed action, 404 for unknown/inaccessible resources where needed to avoid disclosure, 409 for stale revisions/idempotency conflicts, 413 for limits, 422 for validation and 429 for rate limits.

Collection reads use opaque cursors, default 25 and maximum 100 rows. Mutating upload/publication/export requests require `Idempotency-Key`. Same key with a different body returns 409. Retain deduplication results for 24 hours.

| Method and route | Input | Result / rule |
|---|---|---|
| GET /me | none | actor, authorized contexts and capability flags |
| GET /patients | search, cursor | clinic list for permitted clinic roles |
| GET /patients/:id | none | permitted patient profile |
| GET /patients/:id/timeline | testCode, from, to, cursor | approved observations/events/notes with source IDs |
| GET /patients/:id/documents | cursor | scoped document list |
| GET /queue | state, cursor | reviewer queue only |
| POST /uploads | patientId, files:[{filename,contentType,byteCount}], kind: file or photos | sessionId, object-specific upload URLs and completion expiry |
| POST /uploads/:id/complete | none | documentId, jobId; 202 |
| DELETE /uploads/:id | none | cancel incomplete session; completed sessions return 409 |
| GET /uploads/pending | none | own incomplete/unexpired sessions for resume after sign-in |
| GET /jobs/:id | none | state, observed stage and error code |
| POST /documents/:id/retry | reason | bounded retry run; reviewer or owning uploader for extraction failure |
| POST /documents/:id/review-revisions | expectedApprovalRevision, reason | reviewer creates a correction draft against the same source |
| GET /documents/:id/review | none | reviewer-only source/draft/issues/current revision |
| PATCH /documents/:id/review | expectedRevision, field edits, manual source entries, exclusions, missing-identity confirmation | new revision; never publishes |
| POST /documents/:id/approve | expectedRevision | atomic approval revision or 409/422 |
| POST /documents/:id/amendments | completedUploadSessionId, reason, expectedDocumentVersionId | reviewer links a same-patient completed upload as an amendment; freeze publication during linking |
| POST /documents/:id/reject-assignment | reason, expectedRevision | reviewer quarantines a wrong-patient upload; no publication |
| GET /documents/:id/source | versionId, page optional | short-lived authorized source URL |
| GET /patients/:id/history | cursor | clinic audit/version history |
| POST /patients/:id/notes | category, body, eventDate optional | patient-authored note; no clinician approval status |
| POST /notes/:id/corrections | category, body, eventDate optional | owning patient creates a superseding note version |
| POST /notes/:id/acknowledge | none | reviewer/clinician acknowledgement |
| POST /patients/:id/exports | approvalRevision | exportId, jobId; 202 |
| GET /exports/:id | none | status and authorized short-lived URL when ready |

Seed clinic/patient accounts and memberships through a local administrative script for the MVP. Public signup, invitations and membership editing UI are deferred. This keeps account access real without adding an unneeded onboarding subsystem.

## Job state values

Job states are `queued`, `running`, `retry_wait`, `succeeded`, `failed`. Stages are `validate_file`, `prepare_pages`, `ocr`, `extract`, `validate_draft`, `save_draft`, or `render_export`. Identity hold belongs to the review batch after successful extraction, not to a retryable job failure. Lease recovery returns eligible running jobs to queued without resetting durable stage outputs.

## Publication transaction

Lock review batch and verify expected revision. Reauthorize reviewer membership. Validate every selected field and evidence reference in clinic scope. Confirm all exclusions and identity resolution. Lock the patient revision counter, then allocate the next patient approval revision. Insert approved facts, supersession links and evidence references. Mark review batch published and insert audit event. Commit once. All checks happen server-side even if the UI was modified. Failure rolls back all writes.

Patient notes are append-only versions after submission; corrections create a linked note with the previous text accessible in history. Export snapshots freeze selected approved fact IDs and submitted note version IDs at request time, including a note cutoff timestamp. The renderer reads the frozen manifest; it never re-queries current notes. Clinical record correction is separate from account deletion or data-retention policy.

## Essential tests

Two clinics with identically named patients cannot see each other's records. A patient cannot approve via a direct API call. A stale reviewer receives 409. A retried approval creates one batch. A signed URL is never returned for an unauthorized source. JWT role claims do not substitute for active database membership. Logout clears cached records. An amended source cannot silently change an exported historical snapshot.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Search contract

`GET /patients/:id/search?q=&from=&to=&category=&cursor=` returns `{items:[{documentId,documentVersionId,page,documentDate,snippet,matchedField}],nextCursor}`. Query length 2–100 characters; maximum 25 results per page. Search uses the actor's authorized patient record and current approved evidence only. Preserve document date kind where applicable. No result means no match in the searchable collection, not a negative clinical finding.

Use parameterized PostgreSQL full-text queries with deterministic alias expansion. `searchPatientRecords(actor: ActorContext, patientId: string, query: RecordSearchQuery): Promise<RecordSearchResult>` is the server interface. Reauthorize Open source separately. Source-only approved examination entries may appear in search even when they are not numeric chart points.

## Fixed upload and publication semantics

A `file` manifest contains one PDF/JPEG/PNG. A `photos` manifest contains 1–10 JPEG/PNG images in explicit page order, with total declared and verified bytes at most 15,728,640. Worker independently verifies page count and bytes. The original image objects remain the source evidence; generate a derived multipage preview if useful. Checksum the ordered source manifest using each verified object hash.

Completion queues extraction once. Amendment linking may reuse that extraction, but never starts an additional concurrent run. Only a reviewer can link a completed, same-patient draft upload to the expected prior document version. Reject linking if the candidate is already published, belongs to another patient or has an identity hold. Preserve distinct source IDs. Record the candidate as an amendment of the logical document in one transaction.

If a source mixes different patient identities across pages, quarantine the whole upload. MVP does not split a mixed-patient PDF or allow redaction overrides. Patient source access is allowed for their own pending uploads unless quarantined, or for a document explicitly released by clinic review. An approved field alone cannot authorize access to a quarantined source.

Publication requires an explicit disposition for previous facts affected by an amendment: retained, superseded by a named new fact, or withdrawn with reason. Excluding a replacement fact cannot silently leave a retracted old result current. Store `fact_status_events` with fact_id, clinic_id, approval_revision, status and reason; current queries apply these events while historical exports retain their original manifest.

Timeline pages follow the default 25/maximum 100 row limit. The interactive view has a 2,000-observation display bound across the selected range and returns `complete` and `nextCursor`. Client loads all pages within that bound before connecting points. If a range exceeds the display bound, show “Narrow the date range” and an explicit incomplete count, never an apparently complete truncated chart. Event lanes have their own paginated list and coverage indicator.

Reference: [Supabase signed upload lifetime](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), checked 2 October 2026.

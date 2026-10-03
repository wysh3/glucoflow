import type {
  AuditEventDto,
  CursorPage,
  DocumentDto,
  ProcessingState,
  QueueItemDto,
} from '@glucoflow/contracts';
import { PROCESSING_STATE_LABELS } from '@glucoflow/contracts';
import { decodeCursor, encodeCursor } from './identity';
import type { DbClient } from './pool';

/** Document, queue and history reads. */

const DOCUMENT_STATE_SQL = `
  case
    when d.assignment_state = 'quarantined' then 'quarantined'
    when d.duplicate_of_document_id is not null then 'duplicate'
    when d.released_to_patient then 'approved'
    when exists (select 1 from sutra.approval_batches ab where ab.document_id = d.id) then 'approved'
    when exists (select 1 from sutra.review_batches b where b.document_id = d.id and b.state = 'published') then 'approved'
    when exists (
      select 1 from sutra.review_batches b
      where b.document_id = d.id and b.state in ('draft', 'identity_hold', 'ready') and b.revision > 0
    ) then 'review_in_progress'
    when exists (
      select 1 from sutra.review_batches b
      where b.document_id = d.id and b.state in ('draft', 'identity_hold', 'ready')
    ) then 'awaiting_review'
    when exists (
      select 1 from sutra.jobs j
      where j.target_id = d.id and j.kind = 'process_document' and j.state = 'failed'
        and j.run_number = (select max(j2.run_number) from sutra.jobs j2
                            where j2.target_id = d.id and j2.kind = 'process_document')
    ) then 'failed'
    when exists (
      select 1 from sutra.jobs j
      where j.target_id = d.id and j.kind = 'process_document' and j.state = 'running'
    ) then 'processing'
    when exists (
      select 1 from sutra.jobs j
      where j.target_id = d.id and j.kind = 'process_document' and j.state in ('queued', 'retry_wait')
    ) then 'queued'
    else 'awaiting_review'
  end`;

type DocumentRow = {
  document_id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  clinic_identifier: string;
  uploader_name: string;
  uploaded_at: string;
  assignment_state: string;
  duplicate_of_document_id: string | null;
  amendment_pending: boolean;
  state: ProcessingState;
  filename: string | null;
  kind: string | null;
  bytes: string | null;
  page_count: number | null;
  sha256: string | null;
  current_version_id: string | null;
  version_number: number | null;
  version_created_at: string | null;
  supersedes_version_id: string | null;
  approval_revision: number | null;
  issues: string[] | null;
  coverage_note: string | null;
  upload_session_id: string | null;
};

function mapDocument(row: DocumentRow): DocumentDto {
  const state = row.state;
  return {
    documentId: row.document_id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientIdentifier: row.clinic_identifier,
    filename: row.filename ?? 'Document',
    uploaderName: row.uploader_name,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
    state,
    stateLabel: PROCESSING_STATE_LABELS[state] ?? state,
    assignmentState: row.assignment_state as DocumentDto['assignmentState'],
    pageCount: row.page_count,
    bytes: row.bytes ? Number(row.bytes) : 0,
    currentVersion: row.current_version_id
      ? {
          documentVersionId: row.current_version_id,
          versionNumber: row.version_number ?? 1,
          pageCount: row.page_count,
          bytes: row.bytes ? Number(row.bytes) : 0,
          sha256: row.sha256 ?? '',
          createdAt: new Date(row.version_created_at ?? row.uploaded_at).toISOString(),
          supersedesVersionId: row.supersedes_version_id,
          isCurrent: true,
        }
      : null,
    versions: [],
    issues: (row.issues ?? []) as DocumentDto['issues'],
    coverageNote: row.coverage_note,
    approvalRevision: row.approval_revision,
    amendmentPending: row.amendment_pending,
    duplicateOfDocumentId: row.duplicate_of_document_id,
    kind: row.kind ?? 'file',
    uploadSessionId: row.upload_session_id,
  };
}

const DOCUMENT_SELECT = `
  select
    d.id as document_id,
    d.clinic_id,
    d.patient_id,
    p.display_name as patient_name,
    p.clinic_identifier,
    coalesce(u.display_name, 'Clinic') as uploader_name,
    d.created_at as uploaded_at,
    d.assignment_state,
    d.duplicate_of_document_id,
    d.amendment_pending,
    ${DOCUMENT_STATE_SQL} as state,
    v.source_manifest_json -> 'items' -> 0 ->> 'filename' as filename,
    v.source_kind as kind,
    v.bytes,
    v.page_count,
    v.sha256,
    v.id as current_version_id,
    v.version_number,
    v.created_at as version_created_at,
    v.supersedes_version_id,
    (select max(ab.revision) from sutra.approval_batches ab where ab.document_id = d.id) as approval_revision,
    (select b.document_issues from sutra.review_batches b
      where b.document_id = d.id order by b.created_at desc limit 1) as issues,
    (select s.id from sutra.upload_sessions s
      where s.document_id = d.id and s.state = 'completed' limit 1) as upload_session_id,
    case
      when exists (
        select 1 from sutra.review_batches b
        where b.document_id = d.id
          and b.state = 'published'
          and jsonb_array_length(b.excluded_pages) > 0
      ) then 'This source is partially represented: a page was excluded during review.'
      else null
    end as coverage_note
  from sutra.documents d
  join sutra.patients p on p.id = d.patient_id
  left join sutra.app_users u on u.id = d.uploader_id
  left join sutra.document_versions v on v.id = d.current_version_id`;

export async function listDocuments(
  client: DbClient,
  patientId: string,
  options: { cursor?: string; limit?: number },
): Promise<CursorPage<DocumentDto>> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const offset = decodeCursor(options.cursor);
  const result = await client.query<DocumentRow>(
    `${DOCUMENT_SELECT}
     where d.patient_id = $1
     order by d.created_at desc
     limit $2 offset $3`,
    [patientId, limit + 1, offset],
  );
  const rows = result.rows.slice(0, limit);
  return {
    items: rows.map(mapDocument),
    nextCursor: result.rows.length > limit ? encodeCursor(offset + limit) : null,
  };
}

export async function getDocumentRow(
  client: DbClient,
  documentId: string,
): Promise<DocumentDto | null> {
  const result = await client.query<DocumentRow>(`${DOCUMENT_SELECT} where d.id = $1`, [documentId]);
  const row = result.rows[0];
  return row ? mapDocument(row) : null;
}

/** RLS-authorized original for a page; PDFs use one object, photos one per page. */
export async function getDocumentSource(client: DbClient, versionId: string, page = 1): Promise<{objectPath: string; filename: string; pageCount: number | null} | null> {
  if (!Number.isInteger(page) || page < 1) return null;
  const result = await client.query<{object_path: string; filename: string; page_count: number | null}>(
    `select item ->> 'objectPath' as object_path, item ->> 'filename' as filename,
            coalesce(v.page_count, jsonb_array_length(v.source_manifest_json -> 'items')) as page_count
       from sutra.document_versions v
       cross join lateral jsonb_array_elements(v.source_manifest_json -> 'items') as item
      where v.id = $1
        and (item ->> 'index')::int = case when v.source_kind = 'photos' then $2 - 1 else 0 end
        and ($2 <= coalesce(v.page_count, case when v.source_kind = 'photos' then jsonb_array_length(v.source_manifest_json -> 'items') else 10 end))`,
    [versionId, page],
  );
  const row = result.rows[0];
  return row ? {objectPath: row.object_path, filename: row.filename, pageCount: row.page_count} : null;
}

/** A manual retry creates a new bounded run for the same document. */
export async function requestDocumentRetry(
  client: DbClient,
  documentId: string,
  reason: string,
): Promise<{ jobId: string; runNumber: number }> {
  const result = await client.query<{ request_document_retry: { jobId: string; runNumber: number } }>(
    'select sutra.request_document_retry($1, $2) as request_document_retry',
    [documentId, reason],
  );
  return result.rows[0]!.request_document_retry;
}

export async function documentVersions(
  client: DbClient,
  documentId: string,
): Promise<DocumentDto['versions']> {
  const result = await client.query<{
    id: string;
    version_number: number;
    page_count: number | null;
    bytes: string;
    sha256: string;
    created_at: string;
    supersedes_version_id: string | null;
    is_current: boolean;
  }>(
    `select v.id, v.version_number, v.page_count, v.bytes, v.sha256, v.created_at,
            v.supersedes_version_id,
            (v.id = d.current_version_id) as is_current
       from sutra.document_versions v
       join sutra.documents d on d.id = v.document_id
      where v.document_id = $1
      order by v.version_number desc`,
    [documentId],
  );
  return result.rows.map((row) => ({
    documentVersionId: row.id,
    versionNumber: row.version_number,
    pageCount: row.page_count,
    bytes: Number(row.bytes),
    sha256: row.sha256,
    createdAt: new Date(row.created_at).toISOString(),
    supersedesVersionId: row.supersedes_version_id,
    isCurrent: row.is_current,
  }));
}

export type QueueFilter = 'all' | 'processing' | 'awaiting_review' | 'review_in_progress' | 'failed';

export async function listQueue(
  client: DbClient,
  clinicId: string,
  options: { state?: QueueFilter; cursor?: string; limit?: number },
): Promise<CursorPage<QueueItemDto>> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const offset = decodeCursor(options.cursor);
  const filter = options.state ?? 'all';

  const result = await client.query<{
    document_id: string;
    patient_id: string;
    patient_name: string;
    clinic_identifier: string;
    filename: string | null;
    uploaded_at: string;
    uploader_name: string;
    state: ProcessingState;
    assignment_state: string;
    kind: string | null;
    job_id: string | null;
    job_state: string | null;
    job_stage: string | null;
    attempt: number | null;
    error_code: string | null;
    error_message: string | null;
    retry_allowed: boolean;
  }>(
    `with latest_job as (
       select distinct on (j.target_id)
         j.id, j.target_id, j.state, j.stage, j.attempt, j.error_code, j.error_message, j.run_number
       from sutra.jobs j
       where j.kind = 'process_document'
       order by j.target_id, j.run_number desc, j.created_at desc
     )
     select
       d.id as document_id,
       d.patient_id,
       p.display_name as patient_name,
       p.clinic_identifier,
       v.source_manifest_json -> 'items' -> 0 ->> 'filename' as filename,
       d.created_at as uploaded_at,
       u.display_name as uploader_name,
       ${DOCUMENT_STATE_SQL} as state,
       d.assignment_state,
       v.source_kind as kind,
       lj.id as job_id,
       lj.state as job_state,
       lj.stage as job_stage,
       lj.attempt,
       lj.error_code,
       lj.error_message,
       (lj.state = 'failed') as retry_allowed
     from sutra.documents d
     join sutra.patients p on p.id = d.patient_id
     join sutra.app_users u on u.id = d.uploader_id
     left join sutra.document_versions v on v.id = d.current_version_id
     left join latest_job lj on lj.target_id = d.id
     where d.clinic_id = $1
       and ($2 = 'all' or ${DOCUMENT_STATE_SQL} = $2)
     -- Newest first: with a bounded page, a reviewer must see the upload that just
     -- arrived, not the oldest one in a busy queue.
     order by d.created_at desc
     limit $3 offset $4`,
    [clinicId, filter, limit + 1, offset],
  );

  const rows = result.rows.slice(0, limit);
  const items: QueueItemDto[] = rows.map((row) => ({
    jobId: row.job_id,
    documentId: row.document_id,
    documentVersionId: null,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientIdentifier: row.clinic_identifier,
    filename: row.filename ?? 'Document',
    uploadedAt: new Date(row.uploaded_at).toISOString(),
    uploaderName: row.uploader_name,
    state: row.state,
    stateLabel: PROCESSING_STATE_LABELS[row.state] ?? row.state,
    jobState: row.job_state,
    jobStage: row.job_stage,
    jobStageLabel: null,
    attempt: row.attempt ?? 0,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    retryAllowed: Boolean(row.retry_allowed) && row.assignment_state !== 'quarantined',
    kind: row.kind ?? 'file',
  }));
  return {
    items,
    nextCursor: result.rows.length > limit ? encodeCursor(offset + limit) : null,
  };
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  upload_created: 'Upload started',
  upload_completed: 'Upload completed',
  upload_cancelled: 'Upload cancelled',
  retry_requested: 'Processing retry requested',
  review_updated: 'Review updated',
  page_excluded: 'Page excluded from review',
  review_published: 'Reviewed entries approved',
  assignment_rejected: 'Upload rejected as a different patient',
  amendment_linked: 'Amendment linked to an earlier report',
  review_revision_created: 'Correction draft created',
  note_submitted: 'Patient note submitted',
  note_corrected: 'Patient note corrected',
  note_acknowledged: 'Patient note acknowledged',
  export_requested: 'Summary export requested',
  export_ready: 'Summary export ready',
};

export async function listHistory(
  client: DbClient,
  patientId: string,
  options: { cursor?: string; limit?: number },
): Promise<CursorPage<AuditEventDto>> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const offset = decodeCursor(options.cursor);
  const result = await client.query<{
    id: string;
    actor_name: string | null;
    reviewer: boolean | null;
    clinician: boolean | null;
    action: string;
    entity_type: string;
    entity_id: string;
    revision: number | null;
    reason: string | null;
    created_at: string;
  }>(
    `select e.id, a.display_name as actor_name, m.reviewer, m.clinician,
            e.action, e.entity_type, e.entity_id, e.revision, e.reason, e.created_at
       from sutra.audit_events e
       left join sutra.app_users a on a.id = e.actor_id
       left join sutra.memberships m on m.user_id = e.actor_id and m.clinic_id = e.clinic_id
      where e.patient_id = $1
      order by e.created_at desc
      limit $2 offset $3`,
    [patientId, limit + 1, offset],
  );
  const rows = result.rows.slice(0, limit);
  return {
    items: rows.map((row) => ({
      auditEventId: row.id,
      actorName: row.actor_name ?? 'System',
      actorRole: row.reviewer ? 'Reviewer' : row.clinician ? 'Clinician' : 'Patient',
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      revision: row.revision,
      reason: row.reason,
      createdAt: new Date(row.created_at).toISOString(),
      summary: AUDIT_ACTION_LABELS[row.action] ?? row.action.replace(/_/g, ' '),
    })),
    nextCursor: result.rows.length > limit ? encodeCursor(offset + limit) : null,
  };
}

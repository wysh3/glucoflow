import {
  approvalActionLabel,
  describeBlockers,
} from '@sutra/domain';
import type {
  ApprovalDto,
  DraftFactDto,
  FactDisposition,
  IssueCode,
  ReviewDto,
  ReviewPageCoverage,
  ReviewPatch,
} from '@sutra/contracts';
import type { DbClient } from './pool';

/**
 * Review and publication reads and writes. Every mutation is a database procedure
 * with a revision check; the API role cannot write draft or approved rows directly.
 */

type FactRow = {
  id: string;
  kind: string;
  raw_label: string;
  raw_value: string | null;
  raw_unit: string | null;
  event_date: string | null;
  date_raw: string | null;
  date_kind: string;
  date_precision: string;
  normalized_json: Record<string, unknown>;
  issues_json: string[];
  review_state: string;
  review_reason: string | null;
  revision: number;
  group_id: string | null;
  updated_at: string;
  evidence: unknown;
};

export async function getReviewDto(
  client: DbClient,
  documentId: string,
): Promise<ReviewDto | null> {
  const documentResult = await client.query<{
    document_id: string;
    document_version_id: string;
    document_name: string;
    version_number: number;
    patient_id: string;
    patient_name: string;
    clinic_identifier: string;
    clinic_id: string;
    clinic_name: string;
    supersedes_version_id: string | null;
  }>(
    `select d.id as document_id, d.current_version_id as document_version_id,
            sutra.document_display_name(d.current_version_id) as document_name,
            v.version_number, d.patient_id, p.display_name as patient_name,
            p.clinic_identifier, d.clinic_id, c.display_name as clinic_name,
            v.supersedes_version_id
       from sutra.documents d
       join sutra.document_versions v on v.id = d.current_version_id
       join sutra.patients p on p.id = d.patient_id
       join sutra.clinics c on c.id = d.clinic_id
      where d.id = $1`,
    [documentId],
  );
  const document = documentResult.rows[0];
  if (!document) return null;

  const batchResult = await client.query<{
    id: string;
    revision: number;
    state: string;
    identity_state: string;
    identity_reason: string | null;
    identity_raw: string | null;
    excluded_pages: number[];
    coverage_json: {
      pages?: { page: number; coverage: string; quoteCount: number; note?: string }[];
      unreadablePages?: number[];
    };
    document_issues: string[];
    supersedes_batch_id: string | null;
    approval_revision: number | null;
    published_at: string | null;
    extraction_run_id: string | null;
  }>(
    `select id, revision, state, identity_state, identity_reason, identity_raw,
            coalesce(excluded_pages, '[]'::jsonb) as excluded_pages,
            coalesce(coverage_json, '{}'::jsonb) as coverage_json,
            coalesce(document_issues, '[]'::jsonb) as document_issues,
            supersedes_batch_id, approval_revision, published_at, extraction_run_id
       from sutra.review_batches
      where document_id = $1
      order by created_at desc
      limit 1`,
    [documentId],
  );
  const batch = batchResult.rows[0];
  if (!batch) return null;

  const factsResult = await client.query<FactRow>(
    `select f.id, f.kind, f.raw_label, f.raw_value, f.raw_unit,
            to_char(f.event_date, 'YYYY-MM-DD') as event_date, f.date_raw,
            f.date_kind, f.date_precision, f.normalized_json,
            coalesce(f.issues_json, '[]'::jsonb) as issues_json,
            f.review_state, f.review_reason, f.revision, f.group_id, f.updated_at,
            coalesce((
              select json_agg(json_build_object(
                'evidenceId', e.id,
                'documentVersionId', e.document_version_id,
                'page', e.page,
                'quote', e.quote,
                'bbox', e.bbox,
                'origin', e.origin
              ) order by e.page, e.created_at)
              from sutra.draft_fact_evidence fe
              join sutra.evidence_spans e on e.id = fe.evidence_id
              where fe.draft_fact_id = f.id
            ), '[]'::json) as evidence
       from sutra.draft_facts f
      where f.review_batch_id = $1
      order by f.ordinal`,
    [batch.id],
  );

  const runResult = await client.query<{
    provider: string;
    model: string;
    mode: 'fixture' | 'live';
  }>(
    `select provider, model, mode from sutra.extraction_runs
      where id = $1`,
    [batch.extraction_run_id],
  );
  const run = runResult.rows[0];

  const priorResult = await client.query<{
    id: string;
    raw_label: string;
    raw_value: string | null;
    event_date: string | null;
    status: string;
  }>(
    `select f.id, f.raw_label, f.raw_value, to_char(f.event_date, 'YYYY-MM-DD') as event_date, f.status
       from sutra.approved_facts f
      where f.patient_id = $1
        and f.status = 'retained'
        and (
          f.document_id = $2
          or f.document_id = (select supersedes_document_id from sutra.documents where id = $2)
        )
      order by f.ordinal`,
    [document.patient_id, documentId],
  );

  const blockersResult = await client.query<{ review_blockers: string[] }>(
    'select sutra.review_blockers($1) as review_blockers',
    [batch.id],
  );
  const blockers = blockersResult.rows[0]?.review_blockers ?? [];

  const excludedPages = batch.excluded_pages ?? [];
  const pages: ReviewPageCoverage[] = (batch.coverage_json.pages ?? []).map((page) => {
    const excluded = excludedPages.includes(page.page);
    return {
      page: page.page,
      coverage: excluded ? 'excluded' : (page.coverage as ReviewPageCoverage['coverage']),
      reason: excluded ? `Excluded by a reviewer.` : (page.note ?? null),
      quoteCount: page.quoteCount ?? 0,
      coverageNote:
        excluded || page.coverage === 'unreadable'
          ? 'This page is not represented in the approved record.'
          : null,
    };
  });

  const facts: DraftFactDto[] = factsResult.rows.map((row) => ({
    factId: row.id,
    kind: row.kind as DraftFactDto['kind'],
    rawLabel: row.raw_label,
    rawValue: row.raw_value,
    rawUnit: row.raw_unit,
    eventDate: row.event_date,
    dateRaw: row.date_raw,
    dateKind: row.date_kind as DraftFactDto['dateKind'],
    datePrecision: row.date_precision as DraftFactDto['datePrecision'],
    normalized: row.normalized_json as DraftFactDto['normalized'],
    issues: (row.issues_json ?? []) as IssueCode[],
    reviewState: row.review_state as DraftFactDto['reviewState'],
    reviewReason: row.review_reason,
    revision: row.revision,
    groupId: row.group_id,
    updatedAt: new Date(row.updated_at).toISOString(),
    evidence: (Array.isArray(row.evidence) ? row.evidence : []).map((item) => {
      const record = item as Record<string, unknown>;
      return {
        evidenceId: String(record.evidenceId),
        documentVersionId: String(record.documentVersionId),
        page: Number(record.page),
        quote: String(record.quote ?? ''),
        bbox:
          Array.isArray(record.bbox) && record.bbox.length === 4
            ? (record.bbox.map(Number) as [number, number, number, number])
            : null,
        origin: String(record.origin) as DraftFactDto['evidence'][number]['origin'],
      };
    }),
  }));

  const documentIssues = (batch.document_issues ?? []) as IssueCode[];
  const identityState = batch.identity_state as ReviewDto['identityState'];
  const priorFacts = priorResult.rows.map((row) => ({
    factId: row.id,
    label: row.raw_label,
    value: row.raw_value,
    date: row.event_date,
    status: row.status,
  }));

  const dto: ReviewDto = {
    documentId,
    documentVersionId: document.document_version_id,
    documentName: document.document_name,
    versionNumber: document.version_number,
    patient: {
      patientId: document.patient_id,
      displayName: document.patient_name,
      clinicIdentifier: document.clinic_identifier,
      clinicId: document.clinic_id,
      clinicName: document.clinic_name,
    },
    batchId: batch.id,
    revision: batch.revision,
    state: batch.state as ReviewDto['state'],
    identityState,
    identityReason: batch.identity_reason,
    identityRaw: batch.identity_raw,
    assignedIdentifier: document.clinic_identifier,
    facts,
    pages,
    issues: [
      ...new Set([
        ...facts.flatMap((fact) => fact.issues),
        ...documentIssues,
      ]),
    ],
    documentIssues,
    publishedAt: batch.published_at ? new Date(batch.published_at).toISOString() : null,
    publishedRevision: batch.approval_revision,
    supersedesVersionId: document.supersedes_version_id,
    amendmentOfVersionId: document.supersedes_version_id,
    priorFacts,
    requiresDispositions:
      priorFacts.length > 0 && (document.supersedes_version_id !== null || batch.supersedes_batch_id !== null),
    canPublish: blockers.length === 0,
    publishBlockers: blockers,
    extractionMode: run?.mode ?? 'fixture',
    extractionProvider: run?.provider ?? 'unknown',
    extractionModel: run?.model ?? 'unknown',
  };
  return dto;
}

export function reviewActionSummary(review: ReviewDto): {
  actionLabel: string;
  blockerText: string | null;
  progress: { total: number; reviewed: number; excluded: number; unreviewed: number };
} {
  const progress = {
    total: review.facts.length,
    reviewed: review.facts.filter((fact) => fact.reviewState === 'reviewed').length,
    excluded: review.facts.filter((fact) => fact.reviewState === 'excluded').length,
    unreviewed: review.facts.filter((fact) => fact.reviewState === 'unreviewed').length,
  };
  return {
    actionLabel: approvalActionLabel(review.facts),
    blockerText: review.publishBlockers.length > 0 ? describeBlockers(review.publishBlockers) : null,
    progress,
  };
}

export async function updateReview(
  client: DbClient,
  documentId: string,
  patch: ReviewPatch,
): Promise<{ revision: number; state: string; identityState: string; blockers: string[] }> {
  const result = await client.query<{
    update_review: { revision: number; state: string; identityState: string; blockers: string[] };
  }>('select sutra.update_review($1, $2, $3::jsonb) as update_review', [
    documentId,
    patch.expectedRevision,
    JSON.stringify(patch),
  ]);
  return result.rows[0]!.update_review;
}

export async function publishReview(
  client: DbClient,
  documentId: string,
  expectedRevision: number,
  dispositions: FactDisposition[],
): Promise<ApprovalDto> {
  const result = await client.query<{ publish_review: ApprovalDto }>(
    'select sutra.publish_review($1, $2, $3::jsonb) as publish_review',
    [documentId, expectedRevision, JSON.stringify(dispositions)],
  );
  return result.rows[0]!.publish_review;
}

export async function rejectAssignment(
  client: DbClient,
  documentId: string,
  expectedRevision: number,
  reason: string,
): Promise<{ documentId: string; assignmentState: string }> {
  const result = await client.query<{ reject_assignment: { documentId: string; assignmentState: string } }>(
    'select sutra.reject_assignment($1, $2, $3) as reject_assignment',
    [documentId, expectedRevision, reason],
  );
  return result.rows[0]!.reject_assignment;
}

export async function linkAmendment(
  client: DbClient,
  documentId: string,
  sessionId: string,
  expectedVersionId: string,
  reason: string,
): Promise<Record<string, unknown>> {
  const result = await client.query<{ link_amendment: Record<string, unknown> }>(
    'select sutra.link_amendment($1, $2, $3, $4) as link_amendment',
    [documentId, sessionId, expectedVersionId, reason],
  );
  return result.rows[0]!.link_amendment;
}

export async function createReviewRevision(
  client: DbClient,
  documentId: string,
  expectedApprovalRevision: number,
  reason: string,
): Promise<Record<string, unknown>> {
  const result = await client.query<{ create_review_revision: Record<string, unknown> }>(
    'select sutra.create_review_revision($1, $2, $3) as create_review_revision',
    [documentId, expectedApprovalRevision, reason],
  );
  return result.rows[0]!.create_review_revision;
}

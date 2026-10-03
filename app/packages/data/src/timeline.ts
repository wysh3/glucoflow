import {
  testDisplayName,
  type EvidenceDto,
  type FactStatus,
  type TimelineEvent,
  type TimelineNote,
  type TimelineObservation,
} from '@sutra/contracts';
import type { DbClient } from './pool';

/**
 * Approved-only timeline reads. Charts never call a model, and drafts are never
 * visible here: the row level security policy on approved_facts already scopes the
 * actor, and every query additionally requires status = 'retained' for current
 * records.
 */

type ObservationRow = {
  id: string;
  raw_label: string;
  raw_value: string | null;
  raw_unit: string | null;
  event_date: string | null;
  date_raw: string | null;
  date_kind: string;
  date_precision: string;
  normalized_json: Record<string, unknown>;
  plot_eligible: boolean;
  group_id: string | null;
  status: string;
  approval_revision: number;
  document_id: string;
  document_version_id: string;
  evidence: unknown;
};

type EventRow = ObservationRow & { kind: string };

function toEvidence(value: unknown): EvidenceDto[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
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
      origin: String(record.origin) as EvidenceDto['origin'],
    };
  });
}

const EVIDENCE_AGGREGATE = `
  coalesce((
    select json_agg(json_build_object(
      'evidenceId', e.id,
      'documentVersionId', e.document_version_id,
      'page', e.page,
      'quote', e.quote,
      'bbox', e.bbox,
      'origin', e.origin
    ) order by e.page, e.created_at)
    from sutra.approved_fact_evidence fe
    join sutra.evidence_spans e on e.id = fe.evidence_id
    where fe.fact_id = f.id
  ), '[]'::json) as evidence`;

function mapObservation(row: ObservationRow): TimelineObservation {
  const normalized = row.normalized_json ?? {};
  const numericValue =
    typeof normalized.numericValue === 'number' ? normalized.numericValue : null;
  const testCode = typeof normalized.testCode === 'string' ? normalized.testCode : 'unmapped';
  return {
    factId: row.id,
    testCode,
    displayName: testDisplayName(testCode),
    numericValue,
    unit: typeof normalized.unitCode === 'string' ? normalized.unitCode : null,
    rawValue: row.raw_value,
    rawUnit: row.raw_unit,
    date: row.event_date,
    dateKind: row.date_kind as TimelineObservation['dateKind'],
    datePrecision: row.date_precision as TimelineObservation['datePrecision'],
    referenceRangeText:
      typeof normalized.referenceRangeText === 'string' ? normalized.referenceRangeText : null,
    plotEligible: row.plot_eligible,
    groupId: row.group_id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    approvalRevision: row.approval_revision,
    status: row.status as FactStatus,
    evidence: toEvidence(row.evidence),
  };
}

function mapEvent(row: EventRow): TimelineEvent {
  const normalized = row.normalized_json ?? {};
  const label =
    row.kind === 'prescription'
      ? (typeof normalized.name === 'string' && normalized.name) || row.raw_label
      : row.kind === 'examination'
        ? (typeof normalized.category === 'string' && normalized.category) || row.raw_label
        : row.raw_label;
  const detailParts: string[] = [];
  if (typeof normalized.strength === 'string' && normalized.strength) detailParts.push(normalized.strength);
  if (typeof normalized.instructions === 'string' && normalized.instructions) {
    detailParts.push(normalized.instructions);
  }
  if (row.kind === 'examination' && typeof normalized.sourceText === 'string') {
    detailParts.push(normalized.sourceText);
  }
  if (row.raw_value && detailParts.length === 0) detailParts.push(row.raw_value);
  return {
    factId: row.id,
    kind:
      row.kind === 'prescription'
        ? 'prescription'
        : row.kind === 'examination'
          ? 'examination'
          : 'observation_source_only',
    label,
    detail: detailParts.join(' · ') || null,
    date: row.event_date,
    dateRaw: row.date_raw,
    dateKind: row.date_kind as TimelineEvent['dateKind'],
    datePrecision: row.date_precision as TimelineEvent['datePrecision'],
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    approvalRevision: row.approval_revision,
    status: row.status as FactStatus,
    evidence: toEvidence(row.evidence),
  };
}

export type TimelinePage = {
  observations: TimelineObservation[];
  events: TimelineEvent[];
  notes: TimelineNote[];
  observationTotal: number;
  eventTotal: number;
  noteTotal: number;
  latestReportDate: string | null;
  awaitingReviewCount: number;
  sourceOnlyCount: number;
};

const OBSERVATION_SELECT = `
  select f.id, f.raw_label, f.raw_value, f.raw_unit,
         to_char(f.event_date, 'YYYY-MM-DD') as event_date,
         f.date_raw, f.date_kind, f.date_precision, f.normalized_json, f.plot_eligible,
         f.group_id, f.status, f.approval_revision, f.document_id, f.document_version_id,
         ${EVIDENCE_AGGREGATE}
  from sutra.approved_facts f
  where f.patient_id = $1
    and f.kind = 'observation'
    and f.status = 'retained'
    and ($2::text[] is null or f.normalized_json ->> 'testCode' = any($2::text[]))
    and ($3::date is null or f.event_date is null or f.event_date >= $3::date)
    and ($4::date is null or f.event_date is null or f.event_date <= $4::date)`;

export async function loadTimelinePage(
  client: DbClient,
  patientId: string,
  query: { testCodes: string[]; from?: string; to?: string },
  limit: number,
  offset: number,
  contextOffsets: { events?: number; notes?: number } = {},
): Promise<TimelinePage> {
  const codes = query.testCodes.length > 0 ? query.testCodes : null;

  const observations = await client.query<ObservationRow>(
    `${OBSERVATION_SELECT}
     order by f.event_date desc nulls last, f.id
     limit least($5, greatest(0, 2000 - $6)) offset $6`,
    [patientId, codes, query.from ?? null, query.to ?? null, limit, offset],
  );
  const observationCount = await client.query<{ count: string }>(
    `select count(*)::text as count from (${OBSERVATION_SELECT}) counted`,
    [patientId, codes, query.from ?? null, query.to ?? null],
  );

  const events = await client.query<EventRow>(
    `select f.id, f.kind, f.raw_label, f.raw_value, f.raw_unit,
            to_char(f.event_date, 'YYYY-MM-DD') as event_date,
            f.date_raw, f.date_kind, f.date_precision, f.normalized_json, f.plot_eligible,
            f.group_id, f.status, f.approval_revision, f.document_id, f.document_version_id,
            ${EVIDENCE_AGGREGATE}
     from sutra.approved_facts f
     where f.patient_id = $1
       and f.kind in ('prescription', 'examination')
       and f.status = 'retained'
       and ($2::date is null or f.event_date is null or f.event_date >= $2::date)
       and ($3::date is null or f.event_date is null or f.event_date <= $3::date)
     order by f.event_date desc nulls last, f.id
     limit least($4, greatest(0, 2000 - $5)) offset $5`,
    [patientId, query.from ?? null, query.to ?? null, limit, contextOffsets.events ?? 0],
  );

  const notes = await client.query<{
    id: string;
    category: string;
    body: string;
    event_date: string | null;
    submitted_at: string;
    seen_by_name: string | null;
    seen_at: string | null;
    supersedes_note_id: string | null;
    version: number;
  }>(
    `select n.id, n.category, n.body,
            to_char(n.event_date, 'YYYY-MM-DD') as event_date,
            n.submitted_at, a.display_name as seen_by_name, n.seen_at,
            n.supersedes_note_id, n.version
     from sutra.patient_notes n
     left join sutra.app_users a on a.id = n.seen_by
     where n.patient_id = $1
       and not exists (select 1 from sutra.patient_notes newer where newer.supersedes_note_id = n.id)
       and ($2::date is null or n.event_date is null or n.event_date >= $2::date)
       and ($3::date is null or n.event_date is null or n.event_date <= $3::date)
     order by coalesce(n.event_date, n.submitted_at::date) desc, n.submitted_at desc, n.id
     limit least($4, greatest(0, 2000 - $5)) offset $5`,
    [patientId, query.from ?? null, query.to ?? null, limit, contextOffsets.notes ?? 0],
  );

  const contextCounts = await client.query<{ events: string; notes: string }>(`select
    (select count(*) from sutra.approved_facts f where f.patient_id = $1 and f.kind in ('prescription', 'examination') and f.status = 'retained'
      and ($2::date is null or f.event_date is null or f.event_date >= $2::date)
      and ($3::date is null or f.event_date is null or f.event_date <= $3::date))::text as events,
    (select count(*) from sutra.patient_notes n where n.patient_id = $1
      and not exists (select 1 from sutra.patient_notes newer where newer.supersedes_note_id = n.id)
      and ($2::date is null or n.event_date is null or n.event_date >= $2::date)
      and ($3::date is null or n.event_date is null or n.event_date <= $3::date))::text as notes`,
    [patientId, query.from ?? null, query.to ?? null]);

  const counts = await client.query<{
    latest_report_date: string | null;
    awaiting_review_count: string;
    source_only_count: string;
  }>(
    `select
       (select max(f.event_date)::text from sutra.approved_facts f
         where f.patient_id = $1 and f.status = 'retained') as latest_report_date,
       (select count(*)::text from sutra.documents d
         where d.patient_id = $1
           and d.assignment_state = 'assigned'
           and d.duplicate_of_document_id is null
           and not d.released_to_patient
           and not exists (
             select 1 from sutra.review_batches b
             where b.document_id = d.id and b.state = 'published'
           )) as awaiting_review_count,
       (select count(*)::text from sutra.approved_facts f
         where f.patient_id = $1 and f.status = 'retained' and not f.plot_eligible) as source_only_count`,
    [patientId],
  );

  const countRow = counts.rows[0];
  return {
    observations: observations.rows.map(mapObservation),
    events: events.rows.map(mapEvent),
    notes: notes.rows.map((row) => ({
      noteId: row.id,
      category: row.category,
      body: row.body,
      eventDate: row.event_date,
      submittedAt: new Date(row.submitted_at).toISOString(),
      authorRole: 'patient' as const,
      seenBy: row.seen_by_name,
      seenAt: row.seen_at ? new Date(row.seen_at).toISOString() : null,
      supersedesNoteId: row.supersedes_note_id,
      version: row.version,
    })),
    observationTotal: Number(observationCount.rows[0]?.count ?? '0'),
    eventTotal: Number(contextCounts.rows[0]?.events ?? 0),
    noteTotal: Number(contextCounts.rows[0]?.notes ?? 0),
    latestReportDate: countRow?.latest_report_date ?? null,
    awaitingReviewCount: Number(countRow?.awaiting_review_count ?? '0'),
    sourceOnlyCount: Number(countRow?.source_only_count ?? '0'),
  };
}

/** Test codes that currently have at least one approved, plottable result. */
export async function availableTestCodes(client: DbClient, patientId: string): Promise<string[]> {
  const result = await client.query<{ test_code: string }>(
    `select distinct f.normalized_json ->> 'testCode' as test_code
       from sutra.approved_facts f
      where f.patient_id = $1
        and f.status = 'retained'
        and f.plot_eligible
        and f.normalized_json ->> 'testCode' is not null
      order by test_code`,
    [patientId],
  );
  return result.rows.map((row) => row.test_code);
}

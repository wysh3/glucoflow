import type { ExportJobDto, ExportSnapshotManifest } from '@sutra/contracts';
import type { DbClient } from './pool';

/** Export snapshot creation and reads. Rendering happens in the worker. */

const EXPORT_STATE_LABELS: Record<string, string> = {
  queued: 'Waiting to start',
  running: 'Building summary',
  ready: 'Ready to download',
  failed: 'Could not build the summary',
};

type ExportRow = {
  id: string;
  job_id: string | null;
  state: string;
  approval_revision: number;
  created_at: string;
  data_cutoff_at: string;
  fact_count: number;
  note_count: number;
  synthetic: boolean;
  coverage_notes: string[];
  error_code: string | null;
  object_path: string | null;
};

function mapExport(row: ExportRow): ExportJobDto {
  return {
    exportId: row.id,
    jobId: row.job_id,
    state: row.state as ExportJobDto['state'],
    stateLabel: EXPORT_STATE_LABELS[row.state] ?? row.state,
    approvalRevision: row.approval_revision,
    createdAt: new Date(row.created_at).toISOString(),
    dataCutoffAt: new Date(row.data_cutoff_at).toISOString(),
    factCount: row.fact_count,
    noteCount: row.note_count,
    synthetic: row.synthetic,
    coverageNotes: row.coverage_notes ?? [],
    downloadUrl: null,
    downloadExpiresAt: null,
    errorCode: row.error_code,
  };
}

const EXPORT_SELECT = `
  select id, job_id, state, approval_revision, created_at, data_cutoff_at,
         fact_count, note_count, synthetic, coalesce(coverage_notes, '[]'::jsonb) as coverage_notes,
         error_code, object_path, snapshot_manifest_json
    from sutra.exports`;

export async function createExport(
  client: DbClient,
  patientId: string,
  approvalRevision: number,
): Promise<{
  exportId: string;
  jobId: string;
  state: string;
  approvalRevision: number;
  factCount: number;
  noteCount: number;
  dataCutoffAt: string;
}> {
  const result = await client.query<{
    create_export: {
      exportId: string;
      jobId: string;
      state: string;
      approvalRevision: number;
      factCount: number;
      noteCount: number;
      dataCutoffAt: string;
    };
  }>('select sutra.create_export($1, $2) as create_export', [patientId, approvalRevision]);
  return result.rows[0]!.create_export;
}

export async function getExport(client: DbClient, exportId: string): Promise<{
  dto: ExportJobDto;
  objectPath: string | null;
  manifest: ExportSnapshotManifest | null;
} | null> {
  const result = await client.query<ExportRow & { snapshot_manifest_json: ExportSnapshotManifest }>(
    `${EXPORT_SELECT} where id = $1`,
    [exportId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    dto: mapExport(row),
    objectPath: row.object_path,
    manifest: row.snapshot_manifest_json ?? null,
  };
}

export async function listExports(
  client: DbClient,
  patientId: string,
): Promise<ExportJobDto[]> {
  const result = await client.query<ExportRow>(
    `${EXPORT_SELECT} where patient_id = $1 order by created_at desc limit 20`,
    [patientId],
  );
  return result.rows.map(mapExport);
}

/** Frozen facts and note versions for the renderer. Never re-queries current notes. */
export async function loadSnapshotContent(
  client: DbClient,
  manifest: ExportSnapshotManifest,
): Promise<{
  facts: {
    factId: string;
    kind: string;
    rawLabel: string;
    rawValue: string | null;
    rawUnit: string | null;
    eventDate: string | null;
    dateKind: string;
    datePrecision: string;
    dateRaw: string | null;
    normalized: Record<string, unknown>;
    plotEligible: boolean;
    documentName: string;
    page: number | null;
    approvalRevision: number;
  }[];
  notes: {
    noteId: string;
    category: string;
    body: string;
    eventDate: string | null;
    submittedAt: string;
    version: number;
    supersededBy: string | null;
  }[];
}> {
  const facts = await client.query<{
    id: string;
    kind: string;
    raw_label: string;
    raw_value: string | null;
    raw_unit: string | null;
    event_date: string | null;
    date_kind: string;
    date_precision: string;
    date_raw: string | null;
    normalized_json: Record<string, unknown>;
    plot_eligible: boolean;
    document_name: string;
    page: number | null;
    approval_revision: number;
  }>(
    `select f.id, f.kind, f.raw_label, f.raw_value, f.raw_unit,
            to_char(f.event_date, 'YYYY-MM-DD') as event_date,
            f.date_kind, f.date_precision, f.date_raw, f.normalized_json, f.plot_eligible,
            sutra.document_display_name(f.document_version_id) as document_name,
            (select min(e.page) from sutra.approved_fact_evidence fe
              join sutra.evidence_spans e on e.id = fe.evidence_id
              where fe.fact_id = f.id) as page,
            f.approval_revision
       from sutra.approved_facts f
      where f.id = any($1::uuid[])
      order by f.event_date nulls last, f.ordinal`,
    [manifest.factIds],
  );

  const notes = await client.query<{
    id: string;
    category: string;
    body: string;
    event_date: string | null;
    submitted_at: string;
    version: number;
    superseded_by: string | null;
  }>(
    `select n.id, n.category, n.body, to_char(n.event_date, 'YYYY-MM-DD') as event_date,
            n.submitted_at, n.version,
            (select newer.id from sutra.patient_notes newer where newer.supersedes_note_id = n.id) as superseded_by
       from sutra.patient_notes n
      where n.id = any($1::uuid[])
      order by n.submitted_at`,
    [manifest.noteVersionIds],
  );

  return {
    facts: facts.rows.map((row) => ({
      factId: row.id,
      kind: row.kind,
      rawLabel: row.raw_label,
      rawValue: row.raw_value,
      rawUnit: row.raw_unit,
      eventDate: row.event_date,
      dateKind: row.date_kind,
      datePrecision: row.date_precision,
      dateRaw: row.date_raw,
      normalized: row.normalized_json,
      plotEligible: row.plot_eligible,
      documentName: row.document_name,
      page: row.page,
      approvalRevision: row.approval_revision,
    })),
    notes: notes.rows.map((row) => ({
      noteId: row.id,
      category: row.category,
      body: row.body,
      eventDate: row.event_date,
      submittedAt: new Date(row.submitted_at).toISOString(),
      version: row.version,
      supersededBy: row.superseded_by,
    })),
  };
}

export async function patientHeader(
  client: DbClient,
  patientId: string,
): Promise<{ displayName: string; clinicIdentifier: string; clinicName: string; isDemo: boolean } | null> {
  const result = await client.query<{
    display_name: string;
    clinic_identifier: string;
    clinic_name: string;
    is_demo: boolean;
  }>(
    `select p.display_name, p.clinic_identifier, c.display_name as clinic_name, c.is_demo
       from sutra.patients p join sutra.clinics c on c.id = p.clinic_id
      where p.id = $1`,
    [patientId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    displayName: row.display_name,
    clinicIdentifier: row.clinic_identifier,
    clinicName: row.clinic_name,
    isDemo: row.is_demo,
  };
}

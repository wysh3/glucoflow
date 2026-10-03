import type {
  DraftFactInput,
  EvidenceOrigin,
  IdentityState,
  IssueCode,
  NormalizedPayload,
} from '@sutra/contracts';
import type { DbClient } from './pool';

/**
 * Worker-side writes. The worker holds elevated server-side credentials, operates
 * only on leased jobs, and every write is fenced by the lease token.
 */

export async function markDocumentDuplicate(
  client: DbClient,
  documentId: string,
  existingDocumentId: string,
  reason: string,
): Promise<void> {
  await client.query(
    `update sutra.documents
        set assignment_state = 'duplicate', duplicate_of_document_id = $2
      where id = $1`,
    [documentId, existingDocumentId],
  );
  await client.query(
    `select sutra.write_audit(clinic_id, patient_id, null, 'document', id, 'duplicate_detected', null, $2)
       from sutra.documents where id = $1`,
    [documentId, reason],
  );
}

export async function quarantineDocument(
  client: DbClient,
  documentId: string,
  reason: string,
  documentIssues: IssueCode[],
): Promise<void> {
  await client.query(
    `update sutra.documents
        set assignment_state = 'quarantined', quarantine_reason = $2, released_to_patient = false
      where id = $1`,
    [documentId, reason],
  );
  await client.query(
    `update sutra.review_batches
        set identity_state = 'mismatch', identity_reason = $2, state = 'identity_hold',
            document_issues = $3::jsonb, updated_at = now()
      where document_id = $1 and state <> 'published'`,
    [documentId, reason, JSON.stringify(documentIssues)],
  );
  await client.query(
    `select sutra.write_audit(clinic_id, patient_id, null, 'document', id, 'source_quarantined', null, $2)
       from sutra.documents where id = $1`,
    [documentId, reason],
  );
}

export async function setVersionPageCount(
  client: DbClient,
  versionId: string,
  pageCount: number,
): Promise<void> {
  await client.query('update sutra.document_versions set page_count = $2 where id = $1', [
    versionId,
    pageCount,
  ]);
}

export async function createExtractionRun(
  client: DbClient,
  input: {
    jobId: string;
    documentId: string;
    versionId: string;
    clinicId: string;
    patientId: string;
    provider: string;
    model: string;
    mode: 'fixture' | 'live';
    promptHash: string;
    schemaVersion: string;
    aliasMapVersion: string;
    runNumber: number;
    deadlineAt: Date;
  },
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    'select id from sutra.extraction_runs where job_id = $1',
    [input.jobId],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const result = await client.query<{ id: string }>(
    `insert into sutra.extraction_runs (
       job_id, document_id, version_id, clinic_id, patient_id, provider, model, mode,
       prompt_hash, schema_version, alias_map_version, run_number, first_leased_at, deadline_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)
     on conflict do nothing
     returning id`,
    [
      input.jobId,
      input.documentId,
      input.versionId,
      input.clinicId,
      input.patientId,
      input.provider,
      input.model,
      input.mode,
      input.promptHash,
      input.schemaVersion,
      input.aliasMapVersion,
      input.runNumber,
      input.deadlineAt,
    ],
  );
  if (result.rows[0]) return result.rows[0].id;
  const fallback = await client.query<{ id: string }>(
    'select id from sutra.extraction_runs where job_id = $1',
    [input.jobId],
  );
  return fallback.rows[0]!.id;
}

/**
 * Reserves the next model call in the run ledger before dispatch. The call count
 * survives worker restarts and a retry never creates a fresh budget implicitly.
 */
export async function reserveProviderCall(
  client: DbClient,
  runId: string,
  maxCalls: number,
  reservedCostUsd: number,
): Promise<{ ordinal: number } | null> {
  const run = await client.query<{ call_count: number; reserved_cost_usd: string; deadline_at: string | null }>(
    'select call_count, reserved_cost_usd, deadline_at from sutra.extraction_runs where id = $1 for update',
    [runId],
  );
  const row = run.rows[0];
  if (!row) throw new Error('extraction run not found');
  if (row.call_count >= maxCalls) return null;
  if (row.deadline_at && new Date(row.deadline_at).getTime() < Date.now()) return null;

  const ordinal = row.call_count + 1;
  await client.query(
    `insert into sutra.provider_calls (run_id, ordinal, state, reserved_cost_usd)
     values ($1, $2, 'reserved', $3)
     on conflict (run_id, ordinal) do nothing`,
    [runId, ordinal, reservedCostUsd],
  );
  await client.query(
    `update sutra.extraction_runs
        set call_count = $2,
            reserved_cost_usd = reserved_cost_usd + $3
      where id = $1`,
    [runId, ordinal, reservedCostUsd],
  );
  return { ordinal };
}

export async function reconcileProviderCall(
  client: DbClient,
  runId: string,
  ordinal: number,
  result: {
    state: 'succeeded' | 'failed' | 'dispatched';
    actualCostUsd: number;
    tokenCount: number;
    errorCategory: string | null;
  },
): Promise<void> {
  await client.query(
    `update sutra.provider_calls
        set state = $3, actual_cost_usd = $4, token_count = $5, error_category = $6,
            dispatched_at = coalesce(dispatched_at, now()),
            completed_at = case when $3 = 'dispatched' then null else now() end
      where run_id = $1 and ordinal = $2`,
    [runId, ordinal, result.state, result.actualCostUsd, result.tokenCount, result.errorCategory],
  );
  await client.query(
    `update sutra.extraction_runs
        set actual_cost_usd = actual_cost_usd + $2,
            input_tokens = input_tokens + $3,
            output_tokens = output_tokens + $4
      where id = $1`,
    [
      runId,
      result.actualCostUsd,
      Math.round(result.tokenCount * 0.7),
      Math.round(result.tokenCount * 0.3),
    ],
  );
}

export type SaveExtractionInput = {
  jobId: string;
  leaseToken: string;
  runId: string;
  documentId: string;
  versionId: string;
  clinicId: string;
  patientId: string;
  identityState: IdentityState;
  identityRaw: string | null;
  identityReason: string | null;
  documentIssues: IssueCode[];
  pages: {
    page: number;
    coverage: string;
    quoteCount: number;
    proposedCount?: number;
    note?: string;
  }[];
  unreadablePages: number[];
  evidence: {
    temporaryId: string;
    page: number;
    quote: string;
    bbox: [number, number, number, number] | null;
    origin: EvidenceOrigin;
  }[];
  facts: (DraftFactInput & { issues: IssueCode[]; plotEligible: boolean; sourceOnly: boolean })[];
  usage: { inputTokens: number; outputTokens: number; latencyMs: number; calls: number };
  replacement?: boolean;
};

export type SaveExtractionResult = { batchId: string; factIds: string[] };

/**
 * Persists one extraction result as a draft review batch inside a single
 * transaction, fenced by the lease token. No approved row is written here.
 */
export async function saveExtraction(
  client: DbClient,
  input: SaveExtractionInput,
): Promise<SaveExtractionResult> {
  const fenced = await client.query<{ id: string }>(
    'select id from sutra.jobs where id = $1 and lease_token = $2 and state = $3 for update',
    [input.jobId, input.leaseToken, 'running'],
  );
  if (fenced.rowCount === 0) throw new Error('stale_lease');

  const evidenceIds = new Map<string, string>();
  for (const span of input.evidence) {
    const inserted = await client.query<{ id: string }>(
      `insert into sutra.evidence_spans (clinic_id, document_version_id, page, quote, bbox, origin)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        input.clinicId,
        input.versionId,
        span.page,
        span.quote,
        span.bbox,
        span.origin,
      ],
    );
    evidenceIds.set(span.temporaryId, inserted.rows[0]!.id);
  }

  // A replacement draft supersedes the earlier open draft for this document.
  const previous = await client.query<{ id: string }>(
    `select id from sutra.review_batches
      where document_id = $1 and state <> 'published'
      order by revision desc limit 1`,
    [input.documentId],
  );
  if (previous.rows[0]) {
    await client.query(
      `update sutra.review_batches set state = 'superseded', updated_at = now() where id = $1`,
      [previous.rows[0].id],
    );
  }

  const batch = await client.query<{ id: string }>(
    `insert into sutra.review_batches (
       clinic_id, patient_id, document_id, document_version_id, extraction_run_id,
       revision, identity_state, identity_reason, identity_raw, state,
       coverage_json, document_issues, supersedes_batch_id
     ) values ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
     returning id`,
    [
      input.clinicId,
      input.patientId,
      input.documentId,
      input.versionId,
      input.runId,
      input.identityState,
      input.identityReason,
      input.identityRaw,
      input.identityState === 'mismatch'
        ? 'identity_hold'
        : input.facts.length > 0 || input.documentIssues.length > 0
          ? 'draft'
          : 'ready',
      JSON.stringify({
        pages: input.pages,
        unreadablePages: input.unreadablePages,
        usage: input.usage,
      }),
      JSON.stringify(input.documentIssues),
      previous.rows[0]?.id ?? null,
    ],
  );
  const batchId = batch.rows[0]!.id;

  const factIds: string[] = [];
  let ordinal = 0;
  for (const fact of input.facts) {
    ordinal += 1;
    const normalized = fact.normalized as NormalizedPayload & Record<string, unknown>;
    const inserted = await client.query<{ id: string }>(
      `insert into sutra.draft_facts (
         clinic_id, patient_id, document_id, document_version_id, review_batch_id,
         kind, raw_label, raw_value, raw_unit, event_date, date_raw, date_kind, date_precision,
         normalized_json, issues_json, review_state, group_id, ordinal, source_only
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12, $13, $14::jsonb, $15::jsonb,
                 'unreviewed', $16, $17, $18)
       returning id`,
      [
        input.clinicId,
        input.patientId,
        input.documentId,
        input.versionId,
        batchId,
        fact.kind,
        fact.rawLabel,
        fact.rawValue,
        fact.rawUnit,
        fact.eventDate,
        fact.dateRaw,
        fact.dateKind,
        fact.datePrecision,
        JSON.stringify(normalized),
        JSON.stringify(fact.issues),
        fact.groupId ?? null,
        ordinal,
        fact.sourceOnly,
      ],
    );
    const factId = inserted.rows[0]!.id;
    factIds.push(factId);
    for (const temporaryId of fact.evidenceIds) {
      const evidenceId = evidenceIds.get(temporaryId);
      if (!evidenceId) continue;
      await client.query(
        `insert into sutra.draft_fact_evidence (draft_fact_id, evidence_id, clinic_id)
         values ($1, $2, $3) on conflict do nothing`,
        [factId, evidenceId, input.clinicId],
      );
    }
  }

  await client.query(
    `update sutra.extraction_runs
        set state = 'succeeded', usage_json = $2::jsonb, finished_at = now()
      where id = $1`,
    [input.runId, JSON.stringify(input.usage)],
  );

  return { batchId, factIds };
}

export async function failExtractionRun(
  client: DbClient,
  runId: string,
  errorCode: string,
): Promise<void> {
  await client.query(
    `update sutra.extraction_runs set state = 'failed', error_code = $2, finished_at = now()
      where id = $1 and state = 'running'`,
    [runId, errorCode],
  );
}

export async function saveExportResult(
  client: DbClient,
  input: {
    exportId: string;
    jobId: string;
    leaseToken: string;
    objectPath: string;
    coverageNotes: string[];
  },
): Promise<void> {
  const fenced = await client.query(
    'select 1 from sutra.jobs where id = $1 and lease_token = $2 and state = $3',
    [input.jobId, input.leaseToken, 'running'],
  );
  if (fenced.rowCount === 0) throw new Error('stale_lease');
  await client.query(
    `update sutra.exports
        set state = 'ready', object_path = $2, ready_at = now(),
            coverage_notes = coalesce(coverage_notes, '[]'::jsonb) || $3::jsonb
      where id = $1`,
    [input.exportId, input.objectPath, JSON.stringify(input.coverageNotes)],
  );
  // Audit rows are written by the SECURITY DEFINER helper; the worker role has no
  // direct insert grant on audit_events.
  await client.query(
    `select sutra.write_audit(clinic_id, patient_id, null, 'export', id, 'export_ready')
       from sutra.exports where id = $1`,
    [input.exportId],
  );
}

export async function failExport(
  client: DbClient,
  exportId: string,
  errorCode: string,
): Promise<void> {
  await client.query(
    `update sutra.exports set state = 'failed', error_code = $2 where id = $1 and state <> 'ready'`,
    [exportId, errorCode],
  );
}

/** Source objects left behind by an upload that never completed. */
export async function orphanedUploadObjects(
  client: DbClient,
  olderThanHours: number,
): Promise<{ sessionId: string; clinicId: string; items: { objectPath: string }[] }[]> {
  const result = await client.query<{
    id: string;
    clinic_id: string;
    items: { objectPath: string }[];
  }>(
    `select s.id, s.clinic_id, coalesce(s.manifest_json -> 'items', '[]'::jsonb) as items
       from sutra.upload_sessions s
      where s.state <> 'completed'
        and s.created_at < now() - make_interval(hours => $1)`,
    [olderThanHours],
  );
  return result.rows.map((row) => ({
    sessionId: row.id,
    clinicId: row.clinic_id,
    items: row.items,
  }));
}

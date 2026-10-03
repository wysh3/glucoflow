import {
  RECORD_SEARCH_MAX_RESULTS,
  SEARCH_SCOPE_NOTE,
  type RecordSearchItem,
  type RecordSearchMatchedField,
  type RecordSearchQuery,
  type RecordSearchResult,
} from '@sutra/contracts';
import { expandSearchTerms } from '@sutra/domain';
import { encodeCursor, decodeCursor } from './identity';
import type { DbClient } from './pool';

/**
 * Patient-scoped record search. Retrieval only: results are source references with
 * a matching snippet, never a generated medical explanation.
 * Source: docs/mvp/05-data-and-api.md "Search contract".
 */

const TSQUERY_UNSAFE = /[^a-z0-9 ]+/g;

/**
 * Builds a deterministic tsquery string from the expanded alias terms.
 * The value is still passed as a bound parameter and is re-validated in SQL.
 */
export function buildTsQuery(rawQuery: string): { tsquery: string; terms: string[] } {
  const expanded = expandSearchTerms(rawQuery);
  const terms = new Set<string>();
  for (const term of expanded) {
    const cleaned = term.toLowerCase().replace(TSQUERY_UNSAFE, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2) continue;
    const words = cleaned.split(' ').filter((word) => word.length >= 2);
    if (words.length === 0) continue;
    terms.add(words.join(' & '));
  }
  const list = [...terms];
  const tsquery = list.length > 0 ? list.join(' | ') : 'zzznomatch';
  return { tsquery, terms: list };
}

export async function searchPatientRecords(
  client: DbClient,
  patientId: string,
  query: RecordSearchQuery,
): Promise<RecordSearchResult> {
  const limit = RECORD_SEARCH_MAX_RESULTS;
  const offset = decodeCursor(query.cursor);
  const { tsquery } = buildTsQuery(query.q);

  const result = await client.query<{
    document_id: string | null;
    document_version_id: string | null;
    document_name: string;
    page: number | null;
    document_date: string | null;
    date_kind: string;
    snippet: string;
    matched_field: string;
    matched_term: string;
    fact_id: string | null;
    note_id: string | null;
    source_available: boolean;
    source_only: boolean;
    approval_revision: number | null;
  }>(
    `select * from sutra.search_patient_records($1, $2, $3, $4::date, $5::date, $6, $7, $8)`,
    [
      patientId,
      query.q,
      tsquery,
      query.from ?? null,
      query.to ?? null,
      query.category ?? null,
      limit + 1,
      offset,
    ],
  );

  const rows = result.rows.slice(0, limit);
  const items: RecordSearchItem[] = rows.map((row) => ({
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    documentName: row.document_name,
    page: row.page,
    documentDate: row.document_date,
    dateKind: row.date_kind as RecordSearchItem['dateKind'],
    snippet: (row.snippet ?? '').replace(/\[\[/g, '').replace(/\]\]/g, ''),
    matchedField: row.matched_field as RecordSearchMatchedField,
    matchedTerm: row.matched_term,
    factId: row.fact_id,
    noteId: row.note_id,
    sourceAvailable: row.source_available,
    sourceOnly: row.source_only,
    approvalRevision: row.approval_revision,
  }));

  return {
    items,
    nextCursor: result.rows.length > limit ? encodeCursor(offset + limit) : null,
    scopeNote: SEARCH_SCOPE_NOTE,
  };
}

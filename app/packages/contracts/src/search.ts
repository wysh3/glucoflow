import { z } from 'zod';
import { isoDateSchema, uuidSchema, type ISODate, type UUID } from './common';
import type { DateKind } from './facts';

/**
 * Patient-scoped record search. Source: docs/mvp/05-data-and-api.md "Search contract".
 * Retrieval only: results carry source references, never generated medical explanations.
 */

export const recordSearchQuerySchema = z.object({
  q: z.string().min(2).max(100),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  category: z.string().max(64).optional(),
  cursor: z.string().max(512).optional(),
});

export type RecordSearchQuery = {
  q: string;
  from?: ISODate;
  to?: ISODate;
  category?: string;
  cursor?: string;
};

export const RECORD_SEARCH_MAX_RESULTS = 25;

export type RecordSearchMatchedField =
  | 'test_label'
  | 'alias_expansion'
  | 'prescription_name'
  | 'prescription_instruction'
  | 'examination_text'
  | 'document_filename'
  | 'patient_note';

export type RecordSearchItem = {
  documentId: UUID | null;
  documentVersionId: UUID | null;
  documentName: string;
  page: number | null;
  documentDate: string | null;
  dateKind: DateKind;
  snippet: string;
  matchedField: RecordSearchMatchedField;
  matchedTerm: string;
  factId: UUID | null;
  noteId: UUID | null;
  sourceAvailable: boolean;
  /** Source-only facts are searchable even though they are not chart points. */
  sourceOnly: boolean;
  approvalRevision: number | null;
};

export type RecordSearchResult = {
  items: RecordSearchItem[];
  nextCursor: string | null;
  /** Always shown with results: an empty result is not a negative clinical finding. */
  scopeNote: string;
};

export const SEARCH_SCOPE_NOTE =
  'Search covers approved records and uploaded document names in this patient’s record. No result means no match in these records.';

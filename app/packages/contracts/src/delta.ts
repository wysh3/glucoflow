import { z } from 'zod';

/**
 * The delta is the unit the doctor reads before a follow-up. It is not a record
 * and not a summary: it is the small set of changes, open items, disagreements
 * and unknowns that need a decision now.
 */

export const deltaBlockSchema = z.enum(['changed', 'unresolved', 'conflict', 'unknown']);
export type DeltaBlock = z.infer<typeof deltaBlockSchema>;

export const deltaActionSchema = z.enum(['accepted', 'flagged', 'asked_patient']);
export type DeltaAction = z.infer<typeof deltaActionSchema>;

export const deltaItemKindSchema = z.enum([
  'observation',
  'prescription',
  'examination',
  'note',
  'document',
  'referral',
  'result',
  'test',
  'question',
]);
export type DeltaItemKind = z.infer<typeof deltaItemKindSchema>;

export type DeltaEvidence = {
  documentId: string;
  documentVersionId: string;
  documentName: string;
  page: number;
  quote: string;
  bbox: [number, number, number, number] | null;
};

export type DeltaItem = {
  id: string;
  block: DeltaBlock;
  kind: DeltaItemKind;
  title: string;
  detail: string;
  why: string;
  date: string | null;
  ageDays: number | null;
  magnitude?: number | null;
  testCode?: string | null;
  sourceLabel: string;
  actionHint: string;
  evidence: DeltaEvidence[];
  status: 'open' | DeltaAction;
  dispositionNote: string | null;
};

export type DeltaCounts = {
  changed: number;
  unresolved: number;
  conflict: number;
  unknown: number;
};

export type DeltaPatient = {
  patientId: string;
  displayName: string;
  clinicIdentifier: string;
  birthDate: string | null;
};

export type DeltaSummary = {
  patient: DeltaPatient;
  asOf: string;
  lastVisitDate: string | null;
  counts: DeltaCounts;
  blocks: {
    changed: DeltaItem[];
    unresolved: DeltaItem[];
    conflict: DeltaItem[];
    unknown: DeltaItem[];
  };
  narrative: string;
  readSeconds: number;
  truncated: boolean;
  scopeNote: string;
};

export type DeltaObservationInput = {
  factId: string;
  testCode: string;
  displayName: string;
  numericValue: number | null;
  unit: string | null;
  date: string | null;
  datePrecision: string;
  status: string;
  evidence: DeltaEvidence[];
};

export type DeltaEventInput = {
  factId: string;
  kind: 'prescription' | 'examination' | 'observation_source_only';
  label: string;
  detail: string | null;
  date: string | null;
  status: string;
  evidence: DeltaEvidence[];
};

export type DeltaNoteInput = {
  noteId: string;
  category: string;
  body: string;
  eventDate: string | null;
  submittedAt: string;
};

export type DeltaDocumentInput = {
  documentId: string;
  filename: string;
  kind: string;
  state: string;
  pageCount: number | null;
  uploadedAt: string;
  issues: string[];
  coverageNote: string | null;
};

export type DeltaOpenItemInput = {
  id: string;
  kind: 'referral' | 'result' | 'test' | 'question';
  title: string;
  detail: string;
  date: string | null;
  ageDays: number | null;
  owner: string | null;
  actionHint: string;
  evidence: DeltaEvidence[];
};

export type DeltaUnknownInput = {
  id: string;
  title: string;
  detail: string;
  date: string | null;
  evidence: DeltaEvidence[];
};

export type DeltaDisposition = {
  action: DeltaAction;
  note: string | null;
  actorName: string | null;
  createdAt: string;
};

export type DeltaInput = {
  patient: DeltaPatient;
  asOf: string;
  lastVisitDate: string | null;
  observations: DeltaObservationInput[];
  events: DeltaEventInput[];
  notes: DeltaNoteInput[];
  documents: DeltaDocumentInput[];
  openItems: DeltaOpenItemInput[];
  unknownItems: DeltaUnknownInput[];
  dispositions?: Record<string, DeltaDisposition>;
  estimatedReadSeconds?: number;
  truncated?: boolean;
};

export const recordDeltaDispositionSchema = z.object({
  itemId: z.string().min(1).max(200),
  action: deltaActionSchema,
  note: z.string().max(1000).optional(),
});
export type RecordDeltaDispositionInput = z.infer<typeof recordDeltaDispositionSchema>;

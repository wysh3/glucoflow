import { z } from 'zod';
import {
  bboxSchema,
  dateKindSchema,
  datePrecisionSchema,
  evidenceOriginSchema,
  isoDateSchema,
  isoInstantSchema,
  uuidSchema,
  type BBox,
  type DateKind,
  type DatePrecision,
  type EvidenceOrigin,
  type UUID,
} from './common';

/**
 * Draft and approved fact contract.
 * Sources: docs/mvp/05-data-and-api.md "Fact contract", docs/mvp/09-fixed-contracts.md.
 */

export const draftFactKindSchema = z.enum(['observation', 'prescription', 'examination']);
export type DraftFactKind = z.infer<typeof draftFactKindSchema>;

/**
 * Deterministic issue codes. There is deliberately no generated clinical severity.
 */
export const issueCodeSchema = z.enum([
  'identity_missing',
  'identity_mismatch',
  'date_ambiguous',
  'unit_missing',
  'unit_unsupported',
  'evidence_unmatched',
  'possible_duplicate',
  'page_unreadable',
]);
export type IssueCode = z.infer<typeof issueCodeSchema>;

export const ISSUE_LABELS: Record<IssueCode, string> = {
  identity_missing: 'Patient identity is missing from the source',
  identity_mismatch: 'Source identifier does not match the assigned patient',
  date_ambiguous: 'Date is partial or ambiguous',
  unit_missing: 'No unit was read for this value',
  unit_unsupported: 'Unit is not accepted for charting',
  evidence_unmatched: 'Quoted text was not found on the referenced page',
  possible_duplicate: 'A similar earlier record exists',
  page_unreadable: 'This page could not be read reliably',
};

export const reviewStateSchema = z.enum(['unreviewed', 'reviewed', 'excluded']);
export type ReviewState = z.infer<typeof reviewStateSchema>;

export const batchStateSchema = z.enum([
  'draft',
  'identity_hold',
  'ready',
  'published',
  'superseded',
]);
export type BatchState = z.infer<typeof batchStateSchema>;

export const identityStateSchema = z.enum([
  'unchecked',
  'matched',
  'missing_confirmed',
  'mismatch',
]);
export type IdentityState = z.infer<typeof identityStateSchema>;

export const factStatusSchema = z.enum(['retained', 'superseded', 'withdrawn']);
export type FactStatus = z.infer<typeof factStatusSchema>;

export const observationNormalizedSchema = z.object({
  testCode: z.string().nullable(),
  numericValue: z.number().nullable(),
  unitCode: z.string().nullable(),
  rawNumericText: z.string().nullable(),
  referenceRangeText: z.string().nullable(),
  plotEligible: z.boolean(),
  /** Set when one source line yields more than one fact, e.g. a BP pair. */
  groupId: z.string().nullable(),
});

export const prescriptionNormalizedSchema = z.object({
  name: z.string().nullable(),
  strength: z.string().nullable(),
  instructions: z.string().nullable(),
});

export const examinationNormalizedSchema = z.object({
  category: z.string().nullable(),
  sourceText: z.string().nullable(),
});

export type ObservationNormalized = z.infer<typeof observationNormalizedSchema>;
export type PrescriptionNormalized = z.infer<typeof prescriptionNormalizedSchema>;
export type ExaminationNormalized = z.infer<typeof examinationNormalizedSchema>;

export const normalizedSchema = z.union([
  observationNormalizedSchema,
  prescriptionNormalizedSchema,
  examinationNormalizedSchema,
]);

export type NormalizedPayload =
  | ObservationNormalized
  | PrescriptionNormalized
  | ExaminationNormalized;

export const draftFactInputSchema = z.object({
  kind: draftFactKindSchema,
  rawLabel: z.string().min(1).max(400),
  rawValue: z.string().max(400).nullable(),
  rawUnit: z.string().max(120).nullable(),
  eventDate: isoDateSchema.nullable(),
  dateRaw: z.string().max(200).nullable(),
  dateKind: dateKindSchema,
  datePrecision: datePrecisionSchema,
  normalized: normalizedSchema,
  /** Worker evidence IDs or temporary IDs resolved through `newEvidence`. */
  evidenceIds: z.array(z.string().min(1).max(120)).max(8),
  groupId: z.string().max(120).nullable().optional(),
});

export type DraftFactInput = z.infer<typeof draftFactInputSchema>;

export type EvidenceDto = {
  evidenceId: UUID;
  documentVersionId: UUID;
  page: number;
  quote: string;
  bbox: BBox | null;
  origin: EvidenceOrigin;
};

export type DraftFactDto = {
  factId: UUID;
  kind: DraftFactKind;
  rawLabel: string;
  rawValue: string | null;
  rawUnit: string | null;
  eventDate: string | null;
  dateRaw: string | null;
  dateKind: DateKind;
  datePrecision: DatePrecision;
  normalized: NormalizedPayload;
  issues: IssueCode[];
  reviewState: ReviewState;
  reviewReason: string | null;
  revision: number;
  groupId: string | null;
  evidence: EvidenceDto[];
  updatedAt: string;
};

export type ApprovedFactDto = {
  factId: UUID;
  clinicId: UUID;
  patientId: UUID;
  kind: DraftFactKind;
  rawLabel: string;
  rawValue: string | null;
  rawUnit: string | null;
  eventDate: string | null;
  dateRaw: string | null;
  dateKind: DateKind;
  datePrecision: DatePrecision;
  normalized: NormalizedPayload;
  plotEligible: boolean;
  status: FactStatus;
  statusReason: string | null;
  approvalRevision: number;
  approvedAt: string;
  supersedesFactId: UUID | null;
  documentId: UUID;
  documentVersionId: UUID;
  groupId: string | null;
  evidence: EvidenceDto[];
};

export const evidenceSpanInputSchema = z.object({
  id: z.string().min(1).max(120),
  documentVersionId: uuidSchema,
  page: z.number().int().min(1),
  quote: z.string().min(1).max(4000),
  bbox: bboxSchema.nullable().optional(),
  origin: evidenceOriginSchema,
});

export type EvidenceSpanInput = z.infer<typeof evidenceSpanInputSchema>;

export const extractionResultSchema = z.object({
  documentIdentity: z.object({
    nameRaw: z.string().max(300).nullable(),
    identifierRaw: z.string().max(120).nullable(),
  }),
  facts: z.array(draftFactInputSchema).max(400),
  newEvidence: z
    .array(
      z.object({
        temporaryId: z.string().min(1).max(120),
        page: z.number().int().min(1),
        quote: z.string().min(1).max(4000),
      }),
    )
    .max(400),
  unhandledPages: z.array(z.number().int().min(1)).max(200),
  usage: z.object({
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    latencyMs: z.number().int().min(0),
  }),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export const extractionRunModeSchema = z.enum(['fixture', 'live']);
export type ExtractionRunMode = z.infer<typeof extractionRunModeSchema>;

export const realtimeInstant = isoInstantSchema;

export { dateKindSchema, datePrecisionSchema };
export type { DateKind, DatePrecision, EvidenceOrigin, BBox, UUID };

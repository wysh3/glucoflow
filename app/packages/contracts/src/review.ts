import { z } from 'zod';
import { isoDateSchema, uuidSchema, type UUID } from './common';
import {
  dateKindSchema,
  datePrecisionSchema,
  draftFactKindSchema,
  draftFactInputSchema,
  identityStateSchema,
  batchStateSchema,
  type BatchState,
  type DraftFactDto,
  type IdentityState,
  type IssueCode,
} from './facts';

/**
 * Review and publication contract.
 * Sources: docs/mvp/05-data-and-api.md "Publication transaction",
 * docs/mvp/09-fixed-contracts.md "Review and publication".
 */

export type ReviewPageCoverage = {
  page: number;
  coverage: 'text' | 'ocr' | 'mixed' | 'unreadable' | 'excluded';
  reason: string | null;
  quoteCount: number;
  /** A partially represented document shows its coverage note next to Open source. */
  coverageNote: string | null;
};

export type ReviewPatientHeader = {
  patientId: UUID;
  displayName: string;
  clinicIdentifier: string;
  clinicId: UUID;
  clinicName: string;
};

export type ReviewPriorFact = {
  factId: UUID;
  label: string;
  value: string | null;
  date: string | null;
  status: string;
};

export type ReviewDto = {
  documentId: UUID;
  documentVersionId: UUID;
  documentName: string;
  versionNumber: number;
  patient: ReviewPatientHeader;
  batchId: UUID;
  revision: number;
  state: BatchState;
  identityState: IdentityState;
  identityReason: string | null;
  identityRaw: string | null;
  assignedIdentifier: string;
  facts: DraftFactDto[];
  pages: ReviewPageCoverage[];
  issues: IssueCode[];
  documentIssues: IssueCode[];
  publishedAt: string | null;
  publishedRevision: number | null;
  supersedesVersionId: UUID | null;
  amendmentOfVersionId: UUID | null;
  /** Approved facts from an earlier version that an amendment affects. */
  priorFacts: ReviewPriorFact[];
  requiresDispositions: boolean;
  canPublish: boolean;
  publishBlockers: string[];
  extractionMode: 'fixture' | 'live';
  extractionProvider: string;
  extractionModel: string;
};

const correctionSchema = z.object({
  rawLabel: z.string().min(1).max(400).optional(),
  rawValue: z.string().max(400).nullable().optional(),
  rawUnit: z.string().max(120).nullable().optional(),
  eventDate: isoDateSchema.nullable().optional(),
  dateRaw: z.string().max(200).nullable().optional(),
  dateKind: dateKindSchema.optional(),
  datePrecision: datePrecisionSchema.optional(),
  testCode: z.string().max(64).nullable().optional(),
  numericValue: z.number().nullable().optional(),
  unitCode: z.string().max(64).nullable().optional(),
  plotEligible: z.boolean().optional(),
  name: z.string().max(300).nullable().optional(),
  strength: z.string().max(200).nullable().optional(),
  instructions: z.string().max(600).nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  sourceText: z.string().max(2000).nullable().optional(),
});

export type FactCorrection = z.infer<typeof correctionSchema>;

export const factDispositionSchema = z.object({
  factId: uuidSchema,
  status: z.enum(['retained', 'superseded', 'withdrawn']),
  supersededByIndex: z.number().int().min(0).nullable().optional(),
  reason: z.string().min(3).max(500).nullable().optional(),
});
export type FactDisposition = z.infer<typeof factDispositionSchema>;

export const manualFactInputSchema = draftFactInputSchema.extend({
  page: z.number().int().min(1),
  quote: z.string().min(1).max(4000),
  reason: z.string().min(3).max(500),
});
export type ManualFactInput = z.infer<typeof manualFactInputSchema>;

export const reviewPatchSchema = z.object({
  expectedRevision: z.number().int().min(0),
  factUpdates: z
    .array(
      z.object({
        factId: uuidSchema,
        action: z.enum(['review', 'exclude', 'correct']),
        reason: z.string().max(500).nullable().optional(),
        correction: correctionSchema.nullable().optional(),
      }),
    )
    .max(400)
    .default([]),
  manualFacts: z.array(manualFactInputSchema).max(50).default([]),
  pageExclusions: z
    .array(z.object({ page: z.number().int().min(1), reason: z.string().min(3).max(500) }))
    .max(200)
    .default([]),
  identity: z
    .object({
      state: z.literal('missing_confirmed'),
      reason: z.string().min(3).max(500),
    })
    .nullable()
    .optional(),
});

export type ReviewPatch = z.infer<typeof reviewPatchSchema>;

export const approveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  dispositions: z.array(factDispositionSchema).max(400).default([]),
});
export type ApproveInput = z.infer<typeof approveSchema>;

export type ApprovalDto = {
  patientId: UUID;
  approvalRevision: number;
  publishedFactIds: UUID[];
  publishedCount: number;
  supersededCount: number;
  withdrawnCount: number;
  retainedCount: number;
  coverage: { excludedPages: number[]; notes: string[] };
  approvalBatchId: UUID;
};

export const rejectAssignmentSchema = z.object({
  reason: z.string().min(3).max(500),
  expectedRevision: z.number().int().min(0),
});
export type RejectAssignmentInput = z.infer<typeof rejectAssignmentSchema>;

export const amendmentLinkSchema = z.object({
  completedUploadSessionId: uuidSchema,
  reason: z.string().min(3).max(500),
  expectedDocumentVersionId: uuidSchema,
});
export type AmendmentLinkInput = z.infer<typeof amendmentLinkSchema>;

export const reviewRevisionSchema = z.object({
  expectedApprovalRevision: z.number().int().min(0),
  reason: z.string().min(3).max(500),
});
export type ReviewRevisionInput = z.infer<typeof reviewRevisionSchema>;

export { batchStateSchema, identityStateSchema, draftFactKindSchema };

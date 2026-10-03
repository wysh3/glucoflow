import { z } from 'zod';
import { isoDateSchema, uuidSchema, type ISOInstant, type UUID } from './common';
import type { IssueCode } from './facts';

/**
 * Document, patient, queue and history DTOs.
 * Sources: docs/mvp/05-data-and-api.md tables, docs/mvp/02-screens-and-design.md routes.
 */

export const assignmentStateSchema = z.enum([
  'assigned',
  'quarantined',
  'unassigned',
  'duplicate',
]);
export type AssignmentState = z.infer<typeof assignmentStateSchema>;

export const processingStateSchema = z.enum([
  'uploading',
  'queued',
  'processing',
  'awaiting_review',
  'review_in_progress',
  'approved',
  'failed',
  'quarantined',
  'duplicate',
]);
export type ProcessingState = z.infer<typeof processingStateSchema>;

export const PROCESSING_STATE_LABELS: Record<ProcessingState, string> = {
  uploading: 'Upload incomplete',
  queued: 'Waiting to start',
  processing: 'Reading document',
  awaiting_review: 'Awaiting review',
  review_in_progress: 'In review',
  approved: 'Approved',
  failed: 'Could not finish',
  quarantined: 'Patient details need checking',
  duplicate: 'Already uploaded',
};

export type PatientSummaryDto = {
  patientId: UUID;
  clinicId: UUID;
  clinicIdentifier: string;
  displayName: string;
  birthDate: string | null;
  approvalRevision: number;
  lastRecordDate: string | null;
  pendingCount: number;
  documentCount: number;
  latestReportDate: string | null;
};

export type PatientDetailDto = PatientSummaryDto & {
  clinicName: string;
  isDemo: boolean;
};

export type DocumentVersionDto = {
  documentVersionId: UUID;
  versionNumber: number;
  pageCount: number | null;
  bytes: number;
  sha256: string;
  createdAt: ISOInstant;
  supersedesVersionId: UUID | null;
  isCurrent: boolean;
};

export type DocumentDto = {
  documentId: UUID;
  clinicId: UUID;
  patientId: UUID;
  patientName: string;
  patientIdentifier: string;
  filename: string;
  uploaderName: string;
  uploadedAt: ISOInstant;
  state: ProcessingState;
  stateLabel: string;
  assignmentState: AssignmentState;
  pageCount: number | null;
  bytes: number;
  currentVersion: DocumentVersionDto | null;
  versions: DocumentVersionDto[];
  issues: IssueCode[];
  coverageNote: string | null;
  approvalRevision: number | null;
  /** True when an amendment is linked but not yet published. */
  amendmentPending: boolean;
  duplicateOfDocumentId: UUID | null;
  kind: string;
  /** The completed upload session that produced this version, when one exists. */
  uploadSessionId: UUID | null;
};

export type QueueItemDto = {
  jobId: UUID | null;
  documentId: UUID;
  documentVersionId: UUID | null;
  patientId: UUID;
  patientName: string;
  patientIdentifier: string;
  filename: string;
  uploadedAt: ISOInstant;
  uploaderName: string;
  state: ProcessingState;
  stateLabel: string;
  jobState: string | null;
  jobStage: string | null;
  jobStageLabel: string | null;
  attempt: number;
  errorCode: string | null;
  errorMessage: string | null;
  retryAllowed: boolean;
  kind: string;
};

export const queueQuerySchema = z.object({
  state: z
    .enum(['all', 'processing', 'awaiting_review', 'review_in_progress', 'failed'])
    .default('all'),
  cursor: z.string().max(512).optional(),
});
export type QueueQuery = z.infer<typeof queueQuerySchema>;

export type AuditEventDto = {
  auditEventId: UUID;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: UUID;
  revision: number | null;
  reason: string | null;
  createdAt: ISOInstant;
  summary: string;
};

export const patientSearchQuerySchema = z.object({
  search: z.string().max(120).optional(),
  cursor: z.string().max(512).optional(),
});
export type PatientSearchQuery = z.infer<typeof patientSearchQuerySchema>;

export { isoDateSchema, uuidSchema };

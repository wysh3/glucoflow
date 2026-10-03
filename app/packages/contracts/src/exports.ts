import { z } from 'zod';
import { uuidSchema, type ISOInstant, type UUID } from './common';

/**
 * Export snapshot contract.
 * Sources: docs/mvp/03-architecture.md "Export", docs/mvp/05-data-and-api.md.
 */

export const createExportSchema = z.object({
  approvalRevision: z.number().int().min(0),
});
export type CreateExportInput = z.infer<typeof createExportSchema>;

export type ExportState = 'queued' | 'running' | 'ready' | 'failed';

export type ExportJobDto = {
  exportId: UUID;
  jobId: UUID | null;
  state: ExportState;
  stateLabel: string;
  approvalRevision: number;
  createdAt: ISOInstant;
  dataCutoffAt: ISOInstant;
  factCount: number;
  noteCount: number;
  synthetic: boolean;
  coverageNotes: string[];
  /** Short-lived authorized URL, issued only when the caller is authorized. */
  downloadUrl: string | null;
  downloadExpiresAt: ISOInstant | null;
  errorCode: string | null;
};

export type ExportSnapshotManifest = {
  exportId: UUID;
  clinicId: UUID;
  patientId: UUID;
  approvalRevision: number;
  dataCutoffAt: ISOInstant;
  synthetic: boolean;
  factIds: UUID[];
  noteVersionIds: UUID[];
  previousExportId: UUID | null;
  coverageNotes: string[];
};

export const exportSnapshotManifestSchema = z.object({
  exportId: uuidSchema,
  clinicId: uuidSchema,
  patientId: uuidSchema,
  approvalRevision: z.number().int(),
  dataCutoffAt: z.string(),
  synthetic: z.boolean(),
  factIds: z.array(uuidSchema),
  noteVersionIds: z.array(uuidSchema),
  previousExportId: uuidSchema.nullable(),
  coverageNotes: z.array(z.string()),
});

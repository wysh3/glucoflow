import { z } from 'zod';
import { isoDateSchema, uuidSchema, type UUID } from './common';

/**
 * Upload session contract.
 * Sources: docs/mvp/05-data-and-api.md, docs/mvp/09-fixed-contracts.md
 * "Upload limits and lifecycle".
 */

export const UPLOAD_MAX_BYTES = 15_728_640; // 15 MiB, per file and per photo batch
export const UPLOAD_MAX_PAGES = 10;
export const UPLOAD_MAX_PHOTOS = 10;
/** Application completion window. Distinct from the provider's 2 hour token. */
export const UPLOAD_COMPLETION_WINDOW_SECONDS = 15 * 60;
export const STORAGE_UPLOAD_TOKEN_SECONDS = 2 * 60 * 60;
export const DOWNLOAD_URL_SECONDS = 60;

export const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type AcceptedFileType = (typeof ACCEPTED_FILE_TYPES)[number];

export const uploadKindSchema = z.enum(['file', 'photos']);
export type UploadKind = z.infer<typeof uploadKindSchema>;

export const uploadSessionStateSchema = z.enum(['created', 'completed', 'cancelled', 'expired']);
export type UploadSessionState = z.infer<typeof uploadSessionStateSchema>;

export const uploadManifestItemSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ACCEPTED_FILE_TYPES),
  byteCount: z.number().int().min(1).max(UPLOAD_MAX_BYTES),
});
export type UploadManifestItem = z.infer<typeof uploadManifestItemSchema>;

export const createUploadSchema = z.object({
  patientId: uuidSchema,
  kind: uploadKindSchema,
  files: z.array(uploadManifestItemSchema).min(1).max(UPLOAD_MAX_PHOTOS),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export type UploadTargetDto = {
  objectPath: string;
  filename: string;
  contentType: string;
  byteCount: number;
  method: 'PUT' | 'POST';
  uploadUrl: string;
  /** Required by the provider's signed-upload endpoint; never a storage key. */
  uploadToken: string | null;
};

export type UploadSessionDto = {
  sessionId: UUID;
  patientId: UUID;
  clinicId: UUID;
  kind: UploadKind;
  state: UploadSessionState;
  items: UploadTargetDto[];
  createdAt: string;
  /** Application-level completion deadline (15 minutes). */
  completionExpiresAt: string;
  /** Provider signed-upload token lifetime (2 hours), shown honestly in the UI. */
  providerTokenExpiresAt: string;
};

export type UploadCompletionDto = {
  documentId: UUID;
  jobId: UUID;
  duplicateOfDocumentId: UUID | null;
  pageCount: number | null;
  state: string;
};

export type PendingUploadDto = {
  sessionId: UUID;
  patientId: UUID;
  patientName: string;
  kind: UploadKind;
  state: UploadSessionState;
  createdAt: string;
  completionExpiresAt: string;
  fileNames: string[];
  uploadedBytes: number;
  declaredBytes: number;
  /** Resume is only possible while the completion window is open. */
  resumable: boolean;
};

export const pendingUploadsSchema = z.array(z.any());
export { isoDateSchema };

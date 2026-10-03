import { z } from 'zod';

/**
 * Shared identifiers, clinical date handling and actor context.
 * Mirrors docs/mvp/09-fixed-contracts.md "Common types".
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

export const uuidSchema = z.string().regex(UUID_RE, 'expected a UUID');
/** Clinical dates stay as YYYY-MM-DD strings and are never timezone-converted. */
export const isoDateSchema = z.string().regex(ISO_DATE_RE, 'expected YYYY-MM-DD');
export const isoInstantSchema = z.string().regex(ISO_INSTANT_RE, 'expected a UTC ISO 8601 instant');

export type UUID = z.infer<typeof uuidSchema>;
export type ISODate = z.infer<typeof isoDateSchema>;
export type ISOInstant = z.infer<typeof isoInstantSchema>;

export const dateKindSchema = z.enum([
  'collection',
  'report',
  'prescription',
  'examination',
  'reported',
]);
export type DateKind = z.infer<typeof dateKindSchema>;

export const datePrecisionSchema = z.enum(['day', 'month', 'year', 'unknown']);
export type DatePrecision = z.infer<typeof datePrecisionSchema>;

export const noteCategorySchema = z.enum([
  'medication_taking',
  'symptoms',
  'diet_activity',
  'other',
]);
export type NoteCategory = z.infer<typeof noteCategorySchema>;

export const patientContextSchema = z.object({
  kind: z.literal('patient'),
  clinicId: uuidSchema,
  patientId: uuidSchema,
});
export const clinicContextSchema = z.object({
  kind: z.literal('clinic'),
  clinicId: uuidSchema,
  reviewer: z.boolean(),
  clinician: z.boolean(),
});
export const contextSchema = z.discriminatedUnion('kind', [
  patientContextSchema,
  clinicContextSchema,
]);
export type PatientContext = z.infer<typeof patientContextSchema>;
export type ClinicContext = z.infer<typeof clinicContextSchema>;
export type Context = z.infer<typeof contextSchema>;

export type ActorContext = {
  userId: UUID;
  email: string;
  displayName: string;
  contexts: Context[];
  /** True only when the server is running in a non-production local demo mode. */
  demoMode: boolean;
};

export const evidenceOriginSchema = z.enum([
  'pdf_text',
  'ocr',
  'visual_transcription',
  'manual',
]);
export type EvidenceOrigin = z.infer<typeof evidenceOriginSchema>;

export const evidenceRefSchema = z.object({
  evidenceId: uuidSchema,
  page: z.number().int().min(1),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

/** Normalized bbox on the oriented source page, [x0, y0, x1, y1] in 0..1. */
export const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type BBox = z.infer<typeof bboxSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export const paginationQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

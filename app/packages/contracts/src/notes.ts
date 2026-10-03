import { z } from 'zod';
import { isoDateSchema, noteCategorySchema, uuidSchema, type ISOInstant, type UUID } from './common';

/**
 * Patient note contract. Patient statements keep their reporter and never become
 * measured results through review. Source: docs/mvp/01-product.md, docs/mvp/05-data-and-api.md.
 */

export const NOTE_MAX_CHARS = 1000;

export const NOTE_CATEGORY_LABELS: Record<string, string> = {
  medication_taking: 'Medication taking',
  symptoms: 'Symptoms',
  diet_activity: 'Diet / activity',
  other: 'Other',
};

export const createNoteSchema = z.object({
  category: noteCategorySchema,
  body: z.string().trim().min(1).max(NOTE_MAX_CHARS),
  eventDate: isoDateSchema.nullable().optional(),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const correctNoteSchema = createNoteSchema;
export type CorrectNoteInput = z.infer<typeof correctNoteSchema>;

export type PatientNoteDto = {
  noteId: UUID;
  patientId: UUID;
  authorId: UUID;
  authorName: string;
  /** Always 'patient': a note cannot become a clinically verified claim. */
  reporter: 'patient';
  category: string;
  body: string;
  eventDate: string | null;
  submittedAt: ISOInstant;
  version: number;
  supersedesNoteId: UUID | null;
  /** Separate status vocabulary from fact approval. */
  seenBy: string | null;
  seenAt: ISOInstant | null;
  isCurrent: boolean;
};

export const acknowledgeNoteSchema = z.object({});
export type AcknowledgeNoteInput = z.infer<typeof acknowledgeNoteSchema>;

import { z } from 'zod';
import { isoDateSchema, uuidSchema, type ISODate, type UUID } from './common';
import {
  type DateKind,
  type DatePrecision,
  type EvidenceDto,
  type FactStatus,
  type IssueCode,
} from './facts';

/**
 * Timeline contract. Source: docs/mvp/09-fixed-contracts.md "Common types" and
 * docs/mvp/05-data-and-api.md "Search contract" / timeline pagination rules.
 */

/** Interactive views never load more than this many observations at once. */
export const TIMELINE_DISPLAY_BOUND = 2000;

export const timelineQuerySchema = z.object({
  testCodes: z.array(z.string().min(1).max(64)).max(3),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  cursor: z.string().max(512).optional(),
});

export type TimelineQuery = {
  testCodes: string[];
  from?: ISODate;
  to?: ISODate;
  cursor?: string;
};

export type TimelineObservation = {
  factId: UUID;
  testCode: string;
  displayName: string;
  numericValue: number | null;
  unit: string | null;
  rawValue: string | null;
  rawUnit: string | null;
  date: string | null;
  dateKind: DateKind;
  datePrecision: DatePrecision;
  referenceRangeText: string | null;
  plotEligible: boolean;
  groupId: string | null;
  documentId: UUID;
  documentVersionId: UUID;
  approvalRevision: number;
  status: FactStatus;
  evidence: EvidenceDto[];
};

export type TimelineEvent = {
  factId: UUID;
  kind: 'prescription' | 'examination' | 'observation_source_only';
  label: string;
  detail: string | null;
  date: string | null;
  dateRaw: string | null;
  dateKind: DateKind;
  datePrecision: DatePrecision;
  documentId: UUID;
  documentVersionId: UUID;
  approvalRevision: number;
  status: FactStatus;
  evidence: EvidenceDto[];
};

export type TimelineNote = {
  noteId: UUID;
  category: string;
  body: string;
  eventDate: string | null;
  submittedAt: string;
  authorRole: 'patient';
  seenBy: string | null;
  seenAt: string | null;
  supersedesNoteId: UUID | null;
  version: number;
};

export type TimelineCoverage = {
  /** Collection/date-filter scope that produced this page, stated in the UI. */
  from: string | null;
  to: string | null;
  testCodes: string[];
  observationCount: number;
  displayBound: number;
  truncated: boolean;
};

export type TimelineResult = {
  observations: TimelineObservation[];
  events: TimelineEvent[];
  notes: TimelineNote[];
  coverage: TimelineCoverage;
  observationsComplete: boolean;
  nextCursor: string | null;
  eventsNextCursor: string | null;
  notesNextCursor: string | null;
  /** Neutral availability label inputs. Never a clinical availability verdict. */
  latestReportDate: string | null;
  awaitingReviewCount: number;
  sourceOnlyCount: number;
  unitsInUse: { testCode: string; unit: string | null; count: number }[];
  issueSummary: IssueCode[];
};

export const timelineResultSchema = z.object({
  observations: z.array(z.any()),
  events: z.array(z.any()),
  notes: z.array(z.any()),
  coverage: z.object({
    from: z.string().nullable(),
    to: z.string().nullable(),
    testCodes: z.array(z.string()),
    observationCount: z.number().int(),
    displayBound: z.number().int(),
    truncated: z.boolean(),
  }),
  observationsComplete: z.boolean(),
  nextCursor: z.string().nullable(),
  eventsNextCursor: z.string().nullable(),
  notesNextCursor: z.string().nullable(),
  latestReportDate: z.string().nullable(),
  awaitingReviewCount: z.number().int(),
  sourceOnlyCount: z.number().int(),
  unitsInUse: z.array(
    z.object({ testCode: z.string(), unit: z.string().nullable(), count: z.number().int() }),
  ),
  issueSummary: z.array(z.string()),
});

export type TimelineDisplayRow = {
  key: string;
  date: string | null;
  label: string;
  value: string;
  unit: string | null;
  testCode: string | null;
  seriesKey: string;
};

export function uuidOrNull(value: string | null | undefined): UUID | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type { ISODate };

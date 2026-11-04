import { z } from 'zod';
import type { ISOInstant, UUID } from './common';

/**
 * Result accountability ledger.
 *
 * This is an administrative receipt for an incoming report. The lab's own flag
 * is the only source of criticality; this product never interprets a value,
 * triages a patient or recommends a test or treatment.
 */

export const resultFlagSchema = z.enum(['critical', 'abnormal', 'normal', 'unknown']);
export type ResultFlag = z.infer<typeof resultFlagSchema>;

export const resultStatusSchema = z.enum([
  'unmatched',
  'matched',
  'owned',
  'acknowledged',
  'patient_informed',
  'closed',
]);
export type ResultStatus = z.infer<typeof resultStatusSchema>;

export const resultChannelSchema = z.enum([
  'pdf',
  'paper',
  'whatsapp',
  'portal',
  'email',
  'other',
]);
export type ResultChannel = z.infer<typeof resultChannelSchema>;

export const informedChannelSchema = z.enum([
  'call',
  'whatsapp',
  'sms',
  'in_person',
  'letter',
  'other',
]);
export type InformedChannel = z.infer<typeof informedChannelSchema>;

export const RESULT_FLAG_LABELS: Record<ResultFlag, string> = {
  critical: 'Critical, lab flagged',
  abnormal: 'Abnormal, lab flagged',
  normal: 'Normal, lab flagged',
  unknown: 'No lab flag',
};

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  unmatched: 'Needs patient match',
  matched: 'Ready to assign',
  owned: 'Owned',
  acknowledged: 'Acknowledged',
  patient_informed: 'Patient informed',
  closed: 'Closed',
};

export type ResultEventDto = {
  eventId: UUID;
  eventType:
    | 'received'
    | 'matched'
    | 'assigned'
    | 'acknowledged'
    | 'patient_informed'
    | 'escalated'
    | 'closed';
  actorName: string | null;
  fromStatus: ResultStatus | null;
  toStatus: ResultStatus | null;
  note: string | null;
  createdAt: ISOInstant;
};

export type ResultDto = {
  resultId: UUID;
  receiptCode: string;
  clinicId: UUID;
  patientId: UUID | null;
  patientName: string | null;
  patientIdentifier: string | null;
  documentId: UUID | null;
  documentVersionId: UUID | null;
  filename: string | null;
  sourceChannel: ResultChannel;
  labName: string | null;
  reportReceivedAt: ISOInstant;
  patientNameRaw: string;
  patientIdentifierRaw: string | null;
  testName: string;
  valueText: string;
  unit: string | null;
  labFlag: ResultFlag;
  status: ResultStatus;
  statusLabel: string;
  ownerId: UUID | null;
  ownerName: string | null;
  dueAt: ISOInstant | null;
  acknowledgedAt: ISOInstant | null;
  acknowledgedByName: string | null;
  informedAt: ISOInstant | null;
  informedByName: string | null;
  informedChannel: InformedChannel | null;
  readBackConfirmed: boolean;
  readBackAt: ISOInstant | null;
  escalationLevel: number;
  closedAt: ISOInstant | null;
  createdAt: ISOInstant;
  events: ResultEventDto[];
};

export type ResultRowDto = Omit<ResultDto, 'events'>;

export type ResultListDto = {
  items: ResultRowDto[];
  total: number;
};

export type ResultStatsDto = {
  open: number;
  unowned: number;
  overdue: number;
  criticalOpen: number;
  acknowledged: number;
  patientInformed: number;
  closed: number;
  medianAcknowledgeMinutes: number | null;
  informedShare: number | null;
};

export const resultFilterSchema = z.enum([
  'open',
  'critical',
  'overdue',
  'unowned',
  'closed',
  'all',
]);
export type ResultFilter = z.infer<typeof resultFilterSchema>;

export const resultListQuerySchema = z.object({
  filter: resultFilterSchema.default('open'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ResultListQuery = z.infer<typeof resultListQuerySchema>;

export const assignResultSchema = z.object({
  ownerId: z.string().uuid().optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
});
export type AssignResultInput = z.infer<typeof assignResultSchema>;

export const matchResultSchema = z.object({ patientId: z.string().uuid() });
export type MatchResultInput = z.infer<typeof matchResultSchema>;

export const acknowledgeResultSchema = z.object({ note: z.string().max(500).optional() });
export type AcknowledgeResultInput = z.infer<typeof acknowledgeResultSchema>;

export const informedResultSchema = z.object({
  channel: informedChannelSchema,
  note: z.string().max(500).optional(),
  readBack: z.boolean().default(false),
});
export type InformedResultInput = z.infer<typeof informedResultSchema>;

export const escalateResultSchema = z.object({ reason: z.string().min(3).max(500) });
export type EscalateResultInput = z.infer<typeof escalateResultSchema>;

export const closeResultSchema = z.object({ note: z.string().min(3).max(500) });
export type CloseResultInput = z.infer<typeof closeResultSchema>;


export const createResultSchema = z.object({
  patientId: z.string().uuid().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  externalRef: z.string().min(3).max(120).optional(),
  sourceChannel: resultChannelSchema.default('pdf'),
  labName: z.string().max(120).optional(),
  reportReceivedAt: z.string().datetime({ offset: true }).optional(),
  patientNameRaw: z.string().min(1).max(200),
  patientIdentifierRaw: z.string().max(120).optional(),
  testName: z.string().min(1).max(160),
  valueText: z.string().min(1).max(80),
  unit: z.string().max(40).optional(),
  labFlag: resultFlagSchema,
});
export type CreateResultInput = z.infer<typeof createResultSchema>;


export type ResultControlDto = {
  code: string;
  label: string;
  status: 'met' | 'missing' | 'not_applicable';
  evidenceEventIds: UUID[];
  note: string;
};

export type ResultProofDto = {
  resultId: UUID;
  receiptCode: string;
  valid: boolean;
  eventCount: number;
  head: string | null;
  brokenAt: UUID | null;
  checkedAt: ISOInstant;
  controls: ResultControlDto[];
};


export type PublicReceiptProofDto = {
  found: boolean;
  valid: boolean;
  eventCount: number;
  head: string | null;
};

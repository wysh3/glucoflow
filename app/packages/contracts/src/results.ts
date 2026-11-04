import { z } from 'zod';
import type { ISOInstant, UUID } from './common';

/**
 * Result accountability ledger with a patient-side closure record.
 *
 * This is an administrative receipt for an incoming report. The lab's own flag
 * is the only source of criticality; this product never interprets a value,
 * triages a patient or recommends a test or treatment. A patient who cannot be
 * reached is recorded as unreachable, never as informed.
 */

export const resultFlagSchema = z.enum(['critical', 'abnormal', 'normal', 'unknown']);
export type ResultFlag = z.infer<typeof resultFlagSchema>;

export const resultKindSchema = z.enum(['unscheduled', 'monitoring']);
export type ResultKind = z.infer<typeof resultKindSchema>;

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

export const communicationOutcomeSchema = z.enum([
  'informed_patient',
  'informed_caregiver',
  'informed_treating_doctor',
  'declined',
  'unreachable',
  'invalid_number',
  'deceased',
  'transferred',
]);
export type CommunicationOutcome = z.infer<typeof communicationOutcomeSchema>;

export const nextStepSchema = z.enum([
  'book_appointment',
  'repeat_test',
  'see_specialist',
  'collect_report',
  'urgent_attendance',
  'other',
]);
export type NextStep = z.infer<typeof nextStepSchema>;

export const dispositionSchema = z.enum([
  'reviewed_action',
  'ongoing_management',
  'no_action',
  'transferred',
  'unreachable',
  'declined',
  'deceased',
  'invalid_number',
]);
export type Disposition = z.infer<typeof dispositionSchema>;

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
  patient_informed: 'Patient contacted',
  closed: 'Closed',
};

export const COMMUNICATION_OUTCOME_LABELS: Record<CommunicationOutcome, string> = {
  informed_patient: 'Patient reached',
  informed_caregiver: 'Caregiver reached',
  informed_treating_doctor: 'Treating doctor reached',
  declined: 'Patient declined contact',
  unreachable: 'Not reachable after attempts',
  invalid_number: 'Number invalid',
  deceased: 'Patient deceased',
  transferred: 'Care transferred',
};

export const NEXT_STEP_LABELS: Record<NextStep, string> = {
  book_appointment: 'Book a clinic appointment',
  repeat_test: 'Repeat the test',
  see_specialist: 'See a specialist',
  collect_report: 'Collect the report',
  urgent_attendance: 'Attend the clinic urgently',
  other: 'Other administrative step',
};

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  reviewed_action: 'Reviewed, action assigned',
  ongoing_management: 'Ongoing management',
  no_action: 'No further action',
  transferred: 'Care transferred',
  unreachable: 'Closed, patient unreachable',
  declined: 'Closed, patient declined',
  deceased: 'Closed, patient deceased',
  invalid_number: 'Closed, invalid number',
};

export const MONITORING_PROTOCOL_LABELS: Record<string, string> = {
  acei_arb_k_egfr_2w: 'ACE inhibitor or ARB start: potassium and eGFR at 2 to 4 weeks',
  sglt2i_egfr_2w: 'SGLT2 inhibitor start: eGFR at 2 to 4 weeks',
  mra_k_egfr_2w: 'Mineralocorticoid receptor antagonist start: potassium and eGFR at 2 to 4 weeks',
  metformin_b12_annual: 'Long-term metformin: vitamin B12 at least annually',
  statin_alt_2w: 'Statin start: ALT at 2 to 4 weeks',
  annual_uacr_egfr: 'Annual urine albumin-to-creatinine ratio and eGFR',
};

export type ResultEventDto = {
  eventId: UUID;
  eventType:
    | 'received'
    | 'matched'
    | 'assigned'
    | 'acknowledged'
    | 'patient_informed'
    | 'communication_attempt'
    | 'auto_escalated'
    | 'escalated'
    | 'next_step_completed'
    | 'closed';
  actorName: string | null;
  fromStatus: ResultStatus | null;
  toStatus: ResultStatus | null;
  note: string | null;
  detail: Record<string, unknown>;
  createdAt: ISOInstant;
};

export type ResultAttemptDto = {
  attemptId: UUID;
  channel: InformedChannel;
  outcome: CommunicationOutcome;
  recipient: string | null;
  relation: string | null;
  language: string | null;
  note: string | null;
  attemptedAt: ISOInstant;
  actorName: string | null;
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
  labReleasedAt: ISOInstant | null;
  labHold: boolean;
  patientNameRaw: string;
  patientIdentifierRaw: string | null;
  testName: string;
  valueText: string;
  unit: string | null;
  labFlag: ResultFlag;
  resultKind: ResultKind;
  monitoringProtocol: string | null;
  monitoringStartedAt: ISOInstant | null;
  monitoringDueAt: ISOInstant | null;
  status: ResultStatus;
  statusLabel: string;
  ownerId: UUID | null;
  ownerName: string | null;
  dueAt: ISOInstant | null;
  acknowledgedAt: ISOInstant | null;
  acknowledgedByName: string | null;
  acknowledgedValueText: string | null;
  acknowledgedFlag: ResultFlag | null;
  labNotifierName: string | null;
  labNotifierRole: string | null;
  labReadBackValueText: string | null;
  labReadBackAt: ISOInstant | null;
  informedAt: ISOInstant | null;
  informedByName: string | null;
  informedChannel: InformedChannel | null;
  communicationOutcome: CommunicationOutcome | null;
  communicationRecipient: string | null;
  communicationRelation: string | null;
  communicationLanguage: string | null;
  nextStep: NextStep | null;
  nextStepDueAt: ISOInstant | null;
  nextStepCompletedAt: ISOInstant | null;
  teachBackConfirmed: boolean;
  readBackConfirmed: boolean;
  readBackAt: ISOInstant | null;
  disposition: Disposition | null;
  closedWithoutInformed: boolean;
  escalationLevel: number;
  lastEscalatedAt: ISOInstant | null;
  closedAt: ISOInstant | null;
  createdAt: ISOInstant;
  events: ResultEventDto[];
  attempts: ResultAttemptDto[];
};

export type ResultRowDto = Omit<ResultDto, 'events' | 'attempts'>;

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
  eligible: number;
  closedWithin7Days: number;
  openLastMile: number;
  informed: number;
  teachBackConfirmed: number;
  nextStepCompleted: number;
  unreachable: number;
  medianContactMinutes: number | null;
  closureRate7d: number | null;
  teachBackShare: number | null;
  nextStepCompletionShare: number | null;
  monitoringEligible: number;
  monitoringClosedWithinWindow: number;
  monitoringOpen: number;
  monitoringClosureRate: number | null;
};

export const resultFilterSchema = z.enum([
  'open',
  'critical',
  'overdue',
  'unowned',
  'monitoring',
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

export const acknowledgeResultSchema = z.object({
  note: z.string().max(500).optional(),
  valueText: z.string().min(1).max(80),
  flag: resultFlagSchema,
  notifierName: z.string().max(120).optional(),
  notifierRole: z.string().max(80).optional(),
  readBackValue: z.string().max(80).optional(),
});
export type AcknowledgeResultInput = z.infer<typeof acknowledgeResultSchema>;

export const informedResultSchema = z.object({
  channel: informedChannelSchema,
  outcome: communicationOutcomeSchema,
  recipient: z.string().max(200).optional(),
  relation: z.string().max(80).optional(),
  language: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
  attemptedAt: z.string().datetime({ offset: true }).optional(),
  nextStep: nextStepSchema.optional(),
  teachBack: z.boolean().default(false),
  nextStepDueAt: z.string().datetime({ offset: true }).optional(),
});
export type InformedResultInput = z.infer<typeof informedResultSchema>;

export const escalateResultSchema = z.object({ reason: z.string().min(3).max(500) });
export type EscalateResultInput = z.infer<typeof escalateResultSchema>;

export const closeResultSchema = z.object({
  note: z.string().min(3).max(500),
  disposition: dispositionSchema,
});
export type CloseResultInput = z.infer<typeof closeResultSchema>;

export const nextStepCompletedSchema = z.object({
  note: z.string().min(3).max(500),
  completedAt: z.string().datetime({ offset: true }).optional(),
});
export type NextStepCompletedInput = z.infer<typeof nextStepCompletedSchema>;

export const createResultSchema = z.object({
  patientId: z.string().uuid().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  externalRef: z.string().min(3).max(120).optional(),
  sourceChannel: resultChannelSchema.default('pdf'),
  labName: z.string().max(120).optional(),
  reportReceivedAt: z.string().datetime({ offset: true }).optional(),
  labReleasedAt: z.string().datetime({ offset: true }).optional(),
  labNotifierName: z.string().max(120).optional(),
  labNotifierRole: z.string().max(80).optional(),
  labHold: z.boolean().default(false),
  patientNameRaw: z.string().min(1).max(200),
  patientIdentifierRaw: z.string().max(120).optional(),
  testName: z.string().min(1).max(160),
  valueText: z.string().min(1).max(80),
  unit: z.string().max(40).optional(),
  labFlag: resultFlagSchema,
  resultKind: resultKindSchema.default('unscheduled'),
  monitoringProtocol: z.string().max(120).optional(),
  monitoringStartedAt: z.string().datetime({ offset: true }).optional(),
  monitoringDueAt: z.string().datetime({ offset: true }).optional(),
});
export type CreateResultInput = z.infer<typeof createResultSchema>;

export const matchCandidateSchema = z.object({
  patientId: z.string().uuid(),
  displayName: z.string(),
  clinicIdentifier: z.string(),
  score: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  ambiguous: z.boolean(),
});
export type ResultMatchCandidateDto = z.infer<typeof matchCandidateSchema>;

export type ResultControlDto = {
  code: string;
  label: string;
  status: 'present' | 'missing' | 'not_applicable';
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

export type PublicReceiptStage =
  | 'received'
  | 'acknowledged'
  | 'patient_contacted'
  | 'next_step_completed'
  | 'closed'
  | 'closed_unreachable'
  | 'invalid'
  | 'not_found'
  | 'revoked';

export type PublicReceiptProofDto = {
  found: boolean;
  valid: boolean;
  stage: PublicReceiptStage;
};

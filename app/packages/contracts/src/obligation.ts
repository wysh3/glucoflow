import { z } from 'zod';
import {
  communicationOutcomeSchema,
  dispositionSchema,
  informedChannelSchema,
  nextStepSchema,
  resultFlagSchema,
  resultStatusSchema,
} from './results';

/** The four role views over one obligation aggregate. */
export const obligationViewSchema = z.enum(['line', 'calls', 'intake', 'register', 'exceptions']);
export type ObligationView = z.infer<typeof obligationViewSchema>;

export const custodyStateSchema = z.enum(['received', 'accepted', 'assigned']);
export type CustodyState = z.infer<typeof custodyStateSchema>;

export const obligationReviewStateSchema = z.enum(['pending', 'seen']);
export type ObligationReviewState = z.infer<typeof obligationReviewStateSchema>;

export const communicationStateSchema = z.enum(['pending', 'in_progress', 'informed', 'exception']);
export type CommunicationState = z.infer<typeof communicationStateSchema>;

export const terminalStateSchema = z.enum([
  'closed',
  'closed_unreachable',
  'declined',
  'transferred',
  'deceased',
]);
export type TerminalState = z.infer<typeof terminalStateSchema>;

export const acceptCustodySchema = z.object({});
export const assignClinicianSchema = z.object({ clinicianId: z.string().uuid() });

export const seeResultSchema = z.object({
  valueEcho: z.string().trim().min(1).max(120),
  flag: resultFlagSchema.optional(),
  disputeReason: z.string().trim().min(3).max(500).optional(),
});
export type SeeResultInput = z.infer<typeof seeResultSchema>;

export const recordAttemptSchema = z.object({
  channel: informedChannelSchema,
  outcome: communicationOutcomeSchema,
  note: z.string().trim().max(1000).optional(),
});
export type RecordAttemptInput = z.infer<typeof recordAttemptSchema>;

export const recordInformedSchema = z.object({
  channel: informedChannelSchema,
  outcome: communicationOutcomeSchema,
  readBack: z.boolean().default(false),
  teachBack: z.boolean().default(false),
  nextStep: nextStepSchema.optional(),
  nextStepDueAt: z.string().min(1).optional(),
  note: z.string().trim().max(1000).optional(),
});
export type RecordInformedInput = z.infer<typeof recordInformedSchema>;

export const closeObligationSchema = z.object({
  disposition: dispositionSchema,
  note: z.string().trim().max(1000).optional(),
});
export type CloseObligationInput = z.infer<typeof closeObligationSchema>;

export const pauseObligationSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const reassignObligationSchema = z.object({ clinicianId: z.string().uuid() });

export const obligationQuerySchema = z.object({
  view: obligationViewSchema.default('intake'),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** One row of a role worklist. Dates are ISO strings; counts are numbers. */
export type ObligationRow = {
  id: string;
  receiptCode: string;
  patientId: string | null;
  patientName: string | null;
  patientIdentifier: string | null;
  labName: string | null;
  sourceChannel: string;
  testName: string;
  valueText: string;
  unit: string | null;
  labFlag: z.infer<typeof resultFlagSchema>;
  clinicianFlag: z.infer<typeof resultFlagSchema> | null;
  flagDisputed: boolean;
  disputeReason: string | null;
  status: z.infer<typeof resultStatusSchema>;
  custody: CustodyState;
  review: ObligationReviewState;
  communication: CommunicationState;
  terminal: TerminalState | null;
  ownerId: string | null;
  ownerName: string | null;
  receivedAt: string;
  dueAt: string | null;
  breachAt: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  pausedSeconds: number;
  attemptCount: number;
  lastAttemptAt: string | null;
  informedAt: string | null;
  closedAt: string | null;
  disposition: string | null;
};

export type ObligationListDto = {
  view: ObligationView;
  items: ObligationRow[];
  count: number;
};

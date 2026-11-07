import type { CareRole, CareActor } from './care';

export type CareCapability = 'specimen_followup' | 'result_followup' | 'handover' | 'documentation';
export interface CareStaff {
  id: string; name: string; userId: string | null; role: CareRole; team: string;
  capabilities: CareCapability[]; shiftEnd: string;
  capacity: {slots: number; validUntil: string; confirmedAt: string; sourceRef: string} | null;
}
export interface CareAssignment {
  id: string; taskId: string; staffId: string; capability: CareCapability;
  status: 'offered' | 'accepted' | 'declined' | 'expired' | 'completed' | 'withdrawn';
  offeredAt: string; expiresAt: string; resolvedAt?: string; sourceRef: string; completionRef?: string;
}
export interface CareEpisodeHandover {
  id: string; encounterId: string; fromOwner: string; toStaffId: string; destination: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  requestedAt: string; expiresAt: string; resolvedAt?: string; sourceRef: string;
}
export interface CareEpisodeRecord {
  id: string; encounterId: string; kind: 'observation' | 'followup'; label: string; value: string;
  unit: string; occurredAt: string; recordedAt: string; sourceRef: string; recordedBy: string;
  dimensionless?: boolean; recorder?: CareActor;
  supersedesId?: string; disposition?: 'transcription' | 'disputed'; revisionReason?: string;
}
export interface CareCoordination {
  staff: CareStaff[]; assignments: CareAssignment[]; handovers: CareEpisodeHandover[]; records: CareEpisodeRecord[];
}
export type CareCoordinationCommand = {type: 'coordination'} & (
  | {action: 'register_staff'; name: string; userId: string | null; role: CareRole; team: string; capabilities: CareCapability[]; shiftEnd: string}
  | {action: 'renew_staff_shift'; staffId: string; shiftEnd: string; sourceRef: string}
  | {action: 'confirm_capacity'; staffId: string; slots: number; validUntil: string; sourceRef: string}
  | {action: 'offer_task'; taskId: string; staffId: string; durationMinutes: number; sourceRef: string}
  | {action: 'respond_offer'; assignmentId: string; decision: 'accept' | 'decline'}
  | {action: 'complete_assignment'; assignmentId: string; sourceRef: string}
  | {action: 'request_episode_handover'; encounterId: string; staffId: string; destination: string; durationMinutes: number; sourceRef: string}
  | {action: 'respond_episode_handover'; handoverId: string; decision: 'accept' | 'decline'}
  | {action: 'record_observation' | 'record_followup'; encounterId: string; label: string; value: string; unit: string; occurredAt: string; sourceRef: string; dimensionless?: boolean}
  | {action: 'correct_episode_record'; recordId: string; value: string; unit: string; occurredAt: string; dimensionless?: boolean; reason: string}
  | {action: 'dispute_episode_record'; recordId: string; reason: string}
);

import type { CareActor, CareEvent, CareRole, CareTaskStatus } from './care';

export type CareShiftRule = 'validated_result_acknowledgement' | 'specimen_receipt';

export interface CareShiftScope {
  encounterIds: string[];
  rule: CareShiftRule;
  sources: CareEvent['source'][];
  recipientStaffIds: string[];
  expiresAt: string;
}

export interface CareShiftMonitorItem {
  encounterId: string;
  orderId: string;
  status: 'pending' | 'source_unknown' | 'source_confirmed' | 'cancelled';
  lastCheckedAt: string;
  sourceEventId: string | null;
  existingTaskId: string | null;
}

export interface CareShiftMonitor {
  id: string;
  version: number;
  status: 'awaiting_approval' | 'monitoring' | 'paused' | 'stopped' | 'expired';
  scope: CareShiftScope;
  createdAt: string;
  updatedAt: string;
  createdBy: CareActor;
  approvedAt?: string;
  approvedBy?: CareActor;
  items: CareShiftMonitorItem[];
}

export interface CareSoftAcknowledgement {
  actor: CareActor;
  at: string;
  note: string;
}

export interface CareHandoverItem {
  taskId: string | null;
  encounterId: string;
  patientName: string;
  bed: string;
  owner: string;
  title: string;
  status: CareTaskStatus | 'awaiting_source';
  sourceEventId: string | null;
  sourceRef: string | null;
  sourceAt: string | null;
}

export interface CareHandoverVersion {
  version: number;
  body: string;
  recipientStaffId: string;
  recipientUserId?: string;
  recipientName: string;
  recipientRole: CareRole;
  preparedBy: CareActor;
  preparedAt: string;
  sharedAt?: string;
  sharedBy?: CareActor;
  receivedAt?: string;
  receivedBy?: CareActor;
  items: CareHandoverItem[];
}

export interface CareHandoverDocument {
  id: string;
  encounterIds: string[];
  createdBy: CareActor;
  createdAt: string;
  versions: CareHandoverVersion[];
}

export type CarePdfDemoCommand =
  | ({ type: 'shift_monitoring' } & (
      | { action: 'create'; scope: CareShiftScope }
      | { action: 'edit'; monitorId: string; expectedVersion: number; scope: CareShiftScope }
      | { action: 'approve' | 'pause' | 'stop'; monitorId: string; expectedVersion: number }
    ))
  | { type: 'soft_acknowledge_task'; taskId: string; note: string }
  | ({ type: 'handover_document' } & (
      | { action: 'create'; encounterIds: string[]; recipientStaffId: string }
      | { action: 'edit'; documentId: string; expectedVersion: number; body: string; recipientStaffId: string }
      | { action: 'share' | 'receive'; documentId: string; expectedVersion: number }
    ));

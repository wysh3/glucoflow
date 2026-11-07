import type { CareCoordination, CareCoordinationCommand } from './care-coordination';
/** Synthetic care coordination workspace. Patient facts remain source-attributed. */
export const CARE_LANGUAGE_CODES = [
  'en-IN', 'hi-IN', 'bn-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'od-IN', 'pa-IN', 'ta-IN', 'te-IN', 'gu-IN',
  'as-IN', 'ur-IN', 'ne-IN', 'kok-IN', 'ks-IN', 'sd-IN', 'sa-IN', 'sat-IN', 'mni-IN', 'brx-IN', 'mai-IN', 'doi-IN',
] as const;
export type CareLanguageCode = (typeof CARE_LANGUAGE_CODES)[number];
export type CareRole = 'doctor' | 'nurse' | 'lab' | 'coordinator';
export type CareEventKind = 'order_placed' | 'specimen_collected' | 'specimen_received' | 'result_validated' | 'result_acknowledged' | 'order_cancelled' | 'result_corrected' | 'handover_received';
export type CareTaskStatus = 'awaiting_approval' | 'monitoring' | 'paused' | 'awaiting_evidence' | 'source_confirmed' | 'human_attested' | 'expired' | 'cancelled';
export type CareTaskKind = 'specimen_receipt' | 'result_acknowledgement' | 'handover';
export interface CareEncounter {
  id: string; patientName: string; patientCode: string; bed: string;
  documentedContext: string[]; assignedTo: string; admittedAt: string;
  bedTransfer?: {stage: 'requested' | 'allocated' | 'arrived'; destination: string; requestedAt: string;
    history: {stage: 'requested' | 'allocated' | 'arrived'; destination: string; sourceRef: string; at: string; role: CareRole}[]};
}
export interface CareOrder { id: string; encounterId: string; testName: string; specimenId: string; createdAt: string; targetMinutes: number; }
export interface CareEvent { id: string; encounterId: string; orderId: string | null; kind: CareEventKind; source: 'HIS' | 'LIS'; sourceRef: string; label: string; occurredAt: string; receivedAt: string; }
export interface CareTask { id: string; encounterId: string; orderId: string | null; kind: CareTaskKind; title: string; owner: string; status: CareTaskStatus; createdAt: string; expiresAt: string; lastCheckedAt: string | null; completionEventId: string | null; playbookVersion: number; skillId?: string; skillVersion?: number; skillSourceEventId?: string; transfer?: {owner: string; role: CareRole; reason: string; requestedAt: string; status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'; resolvedAt?: string}; }
export interface CareActivity { id: string; at: string; kind: string; title: string; detail: string; taskId?: string; }
export interface CarePlaybook { id: string; version: number; title: string; body: string; status: 'draft' | 'approved' | 'rejected' | 'superseded'; createdAt: string; approvedAt: string | null; tests: {name: string; passed: boolean; detail: string}[]; }
export interface CareMessage { id: string; role: 'user' | 'assistant'; content: string; at: string; engine?: 'hermes' | 'offline'; languageCode?: CareLanguageCode; sources?: string[]; proposals?: CareProposal[]; }
export interface CareProposal { kind: 'monitor' | 'handover' | 'playbook'; title: string; encounterId?: string; orderId?: string; body?: string; skillId?: string; }
export interface CareWorkspace {
  coordination?: CareCoordination;
  archivedAt?: string;
  previousWorkspaceId?: string;
  id: string; revision: number; name: string; synthetic: true; role: CareRole;
  createdAt: string; updatedAt: string;
  encounters: CareEncounter[]; orders: CareOrder[]; events: CareEvent[];
  tasks: CareTask[]; activity: CareActivity[]; playbooks: CarePlaybook[]; messages: CareMessage[];
  feeds: { HIS: {connected: boolean; lastSyncAt: string}; LIS: {connected: boolean; lastSyncAt: string} };
}
export type CareCommand = CareCoordinationCommand
  | {type: 'set_role'; role: CareRole}
  | {type: 'add_encounter'; patientName: string; bed: string; documentedContext: string[]}
  | {type: 'add_order'; encounterId: string; testName: string; targetMinutes: number}
  | {type: 'source_event'; encounterId: string; orderId: string | null; kind: CareEventKind; source: 'HIS' | 'LIS'; sourceRef: string; occurredAt?: string}
  | {type: 'set_feed'; source: 'HIS' | 'LIS'; connected: boolean}
  | {type: 'create_task'; encounterId: string; orderId: string | null; kind: CareTaskKind; title: string; durationMinutes: number}
  | {type: 'task_action'; taskId: string; action: 'approve' | 'pause' | 'resume' | 'cancel' | 'attest'; reason?: string}
  | {type: 'bed_transfer'; encounterId: string; stage: 'requested' | 'allocated' | 'arrived'; destination: string; sourceRef: string}
  | {type: 'request_transfer'; taskId: string; owner: string; role: CareRole; reason: string}
  | {type: 'resolve_transfer'; taskId: string; decision: 'accept' | 'reject'}
  | {type: 'draft_handover'; encounterId?: string}
  | {type: 'propose_playbook'; title: string; body: string}
  | {type: 'test_playbook'; playbookId: string}
  | {type: 'review_playbook'; playbookId: string; decision: 'approve' | 'reject'}
  | {type: 'rollback_playbook'; playbookId: string}
  | {type: 'apply_skill'; skillId: string; encounterId: string; orderId: string};
export interface CareRuntimeStatus { available: boolean; engine: 'hermes'; version: string; model: string | null; configured: boolean; }
export interface CareChatResult { reply: string; engine: 'hermes' | 'offline'; model?: string; languageCode?: CareLanguageCode; proposals: CareProposal[]; sources: string[]; }

export type CareWorkspaceSummary = Pick<CareWorkspace, 'id' | 'name' | 'role' | 'createdAt' | 'updatedAt' | 'synthetic'>;
export interface CareWorkspaceList { workspaces: CareWorkspaceSummary[]; nextCursor: string | null; }

export type CareSkillPattern = 'specimen_receipt' | 'result_acknowledgement';
export type CareSkillStatus = 'draft' | 'approved' | 'rejected' | 'superseded' | 'retired';
export type CareSkillAction = 'test' | 'approve' | 'reject' | 'retire' | 'rollback';
export interface CareSkill {
  id: string;
  pattern: CareSkillPattern;
  version: number;
  title: string;
  description: string;
  status: CareSkillStatus;
  permittedAction: string;
  stopConditions: string[];
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  canTest: boolean;
  tests: {name: string; passed: boolean; detail: string}[];
  provenance: {source: 'HIS' | 'LIS'; kind: CareEventKind; capturedAt: string};
  origin: {workspaceId: string; taskId: string; eventId: string} | null;
}
export interface CareSkillList { skills: CareSkill[]; canReview: boolean; }
export interface CareSkillPreview {
  eligible: boolean;
  reason: string;
  sourceEventId: string | null;
  task: {kind: CareSkillPattern; title: string; durationMinutes: number} | null;
}
export type CareApplicableSkill = Pick<CareSkill, 'id' | 'pattern' | 'version' | 'title'> & {
  encounterId: string;
  orderId: string;
};

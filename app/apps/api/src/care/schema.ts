import type { CareCommand, CareProposal } from '@glucoflow/contracts';
import { CARE_LANGUAGE_CODES } from '@glucoflow/contracts';
import { z } from 'zod';

const role = z.enum(['doctor', 'nurse', 'lab', 'coordinator']);
const source = z.enum(['HIS', 'LIS']);
const eventKind = z.enum([
  'order_placed', 'specimen_collected', 'specimen_received', 'result_validated',
  'result_acknowledged', 'order_cancelled', 'result_corrected', 'handover_received',
]);
const taskKind = z.enum(['specimen_receipt', 'result_acknowledgement', 'handover']);
const uuid = z.uuid();
const minutes = z.number().int().min(1).max(1440);
const bounded = (max: number) => z.string().trim().min(1).max(max);
const orderLink = { encounterId: uuid, orderId: uuid.nullable() };

const originalCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('set_role'), role }),
  z.strictObject({
    type: z.literal('add_encounter'), patientName: bounded(80), bed: bounded(40),
    documentedContext: z.array(bounded(300)).max(6),
  }),
  z.strictObject({ type: z.literal('add_order'), encounterId: uuid, testName: bounded(100), targetMinutes: minutes }),
  z.strictObject({
    type: z.literal('source_event'), ...orderLink, kind: eventKind, source,
    sourceRef: bounded(100), occurredAt: z.iso.datetime({ offset: true }).optional(),
  }),
  z.strictObject({ type: z.literal('set_feed'), source, connected: z.boolean() }),
  z.strictObject({
    type: z.literal('create_task'), ...orderLink, kind: taskKind, title: bounded(120), durationMinutes: minutes,
  }),
  z.strictObject({
    type: z.literal('task_action'), taskId: uuid,
    action: z.enum(['approve', 'pause', 'resume', 'cancel', 'attest']), reason: bounded(400).optional(),
  }),
  z.strictObject({ type: z.literal('bed_transfer'), encounterId: uuid, stage: z.enum(['requested', 'allocated', 'arrived']), destination: bounded(40), sourceRef: bounded(100) }),
  z.strictObject({ type: z.literal('request_transfer'), taskId: uuid, owner: bounded(80), role, reason: bounded(400) }),
  z.strictObject({ type: z.literal('resolve_transfer'), taskId: uuid, decision: z.enum(['accept', 'reject']) }),
  z.strictObject({ type: z.literal('draft_handover'), encounterId: uuid.optional() }),
  z.strictObject({ type: z.literal('propose_playbook'), title: bounded(120), body: bounded(2000) }),
  z.strictObject({ type: z.literal('test_playbook'), playbookId: uuid }),
  z.strictObject({ type: z.literal('review_playbook'), playbookId: uuid, decision: z.enum(['approve', 'reject']) }),
  z.strictObject({ type: z.literal('rollback_playbook'), playbookId: uuid }),
  z.strictObject({ type: z.literal('apply_skill'), skillId: uuid, encounterId: uuid, orderId: uuid }),
]) satisfies z.ZodType<CareCommand>;

const coordinationBase = {type:z.literal('coordination')};
const coordinationSchema = z.discriminatedUnion('action', [
 z.strictObject({...coordinationBase,action:z.literal('register_staff'),name:bounded(80),userId:uuid.nullable(),role,team:bounded(80),capabilities:z.array(z.enum(['specimen_followup','result_followup','handover','documentation'])).min(1).max(4),shiftEnd:z.iso.datetime()}),
 z.strictObject({...coordinationBase,action:z.literal('confirm_capacity'),staffId:uuid,slots:z.number().int().min(0).max(10),validUntil:z.iso.datetime(),sourceRef:bounded(100)}),
 z.strictObject({...coordinationBase,action:z.literal('offer_task'),taskId:uuid,staffId:uuid,durationMinutes:z.number().int().min(1).max(60),sourceRef:bounded(100)}),
 z.strictObject({...coordinationBase,action:z.literal('respond_offer'),assignmentId:uuid,decision:z.enum(['accept','decline'])}),
 z.strictObject({...coordinationBase,action:z.literal('complete_assignment'),assignmentId:uuid,sourceRef:bounded(100)}),
 z.strictObject({...coordinationBase,action:z.literal('request_episode_handover'),encounterId:uuid,staffId:uuid,destination:bounded(40),durationMinutes:z.number().int().min(1).max(60),sourceRef:bounded(100)}),
 z.strictObject({...coordinationBase,action:z.literal('respond_episode_handover'),handoverId:uuid,decision:z.enum(['accept','decline'])}),
 z.strictObject({...coordinationBase,action:z.enum(['record_observation','record_followup']),encounterId:uuid,label:bounded(100),value:bounded(500),unit:z.string().trim().max(40),occurredAt:z.iso.datetime(),sourceRef:bounded(100)}),
]);
const commandSchema=z.union([originalCommandSchema,coordinationSchema]) satisfies z.ZodType<CareCommand>;

export const workspaceParams = z.strictObject({ id: uuid });
export const workspaceListQuery = z.strictObject({
  cursor: z.string().regex(/^[0-9TZ:.\-]+~[0-9a-fA-F-]+$/).max(80).optional(),
});
export const skillParams = z.strictObject({ id: uuid, skillId: uuid });
export const skillCaptureBody = z.strictObject({ taskId: uuid });
export const skillActionBody = z.strictObject({ action: z.enum(['test', 'approve', 'reject', 'retire', 'rollback']) });
export const skillTargetBody = z.strictObject({ encounterId: uuid, orderId: uuid });
export const commandBody = z.strictObject({
  expectedRevision: z.number().int().positive().max(1_000_000), command: commandSchema,
});
const careLanguage = z.enum(CARE_LANGUAGE_CODES);
export const chatBody = z.strictObject({
  message: bounded(4000), mode: z.enum(['hermes', 'offline']), languageCode: careLanguage.default('en-IN'),
});
export const playbookSchema = z.strictObject({ handoverOrder: z.enum(['owner-first', 'source-first']) });

const proposalSchema = z.strictObject({
  kind: z.enum(['monitor', 'handover', 'playbook']), title: bounded(120),
  encounterId: uuid.optional(), orderId: uuid.optional(), body: bounded(2000).optional(), skillId: uuid.optional(),
}) satisfies z.ZodType<CareProposal>;

export const runtimeChatResponse = z.strictObject({
  reply: bounded(4000), engine: z.literal('hermes'), model: bounded(200).optional(),
  languageCode: careLanguage.optional(),
  proposals: z.array(proposalSchema).max(4), sources: z.array(uuid).max(40),
});
export const runtimeHealthResponse = z.object({
  engine: z.literal('hermes'), available: z.boolean(), version: bounded(30),
  configured: z.boolean(), model: bounded(200).nullable(),
});

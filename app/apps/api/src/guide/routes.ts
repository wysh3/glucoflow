import type { FastifyInstance } from 'fastify';
import {
  guideRequestSchema,
  guideChatRequestSchema,
  type GuideRole,
  type MasterEvent,
} from '@glucoflow/contracts';
import type { AppContext } from '../context';
import { parseBody, requireActor, withActorTx } from '../routes/helpers';
import { ApiError } from '../errors';
import { createGuideService, createGuideBudget } from './service';
import { createConversationService } from './conversation';
import { getPatientSummary, loadTimelinePage } from '@glucoflow/data';
import { assertPatientAccess } from '../auth';
export function registerGuideRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  const config = {
    mode: ctx.config.GUIDE_MODE,
    apiKey: ctx.config.GUIDE_API_KEY,
    baseUrl: ctx.config.GUIDE_BASE_URL,
    hourlyLimit: ctx.config.GUIDE_MAX_CALLS_PER_HOUR,
    timeoutMs: 15000,
    maxConcurrent: 2,
    budget: createGuideBudget(ctx.config.GUIDE_MAX_CALLS_PER_HOUR, 2),
  };
  const guide = createGuideService(config);
  const conversation = createConversationService(config);
  app.post(
    '/api/v1/guide',
    {
      bodyLimit: 4096,
      config: {
        rateLimit: {
          max: 12,
          timeWindow: '1 minute',
          hook: 'preHandler',
          keyGenerator: (request) => requireActor(request).profile.userId,
        },
      },
    },
    async (request) => {
      const actor = requireActor(request);
      if (!actor.contexts.length)
        throw ApiError.forbidden('An active workspace is required.');
      const input = parseBody(guideRequestSchema, request.body);
      const hasClinic = actor.capabilities.clinicIds.length > 0;
      const role: GuideRole = hasClinic
        ? actor.capabilities.canReview
          ? actor.capabilities.canViewApproved
            ? 'clinic'
            : 'reviewer'
          : 'clinician'
        : 'patient';
      return guide.answer({ ...input, role });
    },
  );
  app.post(
    '/api/v1/guide/chat',
    {
      bodyLimit: 8192,
      config: {
        rateLimit: {
          max: 12,
          timeWindow: '1 minute',
          hook: 'preHandler',
          keyGenerator: (request) => requireActor(request).profile.userId,
        },
      },
    },
    async (request) => {
      const actor = requireActor(request);
      const input = parseBody(guideChatRequestSchema, request.body);
      const records = await withActorTx(ctx, request, async (client) => {
        const patient = await getPatientSummary(client, input.patientId);
        if (!patient)
          throw ApiError.notFound('That patient record is not available.');
        assertPatientAccess(actor, patient.patientId, patient.clinicId);
        const own = actor.contexts.some(
          (c) => c.kind === 'patient' && c.patientId === patient.patientId,
        );
        const clinician = actor.contexts.some(
          (c) =>
            c.kind === 'clinic' &&
            c.clinicId === patient.clinicId &&
            c.clinician,
        );
        if (!own && !clinician)
          throw ApiError.forbidden(
            'Approved-record chat needs a patient or clinician context.',
          );
        const timeline = await loadTimelinePage(
          client,
          patient.patientId,
          { testCodes: [] },
          2000,
          0,
        );
        const home = await client.query<{
          id: string;
          kind: MasterEvent['kind'];
          payload: Record<string, unknown>;
          created_at: Date;
          actor_id: string;
          digest: string | null;
        }>(
          "select id,kind,payload,created_at,actor_id,digest from sutra.master_events where patient_id=$1 and kind in ('glucose','symptom') order by created_at desc,id desc limit 100",
          [patient.patientId],
        );
        const count = await client.query<{ count: string }>(
          "select count(*)::text as count from sutra.master_events where patient_id=$1 and kind in ('glucose','symptom')",
          [patient.patientId],
        );
        return {
          patient: {
            patientId: patient.patientId,
            displayName: patient.displayName,
            clinicIdentifier: patient.clinicIdentifier,
          },
          timeline,
          home: home.rows.map((e) => ({
            id: e.id,
            kind: e.kind,
            payload: e.payload,
            createdAt: new Date(e.created_at).toISOString(),
            actorId: e.actor_id,
            digest: e.digest,
          })),
          homeTotal: Number(count.rows[0]?.count ?? 0),
        };
      });
      return conversation.answer(
        input,
        records,
        actor.capabilities.patientIds.includes(input.patientId)
          ? 'patient'
          : 'clinician',
      );
    },
  );
}

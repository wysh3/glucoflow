import type { FastifyInstance } from 'fastify';
import { guideRequestSchema, type GuideRole } from '@glucoflow/contracts';
import type { AppContext } from '../context';
import { parseBody, requireActor } from '../routes/helpers';
import { ApiError } from '../errors';
import { createGuideService } from './service';
export function registerGuideRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): void {
  const guide = createGuideService({
    mode: ctx.config.GUIDE_MODE,
    apiKey: ctx.config.GUIDE_API_KEY,
    baseUrl: ctx.config.GUIDE_BASE_URL,
    hourlyLimit: ctx.config.GUIDE_MAX_CALLS_PER_HOUR,
    timeoutMs: 15000,
    maxConcurrent: 2,
  });
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
}

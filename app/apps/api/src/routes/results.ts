import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  acknowledgeResultSchema,
  assignResultSchema,
  closeResultSchema,
  createResultSchema,
  escalateResultSchema,
  informedResultSchema,
  matchResultSchema,
  nextStepCompletedSchema,
  resultListQuerySchema,
} from '@glucoflow/contracts';
import {
  acknowledgeResult,
  assignResult,
  closeResult,
  createResult,
  escalateOverdueResults,
  escalateResult,
  getResult,
  getResultProof,
  listResults,
  markNextStepCompleted,
  matchResult,
  recordResultCommunication,
  resultExport,
  resultMatchCandidates,
  resultStats,
  verifyReceiptByCode,
} from '@glucoflow/data';
import { requireCapability } from '../auth';
import { withTransaction } from '@glucoflow/data/pool';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { parseBody, parseQuery, requireActor, withActorTx } from './helpers';

const importResultsSchema = z.object({
  items: z.array(createResultSchema).min(1).max(100),
});

function clinicIdFor(actor: ReturnType<typeof requireActor>): string {
  const clinicId = actor.capabilities.clinicIds[0];
  if (!clinicId) throw ApiError.forbidden('This account has no clinic membership.');
  return clinicId;
}

/** The database allows a clinician or reviewer to close a result. The API must too. */
function requireClinical(actor: ReturnType<typeof requireActor>): void {
  if (!actor.capabilities.canClinician && !actor.capabilities.canReview) {
    throw ApiError.forbidden('A clinician or reviewer capability is required for this action.');
  }
}

export function registerResultRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/v1/results', async (request, reply) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(createResultSchema, request.body);
    const id = await withActorTx(ctx, request, (client) =>
      createResult(client, clinicIdFor(actor), body),
    );
    const result = await withActorTx(ctx, request, (client) => getResult(client, id));
    reply.code(201);
    return result;
  });

  app.post('/api/v1/results/import', async (request, reply) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(importResultsSchema, request.body);
    const ids = await withActorTx(ctx, request, async (client) => {
      const created: string[] = [];
      for (const item of body.items) {
        created.push(await createResult(client, clinicIdFor(actor), item));
      }
      return created;
    });
    reply.code(201);
    return { created: ids, count: ids.length };
  });

  app.get('/api/v1/results', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const query = parseQuery(resultListQuerySchema, request.query);
    return withActorTx(ctx, request, (client) =>
      listResults(client, clinicIdFor(actor), query.filter, query.limit),
    );
  });

  app.get('/api/v1/results/stats', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, (client) => resultStats(client, clinicIdFor(actor)));
  });

  app.get('/api/v1/results/export', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => ({
      exportedAt: new Date().toISOString(),
      items: await resultExport(client, clinicIdFor(actor)),
    }));
  });

  app.get<{ Params: { id: string } }>('/api/v1/results/:id/candidates', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => {
      const result = await getResult(client, request.params.id);
      if (!result || result.clinicId !== clinicIdFor(actor)) {
        throw ApiError.notFound('That result is not available.');
      }
      return {
        items: await resultMatchCandidates(client, clinicIdFor(actor), request.params.id),
      };
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/results/:id/proof', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => {
      const result = await getResult(client, request.params.id);
      if (!result || result.clinicId !== clinicIdFor(actor)) {
        throw ApiError.notFound('That result is not available.');
      }
      const proof = await getResultProof(client, request.params.id);
      if (!proof) throw ApiError.notFound('That result is not available.');
      return proof;
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/results/:id', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => {
      const result = await getResult(client, request.params.id);
      if (!result || result.clinicId !== clinicIdFor(actor)) {
        throw ApiError.notFound('That result is not available.');
      }
      return result;
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/results/:id/match', async (request) => {
    const actor = requireActor(request);
    requireClinical(actor);
    const body = parseBody(matchResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await matchResult(client, request.params.id, body.patientId);
      return getResult(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/results/:id/assign', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(assignResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await assignResult(client, request.params.id, body.ownerId, body.dueAt);
      return getResult(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/results/:id/acknowledge', async (request) => {
    const actor = requireActor(request);
    requireClinical(actor);
    const body = parseBody(acknowledgeResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await acknowledgeResult(client, request.params.id, body);
      return getResult(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/results/:id/patient-informed', async (request) => {
    const actor = requireActor(request);
    requireClinical(actor);
    const body = parseBody(informedResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await recordResultCommunication(client, request.params.id, body);
      return getResult(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/results/:id/next-step', async (request) => {
    const actor = requireActor(request);
    requireClinical(actor);
    const body = parseBody(nextStepCompletedSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await markNextStepCompleted(client, request.params.id, body.note, body.completedAt);
      return getResult(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/results/:id/escalate', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(escalateResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await escalateResult(client, request.params.id, body.reason);
      return getResult(client, request.params.id);
    });
  });

  app.post('/api/v1/results/escalate-overdue', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => ({
      escalated: await escalateOverdueResults(client, clinicIdFor(actor)),
    }));
  });

  app.post<{ Params: { id: string } }>('/api/v1/results/:id/close', async (request) => {
    const actor = requireActor(request);
    requireClinical(actor);
    const body = parseBody(closeResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await closeResult(client, request.params.id, body);
      return getResult(client, request.params.id);
    });
  });
}

/** No-auth receipt verification returns only the stage and chain validity, never patient data. */
export function registerPublicResultRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get<{ Params: { code: string } }>(
    '/api/v1/public/receipts/:code',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request) => {
      const code = request.params.code.trim();
      if (code.length < 6 || code.length > 40) {
        throw ApiError.validation('Enter a receipt code.');
      }
      return withTransaction(
        ctx.pool,
        { role: ctx.config.apiRole },
        (client) => verifyReceiptByCode(client, code),
      );
    },
  );
}

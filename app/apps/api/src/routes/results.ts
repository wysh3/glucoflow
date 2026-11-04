import type { FastifyInstance } from 'fastify';
import {
  acknowledgeResultSchema,
  assignResultSchema,
  closeResultSchema,
  createResultSchema,
  escalateResultSchema,
  informedResultSchema,
  matchResultSchema,
  resultListQuerySchema,
} from '@glucoflow/contracts';
import {
  acknowledgeResult,
  assignResult,
  closeResult,
  createResult,
  escalateResult,
  getResult,
  getResultProof,
  listResults,
  matchResult,
  recordResultInformed,
  resultExport,
  resultStats,
  verifyReceiptByCode,
} from '@glucoflow/data';
import { requireCapability } from '../auth';
import { withTransaction } from '@glucoflow/data/pool';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { parseBody, parseQuery, requireActor, withActorTx } from './helpers';

function clinicIdFor(actor: ReturnType<typeof requireActor>): string {
  const clinicId = actor.capabilities.clinicIds[0];
  if (!clinicId) throw ApiError.forbidden('This account has no clinic membership.');
  return clinicId;
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

  app.get<{ Params: { id: string } }>('/api/v1/results/:id/proof', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => {
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
    requireCapability(actor, 'review');
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
    requireCapability(actor, 'review');
    const body = parseBody(acknowledgeResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await acknowledgeResult(client, request.params.id, body.note);
      return getResult(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/results/:id/patient-informed', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'review');
    const body = parseBody(informedResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await recordResultInformed(client, request.params.id, body.channel, body.note, body.readBack);
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

  app.post<{ Params: { id: string } }>('/api/v1/results/:id/close', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'review');
    const body = parseBody(closeResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const before = await getResult(client, request.params.id);
      if (!before || before.clinicId !== clinicIdFor(actor)) throw ApiError.notFound('That result is not available.');
      await closeResult(client, request.params.id, body.note);
      return getResult(client, request.params.id);
    });
  });
}


/** No-auth receipt verification returns only chain integrity, never patient data. */
export function registerPublicResultRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get<{ Params: { code: string } }>('/api/v1/public/receipts/:code', async (request) => {
    const code = request.params.code.trim();
    if (code.length < 6 || code.length > 40) {
      throw ApiError.validation('Enter a receipt code.');
    }
    return withTransaction(
      ctx.pool,
      { role: ctx.config.apiRole },
      (client) => verifyReceiptByCode(client, code),
    );
  });
}

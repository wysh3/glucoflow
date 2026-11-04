import type { FastifyInstance } from 'fastify';
import {
  assignClinicianSchema,
  closeObligationSchema,
  obligationQuerySchema,
  pauseObligationSchema,
  reassignObligationSchema,
  recordAttemptSchema,
  recordInformedSchema,
  seeResultSchema,
} from '@glucoflow/contracts';
import {
  acceptCustody,
  assignClinician,
  closeObligation,
  closeObligationUnreachable,
  getObligation,
  listObligations,
  pauseObligation,
  reassignObligation,
  recordAttempt,
  recordInformed,
  resumeObligation,
  seeResult,
} from '@glucoflow/data';
import { requireCapability } from '../auth';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { parseBody, parseQuery, requireActor, withActorTx } from './helpers';

function clinicIdFor(actor: ReturnType<typeof requireActor>): string {
  const clinicId = actor.capabilities.clinicIds[0];
  if (!clinicId) throw ApiError.forbidden('This account has no clinic membership.');
  return clinicId;
}

export function registerObligationRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/obligations', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const query = parseQuery(obligationQuerySchema, request.query);
    return withActorTx(ctx, request, async (client) => {
      const items = await listObligations(
        client,
        query.view,
        clinicIdFor(actor),
        actor.profile.userId,
        query.from,
        query.to,
      );
      return { view: query.view, items, count: items.length };
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/obligations/:id', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => {
      const row = await getObligation(client, request.params.id);
      if (!row) throw ApiError.notFound('That obligation is not available.');
      return row;
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/obligations/:id/accept', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => {
      await acceptCustody(client, request.params.id);
      return mustGet(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/obligations/:id/assign', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(assignClinicianSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      await assignClinician(client, request.params.id, body.clinicianId);
      return mustGet(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/obligations/:id/see', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(seeResultSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      await seeResult(client, request.params.id, body);
      return mustGet(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/obligations/:id/attempt', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(recordAttemptSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      await recordAttempt(client, request.params.id, body);
      return mustGet(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/obligations/:id/informed', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(recordInformedSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      await recordInformed(client, request.params.id, body);
      return mustGet(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/obligations/:id/close', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(closeObligationSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      await closeObligation(client, request.params.id, body);
      return mustGet(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>(
    '/api/v1/obligations/:id/close-unreachable',
    async (request) => {
      const actor = requireActor(request);
      requireCapability(actor, 'clinic');
      const body = parseBody(closeObligationSchema, request.body);
      return withActorTx(ctx, request, async (client) => {
        await closeObligationUnreachable(client, request.params.id, body);
        return mustGet(client, request.params.id);
      });
    },
  );

  app.post<{ Params: { id: string } }>('/api/v1/obligations/:id/pause', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(pauseObligationSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      await pauseObligation(client, request.params.id, body.reason);
      return mustGet(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/obligations/:id/resume', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    return withActorTx(ctx, request, async (client) => {
      await resumeObligation(client, request.params.id);
      return mustGet(client, request.params.id);
    });
  });

  app.post<{ Params: { id: string } }>('/api/v1/obligations/:id/reassign', async (request) => {
    const actor = requireActor(request);
    requireCapability(actor, 'clinic');
    const body = parseBody(reassignObligationSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      await reassignObligation(client, request.params.id, body.clinicianId);
      return mustGet(client, request.params.id);
    });
  });
}

async function mustGet(
  client: Parameters<typeof getObligation>[0],
  resultId: string,
): Promise<NonNullable<Awaited<ReturnType<typeof getObligation>>>> {
  const row = await getObligation(client, resultId);
  if (!row) throw ApiError.notFound('That obligation is not available.');
  return row;
}

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../errors';
import type { CareProgressStage } from './progress';
import type { AppContext } from '../context';
import { listMyHospitals } from '../routes/hospitals';
import { idempotencyKey, parseBody, parseQuery, requireActor, withActorTx } from '../routes/helpers';
import { answerOffline, createHermesBridge } from './chat';
import { appendChat, applyCommand, assertChatRoom, continueWorkspace, createWorkspace, listWorkspaces, readWorkspace } from './repository';
import { responseLifetime } from './request-lifetime';
import { listWorkspaceHistory, readWorkspaceHistory } from './history';
import { configureTeamMember, listTeamAudit, listTeamMembers, resolveCareAccess, teamAuditQuery, teamMemberBody } from './team';
import { chatBody, commandBody, skillActionBody, skillCaptureBody, skillParams, skillTargetBody, workspaceListQuery, workspaceParams } from './schema';
import { actOnSkill, applicableSkillsForWorkspace, captureSkill, listSkills, previewSkill } from './skills';

const base = '/api/v1/care';
async function careActor(ctx: AppContext, request: FastifyRequest) {
  const actor = requireActor(request);
  if (actor.capabilities.clinicIds.length === 0) {
    const hospitals = await withActorTx(ctx, request, listMyHospitals);
    if (!hospitals.some((hospital) => hospital.careRole !== null)) {
      throw ApiError.forbidden('This action needs an assigned staff role.');
    }
  }
  return actor;
}

function routeLimit(max: number) {
  return {
    config: { rateLimit: {
      max, timeWindow: '1 minute' as const, hook: 'preHandler' as const,
      keyGenerator: (request: FastifyRequest) => requireActor(request).profile.userId,
    } },
  };
}

export function registerCareRoutes(app: FastifyInstance, ctx: AppContext): void {
  const hermes = createHermesBridge((timing) => app.log.info({ hermes: timing }, 'Care Hermes timings'));

  app.get(`${base}/runtime`, routeLimit(60), async (request) => {
    await careActor(ctx, request);
    return hermes.health();
  });

  app.post(`${base}/workspaces`, { ...routeLimit(30), bodyLimit: 1024 }, async (request, reply) => {
    const actor = await careActor(ctx, request);
    const { clinicId } = parseBody(z.strictObject({ clinicId: z.uuid().optional() }), request.body);
    const state = await withActorTx(ctx, request, async (client) => {
      const hospitals = await listMyHospitals(client);
      const managed = clinicId
        ? hospitals.find((hospital) => hospital.clinicId === clinicId)
        : hospitals.find((hospital) => hospital.careRole !== null);
      const target = clinicId ?? managed?.clinicId ?? actor.capabilities.clinicIds[0];
      if (!target || (managed ? !managed.careRole : !actor.capabilities.clinicIds.includes(target))) {
        throw ApiError.forbidden('An assigned staff role is required in this clinic.');
      }
      const workspace = await createWorkspace(client, actor.profile.userId, target);
      return managed ? readWorkspace(client, workspace.id, actor.profile.userId) : workspace;
    });
    reply.code(201);
    return state;
  });

  app.get(`${base}/workspaces`, routeLimit(60), async (request) => {
    const actor = await careActor(ctx, request);
    const { cursor } = parseQuery(workspaceListQuery, request.query);
    return withActorTx(ctx, request, (client) => listWorkspaces(client, actor.profile.userId, cursor));
  });

  app.post(`${base}/workspaces/:id/continue`, { ...routeLimit(10), bodyLimit: 1024 }, async (request) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    const { expectedRevision } = parseBody(z.strictObject({ expectedRevision: z.number().int().positive().max(1_000_000) }), request.body);
    return withActorTx(ctx, request, (client) => continueWorkspace(client, id, actor.profile.userId, expectedRevision));
  });

  app.get(`${base}/workspaces/:id`, async (request) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    return withActorTx(ctx, request, (client) => readWorkspace(client, id, actor.profile.userId));
  });

  app.post(`${base}/workspaces/:id/commands`, { ...routeLimit(150), bodyLimit: 24_576 }, async (request) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    const input = parseBody(commandBody, request.body);
    const key = idempotencyKey(request, true)!;
    return withActorTx(ctx, request, (client) => applyCommand(client, id, actor.profile.userId, key, input));
  });

  app.get(`${base}/workspaces/:id/history`, routeLimit(60), async (request) => {
    await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    const { cursor } = parseQuery(z.strictObject({ cursor: z.string().regex(/^[1-9]\d{0,18}$/).optional() }), request.query);
    return withActorTx(ctx, request, (client) => listWorkspaceHistory(client, id, cursor));
  });

  app.get(`${base}/workspaces/:id/team`, routeLimit(60), async (request) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    return withActorTx(ctx, request, async (client) => {
      const access = await resolveCareAccess(client, id, actor.profile.userId);
      return { access, members: await listTeamMembers(client, id) };
    });
  });

  app.post(`${base}/workspaces/:id/team`, { ...routeLimit(30), bodyLimit: 1024 }, async (request) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    const input = parseBody(teamMemberBody, request.body);
    return withActorTx(ctx, request, async (client) => {
      await configureTeamMember(client, id, input);
      return { access: await resolveCareAccess(client, id, actor.profile.userId), members: await listTeamMembers(client, id) };
    });
  });

  app.get(`${base}/workspaces/:id/team/audit`, routeLimit(60), async (request) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    const { before } = parseQuery(teamAuditQuery, request.query);
    return withActorTx(ctx, request, async (client) => {
      await resolveCareAccess(client, id, actor.profile.userId);
      return listTeamAudit(client, id, before);
    });
  });

  app.get(`${base}/workspaces/:id/history/:historyId`, routeLimit(60), async (request) => {
    await careActor(ctx, request);
    const { id, historyId } = parseBody(z.strictObject({ id: z.uuid(), historyId: z.string().regex(/^[1-9]\d{0,18}$/) }), request.params);
    return withActorTx(ctx, request, (client) => readWorkspaceHistory(client, id, historyId));
  });

  app.post(`${base}/workspaces/:id/chat`, { ...routeLimit(12), bodyLimit: 16_384 }, async (request, reply) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    const { message, mode, languageCode } = parseBody(chatBody, request.body);
    const ownerId = actor.profile.userId;
    const { snapshot, applicableSkills } = await withActorTx(ctx, request, async (client) => {
      const snapshot = await readWorkspace(client, id, ownerId);
      return { snapshot, applicableSkills: mode === 'hermes' ? await applicableSkillsForWorkspace(client, snapshot) : [] };
    });
    assertChatRoom(snapshot);

    const lifetime = responseLifetime(reply.raw);
    const streaming = request.headers.accept === 'application/x-ndjson';
    let sequence = 0;
    const emit = (frame: unknown) => {
      if (lifetime.signal.aborted || reply.raw.destroyed) return;
      reply.raw.write(`${JSON.stringify(frame)}\n`);
    };
    const progress = (stage: CareProgressStage) => emit({ type: 'progress', stage, sequence: ++sequence });
    if (streaming) {
      // Only start the stream after authentication, scoped reads and input validation.
      reply.hijack();
      for (const [name, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) reply.raw.setHeader(name, Array.isArray(value) ? [...value] : value);
      }
      reply.raw.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no',
      });
      reply.raw.flushHeaders();
      progress('context');
    }
    try {
      lifetime.signal.throwIfAborted();
      const result = mode === 'offline'
        ? answerOffline(snapshot, message, Date.now(), languageCode)
        : await hermes.chat(snapshot, message, request.id, applicableSkills, languageCode, lifetime.signal, streaming ? progress : undefined);
      lifetime.signal.throwIfAborted();
      if (streaming) progress('saving');
      const workspace = await withActorTx(ctx, request, (client) => appendChat(client, id, ownerId, snapshot.revision, message, result));
      if (!streaming) return workspace;
      emit({ type: 'result', workspace });
    } catch (error) {
      if (!streaming) throw error;
      const safe = error instanceof ApiError ? error : new ApiError(503, 'chat_unavailable', 'The reply could not be completed. Try again.');
      emit({ type: 'error', status: safe.status, error: { code: safe.code, message: safe.message } });
    } finally {
      lifetime.dispose();
      if (streaming && !reply.raw.destroyed) reply.raw.end();
    }
  });

  app.get(`${base}/workspaces/:id/export`, routeLimit(30), async (request, reply) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    const state = await withActorTx(ctx, request, (client) => readWorkspace(client, id, actor.profile.userId));
    reply.header('content-disposition', `attachment; filename="glucoflow-care-${state.id}.json"`);
    return state;
  });

  app.get(`${base}/workspaces/:id/skills`, routeLimit(60), async (request) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    return withActorTx(ctx, request, (client) => listSkills(client, id, actor.profile.userId));
  });

  app.post(`${base}/workspaces/:id/skills`, { ...routeLimit(30), bodyLimit: 1024 }, async (request, reply) => {
    const actor = await careActor(ctx, request);
    const { id } = parseBody(workspaceParams, request.params);
    const { taskId } = parseBody(skillCaptureBody, request.body);
    const skill = await withActorTx(ctx, request, async (client) => {
      const state = await readWorkspace(client, id, actor.profile.userId);
      return captureSkill(client, state, actor.profile.userId, taskId);
    });
    return reply.code(201).send(skill);
  });

  app.post(`${base}/workspaces/:id/skills/:skillId/actions`, { ...routeLimit(60), bodyLimit: 1024 }, async (request) => {
    const actor = await careActor(ctx, request);
    const { id, skillId } = parseBody(skillParams, request.params);
    const { action } = parseBody(skillActionBody, request.body);
    return withActorTx(ctx, request, (client) => actOnSkill(client, id, actor.profile.userId, skillId, action));
  });

  app.post(`${base}/workspaces/:id/skills/:skillId/preview`, { ...routeLimit(60), bodyLimit: 1024 }, async (request) => {
    const actor = await careActor(ctx, request);
    const { id, skillId } = parseBody(skillParams, request.params);
    const { encounterId, orderId } = parseBody(skillTargetBody, request.body);
    return withActorTx(ctx, request, async (client) => {
      const state = await readWorkspace(client, id, actor.profile.userId);
      return previewSkill(client, state, skillId, encounterId, orderId);
    });
  });
}

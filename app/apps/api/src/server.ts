import { registerGuideRoutes } from './guide/routes';
import { registerMasterRoutes } from './routes/master';
import { registerDeltaRoutes } from './routes/delta';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { UPLOAD_MAX_BYTES } from '@glucoflow/contracts';
import { resolveActor } from './auth';
import { createAppContext, type AppContext } from './context';
import { ApiError, toApiError } from './errors';
import { registerHealthRoutes } from './routes/health';
import { registerLocalAuthRoutes } from './routes/auth-local';
import { registerPatientRoutes } from './routes/patients';
import { registerDocumentRoutes } from './routes/documents';
import { registerPublicResultRoutes, registerResultRoutes } from './routes/results';
import { registerObligationRoutes } from './routes/obligations';
import { registerStorageRoutes, registerUploadRoutes } from './routes/uploads';
import { withTransaction } from '@glucoflow/data/pool';

export async function buildServer(existingContext?: AppContext): Promise<FastifyInstance> {
  const ctx = existingContext ?? (await createAppContext());
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      // Request bodies and medical text are never logged.
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["idempotency-key"]'],
      serializers: {req: (request) => ({method: request.method, url: request.url?.split('?')[0], remoteAddress: request.ip})},
    },
    bodyLimit: UPLOAD_MAX_BYTES + 1024,
    trustProxy: false,
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ctx.config.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: false,
    allowedHeaders: ['authorization', 'content-type', 'idempotency-key'],
    // PUT is the signed upload method; HEAD is used by the storage adapter.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    global: false,
    max: 300,
    timeWindow: '1 minute',
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/v1')) {
      reply.header('cache-control', 'no-store');
    }
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    const apiError = toApiError(error);
    if (apiError.status >= 500) {
      request.log.error(
        { code: apiError.code, err: error instanceof Error ? error.message : 'unknown' },
        'request failed',
      );
    }
    reply.code(apiError.status).send({
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: request.id,
        ...(apiError.fields ? { fields: apiError.fields } : {}),
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: { code: 'not_found', message: 'Not found.', requestId: request.id },
    });
  });

  // Public routes.
  registerHealthRoutes(app, ctx);
  registerLocalAuthRoutes(app, ctx);
  registerStorageRoutes(app, ctx);
  registerPublicResultRoutes(app, ctx);

  // Authenticated routes: every request resolves its actor from a verified token
  // and current database membership before any handler runs.
  await app.register(async (instance) => {
    instance.addHook('preHandler', async (request) => {
      const header = request.headers.authorization;
      if (!header || !header.toLowerCase().startsWith('bearer ')) {
        throw ApiError.unauthorized('Sign in to continue.');
      }
      const token = header.slice(7).trim();
      if (!token) throw ApiError.unauthorized('Sign in to continue.');
      request.actor = await resolveActor(ctx.pool, ctx.config, token, ctx.verifyToken);
    });

    registerGuideRoutes(instance, ctx);
    registerPatientRoutes(instance, ctx);
    registerMasterRoutes(instance, ctx);
    // The pre-visit delta is quarantined from this product. A derived comparison
    // between two results is a different intended purpose and should not inherit
    // the result-closure device boundary.
    if (process.env.ENABLE_DELTA === 'true') registerDeltaRoutes(instance, ctx);
    registerDocumentRoutes(instance, ctx);
    registerResultRoutes(instance, ctx);
    registerObligationRoutes(instance, ctx);
    registerUploadRoutes(instance, ctx);
  });

  // The critical clock is not theatre: every open, overdue receipt is escalated
  // on a timer, and a queued notification row is written. The delivery adapter is
  // intentionally separate so the evidence never claims a message was delivered.
  if (process.env.NODE_ENV !== 'test' && process.env.RESULT_ESCALATION_DISABLED !== 'true') {
    const timer = setInterval(() => {
      void withTransaction(ctx.pool, { role: ctx.config.apiRole }, (client) =>
        client.query('select sutra.escalate_overdue_results(null)'),
      ).catch((error: unknown) => {
        app.log.error({ err: error instanceof Error ? error.message : 'unknown' }, 'overdue escalation failed');
      });
    }, 60_000);
    timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }

  return app;
}

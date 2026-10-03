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
import { registerStorageRoutes, registerUploadRoutes } from './routes/uploads';

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

    registerPatientRoutes(instance, ctx);
    registerDocumentRoutes(instance, ctx);
    registerUploadRoutes(instance, ctx);
  });

  return app;
}

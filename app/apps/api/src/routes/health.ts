import type { FastifyInstance } from 'fastify';
import { withTransaction } from '@glucoflow/data/pool';
import { extractionLabel, extractionMode, type AppContext } from '../context';

/**
 * Operational endpoints. The public health endpoint never returns medical rows,
 * secrets or connection strings.
 * Source: docs/mvp/08-deployment.md "Operational endpoints and checks".
 */
export function registerHealthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/health/live', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_request, reply) => {
    try {
      await withTransaction(ctx.pool, { role: ctx.config.apiRole }, async (client) => {
        await client.query('select 1');
      });
      return { status: 'ok', database: 'reachable' };
    } catch {
      reply.code(503);
      return { status: 'unavailable', database: 'unreachable' };
    }
  });

  /**
   * Public client configuration. This is public configuration, not a credential:
   * it tells the client which sign-in path and which extraction mode are active so
   * fixture mode and demo labelling are always visible.
   */
  app.get('/api/v1/config', async () => ({
    appEnv: ctx.config.APP_ENV,
    authMode: ctx.config.AUTH_MODE,
    supabaseUrl: ctx.config.AUTH_MODE === 'supabase' ? (ctx.config.SUPABASE_URL ?? null) : null,
    storageMode: ctx.config.STORAGE_MODE,
    demoLabel: ctx.config.DEMO_LABEL,
    extraction: {
      mode: extractionMode(ctx.config),
      provider: ctx.config.EXTRACTION_PROVIDER,
      model: ctx.config.EXTRACTION_MODEL,
      label: extractionLabel(ctx.config),
    },
    limits: {
      uploadMaxBytes: ctx.config.UPLOAD_MAX_BYTES,
      uploadMaxPages: ctx.config.UPLOAD_MAX_PAGES,
      photoBatchMax: 10,
    },
    serverTime: new Date().toISOString(),
  }));
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyPassword } from '@sutra/data/password';
import { withTransaction } from '@sutra/data/pool';
import { signLocalToken } from '../auth';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { parseBody } from './helpers';

const signInSchema = z.object({
  email: z.string().min(3).max(200),
  password: z.string().min(1).max(200),
});

/**
 * Development sign-in. This exists so the local demo has real authentication
 * without a hosted identity provider. It is refused when APP_ENV=production, and
 * the credential row is only readable inside this transaction
 * (app.auth_purpose = 'signin').
 */
export function registerLocalAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/v1/auth/local-sign-in', async (request, reply) => {
    if (ctx.config.AUTH_MODE !== 'local' || ctx.config.APP_ENV === 'production') {
      reply.code(501);
      return {
        error: {
          code: 'local_auth_disabled',
          message: 'Use the configured identity provider to sign in.',
          requestId: request.id,
        },
      };
    }
    const body = parseBody(signInSchema, request.body);

    const result = await withTransaction(
      ctx.pool,
      { role: ctx.config.apiRole, settings: { 'app.auth_purpose': 'signin' } },
      async (client) => {
        const credential = await client.query<{
          user_id: string;
          password_hash: string;
          display_name: string;
        }>('select * from sutra.local_credential_for($1)', [body.email]);
        const row = credential.rows[0];
        // The same message is returned for an unknown account and a wrong password.
        if (!row) return null;
        const ok = await verifyPassword(body.password, row.password_hash);
        if (!ok) return null;
        return { userId: row.user_id, displayName: row.display_name };
      },
    );

    if (!result) {
      reply.code(401);
      return {
        error: {
          code: 'invalid_credentials',
          message: 'That email address and password combination was not accepted.',
          requestId: request.id,
        },
      };
    }

    const token = await signLocalToken(ctx.config, {
      userId: result.userId,
      email: body.email,
    });
    return {
      accessToken: token.accessToken,
      expiresIn: token.expiresIn,
      tokenType: 'Bearer' as const,
      displayName: result.displayName,
      authMode: 'local' as const,
    };
  });
}

export function assertLocalAuthAvailable(ctx: AppContext): void {
  if (ctx.config.AUTH_MODE !== 'local') {
    throw ApiError.notImplemented('Local sign-in is not the configured authentication mode.');
  }
}

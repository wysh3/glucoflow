import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withActor, type DbClient } from '@sutra/data/pool';
import type { ResolvedActor } from '../auth';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

declare module 'fastify' {
  interface FastifyRequest {
    actor?: ResolvedActor;
  }
}

export function requireActor(request: FastifyRequest): ResolvedActor {
  if (!request.actor) throw ApiError.unauthorized();
  return request.actor;
}

/** Runs one actor-scoped transaction. The actor context is transaction-local. */
export function withActorTx<T>(
  ctx: AppContext,
  request: FastifyRequest,
  fn: (client: DbClient) => Promise<T>,
  extraSettings: Record<string, string> = {},
): Promise<T> {
  const actor = requireActor(request);
  return withActor(
    ctx.pool,
    ctx.config.apiRole,
    actor.profile.userId,
    fn,
    15_000,
  ).catch((error) => {
    // extraSettings is currently only used by the local sign-in path, which has
    // no actor; it is accepted here so callers share one transaction helper.
    void extraSettings;
    throw error;
  });
}

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'body';
      fields[key] = issue.message;
    }
    throw ApiError.validation('The request could not be accepted.', fields);
  }
  return parsed.data;
}

export function parseQuery<T extends z.ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const parsed = schema.safeParse(query ?? {});
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'query';
      fields[key] = issue.message;
    }
    throw ApiError.validation('The request parameters could not be accepted.', fields);
  }
  return parsed.data;
}

export function idempotencyKey(request: FastifyRequest, required: boolean): string | null {
  const header = request.headers['idempotency-key'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    if (required) {
      throw ApiError.validation('This request needs an Idempotency-Key header.', {
        'Idempotency-Key': 'required',
      });
    }
    return null;
  }
  if (value.length < 8 || value.length > 200) {
    throw ApiError.validation('Idempotency-Key must be between 8 and 200 characters.', {
      'Idempotency-Key': 'invalid length',
    });
  }
  return value;
}

export type RouteContext = AppContext & { app: FastifyInstance };

import { createHash } from 'node:crypto';
import { withActor, type DbClient } from '@glucoflow/data/pool';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import type { ResolvedActor } from '../auth';

/**
 * Idempotent mutations.
 *
 * A mutating upload, publication or export request carries an Idempotency-Key.
 * Repeating the same key with the same body returns the stored response; the same
 * key with a different body is a conflict. Results are retained for 24 hours.
 */

export type IdempotencyInput = {
  ctx: AppContext;
  actor: ResolvedActor;
  route: string;
  key: string;
  body: unknown;
  clinicId: string;
  run: (client: DbClient) => Promise<unknown>;
};

function hashBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
}

export async function withIdempotency(input: IdempotencyInput): Promise<unknown> {
  const requestHash = hashBody(input.body);
  return withActor(
    input.ctx.pool,
    input.ctx.config.apiRole,
    input.actor.profile.userId,
    async (client) => {
      const existing = await client.query<{
        request_hash: string;
        state: string;
        response_json: unknown;
      }>(
        `select request_hash, state, response_json
           from sutra.idempotency_keys
          where clinic_id = $1 and actor_id = $2 and route = $3 and key = $4`,
        [input.clinicId, input.actor.profile.userId, input.route, input.key],
      );
      const row = existing.rows[0];
      if (row) {
        if (row.request_hash !== requestHash) {
          throw ApiError.conflict(
            'This Idempotency-Key was already used with a different request.',
            'idempotency_conflict',
          );
        }
        if (row.state === 'completed') {
          return row.response_json;
        }
      } else {
        await client.query(
          `insert into sutra.idempotency_keys
             (clinic_id, actor_id, route, key, request_hash, state)
           values ($1, $2, $3, $4, $5, 'in_progress')`,
          [input.clinicId, input.actor.profile.userId, input.route, input.key, requestHash],
        );
      }

      const response = await input.run(client);
      await client.query(
        `update sutra.idempotency_keys
            set response_json = $5::jsonb, state = 'completed'
          where clinic_id = $1 and actor_id = $2 and route = $3 and key = $4`,
        [
          input.clinicId,
          input.actor.profile.userId,
          input.route,
          input.key,
          JSON.stringify(response ?? null),
        ],
      );
      return response;
    },
    30_000,
  );
}

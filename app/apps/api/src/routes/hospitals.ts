import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  hospitalStaffUpdateSchema,
  type HospitalContext,
  type HospitalStaffAudit,
  type HospitalStaffAuditEvent,
  type HospitalStaffDirectory,
  type HospitalStaffMember,
} from '@glucoflow/contracts';
import type { DbClient } from '@glucoflow/data/pool';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { parseBody, parseQuery, requireActor, withActorTx } from './helpers';

const base = '/api/v1/hospitals';
const clinicParams = z.strictObject({ clinicId: z.uuid() });
const staffParams = clinicParams.extend({ userId: z.uuid() });
const pageSize = 50;

export async function listMyHospitals(client: DbClient): Promise<HospitalContext[]> {
  const { rows } = await client.query<HospitalContext>(
    `select clinic_id as "clinicId", display_name as "displayName", administrator, care_role as "careRole"
       from sutra.list_my_hospitals()`,
  );
  return rows;
}

function rateLimit(max: number) {
  return {
    config: { rateLimit: {
      max, timeWindow: '1 minute' as const, hook: 'preHandler' as const,
      keyGenerator: (request: FastifyRequest) => requireActor(request).profile.userId,
    } },
  };
}

export function registerHospitalRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get(base, rateLimit(60), async (request) =>
    withActorTx(ctx, request, async (client) => ({ hospitals: await listMyHospitals(client) })),
  );

  app.get(`${base}/:clinicId/staff`, rateLimit(60), async (request): Promise<HospitalStaffDirectory> => {
    const { clinicId } = parseBody(clinicParams, request.params);
    const { cursor } = parseQuery(z.strictObject({ cursor: z.uuid().optional() }), request.query);
    return withActorTx(ctx, request, async (client) => {
      const { rows } = await client.query<HospitalStaffMember>(
        `select user_id as "userId", display_name as "displayName", email, administrator,
                care_role as "careRole", clinician, active
           from sutra.list_hospital_staff($1,$2)`,
        [clinicId, cursor ?? null],
      );
      return { members: rows.slice(0, pageSize), nextCursor: rows.length > pageSize ? rows[pageSize - 1]!.userId : null };
    });
  });

  app.patch(`${base}/:clinicId/staff/:userId`, { ...rateLimit(30), bodyLimit: 1024 }, async (request): Promise<HospitalStaffMember> => {
    const { clinicId, userId } = parseBody(staffParams, request.params);
    const assignment = parseBody(hospitalStaffUpdateSchema, request.body);
    return withActorTx(ctx, request, async (client) => {
      const { rows } = await client.query<HospitalStaffMember>(
        `select user_id as "userId", display_name as "displayName", email, administrator,
                care_role as "careRole", clinician, active
           from sutra.assign_hospital_staff($1,$2,$3,$4,$5,$6::jsonb)`,
        [clinicId, userId, assignment.administrator, assignment.careRole, assignment.active, JSON.stringify(assignment.expectedAssignment)],
      );
      return rows[0]!;
    });
  });

  app.get(`${base}/:clinicId/audit`, rateLimit(60), async (request): Promise<HospitalStaffAudit> => {
    const { clinicId } = parseBody(clinicParams, request.params);
    const { before } = parseQuery(z.strictObject({ before: z.string().regex(/^[1-9]\d{0,18}$/)
      .refine((value) => value.length < 19 || value <= '9223372036854775807').optional() }), request.query);
    return withActorTx(ctx, request, async (client) => {
      const hospitals = await listMyHospitals(client);
      if (!hospitals.some((hospital) => hospital.clinicId === clinicId && hospital.administrator)) {
        throw ApiError.forbidden('Active hospital administrator access required.');
      }
      const { rows } = await client.query<HospitalStaffAuditEvent>(
        `select id::text, actor_id as "actorId", target_user_id as "targetUserId",
                previous_assignment as previous, current_assignment as current, created_at as at
           from sutra.hospital_staff_audit
          where clinic_id=$1 and ($2::bigint is null or id<$2)
          order by hospital_staff_audit.id desc limit $3`,
        [clinicId, before ?? null, pageSize + 1],
      );
      return { events: rows.slice(0, pageSize), nextCursor: rows.length > pageSize ? rows[pageSize - 1]!.id : null };
    });
  });
}

import { z } from 'zod';
import { contextSchema, type ActorContext, type Context } from './common';

/**
 * `GET /me` response. The client selects an active context only from this list and
 * the server reauthorizes every request against current database membership.
 */

export const capabilitiesSchema = z.object({
  canReview: z.boolean(),
  canViewApproved: z.boolean(),
  canUploadForPatient: z.boolean(),
  canExport: z.boolean(),
  canAcknowledgeNote: z.boolean(),
  patientIds: z.array(z.string()),
  clinicIds: z.array(z.string()),
});

export type Capabilities = z.infer<typeof capabilitiesSchema>;

export const meResponseSchema = z.object({
  actor: z.object({
    userId: z.string(),
    email: z.string(),
    displayName: z.string(),
    demoMode: z.boolean(),
  }),
  contexts: z.array(contextSchema),
  capabilities: capabilitiesSchema,
  appEnv: z.string(),
  extraction: z.object({
    mode: z.enum(['fixture', 'live']),
    provider: z.string(),
    model: z.string(),
    label: z.string(),
  }),
  storage: z.object({ mode: z.enum(['local', 'supabase']) }),
  serverTime: z.string(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

export type { ActorContext, Context };

import { z } from 'zod';
import type { UUID } from './common';

/**
 * Durable job contract. Source: docs/mvp/03-architecture.md "Durable job contract"
 * and docs/mvp/05-data-and-api.md "Job state values".
 */

export const jobStates = ['queued', 'running', 'retry_wait', 'succeeded', 'failed'] as const;
export type JobState = (typeof jobStates)[number];

export const jobStages = [
  'validate_file',
  'prepare_pages',
  'ocr',
  'extract',
  'validate_draft',
  'save_draft',
  'render_export',
] as const;
export type JobStage = (typeof jobStages)[number];

export const jobKinds = ['process_document', 'render_export'] as const;
export type JobKind = (typeof jobKinds)[number];

export const jobStateSchema = z.enum(jobStates);
export const jobStageSchema = z.enum(jobStages);
export const jobKindSchema = z.enum(jobKinds);

export type JobDto = {
  jobId: UUID;
  kind: JobKind;
  state: JobState;
  stage: JobStage | null;
  attempt: number;
  maxAttempts: number;
  targetId: UUID;
  /** Observed stages come from committed stage outputs, not a timer. */
  observedStages: { stage: JobStage; completedAt: string }[];
  errorCode: string | null;
  errorMessage: string | null;
  retryAfterSeconds: number | null;
  updatedAt: string;
  /** Whether the caller may create a new bounded retry run for this target. */
  retryAllowed: boolean;
  retryBlockedReason: string | null;
};

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  validate_file: 'Checking file',
  prepare_pages: 'Reading document',
  ocr: 'Reading scanned pages',
  extract: 'Proposing entries',
  validate_draft: 'Checking proposed entries',
  save_draft: 'Saving draft',
  render_export: 'Building summary',
};

export const JOB_STATE_LABELS: Record<JobState, string> = {
  queued: 'Waiting to start',
  running: 'In progress',
  retry_wait: 'Waiting to retry',
  succeeded: 'Finished',
  failed: 'Could not finish',
};

export const jobDtoSchema = z.object({
  jobId: z.string(),
  kind: z.string(),
  state: z.string(),
  stage: z.string().nullable(),
  attempt: z.number(),
  maxAttempts: z.number(),
  targetId: z.string(),
  observedStages: z.array(z.object({ stage: z.string(), completedAt: z.string() })),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  retryAfterSeconds: z.number().nullable(),
  updatedAt: z.string(),
  retryAllowed: z.boolean(),
  retryBlockedReason: z.string().nullable(),
});

export const retryRequestSchema = z.object({
  reason: z.string().min(3).max(500),
});
export type RetryRequest = z.infer<typeof retryRequestSchema>;

export const RETRY_BACKOFF_SECONDS = [5, 20] as const;
export const MAX_JOB_ATTEMPTS = 3;
export const LEASE_SECONDS = 60;
export const HEARTBEAT_SECONDS = 15;
export const RUN_DEADLINE_SECONDS = 5 * 60;
export const MAX_DOCUMENT_MODEL_CALLS = 12;
export const MAX_MANUAL_RETRIES_PER_HOUR = 3;

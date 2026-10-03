import {
  JOB_STAGE_LABELS,
  LEASE_SECONDS,
  MAX_JOB_ATTEMPTS,
  RETRY_BACKOFF_SECONDS,
  type JobDto,
  type JobKind,
  type JobStage,
  type JobState,
} from '@glucoflow/contracts';
import type { DbClient } from './pool';

/**
 * Durable job queue. Claiming uses FOR UPDATE SKIP LOCKED, every write is fenced by
 * the lease token, and durable stage outputs are preserved across worker restarts.
 * Source: docs/mvp/03-architecture.md "Durable job contract".
 */

export type LeasedJob = {
  jobId: string;
  kind: JobKind;
  targetId: string;
  clinicId: string;
  patientId: string | null;
  stage: JobStage | null;
  attempt: number;
  maxAttempts: number;
  runNumber: number;
  leaseToken: string;
  leaseUntil: string;
};

/** Returns expired running jobs to the queue without clearing durable outputs. */
export async function recoverExpiredLeases(client: DbClient): Promise<number> {
  const result = await client.query(
    `update sutra.jobs
        set state = 'queued', lease_token = null, lease_until = null, stage = null, updated_at = now()
      where state = 'running' and lease_until is not null and lease_until < now()`,
  );
  return result.rowCount ?? 0;
}

/**
 * Advisory lock key used to pause job processing.
 *
 * A maintenance or test process takes this lock; the worker then stops leasing new jobs
 * (work already in flight finishes) instead of competing for the same rows. The key is
 * an arbitrary constant, not a secret.
 */
export const QUEUE_PAUSE_LOCK_KEY = 8_274_119;

/** True while another session holds the queue pause lock. */
export async function isQueuePaused(client: DbClient): Promise<boolean> {
  const result = await client.query<{ paused: boolean }>(
    `select exists (
       select 1 from pg_locks
        where locktype = 'advisory'
          and objid = $1
          and granted
          and pid <> pg_backend_pid()
     ) as paused`,
    [QUEUE_PAUSE_LOCK_KEY],
  );
  return result.rows[0]?.paused === true;
}

export async function leaseJob(client: DbClient): Promise<LeasedJob | null> {
  const result = await client.query<{
    id: string;
    kind: JobKind;
    target_id: string;
    clinic_id: string;
    patient_id: string | null;
    stage: JobStage | null;
    attempt: number;
    max_attempts: number;
    run_number: number;
    lease_token: string;
    lease_until: string;
  }>(
    `with candidate as (
       select id from sutra.jobs
        where state in ('queued', 'retry_wait')
          and available_at <= now()
          and attempt < max_attempts
        order by available_at, created_at
        for update skip locked
        limit 1
     )
     update sutra.jobs j
        set state = 'running',
            attempt = j.attempt + 1,
            lease_token = gen_random_uuid(),
            lease_until = now() + make_interval(secs => $1),
            started_at = coalesce(j.started_at, now()),
            last_heartbeat_at = now(),
            updated_at = now()
       from candidate
      where j.id = candidate.id
      returning j.id, j.kind, j.target_id, j.clinic_id, j.patient_id, j.stage,
                j.attempt, j.max_attempts, j.run_number, j.lease_token, j.lease_until`,
    [LEASE_SECONDS],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    jobId: row.id,
    kind: row.kind,
    targetId: row.target_id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    stage: row.stage,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    runNumber: row.run_number,
    leaseToken: row.lease_token,
    leaseUntil: new Date(row.lease_until).toISOString(),
  };
}

export async function heartbeat(
  client: DbClient,
  jobId: string,
  leaseToken: string,
): Promise<boolean> {
  const result = await client.query(
    `update sutra.jobs
        set lease_until = now() + make_interval(secs => $3),
            last_heartbeat_at = now(),
            updated_at = now()
      where id = $1 and lease_token = $2 and state = 'running'`,
    [jobId, leaseToken, LEASE_SECONDS],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function setStage(
  client: DbClient,
  jobId: string,
  leaseToken: string,
  stage: JobStage,
): Promise<boolean> {
  const result = await client.query(
    `update sutra.jobs set stage = $3, updated_at = now()
      where id = $1 and lease_token = $2 and state = 'running'`,
    [jobId, leaseToken, stage],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function recordStageOutput(
  client: DbClient,
  jobId: string,
  leaseToken: string,
  stage: JobStage,
  documentVersionId: string | null,
  outputRef: Record<string, unknown>,
): Promise<void> {
  const fenced = await client.query(
    'select 1 from sutra.jobs where id = $1 and lease_token = $2 and state = $3',
    [jobId, leaseToken, 'running'],
  );
  if (fenced.rowCount === 0) {
    throw new Error('stale_lease');
  }
  await client.query(
    `insert into sutra.job_stage_outputs (job_id, stage, document_version_id, output_ref)
     values ($1, $2, $3, $4::jsonb)
     on conflict (job_id, stage) do update
       set output_ref = excluded.output_ref, completed_at = now()`,
    [jobId, stage, documentVersionId, JSON.stringify(outputRef)],
  );
}

export async function loadStageOutputs(
  client: DbClient,
  jobId: string,
): Promise<{ stage: JobStage; completedAt: string; outputRef: Record<string, unknown> }[]> {
  const result = await client.query<{ stage: JobStage; completed_at: string; output_ref: Record<string, unknown> }>(
    'select stage, completed_at, output_ref from sutra.job_stage_outputs where job_id = $1 order by completed_at',
    [jobId],
  );
  return result.rows.map((row) => ({
    stage: row.stage,
    completedAt: new Date(row.completed_at).toISOString(),
    outputRef: row.output_ref,
  }));
}

export async function completeJob(
  client: DbClient,
  jobId: string,
  leaseToken: string,
): Promise<boolean> {
  const result = await client.query(
    `update sutra.jobs
        set state = 'succeeded', finished_at = now(), lease_token = null, lease_until = null,
            stage = null, error_code = null, error_message = null, updated_at = now()
      where id = $1 and lease_token = $2 and state = 'running'`,
    [jobId, leaseToken],
  );
  return (result.rowCount ?? 0) > 0;
}

export type JobFailure = {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
};

/**
 * Retries transient failures at most three total attempts with a 5/20 second
 * baseline and jitter. Format, identity and authorization failures never retry.
 */
export async function failJob(
  client: DbClient,
  jobId: string,
  leaseToken: string,
  failure: JobFailure,
): Promise<{ state: JobState; availableAt: string | null }> {
  const current = await client.query<{ attempt: number; max_attempts: number }>(
    'select attempt, max_attempts from sutra.jobs where id = $1 and lease_token = $2',
    [jobId, leaseToken],
  );
  const row = current.rows[0];
  if (!row) throw new Error('stale_lease');

  const attemptsLeft = failure.retryable && row.attempt < Math.min(row.max_attempts, MAX_JOB_ATTEMPTS);
  if (!attemptsLeft) {
    await client.query(
      `update sutra.jobs
          set state = 'failed', error_code = $3, error_message = $4, finished_at = now(),
              lease_token = null, lease_until = null, stage = null, updated_at = now()
        where id = $1 and lease_token = $2`,
      [jobId, leaseToken, failure.code, failure.message],
    );
    return { state: 'failed', availableAt: null };
  }

  const baseline = RETRY_BACKOFF_SECONDS[Math.min(row.attempt - 1, RETRY_BACKOFF_SECONDS.length - 1)] ?? 20;
  const jitter = Math.floor(Math.random() * 2000) / 1000;
  const delay = Math.max(failure.retryAfterSeconds ?? 0, baseline + jitter);
  const result = await client.query<{ available_at: string }>(
    `update sutra.jobs
        set state = 'retry_wait',
            available_at = now() + make_interval(secs => $5),
            error_code = $3, error_message = $4,
            lease_token = null, lease_until = null, updated_at = now()
      where id = $1 and lease_token = $2
      returning available_at`,
    [jobId, leaseToken, failure.code, failure.message, delay],
  );
  return {
    state: 'retry_wait',
    availableAt: result.rows[0] ? new Date(result.rows[0].available_at).toISOString() : null,
  };
}

export async function getJobDto(client: DbClient, jobId: string): Promise<JobDto | null> {
  const result = await client.query<{
    id: string;
    kind: JobKind;
    state: JobState;
    stage: JobStage | null;
    attempt: number;
    max_attempts: number;
    target_id: string;
    error_code: string | null;
    error_message: string | null;
    updated_at: string;
    retry_allowed: boolean;
    stages: { stage: JobStage; completedAt: string }[];
    next_available_at: string | null;
  }>(
    `select j.id, j.kind, j.state, j.stage, j.attempt, j.max_attempts, j.target_id,
            j.error_code, j.error_message, j.updated_at, j.available_at as next_available_at,
            (j.state = 'failed') as retry_allowed,
            coalesce((
              select json_agg(json_build_object('stage', s.stage, 'completedAt', s.completed_at)
                              order by s.completed_at)
              from sutra.job_stage_outputs s where s.job_id = j.id
            ), '[]'::json) as stages
       from sutra.jobs j where j.id = $1`,
    [jobId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const observedStages = (Array.isArray(row.stages) ? row.stages : []).map((item) => ({
    stage: (item as { stage: JobStage }).stage,
    completedAt: new Date((item as { completedAt: string }).completedAt).toISOString(),
  }));
  const lastStage = observedStages.at(-1)?.stage ?? row.stage;
  return {
    jobId: row.id,
    kind: row.kind,
    state: row.state,
    stage: row.stage,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    targetId: row.target_id,
    observedStages,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    retryAfterSeconds:
      row.state === 'retry_wait' && row.next_available_at
        ? Math.max(0, Math.round((new Date(row.next_available_at).getTime() - Date.now()) / 1000))
        : null,
    updatedAt: new Date(row.updated_at).toISOString(),
    retryAllowed: row.retry_allowed,
    retryBlockedReason: row.retry_allowed ? null : 'A retry is available after a failed run.',
    ...(lastStage ? { stageLabel: JOB_STAGE_LABELS[lastStage] } : {}),
  } as JobDto;
}

export { JOB_STAGE_LABELS };

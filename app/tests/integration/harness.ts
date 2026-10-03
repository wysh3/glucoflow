import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { hashPassword, withTransaction, type DbClient } from '@glucoflow/data';
import { LocalStorageAdapter } from '@glucoflow/data/storage';
import { createExtractionProvider, processDocumentJob } from '@glucoflow/extraction';
import { leaseJob } from '@glucoflow/data';
import { appRoot, ensureLocalEnv, localRoot } from '../../scripts/lib/env';

/**
 * Integration test harness.
 *
 * It runs against the local PostgreSQL cluster created by `pnpm db:start` with the
 * migrations applied, and uses the same roles the API and the worker use. No test
 * bypasses row level security.
 */

export type TestContext = {
  env: ReturnType<typeof ensureLocalEnv>;
  ownerPool: pg.Pool;
  apiRole: string;
  workerRole: string;
  storage: LocalStorageAdapter;
  sourceBucket: string;
  exportBucket: string;
  owner: <T>(fn: (client: DbClient) => Promise<T>, actorId?: string) => Promise<T>;
  asActor: <T>(actorId: string, fn: (client: DbClient) => Promise<T>) => Promise<T>;
  asWorker: <T>(fn: (client: DbClient) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

export function requireLocalEnvironment(): ReturnType<typeof ensureLocalEnv> {
  const env = ensureLocalEnv();
  if (!env.DATABASE_URL_OWNER || !env.DATABASE_URL_API || !env.DATABASE_URL_WORKER) {
    throw new Error('Local database configuration is missing. Run "pnpm db:start" and "pnpm db:migrate".');
  }
  return env;
}

export async function createTestContext(): Promise<TestContext> {
  const env = requireLocalEnvironment();
  const ownerPool = new pg.Pool({ connectionString: env.DATABASE_URL_OWNER, max: 4 });
  const apiPool = new pg.Pool({ connectionString: env.DATABASE_URL_API, max: 4 });
  const workerPool = new pg.Pool({ connectionString: env.DATABASE_URL_WORKER, max: 4 });
  const apiRole = process.env.DATABASE_ROLE_API ?? 'sutra_api';
  const workerRole = process.env.DATABASE_ROLE_WORKER ?? 'sutra_worker';
  const storage = new LocalStorageAdapter({
    root: env.STORAGE_LOCAL_ROOT ?? join(localRoot, 'storage'),
    secret: env.STORAGE_LOCAL_SECRET ?? '',
    publicBaseUrl: 'http://127.0.0.1:8787',
  });

  return {
    env,
    ownerPool,
    apiRole,
    workerRole,
    storage,
    sourceBucket: env.STORAGE_BUCKET_SOURCES ?? 'sutra-sources',
    exportBucket: env.STORAGE_BUCKET_EXPORTS ?? 'sutra-exports',
    owner: (fn, actorId) =>
      withTransaction(
        ownerPool,
        { role: 'sutra_owner', actorId: actorId ?? null, statementTimeoutMs: 60_000 },
        fn,
      ),
    asActor: (actorId, fn) =>
      withTransaction(apiPool, { role: apiRole, actorId, statementTimeoutMs: 30_000 }, fn),
    asWorker: (fn) =>
      withTransaction(
        workerPool,
        { role: workerRole, workerId: 'test', statementTimeoutMs: 60_000 },
        fn,
      ),
    close: async () => {
      await Promise.all([ownerPool.end(), apiPool.end(), workerPool.end()]);
    },
  };
}

export type TestFixture = {
  clinicId: string;
  reviewerId: string;
  clinicianId: string;
  patientUserId: string;
  patientId: string;
  patientIdentifier: string;
  otherClinicId: string;
  otherReviewerId: string;
  otherPatientId: string;
};

/**
 * Creates two isolated clinics with identically named patients, a reviewer, a
 * clinician-only account and a linked patient account.
 */
export async function createFixture(context: TestContext, label: string): Promise<TestFixture> {
  const suffix = `${label}-${randomUUID().slice(0, 8)}`;
  const passwordHash = await hashPassword('integration-test-only');

  return context.owner(async (client) => {
    const clinic = await client.query<{ id: string }>(
      'insert into sutra.clinics (display_name, is_demo) values ($1, true) returning id',
      [`Integration clinic A ${suffix}`],
    );
    const otherClinic = await client.query<{ id: string }>(
      'insert into sutra.clinics (display_name, is_demo) values ($1, true) returning id',
      [`Integration clinic B ${suffix}`],
    );
    const clinicId = clinic.rows[0]!.id;
    const otherClinicId = otherClinic.rows[0]!.id;

    const createUser = async (email: string, displayName: string): Promise<string> => {
      const created = await client.query<{ id: string }>(
        'insert into sutra.app_users (email, display_name) values ($1, $2) returning id',
        [email, displayName],
      );
      await client.query(
        'insert into sutra.local_credentials (user_id, password_hash) values ($1, $2)',
        [created.rows[0]!.id, passwordHash],
      );
      return created.rows[0]!.id;
    };

    const reviewerId = await createUser(`reviewer-${suffix}@test.local`, 'Test Reviewer');
    const clinicianId = await createUser(`clinician-${suffix}@test.local`, 'Test Clinician');
    const patientUserId = await createUser(`patient-${suffix}@test.local`, 'Asha Rao');
    const otherReviewerId = await createUser(`other-${suffix}@test.local`, 'Other Clinic Reviewer');

    await client.query(
      `insert into sutra.memberships (clinic_id, user_id, reviewer, clinician) values
         ($1, $2, true, true), ($1, $3, false, true), ($4, $5, true, true)`,
      [clinicId, reviewerId, clinicianId, otherClinicId, otherReviewerId],
    );

    const patientIdentifier = 'P0482';
    const patient = await client.query<{ id: string }>(
      'insert into sutra.patients (clinic_id, clinic_identifier, display_name) values ($1, $2, $3) returning id',
      [clinicId, patientIdentifier, 'Asha Rao'],
    );
    const otherPatient = await client.query<{ id: string }>(
      'insert into sutra.patients (clinic_id, clinic_identifier, display_name) values ($1, $2, $3) returning id',
      [otherClinicId, patientIdentifier, 'Asha Rao'],
    );
    await client.query(
      'insert into sutra.patient_accounts (clinic_id, patient_id, user_id, active) values ($1, $2, $3, true)',
      [clinicId, patient.rows[0]!.id, patientUserId],
    );

    return {
      clinicId,
      reviewerId,
      clinicianId,
      patientUserId,
      patientId: patient.rows[0]!.id,
      patientIdentifier,
      otherClinicId,
      otherReviewerId,
      otherPatientId: otherPatient.rows[0]!.id,
    };
  });
}

export async function removeClinic(context: TestContext, clinicId: string): Promise<void> {
  await context.owner(async (client) => {
    const statements = [
      'delete from sutra.approved_fact_evidence where clinic_id = $1',
      'delete from sutra.fact_status_events where clinic_id = $1',
      'delete from sutra.approved_facts where clinic_id = $1',
      'delete from sutra.approval_batches where clinic_id = $1',
      'delete from sutra.draft_fact_evidence where clinic_id = $1',
      'delete from sutra.draft_facts where clinic_id = $1',
      'delete from sutra.review_batches where clinic_id = $1',
      'delete from sutra.provider_calls where run_id in (select id from sutra.extraction_runs where clinic_id = $1)',
      'delete from sutra.extraction_batches where run_id in (select id from sutra.extraction_runs where clinic_id = $1)',
      'delete from sutra.extraction_runs where clinic_id = $1',
      'delete from sutra.evidence_spans where clinic_id = $1',
      'delete from sutra.job_stage_outputs where job_id in (select id from sutra.jobs where clinic_id = $1)',
      'delete from sutra.jobs where clinic_id = $1',
      'delete from sutra.exports where clinic_id = $1',
      'delete from sutra.idempotency_keys where clinic_id = $1',
      'delete from sutra.patient_notes where clinic_id = $1',
      'delete from sutra.patient_accounts where clinic_id = $1',
      'update sutra.documents set current_version_id = null, duplicate_of_document_id = null, supersedes_document_id = null where clinic_id = $1',
      'delete from sutra.document_versions where clinic_id = $1',
      'delete from sutra.documents where clinic_id = $1',
      'delete from sutra.upload_sessions where clinic_id = $1',
      'delete from sutra.audit_events where clinic_id = $1',
      'delete from sutra.patients where clinic_id = $1',
      'delete from sutra.memberships where clinic_id = $1',
      // The clinic row itself is removed last, so a finished suite leaves no tenant
      // behind for the maintenance pass to report.
      'delete from sutra.clinics where id = $1',
    ];
    for (const statement of statements) {
      await client.query(statement, [clinicId]);
    }
  });
}

export type StagedUpload = {
  sessionId: string;
  documentId: string;
  versionId: string;
  jobId: string;
  objectPaths: string[];
};

/** Stores fixture bytes and creates the completed upload, document, version and job. */
export async function stageFixtureUpload(
  context: TestContext,
  fixture: TestFixture,
  options: {
    filename: string;
    contentType?: string;
    bytes?: Buffer;
    uploaderId?: string;
    clinicId?: string;
    patientId?: string;
    queueJob?: boolean;
  },
): Promise<StagedUpload> {
  const clinicId = options.clinicId ?? fixture.clinicId;
  const patientId = options.patientId ?? fixture.patientId;
  const uploaderId = options.uploaderId ?? fixture.patientUserId;
  const bytes =
    options.bytes ??
    readFileSync(join(appRoot, 'fixtures', 'synthetic', 'sources', options.filename));
  const sessionId = randomUUID();
  const objectPath = `clinics/${clinicId}/patients/${patientId}/uploads/${sessionId}/00-${options.filename}`;
  await context.storage.putObject(
    context.sourceBucket,
    objectPath,
    bytes,
    options.contentType ?? 'application/pdf',
  );

  return context.owner(async (client) => {
    const sha = await import('node:crypto').then((module) =>
      module.createHash('sha256').update(module.createHash('sha256').update(bytes).digest('hex')).digest('hex'),
    );
    await client.query(
      `insert into sutra.upload_sessions (
         id, clinic_id, patient_id, actor_id, kind, manifest_json, state,
         provider_token_expires_at, completion_expires_at, completed_at
       ) values ($1, $2, $3, $4, 'file', $5::jsonb, 'completed', now(), now(), now())`,
      [
        sessionId,
        clinicId,
        patientId,
        uploaderId,
        JSON.stringify({
          kind: 'file',
          items: [
            {
              index: 0,
              objectPath,
              filename: options.filename,
              contentType: options.contentType ?? 'application/pdf',
              byteCount: bytes.length,
            },
          ],
        }),
      ],
    );
    const document = await client.query<{ id: string }>(
      `insert into sutra.documents (clinic_id, patient_id, uploader_id, assignment_state)
       values ($1, $2, $3, 'assigned') returning id`,
      [clinicId, patientId, uploaderId],
    );
    const version = await client.query<{ id: string }>(
      `insert into sutra.document_versions (
         document_id, clinic_id, source_manifest_json, sha256, bytes, version_number, source_kind
       ) values ($1, $2, $3::jsonb, $4, $5, 1, 'file') returning id`,
      [
        document.rows[0]!.id,
        clinicId,
        JSON.stringify({
          kind: 'file',
          items: [
            {
              index: 0,
              objectPath,
              filename: options.filename,
              contentType: options.contentType ?? 'application/pdf',
              byteCount: bytes.length,
            },
          ],
        }),
        sha,
        bytes.length,
      ],
    );
    await client.query('update sutra.documents set current_version_id = $2 where id = $1', [
      document.rows[0]!.id,
      version.rows[0]!.id,
    ]);
    await client.query('update sutra.upload_sessions set document_id = $2 where id = $1', [
      sessionId,
      document.rows[0]!.id,
    ]);
    const job = await client.query<{ id: string }>(
      `insert into sutra.jobs (clinic_id, patient_id, kind, target_id, created_by)
       values ($1, $2, 'process_document', $3, $4) returning id`,
      [clinicId, patientId, document.rows[0]!.id, uploaderId],
    );
    return {
      sessionId,
      documentId: document.rows[0]!.id,
      versionId: version.rows[0]!.id,
      jobId: job.rows[0]!.id,
      objectPaths: [objectPath],
    };
  });
}


export type LeasedJob = {
  jobId: string;
  kind: 'process_document' | 'render_export';
  targetId: string;
  clinicId: string;
  patientId: string | null;
  stage: null;
  attempt: number;
  maxAttempts: number;
  runNumber: number;
  leaseToken: string;
  leaseUntil: string;
};

/**
 * Takes the lease for one specific job.
 *
 * Test files run in parallel and a development worker may be running against the same
 * database, so the lease is taken by id with a fresh token. Any other worker holding
 * the job is fenced out: its later writes are rejected by the same lease check the
 * production path uses.
 */
export async function leaseTargetJob(context: TestContext, jobId: string): Promise<LeasedJob | null> {
  return context.asWorker(async (client) => {
    const result = await client.query<{
      id: string;
      kind: 'process_document' | 'render_export';
      target_id: string;
      clinic_id: string;
      patient_id: string | null;
      stage: null;
      attempt: number;
      max_attempts: number;
      run_number: number;
      lease_token: string;
      lease_until: string;
    }>(
      `update sutra.jobs
          set state = 'running',
              attempt = attempt + 1,
              lease_token = gen_random_uuid(),
              lease_until = now() + interval '60 seconds',
              started_at = coalesce(started_at, now()),
              last_heartbeat_at = now(),
              updated_at = now()
        where id = $1
          and state in ('queued', 'retry_wait', 'running')
          and attempt < max_attempts
        returning id, kind, target_id, clinic_id, patient_id, stage, attempt, max_attempts,
                  run_number, lease_token, lease_until`,
      [jobId],
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
  });
}

/**
 * Runs the real worker job code for one specific job.
 *
 * Test files run in parallel and a development worker may be running against the same
 * database, so the harness takes the lease for its own job by id. The lease token is
 * regenerated, which fences any other worker out of that job: its later writes are
 * rejected by the same check the production path uses. The processing itself is the
 * production code path.
 */
export async function runOneJob(context: TestContext, jobId?: string): Promise<string | null> {
  const leased = jobId ? await leaseTargetJob(context, jobId) : await context.asWorker((client) => leaseJob(client));
  if (!leased) {
    // Another worker (for example a running development worker) already holds or has
    // finished this job. Wait for it to reach a terminal state instead of failing.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await jobState(context, jobId!);
      if (state.state === 'succeeded' || state.state === 'failed') return jobId!;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  }

  await processDocumentJob(
    {
      tx: (fn) => context.asWorker(fn),
      storage: context.storage,
      sourceBucket: context.sourceBucket,
      tmpRoot: join(localRoot, 'tmp', `test-${leased.jobId}`),
      enableOcr: false,
      maxPages: 10,
      maxCalls: 12,
      createProvider: (budget) =>
        createExtractionProvider(
          { provider: 'fixture', model: 'deterministic-rules-v1', maxCalls: 12 },
          budget,
        ),
      heartbeat: () => undefined,
      log: () => undefined,
    },
    leased,
  );
  return leased.jobId;
}

export async function jobState(
  context: TestContext,
  jobId: string,
): Promise<{ state: string; error_code: string | null; attempt: number }> {
  return context.owner(async (client) => {
    const result = await client.query<{ state: string; error_code: string | null; attempt: number }>(
      'select state, error_code, attempt from sutra.jobs where id = $1',
      [jobId],
    );
    return result.rows[0]!;
  });
}

export async function documentState(
  context: TestContext,
  documentId: string,
): Promise<{ assignment_state: string; duplicate_of_document_id: string | null; released_to_patient: boolean }> {
  return context.owner(async (client) => {
    const result = await client.query<{
      assignment_state: string;
      duplicate_of_document_id: string | null;
      released_to_patient: boolean;
    }>('select assignment_state, duplicate_of_document_id, released_to_patient from sutra.documents where id = $1', [
      documentId,
    ]);
    return result.rows[0]!;
  });
}

export async function latestBatch(
  context: TestContext,
  documentId: string,
): Promise<{ id: string; revision: number; state: string; identity_state: string } | null> {
  return context.owner(async (client) => {
    const result = await client.query<{ id: string; revision: number; state: string; identity_state: string }>(
      'select id, revision, state, identity_state from sutra.review_batches where document_id = $1 order by created_at desc limit 1',
      [documentId],
    );
    return result.rows[0] ?? null;
  });
}

/** The message of the error a call raises, for tests that assert a specific refusal. */
export async function errorMessage(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function errorCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      return String((error as { code: unknown }).code);
    }
    return error instanceof Error ? `error:${error.message}` : 'unknown';
  }
}

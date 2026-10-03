/**
 * Seeds the isolated synthetic demonstration environment.
 *
 * The reset history is produced by the real code path: the fixture source files are
 * stored as uploads, processed by the same document job the worker runs, and
 * published through the same publication procedure the reviewer uses.
 *
 *   pnpm seed:demo -- --clinic demo --confirm-demo
 *
 * Passwords are generated, printed once and written to app/.local/demo-credentials.json
 * (not committed). No password is stored in source, fixtures or documentation.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { hashPassword, generateDemoPassword, withTransaction, type DbClient } from '@glucoflow/data';
import { LocalStorageAdapter } from '@glucoflow/data/storage';
import { leaseJob } from '@glucoflow/data';
import { createExtractionProvider, processDocumentJob } from '@glucoflow/extraction';
import { appRoot, ensureLocalEnv, localRoot } from './lib/env';

const SOURCE_DIR = join(appRoot, 'fixtures', 'synthetic', 'sources');

/** The approved reset history: three source-backed dates and values. */
const HISTORY_DOCUMENTS = [
  '2026-01-12_lab_report.pdf',
  '2026-04-10_lab_report.pdf',
  '2026-07-09_lab_report.pdf',
];
/** Context documents that are also part of the approved history. */
const CONTEXT_DOCUMENTS = [
  '2026-03-02_prescription.pdf',
  '2026-05-20_eye_examination.pdf',
  '2026-06-11_foot_examination.pdf',
];

type SeedOptions = {
  clinicArg: string;
  confirmDemo: boolean;
};

function parseArgs(argv: string[]): SeedOptions {
  let clinicArg = 'demo';
  let confirmDemo = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--clinic') clinicArg = argv[index + 1] ?? 'demo';
    if (argv[index] === '--confirm-demo') confirmDemo = true;
  }
  return { clinicArg, confirmDemo };
}

async function ensureClinic(
  client: DbClient,
  name: string,
  isDemo: boolean,
  existingId?: string,
): Promise<string> {
  if (existingId) {
    const found = await client.query<{ id: string; is_demo: boolean }>(
      'select id, is_demo from sutra.clinics where id = $1',
      [existingId],
    );
    if (found.rows[0]) {
      if (!found.rows[0].is_demo && isDemo) {
        throw new Error(
          'Refusing to seed a clinic that is not flagged as a demo tenant. Run reset:demo or use a new clinic id.',
        );
      }
      return found.rows[0].id;
    }
  }
  const existing = await client.query<{ id: string; is_demo: boolean }>(
    'select id, is_demo from sutra.clinics where display_name = $1',
    [name],
  );
  if (existing.rows[0]) {
    if (!existing.rows[0].is_demo && isDemo) {
      throw new Error(`Refusing to seed the non-demo clinic "${name}".`);
    }
    return existing.rows[0].id;
  }
  const created = await client.query<{ id: string }>(
    'insert into sutra.clinics (display_name, is_demo) values ($1, $2) returning id',
    [name, isDemo],
  );
  return created.rows[0]!.id;
}

/** Reads the previous credentials file, if any, without failing when it is absent. */
function readPreviousCredentials(): {
  accounts?: Record<string, { password?: string }>;
} | null {
  try {
    return JSON.parse(readFileSync(join(localRoot, 'demo-credentials.json'), 'utf8')) as {
      accounts?: Record<string, { password?: string }>;
    };
  } catch {
    return null;
  }
}

async function ensureUser(
  client: DbClient,
  email: string,
  displayName: string,
  password: string,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    'select id from sutra.app_users where lower(email) = lower($1)',
    [email],
  );
  if (existing.rows[0]) {
    await client.query('update sutra.app_users set display_name = $2 where id = $1', [
      existing.rows[0].id,
      displayName,
    ]);
    // Re-seeding keeps the account usable: the stored hash is set to the password
    // written to the credentials file, so the file and the database never disagree.
    const rotated = await hashPassword(password);
    await client.query(
      `insert into sutra.local_credentials (user_id, password_hash) values ($1, $2)
       on conflict (user_id) do update set password_hash = excluded.password_hash`,
      [existing.rows[0].id, rotated],
    );
    return existing.rows[0].id;
  }
  const created = await client.query<{ id: string }>(
    'insert into sutra.app_users (email, display_name) values ($1, $2) returning id',
    [email, displayName],
  );
  const hash = await hashPassword(password);
  await client.query(
    'insert into sutra.local_credentials (user_id, password_hash) values ($1, $2)',
    [created.rows[0]!.id, hash],
  );
  return created.rows[0]!.id;
}

async function ensureMembership(
  client: DbClient,
  clinicId: string,
  userId: string,
  roles: { reviewer: boolean; clinician: boolean; administrator?: boolean },
): Promise<void> {
  await client.query(
    `insert into sutra.memberships (clinic_id, user_id, reviewer, clinician, administrator, active)
     values ($1, $2, $3, $4, $5, true)
     on conflict (clinic_id, user_id) do update
       set reviewer = excluded.reviewer, clinician = excluded.clinician,
           administrator = excluded.administrator, active = true`,
    [clinicId, userId, roles.reviewer, roles.clinician, roles.administrator ?? false],
  );
}

async function ensurePatient(
  client: DbClient,
  clinicId: string,
  identifier: string,
  displayName: string,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    'select id from sutra.patients where clinic_id = $1 and clinic_identifier = $2',
    [clinicId, identifier],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await client.query<{ id: string }>(
    'insert into sutra.patients (clinic_id, clinic_identifier, display_name) values ($1, $2, $3) returning id',
    [clinicId, identifier, displayName],
  );
  return created.rows[0]!.id;
}

async function linkPatientAccount(
  client: DbClient,
  clinicId: string,
  patientId: string,
  userId: string,
): Promise<void> {
  await client.query(
    `insert into sutra.patient_accounts (clinic_id, patient_id, user_id, active)
     values ($1, $2, $3, true)
     on conflict (patient_id, user_id) do update set active = true`,
    [clinicId, patientId, userId],
  );
}

/** Stores a fixture file as a completed upload exactly like the API completion path. */
async function stageUpload(
  client: DbClient,
  storage: LocalStorageAdapter,
  bucket: string,
  input: {
    clinicId: string;
    patientId: string;
    uploaderId: string;
    filename: string;
    contentType: string;
  },
): Promise<{ documentId: string; sessionId: string; bytes: number }> {
  const bytes = readFileSync(join(SOURCE_DIR, input.filename));
  const sessionId = randomUUID();
  const objectPath = `clinics/${input.clinicId}/patients/${input.patientId}/uploads/${sessionId}/00-${input.filename}`;
  await storage.putObject(bucket, objectPath, bytes, input.contentType);
  const sha256 = createHash('sha256').update(`${objectPath}:${createHash('sha256').update(bytes).digest('hex')}`).digest('hex');

  await client.query(
    `insert into sutra.upload_sessions (
       id, clinic_id, patient_id, actor_id, kind, manifest_json, state,
       provider_token_expires_at, completion_expires_at, completed_at
     ) values ($1, $2, $3, $4, 'file', $5::jsonb, 'completed', now(), now(), now())`,
    [
      sessionId,
      input.clinicId,
      input.patientId,
      input.uploaderId,
      JSON.stringify({
        kind: 'file',
        items: [
          {
            index: 0,
            objectPath,
            filename: input.filename,
            contentType: input.contentType,
            byteCount: bytes.length,
          },
        ],
      }),
    ],
  );

  const document = await client.query<{ id: string }>(
    `insert into sutra.documents (clinic_id, patient_id, uploader_id, assignment_state)
     values ($1, $2, $3, 'assigned') returning id`,
    [input.clinicId, input.patientId, input.uploaderId],
  );
  const documentId = document.rows[0]!.id;
  const version = await client.query<{ id: string }>(
    `insert into sutra.document_versions (
       document_id, clinic_id, source_manifest_json, sha256, bytes, version_number, source_kind
     ) values ($1, $2, $3::jsonb, $4, $5, 1, 'file') returning id`,
    [
      documentId,
      input.clinicId,
      JSON.stringify({
        kind: 'file',
        items: [
          {
            index: 0,
            objectPath,
            filename: input.filename,
            contentType: input.contentType,
            byteCount: bytes.length,
          },
        ],
      }),
      sha256,
      bytes.length,
    ],
  );
  await client.query('update sutra.documents set current_version_id = $2 where id = $1', [
    documentId,
    version.rows[0]!.id,
  ]);
  await client.query('update sutra.upload_sessions set document_id = $2 where id = $1', [
    sessionId,
    documentId,
  ]);
  await client.query(
    `insert into sutra.jobs (clinic_id, patient_id, kind, target_id, created_by)
     values ($1, $2, 'process_document', $3, $4)`,
    [input.clinicId, input.patientId, documentId, input.uploaderId],
  );
  return { documentId, sessionId, bytes: bytes.length };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.confirmDemo) {
    throw new Error(
      'Refusing to seed without --confirm-demo. This command creates synthetic demo accounts and records only.',
    );
  }
  const env = ensureLocalEnv();
  if (env.APP_ENV === 'production') {
    throw new Error('Refusing to seed a production environment.');
  }

  const owner = new pg.Pool({ connectionString: env.DATABASE_URL_OWNER, max: 3 });
  const ownerTx = <T>(fn: (client: DbClient) => Promise<T>, actorId?: string): Promise<T> =>
    withTransaction(owner, { role: 'sutra_owner', actorId: actorId ?? null }, fn);
  const storage = new LocalStorageAdapter({
    root: env.STORAGE_LOCAL_ROOT ?? join(localRoot, 'storage'),
    secret: env.STORAGE_LOCAL_SECRET ?? '',
    publicBaseUrl: env.API_BASE_URL ?? 'http://127.0.0.1:8787',
  });

  const credentials: Record<string, { email: string; password: string; role: string }> = {};

  try {
    const demoClinicId = await ownerTx((client) =>
      ensureClinic(
        client,
        'Glucoflow Demo Clinic (synthetic)',
        true,
        options.clinicArg !== 'demo' && /^[0-9a-f-]{36}$/i.test(options.clinicArg)
          ? options.clinicArg
          : undefined,
      ),
    );
    const testClinicId = await ownerTx((client) =>
      ensureClinic(client, 'Northside Test Clinic (synthetic)', true),
    );

    // Accounts. Passwords are generated for this environment only.
    // A previous run's passwords are reused when the credentials file is present, so
    // re-seeding does not invalidate a password someone already copied.
    const previous = readPreviousCredentials();
    const pick = (key: string): string => previous?.accounts?.[key]?.password ?? generateDemoPassword();
    const patientPassword = pick('patient');
    const clinicPassword = pick('clinic');
    const reviewerPassword = pick('reviewer');
    const clinicianPassword = pick('clinician');
    const otherClinicPassword = pick('other-clinic');
    const otherPatientPassword = pick('other-patient');

    const patientUser = await ownerTx((client) => ensureUser(client, 'patient@glucoflow.demo', 'Asha Rao (synthetic)', patientPassword));
    const clinicUser = await ownerTx((client) => ensureUser(client, 'clinic@glucoflow.demo', 'Dr Meera Nair (synthetic)', clinicPassword));
    const reviewerUser = await ownerTx((client) => ensureUser(client, 'reviewer@glucoflow.demo', 'Reviewer Sana Iqbal (synthetic)', reviewerPassword));
    const clinicianUser = await ownerTx((client) => ensureUser(client, 'clinician@glucoflow.demo', 'Clinician Arun Das (synthetic)', clinicianPassword));
    const otherClinicUser = await ownerTx((client) => ensureUser(client, 'other-clinic@glucoflow.demo', 'Northside Reviewer (synthetic)', otherClinicPassword));
    const otherPatientUser = await ownerTx((client) => ensureUser(client, 'other-patient@glucoflow.demo', 'Asha Rao (other clinic, synthetic)', otherPatientPassword));

    credentials['patient'] = { email: 'patient@glucoflow.demo', password: patientPassword, role: 'patient (self-linked)' };
    credentials['clinic'] = { email: 'clinic@glucoflow.demo', password: clinicPassword, role: 'reviewer + clinician' };
    credentials['reviewer'] = { email: 'reviewer@glucoflow.demo', password: reviewerPassword, role: 'reviewer only' };
    credentials['clinician'] = { email: 'clinician@glucoflow.demo', password: clinicianPassword, role: 'clinician only' };
    credentials['other-clinic'] = { email: 'other-clinic@glucoflow.demo', password: otherClinicPassword, role: 'reviewer in the isolated test clinic' };
    credentials['other-patient'] = { email: 'other-patient@glucoflow.demo', password: otherPatientPassword, role: 'patient in the isolated test clinic' };

    await ownerTx((client) => ensureMembership(client, demoClinicId, clinicUser, { reviewer: true, clinician: true }));
    await ownerTx((client) => ensureMembership(client, demoClinicId, reviewerUser, { reviewer: true, clinician: false }));
    await ownerTx((client) => ensureMembership(client, demoClinicId, clinicianUser, { reviewer: false, clinician: true }));
    await ownerTx((client) => ensureMembership(client, testClinicId, otherClinicUser, { reviewer: true, clinician: true }));

    const patientId = await ownerTx((client) => ensurePatient(client, demoClinicId, 'P0482', 'Asha Rao (synthetic)'));
    // A deliberately identical name and identifier in the second clinic, to prove isolation.
    const otherPatientId = await ownerTx((client) => ensurePatient(client, testClinicId, 'P0482', 'Asha Rao (synthetic)'));
    await ownerTx((client) => linkPatientAccount(client, demoClinicId, patientId, patientUser));
    await ownerTx((client) => linkPatientAccount(client, testClinicId, otherPatientId, otherPatientUser));

    console.log('Seeding the approved history through the real processing and publication path...');
    const seededDocuments: { filename: string; documentId: string }[] = [];
    for (const filename of [...HISTORY_DOCUMENTS, ...CONTEXT_DOCUMENTS]) {
      const staged = await ownerTx((client) =>
        stageUpload(client, storage, env.STORAGE_BUCKET_SOURCES ?? 'sutra-sources', {
          clinicId: demoClinicId,
          patientId,
          uploaderId: clinicUser,
          filename,
          contentType: 'application/pdf',
        }),
      );
      seededDocuments.push({ filename, documentId: staged.documentId });
    }

    // Run the real worker job code in this process, one leased job at a time.
    const workerRole = process.env.DATABASE_ROLE_WORKER ?? 'sutra_worker';
    const workerPool = new pg.Pool({ connectionString: env.DATABASE_URL_WORKER, max: 2 });
    const tx = <T>(fn: (client: DbClient) => Promise<T>): Promise<T> =>
      withTransaction(workerPool, { role: workerRole, workerId: 'seed' }, fn);

    let processed = 0;
    for (;;) {
      const job = await tx((client) => leaseJob(client));
      if (!job) break;
      await processDocumentJob(
        {
          tx,
          storage,
          sourceBucket: env.STORAGE_BUCKET_SOURCES ?? 'sutra-sources',
          tmpRoot: env.TMP_ROOT ?? join(localRoot, 'tmp'),
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
        job,
      );
      processed += 1;
    }
    await workerPool.end();
    console.log(`Processed ${processed} document job(s) with the fixture rule engine.`);

    // Publish each document through the real publication procedure as the reviewer.
    let published = 0;
    for (const document of seededDocuments) {
      const publishedResult = await ownerTx(async (client) => {
          const batch = await client.query<{ id: string; revision: number; state: string; identity_state: string }>(
            `select id, revision, state, identity_state from sutra.review_batches
              where document_id = $1 order by created_at desc limit 1`,
            [document.documentId],
          );
          const row = batch.rows[0];
          if (!row) return { skipped: 'no draft batch' };
          if (row.identity_state === 'mismatch' || row.identity_state === 'unchecked') {
            return { skipped: `identity state ${row.identity_state}` };
          }
          // Approve every proposed entry (the seeded history is fully reviewed).
          await client.query(
            `update sutra.draft_facts set review_state = 'reviewed' where review_batch_id = $1`,
            [row.id],
          );
          const result = await client.query<{ publish_review: { approvalRevision: number; publishedCount: number } }>(
            'select sutra.publish_review($1, $2, $3::jsonb) as publish_review',
            [document.documentId, row.revision, '[]'],
          );
          return result.rows[0]!.publish_review;
        },
        clinicUser,
      );
      if ('skipped' in publishedResult) {
        console.log(`  ${document.filename}: not published (${publishedResult.skipped})`);
      } else {
        published += 1;
      }
    }
    console.log(`Published ${published} document(s) into the approved history.`);

    // A patient-reported note. Notes never become measured results.
    await ownerTx(async (client) => {
      const existing = await client.query<{ count: string }>(
        `select count(*)::text as count from sutra.patient_notes where patient_id = $1`,
        [patientId],
      );
      if (Number(existing.rows[0]?.count ?? '0') > 0) return;
      await client.query('select sutra.submit_patient_note($1, $2, $3, $4::date)', [
        patientId,
        'diet_activity',
        'Walked 30 minutes after dinner on most days this month; reduced sweet tea to one cup a day.',
        '2026-09-10',
      ]);
    }, patientUser);

    const state = await ownerTx(async (client) => {
      const counts = await client.query<{
        approved: string;
        documents: string;
        pending_review: string;
        notes: string;
      }>(
        `select
           (select count(*)::text from sutra.approved_facts where patient_id = $1 and status = 'retained') as approved,
           (select count(*)::text from sutra.documents where patient_id = $1) as documents,
           (select count(*)::text from sutra.documents d where d.patient_id = $1
              and not exists (select 1 from sutra.approval_batches ab where ab.document_id = d.id)) as pending_review,
           (select count(*)::text from sutra.patient_notes where patient_id = $1) as notes`,
        [patientId],
      );
      const revision = await client.query<{ approval_revision: number }>(
        'select approval_revision from sutra.patients where id = $1',
        [patientId],
      );
      return { ...counts.rows[0]!, approvalRevision: revision.rows[0]!.approval_revision };
    });

    const credentialPath = join(localRoot, 'demo-credentials.json');
    mkdirSync(localRoot, { recursive: true });
    writeFileSync(
      credentialPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          note: 'Generated local demonstration credentials. Not committed. Do not reuse outside this local environment.',
          patientId,
          demoClinicId,
          testClinicId,
          accounts: credentials,
        },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    );

    console.log('');
    console.log('Demo environment seeded.');
    console.log(`  demo clinic:   ${demoClinicId}`);
    console.log(`  test clinic:   ${testClinicId}`);
    console.log(`  patient:       P0482 (Asha Rao, synthetic)`);
    console.log(`  approved facts: ${state.approved} across ${state.documents} documents`);
    console.log(`  awaiting review: ${state.pending_review} document(s)`);
    console.log(`  patient notes: ${state.notes}`);
    console.log(`  approval revision: ${state.approvalRevision}`);
    console.log('');
    console.log('Sign-in accounts (passwords are in .local/demo-credentials.json):');
    for (const [key, value] of Object.entries(credentials)) {
      console.log(`  ${key.padEnd(14)} ${value.email.padEnd(28)} ${value.role}`);
    }
    console.log('');
    console.log('Upload fixtures/synthetic/sources/2026-09-14_lab_report.pdf in the demo to run the live sequence.');
  } finally {
    await owner.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

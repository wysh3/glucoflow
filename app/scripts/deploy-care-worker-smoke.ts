import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import pg from 'pg';
import type { JobDto, ReviewDto, UploadCompletionDto, UploadSessionDto } from '@glucoflow/contracts';
import { appRoot, localRoot } from './lib/env';
import { buildSyntheticReport, smokerunDate } from './lib/synthetic-report';

let phase = 'worker revision preflight';
type ProofFile = { filename: string; contentType: string; bytes?: Buffer };
type ProofJob = { documentId: string; jobId: string };

async function main(): Promise<void> {
  const [confirm, resume, ...otherArgs] = process.argv.slice(2);
  assert.ok(confirm === '--confirm-live' && (!resume || resume === '--resume-pdf') && !otherArgs.length,
    'Pass --confirm-live for two bounded hosted synthetic uploads, or add --resume-pdf after a polling interruption');
  const worker = JSON.parse(execFileSync('az', [
    'containerapp', 'show', '--name', 'glucoflow-worker', '--resource-group', 'glucoflow-demo',
    '--query', '{ready:properties.latestReadyRevisionName,latest:properties.latestRevisionName,env:properties.template.containers[?name==\'worker\'].env[]|[?name==\'MAX_DOCUMENT_MODEL_CALLS\'||name==\'EXTRACTION_PROVIDER\']}',
    '--output', 'json', '--only-show-errors',
  ], { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] })) as {
    ready: string; latest: string; env: { name: string; value?: string }[];
  };
  const workerValues = Object.fromEntries(worker.env.map(({ name, value }) => [name, value]));
  assert.ok(worker.ready && worker.ready === worker.latest && workerValues.MAX_DOCUMENT_MODEL_CALLS === '2'
    && workerValues.EXTRACTION_PROVIDER === 'hermes', 'A ready Hermes worker with a two-call document cap is required');
  const hosted = JSON.parse(readFileSync(join(localRoot, 'azure-deployment-secrets.json'), 'utf8'));
  const fixture = JSON.parse(readFileSync(join(localRoot, 'hosted-demo-credentials.json'), 'utf8'));
  const base = new URL('/api/v1', hosted.apiUrlPublic).href;
  const storageOrigin = new URL(hosted.supabaseUrl).origin;
  const owner = new URL(hosted.ownerUrl);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) owner.searchParams.delete(key);
  const db = new pg.Client({
    connectionString: owner.toString(), connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: true, ca: readFileSync(join(appRoot, 'deploy', 'supabase-ca.crt'), 'utf8') },
  });

  async function signIn(role: 'patient' | 'clinic' | 'other-clinic'): Promise<string> {
    const { email, password } = fixture.accounts[role];
    assert.ok(email.endsWith('@glucoflow.demo'), 'Upload proof requires a synthetic demo identity');
    const response = await fetch(`${storageOrigin}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: hosted.publishableKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 200, `Synthetic ${role} login HTTP status`);
    const { access_token } = (await response.json()) as { access_token?: string };
    assert.ok(access_token, 'Synthetic sign-in did not issue an access token');
    return access_token;
  }

  async function api<T>(path: string, expected: number, token: string, method = 'GET', body?: object): Promise<T> {
    const fetchRequest = () => fetch(base + path, {
      method, headers: {
        authorization: `Bearer ${token}`,
        ...(method === 'POST' && { 'idempotency-key': randomUUID() }),
        ...(body && { 'content-type': 'application/json' }),
      },
      body: body && JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    const response = await fetchRequest().catch((error: unknown) => {
      if (method !== 'GET') throw error;
      return fetchRequest();
    });
    assert.equal(response.status, expected, `Hosted ${method} ${path.replace(/\/[a-f0-9-]{36}/, '/:id')} HTTP status`);
    return response.json() as Promise<T>;
  }

  try {
    phase = 'synthetic identity preflight';
    await db.connect();
    await db.query('set default_transaction_read_only = on');
    const identity = await db.query<{ display_name: string; clinic_identifier: string }>(`
      select p.display_name, p.clinic_identifier from sutra.patients p
      join sutra.clinics c on c.id = p.clinic_id
      where p.id = $1 and c.id = $2 and c.is_demo and p.clinic_identifier = 'P0482'
    `, [fixture.patientId, fixture.demoClinicId]);
    const demo = identity.rows[0];
    assert.ok(demo, 'Expected the seeded synthetic patient in the demo clinic');
    phase = 'synthetic sign-in';
    const [patient, clinic, other] = await Promise.all([signIn('patient'), signIn('clinic'), signIn('other-clinic')]);
    async function proveUpload(
      kind: 'file' | 'photos',
      files: (ProofFile & { bytes: Buffer })[],
    ): Promise<ProofJob> {
      phase = `${kind} upload session`;
      const session = await api<UploadSessionDto>('/uploads', 201, patient, 'POST', {
        patientId: fixture.patientId, kind,
        files: files.map(({ filename, contentType, bytes }) => ({ filename, contentType, byteCount: bytes.length })),
      });
      assert.equal(session.items.length, files.length, 'Upload did not return every expected source target');
      phase = `${kind} signed storage upload`;
      for (const [index, target] of session.items.entries()) {
        const file = files[index]!;
        assert.equal(target.filename, file.filename, 'Upload session changed the original photo order');
        const uploadUrl = new URL(target.uploadUrl);
        assert.equal(uploadUrl.origin, storageOrigin, 'Expected the private hosted Storage upload endpoint');
        if (target.uploadToken && !uploadUrl.searchParams.has('token')) uploadUrl.searchParams.set('token', target.uploadToken);
        const put = await fetch(uploadUrl, {
          method: target.method, headers: { 'content-type': target.contentType, 'x-upsert': 'false' },
          body: new Uint8Array(file.bytes),
          redirect: 'error', signal: AbortSignal.timeout(20_000),
        });
        assert.ok(put.ok, 'Private synthetic source upload failed');
      }

      phase = `${kind} upload completion`;
      const completed = await api<UploadCompletionDto>(`/uploads/${session.sessionId}/complete`, 202, patient, 'POST');
      assert.ok(completed.jobId && completed.documentId && !completed.duplicateOfDocumentId, 'Expected one new document job');
      return { jobId: completed.jobId, documentId: completed.documentId };
    }

    async function proveDraft(
      kind: 'file' | 'photos',
      completed: ProofJob,
      files: ProofFile[],
      uploadChecksum?: string,
    ): Promise<void> {
      const deadline = Date.now() + 300_000;
      phase = `${kind} job polling`;
      async function readJob() {
        const result = await db.query<{ state: JobDto['state']; error_code: string | null; elapsed_ms: number | null }>(`
          select state, error_code, (extract(epoch from finished_at - created_at) * 1000)::int as elapsed_ms
          from sutra.jobs where id = $1 and target_id = $2 and patient_id = $3
        `, [completed.jobId, completed.documentId, fixture.patientId]);
        assert.ok(result.rows[0], 'Expected one synthetic job in the durable ledger');
        return result.rows[0];
      }
      let job = await readJob();
      while (job.state !== 'succeeded' && job.state !== 'failed' && Date.now() < deadline) {
        await setTimeout(2000);
        job = await readJob();
      }

      phase = `${kind} usage ledger`;
      const usage = await db.query<{
        call_count: number; input_tokens: number; output_tokens: number; actual_cost_usd: string;
        released_to_patient: boolean; calls_in_ledger: number; calls_with_usage: number;
      }>(`
        select r.call_count, r.input_tokens, r.output_tokens, r.actual_cost_usd, d.released_to_patient,
          (select count(*)::int from sutra.provider_calls pc where pc.run_id = r.id) as calls_in_ledger,
          (select count(*)::int from sutra.provider_calls pc where pc.run_id = r.id and pc.usage_known) as calls_with_usage
        from sutra.extraction_runs r join sutra.documents d on d.id = r.document_id
        where r.job_id = $1 and r.document_id = $2
      `, [completed.jobId, completed.documentId]);
      const run = usage.rows[0];
      console.log(`Hosted ${kind} upload job: ${job.state}, ${job.elapsed_ms ?? 'pending'} ms, ${run?.call_count ?? 0} durable call reservations.`);
      if (job.error_code && /^[a-z_]+$/.test(job.error_code)) console.log(`Hosted job failure category: ${job.error_code}.`);
      assert.equal(job.state, 'succeeded', 'Hosted worker did not finish the synthetic upload');
      assert.ok(run && run.call_count >= 1 && run.call_count <= 2, 'Expected 1–2 reserved provider requests');
      assert.equal(run.call_count, run.calls_in_ledger, 'Provider call records did not match the durable run count');
      assert.ok(run.calls_with_usage >= 1 && run.input_tokens > 0 && run.output_tokens > 0, 'Actual provider usage missing');
      assert.equal(run.released_to_patient, false, 'The upload must remain an unpublished draft');

      const path = `/documents/${completed.documentId}`;
      phase = `${kind} draft review`;
      const review = await api<ReviewDto>(`${path}/review`, 200, clinic);
      assert.equal(review.extractionProvider, 'hermes');
      assert.equal(review.extractionModel, 'gpt-6-luna');
      assert.equal(review.extractionMode, 'live');
      assert.equal(review.publishedAt, null);
      assert.ok(review.facts.some((fact) => fact.kind === 'observation' && fact.rawValue === '7.8'
        && fact.evidence.some((evidence) => evidence.page >= 1 && evidence.page <= files.length
          && evidence.documentVersionId === review.documentVersionId)),
      'Expected the synthetic HbA1c value with page source evidence');
      phase = `${kind} cross-clinic review and source denial`;
      await api(`${path}/review`, 404, other);
      await api(`${path}/source`, 404, other);
      const sourceHashes = [];
      for (const [index, file] of files.entries()) {
        phase = `${kind} source authorization and page order`;
        const source = await api<{ url: string; documentName: string; page: number }>(`${path}/source?page=${index + 1}`, 200, patient);
        assert.equal(source.page, index + 1, 'Expected the source at its original page number');
        assert.equal(source.documentName, file.filename, 'Expected the source filename at its original page number');
        assert.equal(new URL(source.url).origin, storageOrigin, 'Expected the private hosted Storage download endpoint');
        phase = `${kind} original bytes download`;
        const original = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
        assert.equal(original.status, 200);
        const originalBytes = Buffer.from(await original.arrayBuffer());
        if (file.bytes) assert.ok(file.bytes.equals(originalBytes), 'Original source bytes changed during processing');
        sourceHashes.push(createHash('sha256').update(originalBytes).digest('hex'));
      }
      if (uploadChecksum) assert.equal(createHash('sha256').update(sourceHashes.join('\n')).digest('hex'), uploadChecksum,
        'Original bytes no longer match the upload completion checksum');
      console.log(`PASS Live Hermes ${kind} draft, ordered original source and cross-clinic denial. Provider usage ${run.input_tokens} input, ${run.output_tokens} output, configured ledger estimate USD ${Number(run.actual_cost_usd).toFixed(6)}.`);
    }

    phase = 'existing synthetic proof lookup';
    const previous = await db.query<ProofJob & { filename: string; checksum: string }>(`
      select d.id as "documentId", j.id as "jobId", v.sha256 as checksum,
             v.source_manifest_json #>> '{items,0,filename}' as filename
      from sutra.documents d join sutra.document_versions v on v.id = d.current_version_id
      join sutra.jobs j on j.target_id = d.id and j.kind = 'process_document' and j.run_number = 1
      where d.patient_id = $1 and d.clinic_id = $2 and d.created_at > now() - interval '30 minutes'
        and (v.source_manifest_json #>> '{items,0,filename}') like 'synthetic-hermes-proof-%'
    `, [fixture.patientId, fixture.demoClinicId]);
    if (resume) {
      assert.equal(previous.rowCount, 1, 'Resume requires exactly one recent synthetic PDF proof job');
      const pdf = previous.rows[0]!;
      await proveDraft('file', pdf, [{ filename: pdf.filename, contentType: 'application/pdf' }], pdf.checksum);
    } else {
      assert.equal(previous.rowCount, 0, 'An existing PDF proof job can be checked with --resume-pdf');
      phase = 'synthetic PDF generation';
      const filename = `synthetic-hermes-proof-${randomUUID()}.pdf`;
      const bytes = await buildSyntheticReport({
        identifier: demo.clinic_identifier, patientName: demo.display_name, collectedOn: smokerunDate().printed,
        hba1c: '7.8', filename,
      });
      const files = [{ filename, contentType: 'application/pdf', bytes }];
      await proveDraft('file', await proveUpload('file', files), files);
    }
    const photos = ['a', 'b'].map((suffix) => {
      const filename = `2026-09-14_lab_report_photo_${suffix}.jpg`;
      return {
        filename,
        contentType: 'image/jpeg',
        bytes: readFileSync(join(appRoot, 'fixtures', 'synthetic', 'photos', filename)),
      };
    });
    const recentPhotos = await db.query<ProofJob>(`
      select d.id as "documentId", j.id as "jobId"
      from sutra.documents d join sutra.document_versions v on v.id = d.current_version_id
      join sutra.jobs j on j.target_id = d.id and j.kind = 'process_document' and j.run_number = 1
      where d.patient_id = $1 and d.clinic_id = $2 and d.created_at > now() - interval '30 minutes'
        and (v.source_manifest_json #>> '{items,0,filename}') = $3
    `, [fixture.patientId, fixture.demoClinicId, photos[0]!.filename]);
    assert.ok(recentPhotos.rows.length <= 1, 'Multiple recent photo proof jobs must be inspected manually');
    if (resume) assert.equal(recentPhotos.rows.length, 1, 'Resume requires an existing photo job; it will not create another upload');
    const photoJob = recentPhotos.rows[0] ?? await proveUpload('photos', photos);
    const photoDeadline = Date.now() + 300_000;
    while (true) {
      const status = await db.query<{state: string}>(
        'select state from sutra.jobs where id=$1 and target_id=$2 and patient_id=$3 and clinic_id=$4',
        [photoJob.jobId, photoJob.documentId, fixture.patientId, fixture.demoClinicId]);
      assert.ok(status.rows[0], 'Expected the synthetic photo job');
      if (['succeeded', 'failed'].includes(status.rows[0].state)) break;
      assert.ok(Date.now() < photoDeadline, 'Synthetic photo job did not finish before the deadline');
      await setTimeout(2000);
    }
    phase = 'photos duplicate proof';
    const duplicate = await db.query<{canonical_id: string; original_checksum: string; canonical_checksum: string}>(`
      select original.id as canonical_id, v.sha256 as original_checksum, original_version.sha256 as canonical_checksum
      from sutra.documents d
      join sutra.document_versions v on v.id = d.current_version_id
      join sutra.documents original on original.id = d.duplicate_of_document_id
      join sutra.document_versions original_version on original_version.id = original.current_version_id
      join sutra.clinics c on c.id = d.clinic_id
      join sutra.jobs j on j.id = $4 and j.target_id = d.id
      where d.id = $1 and d.patient_id = $2 and d.clinic_id = $3 and c.is_demo
        and original.patient_id = d.patient_id and original.clinic_id = d.clinic_id
        and original.duplicate_of_document_id is null and j.state = 'succeeded'
        and not d.released_to_patient
        and not exists (select 1 from sutra.extraction_runs r where r.job_id = j.id)
    `, [photoJob.documentId, fixture.patientId, fixture.demoClinicId, photoJob.jobId]);
    const canonical = duplicate.rows[0];
    if (canonical) {
      const expectedChecksum = createHash('sha256').update(photos.map(photo =>
        createHash('sha256').update(photo.bytes).digest('hex')).join('\n')).digest('hex');
      assert.equal(canonical.original_checksum, expectedChecksum, 'Duplicate upload checksum differs from ordered synthetic fixture');
      assert.equal(canonical.canonical_checksum, expectedChecksum, 'Canonical source checksum differs from duplicate upload');
      const path = `/documents/${canonical.canonical_id}`;
      phase = 'photos canonical draft authorization';
      const review = await api<ReviewDto>(`${path}/review`, 200, clinic);
      assert.equal(review.documentId, canonical.canonical_id, 'Canonical review returned another document');
      await api(`${path}/review`, 404, other);
      await api(`${path}/source`, 404, other);
      for (const [index, photo] of photos.entries()) {
        const source = await api<{url: string; page: number; documentName: string}>(`${path}/source?page=${index + 1}`, 200, patient);
        assert.equal(source.page, index + 1);
        assert.equal(source.documentName, photo.filename);
        assert.equal(new URL(source.url).origin, storageOrigin);
        const original = await fetch(source.url, {redirect: 'error', signal: AbortSignal.timeout(15_000)});
        assert.equal(original.status, 200);
        assert.ok(photo.bytes.equals(Buffer.from(await original.arrayBuffer())), 'Canonical photo bytes differ from synthetic fixture');
      }
      console.log('PASS Photo deduplication: same synthetic patient/clinic, identical ordered source checksums, no new extraction run, authorized canonical review/source and cross-clinic denial. This is not fresh live photo extraction evidence.');
      return;
    }
    await proveDraft('photos', photoJob, photos);
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  const code = cause instanceof Error && 'code' in cause ? String(cause.code) : cause instanceof Error ? cause.name : '';
  const detail = /^[A-Za-z0-9_]{1,40}$/.test(code) ? ` (${code})` : '';
  console.error(error instanceof assert.AssertionError ? error.message : `Hosted worker proof failed during ${phase}${detail}.`);
  process.exitCode = 1;
});

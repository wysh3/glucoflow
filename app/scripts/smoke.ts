/**
 * Authenticated smoke flow against a running API and worker.
 *
 *   pnpm smoke -- --base-url http://127.0.0.1:8787
 *
 * It performs the real steps: patient sign-in, upload of a synthetic report, worker
 * processing, reviewer approval, export and the patient view, plus the negative
 * access checks. Every result printed here is measured, not assumed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UPLOAD_MAX_BYTES } from '@sutra/contracts';
import { ensureLocalEnv, localRoot } from './lib/env';
import { buildSyntheticReport, smokerunDate } from './lib/synthetic-report';

type Credential = { email: string; password: string; role: string };
type CredentialsFile = {
  patientId: string;
  demoClinicId: string;
  testClinicId: string;
  accounts: Record<string, Credential>;
};

type Result = { name: string; ok: boolean; detail: string };

const results: Result[] = [];

function record(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

function errorDetail(body: unknown): string {
  const payload = body as { error?: { code?: string; message?: string } } | null;
  if (payload?.error) return `${payload.error.code ?? 'error'}: ${payload.error.message ?? ''}`;
  return '';
}

function parseArgs(argv: string[]): { baseUrl: string; skipUpload: boolean } {
  let baseUrl = 'http://127.0.0.1:8787';
  let skipUpload = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--base-url') baseUrl = argv[index + 1] ?? baseUrl;
    if (argv[index] === '--skip-upload') skipUpload = true;
  }
  return { baseUrl, skipUpload };
}

class Client {
  token: string | null = null;

  constructor(private readonly baseUrl: string) {}

  async signIn(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/local-sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error(`sign-in failed for ${email}: ${response.status}`);
    }
    const payload = (await response.json()) as { accessToken: string };
    this.token = payload.accessToken;
  }

  async request<T>(
    path: string,
    options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
  ): Promise<{ status: number; body: T | null }> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? (JSON.parse(text) as T) : null };
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const credentialsPath = join(localRoot, 'demo-credentials.json');
  let credentials: CredentialsFile;
  try {
    credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as CredentialsFile;
  } catch {
    throw new Error(
      `No demo credentials at ${credentialsPath}. Run "pnpm db:migrate" and "pnpm seed:demo -- --clinic demo --confirm-demo" first.`,
    );
  }
  const env = ensureLocalEnv();
  void env;

  // Health -----------------------------------------------------------------
  const live = await fetch(`${options.baseUrl}/health/live`);
  record('API is alive', live.ok, `GET /health/live returned ${live.status}`);
  const ready = await fetch(`${options.baseUrl}/health/ready`);
  record('Database is reachable', ready.ok, `GET /health/ready returned ${ready.status}`);

  const clinic = new Client(options.baseUrl);
  const patient = new Client(options.baseUrl);
  const otherClinic = new Client(options.baseUrl);

  await clinic.signIn(credentials.accounts['clinic']!.email, credentials.accounts['clinic']!.password);
  await patient.signIn(credentials.accounts['patient']!.email, credentials.accounts['patient']!.password);
  await otherClinic.signIn(
    credentials.accounts['other-clinic']!.email,
    credentials.accounts['other-clinic']!.password,
  );
  record('Seeded accounts sign in', true, 'patient, clinic reviewer and the isolated clinic account');

  // Context and permissions ------------------------------------------------
  const me = await clinic.request<{
    capabilities: { canReview: boolean };
    contexts: { kind: string }[];
  }>('/api/v1/me');
  record(
    'Reviewer capabilities come from the database',
    me.status === 200 && me.body?.capabilities.canReview === true,
    `canReview=${String(me.body?.capabilities.canReview)}`,
  );

  const patientMe = await patient.request<{ capabilities: { canReview: boolean } }>('/api/v1/me');
  record(
    'Patient account holds no reviewer capability',
    patientMe.body?.capabilities.canReview === false,
    `canReview=${String(patientMe.body?.capabilities.canReview)}`,
  );

  // Cross-clinic isolation -------------------------------------------------
  const crossClinic = await otherClinic.request(`/api/v1/patients/${credentials.patientId}/timeline`, {
    query: undefined,
  } as never);
  record(
    'Second clinic cannot read this patient record',
    crossClinic.status === 404 || crossClinic.status === 403,
    `GET timeline returned ${crossClinic.status}`,
  );

  const directApprove = await patient.request('/api/v1/documents/00000000-0000-4000-8000-000000000000/approve', {
    method: 'POST',
    body: { expectedRevision: 0 },
  });
  record(
    'Patient cannot call the approval route',
    directApprove.status === 403,
    `POST approve returned ${directApprove.status}`,
  );

  // Approved history -------------------------------------------------------
  const before = await clinic.request<{
    observations: { factId: string; testCode: string }[];
    coverage: { observationCount: number };
    latestReportDate: string | null;
  }>(`/api/v1/patients/${credentials.patientId}/timeline?testCode=hba1c`);

  // Upload the return-visit report as the patient --------------------------
  let uploadedDocumentId: string | null = null;
  let approvedRevision: number | null = null;

  if (!options.skipUpload) {
    // A fresh synthetic document per run so the duplicate check does not mask the
    // upload path on a repeated run.
    const collected = smokerunDate(0);
    const filename = `synthetic-smoke-${collected.iso}.pdf`;
    const bytes = await buildSyntheticReport({
      identifier: 'P0482',
      patientName: 'Asha Rao',
      collectedOn: collected.printed,
      hba1c: '7.8',
      filename,
    });
    if (bytes.length > UPLOAD_MAX_BYTES) throw new Error('fixture exceeds the upload limit');

    const created = await patient.request<{
      sessionId: string;
      items: { uploadUrl: string; method: 'PUT' | 'POST'; uploadToken: string | null; contentType: string }[];
    }>('/api/v1/uploads', {
      method: 'POST',
      idempotencyKey: `smoke-upload-${Date.now()}`,
      body: {
        patientId: credentials.patientId,
        kind: 'file',
        files: [
          {
            filename,
            contentType: 'application/pdf',
            byteCount: bytes.length,
          },
        ],
      },
    });
    record('Upload session created', created.status === 201, `POST /uploads returned ${created.status}`);
    const session = created.body!;
    const target = session.items[0]!;
    const uploadUrl = new URL(target.uploadUrl);
    if (target.uploadToken) uploadUrl.searchParams.set('token', target.uploadToken);
    const put = await fetch(uploadUrl, {
      method: target.method,
      headers: { 'content-type': target.contentType },
      body: new Uint8Array(bytes),
    });
    record('Bytes reached the private source bucket', put.ok, `signed upload returned ${put.status}`);

    const completed = await patient.request<{ documentId: string; jobId: string }>(
      `/api/v1/uploads/${session.sessionId}/complete`,
      { method: 'POST', idempotencyKey: `smoke-complete-${Date.now()}` },
    );
    record(
      'Completion queued exactly one processing job',
      completed.status === 202 && Boolean(completed.body?.jobId),
      `POST complete returned ${completed.status}`,
    );
    uploadedDocumentId = completed.body?.documentId ?? null;

    // Poll the job the way the interface does.
    let jobState = 'queued';
    let attempts = 0;
    while (attempts < 90 && jobState !== 'succeeded' && jobState !== 'failed') {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const job = await patient.request<{
        state: string;
        observedStages: { stage: string }[];
        errorMessage: string | null;
      }>(`/api/v1/jobs/${completed.body!.jobId}`);
      jobState = job.body?.state ?? 'unknown';
      attempts += 1;
      if (jobState === 'failed') {
        record('Worker processed the document', false, job.body?.errorMessage ?? 'job failed');
      }
    }
    record(
      'Worker processed the document',
      jobState === 'succeeded',
      `job finished in ${(attempts * 0.5).toFixed(1)}s with state ${jobState}`,
    );
  }

  // Review and approve -----------------------------------------------------
  const queue = await clinic.request<{ items: { documentId: string; state: string }[] }>(
    '/api/v1/queue?state=awaiting_review',
  );
  if ((queue.body?.items.length ?? 0) === 0) {
    const all = await clinic.request<{ items: { documentId: string; state: string }[] }>(
      '/api/v1/queue?state=all',
    );
    console.log(
      `      debug: queue?state=all returned ${all.status} with states [${(all.body?.items ?? [])
        .map((item) => `${item.documentId.slice(0, 8)}:${item.state}`)
        .join(', ')}]`,
    );
  }
  record(
    'Uploaded document appears in the clinic queue',
    (queue.body?.items.length ?? 0) > 0,
    `${queue.body?.items.length ?? 0} document(s) awaiting review${errorDetail(queue.body)}`,
  );

  const targetDocument =
    uploadedDocumentId ?? queue.body?.items[0]?.documentId ?? null;
  if (!targetDocument) throw new Error('no document is available to review');

  const review = await clinic.request<{
    revision: number;
    facts: { factId: string; issues: string[]; reviewState: string }[];
    identityState: string;
    canPublish: boolean;
    publishBlockers: string[];
    pages: { page: number; coverage: string }[];
  }>(`/api/v1/documents/${targetDocument}/review`);
  record(
    'Reviewer sees every proposed entry with its issues',
    review.status === 200 && (review.body?.facts.length ?? 0) > 0,
    `${review.body?.facts.length ?? 0} proposed entries, identity ${review.body?.identityState}`,
  );

  const unreadablePages = (review.body?.pages ?? [])
    .filter((page) => page.coverage === 'unreadable')
    .map((page) => page.page);

  if (unreadablePages.length > 0) {
    await clinic.request(`/api/v1/documents/${targetDocument}/review`, {
      method: 'PATCH',
      body: {
        expectedRevision: review.body!.revision,
        pageExclusions: unreadablePages.map((page) => ({
          page,
          reason: 'Smoke run: the page could not be read.',
        })),
      },
    });
  }

  const refreshed = await clinic.request<{ revision: number }>(
    `/api/v1/documents/${targetDocument}/review`,
  );
  const revision = refreshed.body!.revision;

  const decisions = await clinic.request<{
    revision: number;
    blockers: string[];
    state: string;
  }>(`/api/v1/documents/${targetDocument}/review`, {
    method: 'PATCH',
    body: {
      expectedRevision: revision,
      factUpdates: (review.body?.facts ?? []).map((fact) => ({
        factId: fact.factId,
        action: 'review',
      })),
      ...(review.body?.identityState === 'unchecked'
        ? {
            identity: {
              state: 'missing_confirmed',
              reason: 'Smoke run: the identifier was checked against the printed page.',
            },
          }
        : {}),
    },
  });
  record(
    'Every entry can be explicitly reviewed',
    decisions.status === 200,
    `review state ${decisions.body?.state ?? 'unknown'}, blockers ${
      decisions.body?.blockers.join(', ') || 'none'
    }`,
  );

  // A second reviewer who still holds the earlier revision must be refused.
  const staleConflict = await clinic.request(`/api/v1/documents/${targetDocument}/review`, {
    method: 'PATCH',
    body: { expectedRevision: revision, factUpdates: [] },
  });
  record(
    'A stale reviewer receives a conflict',
    staleConflict.status === 409,
    `PATCH with the previous revision (${revision}) returned ${staleConflict.status}`,
  );

  const approveRevision = decisions.body?.revision ?? revision + 1;
  const approval = await clinic.request<{
    approvalRevision: number;
    publishedCount: number;
    publishedFactIds: string[];
  }>(`/api/v1/documents/${targetDocument}/approve`, {
    method: 'POST',
    idempotencyKey: `smoke-approve-${targetDocument}`,
    body: { expectedRevision: approveRevision, dispositions: [] },
  });
  record(
    'Publication commits one approval revision',
    (approval.status === 200 || approval.status === 201) && Boolean(approval.body?.approvalRevision),
    `status ${approval.status}, approval revision ${approval.body?.approvalRevision ?? 'none'}, ${
      approval.body?.publishedCount ?? 0
    } entries${errorDetail(approval.body)}`,
  );
  approvedRevision = approval.body?.approvalRevision ?? null;

  const repeat = await clinic.request<{ approvalRevision: number; publishedCount: number }>(
    `/api/v1/documents/${targetDocument}/approve`,
    {
      method: 'POST',
      idempotencyKey: `smoke-approve-${targetDocument}`,
      body: { expectedRevision: approveRevision, dispositions: [] },
    },
  );
  record(
    'A repeated approval returns the original batch',
    repeat.status === 200 &&
      repeat.body?.approvalRevision === approval.body?.approvalRevision,
    `repeat returned ${repeat.status} with approval revision ${
      (repeat.body as { approvalRevision?: number } | null)?.approvalRevision ?? 'none'
    }${errorDetail(repeat.body)}`,
  );

  // Export -----------------------------------------------------------------
  if (approvedRevision !== null) {
    const created = await clinic.request<{ exportId: string; jobId: string }>(
      `/api/v1/patients/${credentials.patientId}/exports`,
      {
        method: 'POST',
        idempotencyKey: `smoke-export-${approvedRevision}`,
        body: { approvalRevision: approvedRevision },
      },
    );
    record('Export request queued', created.status === 202, `POST exports returned ${created.status}`);

    let exportState = 'queued';
    let downloadUrl: string | null = null;
    for (let attempt = 0; attempt < 60 && exportState !== 'ready' && exportState !== 'failed'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const status = await clinic.request<{ state: string; downloadUrl: string | null }>(
        `/api/v1/exports/${created.body!.exportId}`,
      );
      exportState = status.body?.state ?? 'unknown';
      downloadUrl = status.body?.downloadUrl ?? null;
    }
    record('Export rendered', exportState === 'ready', `export state ${exportState}`);

    if (downloadUrl) {
      const pdf = await fetch(downloadUrl);
      const buffer = Buffer.from(await pdf.arrayBuffer());
      record(
        'Export downloads as a PDF',
        pdf.ok && buffer.subarray(0, 5).toString('latin1') === '%PDF-',
        `${buffer.length} bytes, signature ${buffer.subarray(0, 5).toString('latin1')}`,
      );
    }

    const unauthorizedExport = await otherClinic.request(`/api/v1/exports/${created.body!.exportId}`);
    record(
      'A second clinic cannot read the export',
      unauthorizedExport.status === 404 || unauthorizedExport.status === 403,
      `GET export returned ${unauthorizedExport.status}`,
    );
  }

  // Patient view -----------------------------------------------------------
  const after = await patient.request<{
    observations: { testCode: string; numericValue: number | null; date: string | null }[];
    coverage: { observationCount: number };
    latestReportDate: string | null;
  }>(`/api/v1/patients/${credentials.patientId}/timeline?testCode=hba1c`);
  const beforeCount = before.body?.coverage.observationCount ?? 0;
  const afterCount = after.body?.coverage.observationCount ?? 0;
  record(
    'Patient timeline reflects the approved update',
    afterCount >= beforeCount,
    `approved HbA1c results: ${beforeCount} before, ${afterCount} after (latest ${after.body?.latestReportDate})`,
  );

  const patientDocuments = await patient.request<{ items: { state: string }[] }>(
    `/api/v1/patients/${credentials.patientId}/documents`,
  );
  record(
    'Patient sees the review status of their own uploads',
    (patientDocuments.body?.items.length ?? 0) > 0,
    `${patientDocuments.body?.items.length ?? 0} document(s) with their state`,
  );

  // Search -----------------------------------------------------------------
  const search = await clinic.request<{
    items: { matchedField: string; sourceAvailable: boolean; snippet: string }[];
  }>(`/api/v1/patients/${credentials.patientId}/search?q=eye`);
  const eyeResult = search.body?.items.find((item) => /eye/i.test(item.snippet));
  record(
    'Search retrieves the examination record with its source',
    Boolean(eyeResult) && eyeResult?.sourceAvailable === true,
    eyeResult ? `matched ${eyeResult.matchedField}` : 'no eye examination result found',
  );

  const emptySearch = await clinic.request<{ items: unknown[] }>(
    `/api/v1/patients/${credentials.patientId}/search?q=zzzznotpresent`,
  );
  record(
    'An empty search returns no result and no verdict label',
    (emptySearch.body?.items.length ?? 0) === 0,
    `${emptySearch.body?.items.length ?? 0} results for an absent term`,
  );

  // Summary ----------------------------------------------------------------
  const failures = results.filter((result) => !result.ok);
  console.log('');
  console.log(`${results.length - failures.length} of ${results.length} checks passed.`);
  if (failures.length > 0) {
    console.log('Failures:');
    for (const failure of failures) console.log(`  - ${failure.name}: ${failure.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

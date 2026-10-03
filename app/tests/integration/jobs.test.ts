import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  completeJob,
  createExtractionRun,
  failJob,
  heartbeat,
  leaseJob,
  loadStageOutputs,
  recoverExpiredLeases,
  recordStageOutput,
  reserveProviderCall,
} from '@sutra/data';
import {
  createFixture,
  createTestContext,
  documentState,
  errorCode,
  errorMessage,
  jobState,
  leaseTargetJob,
  removeClinic,
  runOneJob,
  stageFixtureUpload,
  type TestContext,
  type TestFixture,
} from './harness';

/**
 * Durable queue behaviour: one lease at a time, fenced writes, lease recovery,
 * bounded retries, quarantine for unreadable sources and a call ledger that survives a
 * restart.
 *
 * Each test leases its own job by id, so parallel suites and a running development
 * worker cannot take it away.
 */

let context: TestContext;
let fixture: TestFixture;

beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'jobs');
});

afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

describe('durable jobs', () => {
  it('leases one job at a time and fences a stale worker', async () => {
    const staged = await stageFixtureUpload(context, fixture, { filename: '2026-01-12_lab_report.pdf' });
    const first = await leaseTargetJob(context, staged.jobId);
    expect(first).not.toBeNull();

    // The same job cannot be leased twice while its lease is held: a second lease call
    // either finds nothing or finds a different job.
    const second = await context.asWorker((client) => leaseJob(client));
    if (second) expect(second.jobId).not.toBe(first!.jobId);

    const staleAccepted = await context.asWorker((client) =>
      recordStageOutput(client, first!.jobId, randomUUID(), 'validate_file', staged.versionId, {
        forged: true,
      }).then(
        () => true,
        () => false,
      ),
    );
    expect(staleAccepted).toBe(false);
  });

  it('keeps a durable stage output across a simulated worker restart', async () => {
    const staged = await stageFixtureUpload(context, fixture, { filename: '2026-04-10_lab_report.pdf' });
    const leased = await leaseTargetJob(context, staged.jobId);
    expect(leased?.jobId).toBe(staged.jobId);

    await context.asWorker((client) =>
      recordStageOutput(client, leased!.jobId, leased!.leaseToken, 'validate_file', staged.versionId, {
        bytes: 1024,
      }),
    );

    // Expire the lease, run recovery, and confirm the committed stage output survives.
    await context.owner(async (client) => {
      await client.query("update sutra.jobs set lease_until = now() - interval '1 minute' where id = $1", [
        leased!.jobId,
      ]);
    });
    await context.asWorker((client) => recoverExpiredLeases(client));

    const outputs = await context.asWorker((client) => loadStageOutputs(client, leased!.jobId));
    expect(outputs.map((output) => output.stage)).toContain('validate_file');
    const state = await jobState(context, leased!.jobId);
    expect(state.state).toBe('queued');
  });

  it('refuses stage output from an expired worker', async () => {
    const staged = await stageFixtureUpload(context, fixture, { filename: '2026-07-09_lab_report.pdf' });
    const leased = await leaseTargetJob(context, staged.jobId);
    expect(leased).not.toBeNull();

    await context.owner(async (client) => {
      await client.query("update sutra.jobs set lease_until = now() - interval '1 minute' where id = $1", [
        leased!.jobId,
      ]);
    });

    // Once the lease has expired and the job has been recovered, the old lease token is
    // useless: no heartbeat, no stage output, no completion.
    await context.asWorker((client) => recoverExpiredLeases(client));
    expect((await jobState(context, leased!.jobId)).state).toBe('queued');

    const accepted = await context.asWorker((client) =>
      heartbeat(client, leased!.jobId, leased!.leaseToken),
    );
    expect(accepted).toBe(false);

    const fenced = await context.asWorker((client) =>
      recordStageOutput(client, leased!.jobId, randomUUID(), 'extract', staged.versionId, {}).then(
        () => true,
        () => false,
      ),
    );
    expect(fenced).toBe(false);

    const completed = await context.asWorker((client) =>
      completeJob(client, leased!.jobId, leased!.leaseToken),
    );
    expect(completed).toBe(false);
  });

  it('retries a transient failure then fails after the attempt limit', async () => {
    const staged = await stageFixtureUpload(context, fixture, { filename: '2026-05-20_eye_examination.pdf' });
    const leased = await leaseTargetJob(context, staged.jobId);
    expect(leased).not.toBeNull();

    const first = await context.asWorker((client) =>
      failJob(client, leased!.jobId, leased!.leaseToken, {
        code: 'provider_timeout',
        message: 'provider call timed out',
        retryable: true,
      }),
    );
    expect(first.state).toBe('retry_wait');

    // Two more attempts exhaust the three attempt budget.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await context.owner(async (client) => {
        await client.query(
          "update sutra.jobs set available_at = now() - interval '1 second' where id = $1",
          [staged.jobId],
        );
      });
      const next = await leaseTargetJob(context, staged.jobId);
      expect(next?.jobId).toBe(staged.jobId);
      const outcome = await context.asWorker((client) =>
        failJob(client, next!.jobId, next!.leaseToken, {
          code: 'provider_timeout',
          message: 'provider call timed out',
          retryable: true,
        }),
      );
      if (attempt === 1) expect(outcome.state).toBe('failed');
    }
    const finalState = await jobState(context, staged.jobId);
    expect(finalState.state).toBe('failed');
    expect(finalState.error_code).toBe('provider_timeout');
  });

  it('never retries an unsupported format failure', async () => {
    const staged = await stageFixtureUpload(context, fixture, {
      filename: 'not-a-document.pdf',
      bytes: Buffer.from('this is not a pdf file at all', 'utf8'),
    });
    await runOneJob(context, staged.jobId);
    const state = await jobState(context, staged.jobId);
    expect(state.state).toBe('failed');
    expect(state.error_code).toBe('unsupported_format');
    // A permanent failure is not retried by the queue.
    expect(state.attempt).toBe(1);
  });

  it('quarantines a document above the page limit without a retry loop', async () => {
    const staged = await stageFixtureUpload(context, fixture, {
      filename: '2026-09-24_eleven_page_report.pdf',
    });
    await runOneJob(context, staged.jobId);
    const state = await jobState(context, staged.jobId);
    expect(state.state).toBe('failed');
    expect(state.error_code).toBe('page_limit_exceeded');
    expect(state.attempt).toBe(1);
  });

  it('preserves the model call ledger across a restart and caps the run', async () => {
    const staged = await stageFixtureUpload(context, fixture, { filename: '2026-06-11_foot_examination.pdf' });
    const runId = await context.asWorker((client) =>
      createExtractionRun(client, {
        jobId: staged.jobId,
        documentId: staged.documentId,
        versionId: staged.versionId,
        clinicId: fixture.clinicId,
        patientId: fixture.patientId,
        provider: 'openai-compatible',
        model: 'test-model',
        mode: 'live',
        promptHash: 'test',
        schemaVersion: '1',
        aliasMapVersion: '1',
        runNumber: 1,
        deadlineAt: new Date(Date.now() + 60_000),
      }),
    );

    const first = await context.asWorker((client) => reserveProviderCall(client, runId, 3, 0.01));
    const second = await context.asWorker((client) => reserveProviderCall(client, runId, 3, 0.01));
    const third = await context.asWorker((client) => reserveProviderCall(client, runId, 3, 0.01));
    const fourth = await context.asWorker((client) => reserveProviderCall(client, runId, 3, 0.01));
    expect([first?.ordinal, second?.ordinal, third?.ordinal]).toEqual([1, 2, 3]);
    // The fourth call is refused by the run cap, not by a retry.
    expect(fourth).toBeNull();

    // The ledger is committed per call, so a restart cannot reset the spend.
    const ledger = await context.owner(async (client) => {
      const result = await client.query<{ call_count: number; reserved_cost_usd: string }>(
        'select call_count, reserved_cost_usd from sutra.extraction_runs where id = $1',
        [runId],
      );
      return result.rows[0]!;
    });
    expect(ledger.call_count).toBe(3);
    expect(Number(ledger.reserved_cost_usd)).toBeCloseTo(0.03, 5);
  });

  it('counts a manual retry as a new run subject to the hourly cap', async () => {
    const staged = await stageFixtureUpload(context, fixture, { filename: '2026-02-15_lab_report_two_pages.pdf' });
    await runOneJob(context, staged.jobId);
    await context.owner(async (client) => {
      await client.query("update sutra.jobs set state = 'failed', error_code = 'provider_timeout' where id = $1", [
        staged.jobId,
      ]);
    });

    // Each retry is only offered after the previous run failed, so every round marks
    // the current run as failed before asking again. The hourly cap is per document.
    const created: string[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await context.owner(async (client) => {
        await client.query(
          "update sutra.jobs set state = 'failed', error_code = 'provider_timeout' where target_id = $1 and state <> 'failed'",
          [staged.documentId],
        );
      });
      const result = await context
        .asActor(fixture.reviewerId, (client) =>
          client.query<{ request_document_retry: { jobId: string } }>(
            'select sutra.request_document_retry($1, $2)',
            [staged.documentId, 'Integration test retry'],
          ),
        )
        .then(
          (value) => value.rows[0]!.request_document_retry.jobId,
          () => null,
        );
      if (result) created.push(result);
    }
    // Three retries are accepted, the fourth is refused by the hourly cap.
    expect(created.length).toBe(3);
    const retryJobs = await context.owner(async (client) => {
      const result = await client.query<{ count: string }>(
        'select count(*)::text as count from sutra.jobs where target_id = $1 and run_number > 1',
        [staged.documentId],
      );
      return Number(result.rows[0]!.count);
    });
    expect(retryJobs).toBe(3);
  });

  it('refuses a manual retry for a quarantined upload', async () => {
    const staged = await stageFixtureUpload(context, fixture, { filename: '2026-09-20_wrong_patient_report.pdf' });
    await runOneJob(context, staged.jobId);
    const state = await documentState(context, staged.documentId);
    expect(state.assignment_state).toBe('quarantined');
    const attempt = context.asActor(fixture.reviewerId, (client) =>
      client.query('select sutra.request_document_retry($1, $2)', [
        staged.documentId,
        'Should not be allowed',
      ]),
    );
    // The specific refusal matters: another retry rule raises the same SQLSTATE, so a
    // generic code assertion would pass even if the quarantine check were removed.
    expect(await errorCode(attempt)).toBe('P0001');
    expect(await errorMessage(attempt)).toMatch(/quarantined/i);
  });

  it('completes a successful job and clears the lease', async () => {
    const staged = await stageFixtureUpload(context, fixture, { filename: '2026-03-02_prescription.pdf' });
    await runOneJob(context, staged.jobId);
    const state = await jobState(context, staged.jobId);
    expect(state.state).toBe('succeeded');
    const lease = await context.owner(async (client) => {
      const result = await client.query<{ lease_token: string | null }>(
        'select lease_token from sutra.jobs where id = $1',
        [staged.jobId],
      );
      return result.rows[0]!.lease_token;
    });
    expect(lease).toBeNull();
  });

  it('fences a completed job against a second completion', async () => {
    const staged = await stageFixtureUpload(context, fixture, { filename: '2026-09-18_no_identifier_report.pdf' });
    const leased = await leaseTargetJob(context, staged.jobId);
    expect(leased).not.toBeNull();
    const first = await context.asWorker((client) =>
      completeJob(client, leased!.jobId, leased!.leaseToken),
    );
    const second = await context.asWorker((client) =>
      completeJob(client, leased!.jobId, leased!.leaseToken),
    );
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});

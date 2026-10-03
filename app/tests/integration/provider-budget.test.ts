import { beforeAll, afterAll, expect, it } from 'vitest';
import {
  createExtractionRun,
  reserveProviderCall,
  reconcileProviderCall,
} from '@glucoflow/data';
import {
  createFixture,
  createTestContext,
  removeClinic,
  stageFixtureUpload,
  type TestContext,
  type TestFixture,
} from './harness';
let context: TestContext;
let fixture: TestFixture;
let runId: string;
beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'budget');
  const doc = await stageFixtureUpload(context, fixture, {
    filename: '2026-01-12_lab_report.pdf',
  });
  runId = await context.asWorker((client) =>
    createExtractionRun(client, {
      jobId: doc.jobId,
      documentId: doc.documentId,
      versionId: doc.versionId,
      clinicId: fixture.clinicId,
      patientId: fixture.patientId,
      provider: 'stub',
      model: 'stub',
      mode: 'live',
      promptHash: 'test',
      schemaVersion: '1',
      aliasMapVersion: '1',
      runNumber: 1,
      deadlineAt: new Date(Date.now() + 60_000),
    }),
  );
});
afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});
it('serializes competing reservations and refuses dollar and token overruns before dispatch', async () => {
  const reserve = () =>
    context.asWorker((client) =>
      reserveProviderCall(client, runId, 12, 0.1, {
        tokens: 100,
        maxTokens: 100,
        maxCostUsd: 0.1,
      }),
    );
  const reservations = await Promise.all([reserve(), reserve()]);
  expect(reservations.filter(Boolean)).toHaveLength(1);
  expect(
    await context.asWorker((client) =>
      reserveProviderCall(client, runId, 12, 0.01, {
        tokens: 1,
        maxTokens: 100,
        maxCostUsd: 0.1,
      }),
    ),
  ).toBeNull();
});
it('reconciles actual separate token usage once and releases only known unused reservations', async () => {
  const usage = {
    state: 'succeeded' as const,
    actualCostUsd: 0.02,
    tokenCount: 30,
    inputTokens: 20,
    outputTokens: 10,
  };
  await context.asWorker((client) =>
    reconcileProviderCall(client, runId, 1, usage),
  );
  await context.asWorker((client) =>
    reconcileProviderCall(client, runId, 1, usage),
  );
  const run = await context.asWorker((client) =>
    client.query(
      'select input_tokens, output_tokens, actual_cost_usd from sutra.extraction_runs where id=$1',
      [runId],
    ),
  );
  expect(run.rows[0].input_tokens).toBe(20);
  expect(run.rows[0].output_tokens).toBe(10);
  expect(Number(run.rows[0].actual_cost_usd)).toBe(0.02);
  expect(
    await context.asWorker((client) =>
      reserveProviderCall(client, runId, 12, 0.08, {
        tokens: 70,
        maxTokens: 100,
        maxCostUsd: 0.1,
      }),
    ),
  ).not.toBeNull();
});
it('holds reservations after unknown usage and restart instead of silently restoring budget', async () => {
  await context.asWorker((client) =>
    reconcileProviderCall(client, runId, 2, {
      state: 'failed',
      actualCostUsd: 0,
      tokenCount: 0,
      inputTokens: null,
      outputTokens: null,
    }),
  );
  expect(
    await context.asWorker((client) =>
      reserveProviderCall(client, runId, 12, 0.01, {
        tokens: 1,
        maxTokens: 100,
        maxCostUsd: 0.1,
      }),
    ),
  ).toBeNull();
});

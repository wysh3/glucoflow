import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createExtractionProvider, processDocumentJob, ProviderRequestError } from '@glucoflow/extraction';
import { createFixture, createTestContext, jobState, leaseTargetJob, removeClinic, stageFixtureUpload, type TestContext, type TestFixture } from './harness';

let db: TestContext;
let fixture: TestFixture;
beforeAll(async () => {
  db = await createTestContext();
  fixture = await createFixture(db, 'worker-scratch');
});
afterAll(async () => {
  await removeClinic(db, fixture.clinicId);
  await removeClinic(db, fixture.otherClinicId);
  await db.close();
});

it.each([
  { filename: '2026-01-12_lab_report.pdf', outcome: 'succeeded' },
  { filename: '2026-09-14_lab_report.pdf', outcome: 'failed' },
])('removes only the job scratch when extraction $outcome', async ({ filename, outcome }) => {
  const staged = await stageFixtureUpload(db, fixture, { filename });
  const original = await db.storage.getObject(db.sourceBucket, staged.objectPaths[0]!);
  const lease = await leaseTargetJob(db, staged.jobId);
  expect(lease).not.toBeNull();
  const root = await mkdtemp(join(tmpdir(), 'glucoflow-scratch-test-'));
  const unrelated = join(root, 'unrelated');
  await mkdir(unrelated);
  await writeFile(join(unrelated, 'marker'), 'keep');
  let renderedBytes = 0;
  try {
    await processDocumentJob({
      tx: db.asWorker, storage: db.storage, sourceBucket: db.sourceBucket,
      tmpRoot: root, enableOcr: false, renderPages: true, maxPages: 10, maxCalls: 12,
      createProvider: (budget) => {
        const fixtureProvider = createExtractionProvider({ provider: 'fixture', model: 'deterministic-rules-v1', maxCalls: 12 }, budget);
        return {
          name: fixtureProvider.name, model: fixtureProvider.model,
          mode: fixtureProvider.mode, promptHash: fixtureProvider.promptHash,
          async extract(input, signal) {
            renderedBytes = (await readFile(input.pages[0]!.imagePath!)).length;
            if (outcome === 'failed') throw new ProviderRequestError({
              category: 'auth', retryable: false, message: 'Synthetic provider rejected authentication.',
            });
            return fixtureProvider.extract(input, signal);
          },
        };
      },
      heartbeat: () => undefined, log: () => undefined,
    }, lease!);

    expect(renderedBytes).toBeGreaterThan(0);
    expect((await jobState(db, staged.jobId)).state).toBe(outcome);
    expect(await readdir(root)).toEqual(['unrelated']);
    expect(await readFile(join(unrelated, 'marker'), 'utf8')).toBe('keep');
    expect(await db.storage.getObject(db.sourceBucket, staged.objectPaths[0]!)).toEqual(original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * The worker's own document-processing path, exercised the way the worker really runs it.
 *
 * An independent review found that uploaded scans produced zero facts: rendering was
 * gated on a page-image callback the worker never passes, so OCR never ran. The
 * evaluation passed its own callback and exercised a different path, so every green test
 * missed it. This test reproduces the worker's exact configuration - no page-image
 * callback - against a scanned page with no text layer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createExtractionProvider, processDocumentJob } from '@sutra/extraction';
import { leaseJob } from '@sutra/data';
import { appRoot, localRoot } from '../../scripts/lib/env';
import {
  createFixture,
  createTestContext,
  documentState,
  leaseTargetJob,
  removeClinic,
  stageFixtureUpload,
  type TestContext,
  type TestFixture,
} from './harness';

let context: TestContext;
let fixture: TestFixture;

beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'worker-scan');
});

afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

describe('the worker reads an uploaded scan', () => {
  it('extracts facts from a scanned page with no page-image callback', async () => {
    // A scan from the held-out corpus: the machine-readable text layer is empty, so OCR
    // is the only way to read it. The patient carries the identifier printed on it, so
    // identity resolves instead of holding the document.
    const scan = readFileSync(join(appRoot, 'fixtures', 'synthetic', 'eval-corpus', 'eval-11_E3010.pdf'));
    const patientId = await context.owner(async (client) => {
      const inserted = await client.query<{ id: string }>(
        'insert into sutra.patients (clinic_id, display_name, clinic_identifier) values ($1, $2, $3) returning id',
        [fixture.clinicId, 'Scan Patient (synthetic)', 'E3010'],
      );
      return inserted.rows[0]!.id;
    });
    const staged = await stageFixtureUpload(context, fixture, {
      bytes: scan,
      filename: 'worker-scan.pdf',
      contentType: 'application/pdf',
      patientId,
    });

    const leased = await leaseTargetJob(context, staged.jobId);
    expect(leased).not.toBeNull();

    await processDocumentJob(
      {
        // The worker passes no page-image callback. Rendering must not depend on one.
        tx: (fn) => context.asWorker(fn),
        storage: context.storage,
        sourceBucket: context.sourceBucket,
        tmpRoot: join(localRoot, 'tmp', `worker-scan-${staged.jobId}`),
        enableOcr: true,
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
      leased!,
    );

    const document = await documentState(context, staged.documentId);
    expect(document.assignment_state).toBe('assigned');

    const facts = await context.owner(
      (client) =>
        client.query<{ count: string }>(
          'select count(*)::text as count from sutra.draft_facts where document_id = $1',
          [staged.documentId],
        ),
      fixture.reviewerId,
    );
    const count = Number(facts.rows[0]?.count ?? '0');
    // This document carries seven observations. Before the fix this was zero.
    expect(count).toBeGreaterThanOrEqual(7);
  });

  it('quarantines a scan when rendering is explicitly disabled', async () => {
    // A different scan, so duplicate detection does not short-circuit the run.
    const scan = readFileSync(join(appRoot, 'fixtures', 'synthetic', 'eval-corpus', 'eval-13_E3012.pdf'));
    const staged = await stageFixtureUpload(context, fixture, {
      bytes: scan,
      filename: 'worker-scan-no-render.pdf',
      contentType: 'application/pdf',
    });

    const leased = await leaseTargetJob(context, staged.jobId);
    expect(leased).not.toBeNull();

    await processDocumentJob(
      {
        tx: (fn) => context.asWorker(fn),
        storage: context.storage,
        sourceBucket: context.sourceBucket,
        tmpRoot: join(localRoot, 'tmp', `worker-norender-${staged.jobId}`),
        enableOcr: true,
        renderPages: false,
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
      leased!,
    );

    const document = await documentState(context, staged.documentId);
    // The page cannot be read without rendering. The honest outcome is an unreadable
    // page flag and no facts - never guessed values.
    expect(document.assignment_state).toBe('assigned');
    const issues = await context.owner(
      (client) =>
        client.query<{ document_issues: string[] }>(
          'select document_issues from sutra.review_batches where document_id = $1',
          [staged.documentId],
        ),
      fixture.reviewerId,
    );
    expect(issues.rows[0]?.document_issues ?? []).toContain('page_unreadable');
    const facts = await context.owner(
      (client) =>
        client.query<{ count: string }>(
          'select count(*)::text as count from sutra.draft_facts where document_id = $1',
          [staged.documentId],
        ),
      fixture.reviewerId,
    );
    expect(Number(facts.rows[0]?.count ?? '0')).toBe(0);
  });
});

// Unused import kept for parity with the other worker suites.
void leaseJob;

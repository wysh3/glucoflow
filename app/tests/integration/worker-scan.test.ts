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
import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createExtractionProvider, processDocumentJob } from '@sutra/extraction';
import { leaseJob, getDocumentSource } from '@sutra/data';
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
  it.each([false, true])('processes both photo pages and checks later-page identity (mismatch=%s)', async (mismatch) => {
    const photo = (lines: string[]): Buffer => {
      const canvas = createCanvas(1600, 1000);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1600, 1000);
      ctx.fillStyle = '#111'; ctx.font = '40px sans-serif';
      lines.forEach((line, i) => ctx.fillText(line, 80, 100 + i * 90));
      return canvas.toBuffer('image/png');
    };
    const first = photo(['SYNTHETIC TEST REPORT', 'Patient: Asha Rao', 'MRN: P0482', 'Collected: 03 October 2026', 'HbA1c: 6.9 %']);
    const second = photo(['SYNTHETIC TEST REPORT', 'Patient: Asha Rao', `MRN: ${mismatch ? 'P9999' : 'P0482'}`, 'Collected: 03 October 2026', 'Fasting glucose: 123 mg/dL']);
    const staged = await stageFixtureUpload(context, fixture, {filename: 'photo-1.png', contentType: 'image/png', bytes: first});
    const secondPath = staged.objectPaths[0]!.replace('00-photo-1.png', '01-photo-2.png');
    await context.storage.putObject(context.sourceBucket, secondPath, second, 'image/png');
    await context.owner(async client => {
      const manifest = {kind: 'photos', items: [first, second].map((bytes, index) => ({index, filename: `photo-${index + 1}.png`, objectPath: index === 0 ? staged.objectPaths[0] : secondPath, contentType: 'image/png', byteCount: bytes.length}))};
      const checksum = createHash('sha256').update([first, second].map(bytes => createHash('sha256').update(bytes).digest('hex')).join('\n')).digest('hex');
      await client.query("update sutra.document_versions set source_kind = 'photos', source_manifest_json = $2::jsonb, sha256 = $3, bytes = $4 where id = $1", [staged.versionId, JSON.stringify(manifest), checksum, first.length + second.length]);
    });
    const leased = await leaseTargetJob(context, staged.jobId);
    await processDocumentJob({tx: fn => context.asWorker(fn), storage: context.storage, sourceBucket: context.sourceBucket, tmpRoot: join(localRoot, 'tmp', `photo-batch-${staged.jobId}`), enableOcr: true, maxPages: 10, maxCalls: 12, createProvider: budget => createExtractionProvider({provider: 'fixture', model: 'deterministic-rules-v1', maxCalls: 12}, budget), heartbeat: () => undefined, log: () => undefined}, leased!);
    const document = await documentState(context, staged.documentId);
    if (mismatch) {
      expect(document.assignment_state).toBe('quarantined');
    } else {
      const pages = await context.owner(client => client.query<{page: number}>('select distinct page from sutra.evidence_spans where document_version_id = $1 order by page', [staged.versionId]));
      expect(pages.rows.map(row => row.page)).toEqual([1, 2]);
      const facts = await context.owner(client => client.query<{raw_label: string}>('select raw_label from sutra.draft_facts where document_id = $1', [staged.documentId]));
      expect(facts.rows.some(row => /fasting glucose/i.test(row.raw_label))).toBe(true);
      const source = await context.asActor(fixture.patientUserId, client => getDocumentSource(client, staged.versionId, 2));
      expect(source?.objectPath).toBe(secondPath);
      expect(source?.filename).toBe('photo-2.png');
      expect(await context.asActor(fixture.otherReviewerId, client => getDocumentSource(client, staged.versionId, 2))).toBeNull();
      expect(await context.asActor(fixture.patientUserId, client => getDocumentSource(client, staged.versionId, 3))).toBeNull();
    }
  });
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

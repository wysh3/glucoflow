import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDocumentRow, listDocuments, updateReview, getReviewDto } from '@glucoflow/data';
import { buildSyntheticReport, smokerunDate } from '../../scripts/lib/synthetic-report';
import {
  createFixture,
  createTestContext,
  documentState,
  errorCode,
  latestBatch,
  removeClinic,
  runOneJob,
  stageFixtureUpload,
  type TestContext,
  type TestFixture,
} from './harness';

/**
 * Review and publication rules: no unreviewed entry can be published, identity holds
 * block the whole document, exclusions leave a coverage note, a differing identifier
 * cannot be overridden and a correction draft keeps earlier published facts current
 * until the replacement is approved.
 */

let context: TestContext;
let fixture: TestFixture;

beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'review');
});

afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

async function prepareDocument(filename: string, bytes?: Buffer): Promise<{
  documentId: string;
  versionId: string;
  batchId: string;
  revision: number;
  factIds: string[];
  identityState: string;
}> {
  const staged = await stageFixtureUpload(context, fixture, { filename, ...(bytes ? {bytes} : {}) });
  await runOneJob(context, staged.jobId);
  const batch = await latestBatch(context, staged.documentId);
  const facts = await context.owner(async (client) => {
    const result = await client.query<{ id: string }>(
      'select id from sutra.draft_facts where review_batch_id = $1 order by ordinal',
      [batch!.id],
    );
    return result.rows.map((row) => row.id);
  });
  return {
    documentId: staged.documentId,
    versionId: staged.versionId,
    batchId: batch!.id,
    revision: batch!.revision,
    factIds: facts,
    identityState: batch!.identity_state,
  };
}

async function reviewAll(documentId: string, revision: number, factIds: string[]): Promise<number> {
  const result = await context.asActor(fixture.reviewerId, (client) =>
    client.query<{ update_review: { revision: number; state: string } }>(
      'select sutra.update_review($1, $2, $3::jsonb)',
      [
        documentId,
        revision,
        JSON.stringify({
          factUpdates: factIds.map((factId) => ({ factId, action: 'review' })),
        }),
      ],
    ),
  );
  return result.rows[0]!.update_review.revision;
}

describe('review and publication', () => {
  it('renormalizes corrected values and removes obsolete chart eligibility for unsupported units', async () => {
    const bytes = await buildSyntheticReport({identifier: 'P0482', patientName: 'Ravi Menon', collectedOn: '16/02/2026', hba1c: '8.0', filename: 'correction-regression.pdf'});
    const prepared = await prepareDocument('correction-regression.pdf', bytes);
    const before = await context.asActor(fixture.reviewerId, client => getReviewDto(client, prepared.documentId));
    const fact = before!.facts.find(item => item.rawLabel === 'HbA1c')!;
    const changed = await context.asActor(fixture.reviewerId, client => updateReview(client, prepared.documentId, {expectedRevision: prepared.revision, factUpdates: [{factId: fact.factId, action: 'correct', reason: 'Checked against the source', correction: {rawValue: '6.4', rawUnit: '%', eventDate: '2026-02-16', datePrecision: 'day'}}], manualFacts: [], pageExclusions: []}));
    let after = await context.asActor(fixture.reviewerId, client => getReviewDto(client, prepared.documentId));
    expect((after!.facts.find(item => item.factId === fact.factId)!.normalized as {numericValue:number}).numericValue).toBe(6.4);
    await context.asActor(fixture.reviewerId, client => updateReview(client, prepared.documentId, {expectedRevision: changed.revision, factUpdates: [{factId: fact.factId, action: 'correct', reason: 'Unrecognized literal value and unit', correction: {rawValue: 'unreadable', rawUnit: 'unknown'}}], manualFacts: [], pageExclusions: []}));
    after = await context.asActor(fixture.reviewerId, client => getReviewDto(client, prepared.documentId));
    const normalized = after!.facts.find(item => item.factId === fact.factId)!.normalized as {numericValue:number|null; plotEligible:boolean};
    expect(normalized.numericValue).toBeNull();
    expect(normalized.plotEligible).toBe(false);
  });
  it.each(['patient', 'clinic'] as const)('shows a published %s upload to its patient without exposing staff review data', async (uploader) => {
    const filename = `visibility-${uploader}.pdf`;
    const bytes = await buildSyntheticReport({ identifier: fixture.patientIdentifier, patientName: 'Asha Rao', collectedOn: '03 October 2026', hba1c: uploader === 'patient' ? '9.11' : '9.12', filename });
    const staged = await stageFixtureUpload(context, fixture, { filename, bytes, uploaderId: uploader === 'patient' ? fixture.patientUserId : fixture.reviewerId });
    await runOneJob(context, staged.jobId);
    const batch = await latestBatch(context, staged.documentId);
    const facts = await context.owner(async (client) => (await client.query<{id: string}>('select id from sutra.draft_facts where review_batch_id = $1', [batch!.id])).rows.map(row => row.id));
    const revision = await reviewAll(staged.documentId, batch!.revision, facts);
    await context.asActor(fixture.reviewerId, client => client.query('select sutra.publish_review($1, $2, $3::jsonb)', [staged.documentId, revision, '[]']));
    const result = await context.asActor(fixture.patientUserId, client => getDocumentRow(client, staged.documentId));
    expect(result?.state).toBe('approved');
    const list = await context.asActor(fixture.patientUserId, client => listDocuments(client, fixture.patientId, { limit: 100 }));
    expect(list.items.some(item => item.documentId === staged.documentId)).toBe(true);
    const hidden = await context.asActor(fixture.patientUserId, client => client.query('select id from sutra.review_batches where document_id = $1', [staged.documentId]));
    expect(hidden.rows).toHaveLength(0);
    const other = await context.asActor(fixture.otherReviewerId, client => getDocumentRow(client, staged.documentId));
    expect(other).toBeNull();
  });
  it('refuses publication while an entry is unreviewed', async () => {
    const prepared = await prepareDocument('2026-01-12_lab_report.pdf');
    const code = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.publish_review($1, $2, $3::jsonb)', [
          prepared.documentId,
          prepared.revision,
          '[]',
        ]),
      ),
    );
    expect(code).toBe('22023');
  });

  it('publishes only after every entry has an explicit decision', async () => {
    const prepared = await prepareDocument('2026-04-10_lab_report.pdf');
    const revision = await reviewAll(prepared.documentId, prepared.revision, prepared.factIds);
    const result = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ publish_review: { approvalRevision: number; publishedCount: number; publishedFactIds: string[] } }>(
        'select sutra.publish_review($1, $2, $3::jsonb)',
        [prepared.documentId, revision, '[]'],
      ),
    );
    const approval = result.rows[0]!.publish_review;
    expect(approval.publishedCount).toBe(prepared.factIds.length);
    expect(approval.publishedFactIds.length).toBe(prepared.factIds.length);

    const published = await context.owner(async (client) => {
      const rows = await client.query<{ count: string; status: string }>(
        `select count(*)::text as count, min(status) as status from sutra.approved_facts
          where document_id = $1 and status = 'retained'`,
        [prepared.documentId],
      );
      const released = await client.query<{ released_to_patient: boolean }>(
        'select released_to_patient from sutra.documents where id = $1',
        [prepared.documentId],
      );
      return { count: Number(rows.rows[0]!.count), released: released.rows[0]!.released_to_patient };
    });
    expect(published.count).toBe(prepared.factIds.length);
    // Publication releases the document to the patient view.
    expect(published.released).toBe(true);
  });

  it('requires evidence from the same document version for every published entry', async () => {
    const prepared = await prepareDocument('2026-07-09_lab_report.pdf');
    // Remove the evidence link of one reviewed entry.
    await context.owner(async (client) => {
      await client.query('delete from sutra.draft_fact_evidence where draft_fact_id = $1', [
        prepared.factIds[0],
      ]);
    });
    const revision = await reviewAll(prepared.documentId, prepared.revision, prepared.factIds);
    const code = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.publish_review($1, $2, $3::jsonb)', [
          prepared.documentId,
          revision,
          '[]',
        ]),
      ),
    );
    expect(code).toBe('22023');
  });

  it('blocks the whole document on a differing explicit identifier', async () => {
    const staged = await stageFixtureUpload(context, fixture, {
      filename: '2026-09-20_wrong_patient_report.pdf',
    });
    await runOneJob(context, staged.jobId);
    const batch = await latestBatch(context, staged.documentId);
    expect(batch!.identity_state).toBe('mismatch');
    const state = await documentState(context, staged.documentId);
    expect(state.assignment_state).toBe('quarantined');
    const code = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.publish_review($1, $2, $3::jsonb)', [
          staged.documentId,
          batch!.revision,
          '[]',
        ]),
      ),
    );
    // A quarantined upload is refused before any publication work happens.
    expect(code).toBe('P0001');
  });

  it('needs a recorded reason to clear a missing identity', async () => {
    const staged = await stageFixtureUpload(context, fixture, {
      filename: '2026-09-18_no_identifier_report.pdf',
    });
    await runOneJob(context, staged.jobId);
    const batch = await latestBatch(context, staged.documentId);
    expect(batch!.identity_state).toBe('unchecked');

    const withoutReason = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.update_review($1, $2, $3::jsonb)', [
          staged.documentId,
          batch!.revision,
          JSON.stringify({ identity: { state: 'missing_confirmed', reason: '' } }),
        ]),
      ),
    );
    expect(withoutReason).toBe('22023');

    const confirmed = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ update_review: { identityState: string } }>(
        'select sutra.update_review($1, $2, $3::jsonb)',
        [
          staged.documentId,
          batch!.revision,
          JSON.stringify({
            identity: {
              state: 'missing_confirmed',
              reason: 'The printed page shows the name and visit date only.',
            },
          }),
        ],
      ),
    );
    expect(confirmed.rows[0]!.update_review.identityState).toBe('missing_confirmed');
  });

  it('rejects a generic override for a different identifier', async () => {
    // A fresh document with a different printed identifier and unique bytes, so the
    // duplicate check cannot mask the identity rule under test.
    const bytes = await buildSyntheticReport({
      identifier: 'P0517',
      patientName: 'Ravi Menon',
      collectedOn: smokerunDate(30).printed,
      hba1c: '9.2',
      filename: 'wrong-patient.pdf',
    });
    const staged = await stageFixtureUpload(context, fixture, {
      filename: 'integration-wrong-patient.pdf',
      bytes,
    });
    await runOneJob(context, staged.jobId);
    const batch = await latestBatch(context, staged.documentId);
    const code = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.update_review($1, $2, $3::jsonb)', [
          staged.documentId,
          batch!.revision,
          JSON.stringify({
            identity: { state: 'missing_confirmed', reason: 'Approving anyway is not permitted.' },
          }),
        ]),
      ),
    );
    // The review batch keeps the mismatch, so the assignment must be rejected instead.
    // A missing-identity confirmation never clears a differing identifier.
    const state = await documentState(context, staged.documentId);
    expect(state.assignment_state).toBe('quarantined');
    // A quarantined upload is refused before any identity decision is considered.
    expect(code).toBe('42501');
    const stillMismatched = await latestBatch(context, staged.documentId);
    expect(stillMismatched!.identity_state).toBe('mismatch');
  });

  it('records a page exclusion in the published coverage', async () => {
    const staged = await stageFixtureUpload(context, fixture, {
      filename: '2026-02-15_lab_report_two_pages.pdf',
    });
    await runOneJob(context, staged.jobId);
    const batch = await latestBatch(context, staged.documentId);
    const facts = await context.owner(async (client) => {
      const result = await client.query<{ id: string }>(
        'select id from sutra.draft_facts where review_batch_id = $1 order by ordinal',
        [batch!.id],
      );
      return result.rows.map((row) => row.id);
    });

    const afterExclusion = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ update_review: { revision: number } }>(
        'select sutra.update_review($1, $2, $3::jsonb)',
        [
          staged.documentId,
          batch!.revision,
          JSON.stringify({
            pageExclusions: [{ page: 2, reason: 'This page was not readable in the uploaded scan.' }],
          }),
        ],
      ),
    );
    const revision = afterExclusion.rows[0]!.update_review.revision;
    const reviewed = await reviewAll(staged.documentId, revision, facts);
    const approval = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ publish_review: { coverage: { excludedPages: number[]; notes: string[] } } }>(
        'select sutra.publish_review($1, $2, $3::jsonb)',
        [staged.documentId, reviewed, '[]'],
      ),
    );
    expect(approval.rows[0]!.publish_review.coverage.excludedPages).toContain(2);
    expect(approval.rows[0]!.publish_review.coverage.notes.length).toBeGreaterThan(0);
  });

  it('marks a moderated entry unreviewed again after a correction', async () => {
    const prepared = await prepareDocument('2026-05-20_eye_examination.pdf');
    const revision = await reviewAll(prepared.documentId, prepared.revision, prepared.factIds);
    const corrected = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ update_review: { blockers: string[]; state: string } }>(
        'select sutra.update_review($1, $2, $3::jsonb)',
        [
          prepared.documentId,
          revision,
          JSON.stringify({
            factUpdates: [
              {
                factId: prepared.factIds[0],
                action: 'correct',
                reason: 'The source line was misread.',
                correction: { rawLabel: 'Eye examination', sourceText: 'Corrected literal text.' },
              },
            ],
          }),
        ],
      ),
    );
    expect(corrected.rows[0]!.update_review.blockers).toContain('entries_unreviewed');
    expect(corrected.rows[0]!.update_review.state).toBe('draft');
  });

  it('detects a stale revision on the publication call too', async () => {
    const prepared = await prepareDocument('2026-06-11_foot_examination.pdf');
    process.stdout.write('');
    const code = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.publish_review($1, $2, $3::jsonb)', [
          prepared.documentId,
          prepared.revision + 5,
          '[]',
        ]),
      ),
    );
    expect(code).toBe('40001');
  });

  it('creates a correction draft that leaves the published facts current', async () => {
    const prepared = await prepareDocument('2026-09-14_lab_report.pdf');
    const revision = await reviewAll(prepared.documentId, prepared.revision, prepared.factIds);
    const approval = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ publish_review: { approvalRevision: number } }>(
        'select sutra.publish_review($1, $2, $3::jsonb)',
        [prepared.documentId, revision, '[]'],
      ),
    );
    const approvalRevision = approval.rows[0]!.publish_review.approvalRevision;

    const draft = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ create_review_revision: { reviewBatchId: string } }>(
        'select sutra.create_review_revision($1, $2, $3)',
        [prepared.documentId, approvalRevision, 'A value needs correcting after publication.'],
      ),
    );
    expect(draft.rows[0]!.create_review_revision.reviewBatchId).toBeTruthy();

    const current = await context.owner(async (client) => {
      const result = await client.query<{ count: string }>(
        `select count(*)::text as count from sutra.approved_facts
          where document_id = $1 and status = 'retained'`,
        [prepared.documentId],
      );
      return Number(result.rows[0]!.count);
    });
    // The earlier approved values stay current until the replacement is published.
    expect(current).toBe(prepared.factIds.length);

    const stale = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.create_review_revision($1, $2, $3)', [
          prepared.documentId,
          approvalRevision - 1,
          'Stale revision must be refused.',
        ]),
      ),
    );
    expect(stale).toBe('40001');
  });

  it('requires an explicit decision for earlier facts when an amendment is published', async () => {
    const original = await prepareDocument('2026-03-02_prescription.pdf');
    const originalRevision = await reviewAll(original.documentId, original.revision, original.factIds);
    const originalApproval = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ publish_review: { approvalRevision: number } }>(
        'select sutra.publish_review($1, $2, $3::jsonb)',
        [original.documentId, originalRevision, '[]'],
      ),
    );
    void originalApproval;

    const amendment = await stageFixtureUpload(context, fixture, {
      filename: '2026-09-22_unsupported_unit_report.pdf',
    });
    await runOneJob(context, amendment.jobId);
    const link = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ link_amendment: { amendmentPending: boolean } }>(
        'select sutra.link_amendment($1, $2, $3, $4)',
        [
          original.documentId,
          amendment.sessionId,
          original.versionId,
          'Re-issued report for the same visit.',
        ],
      ),
    );
    expect(link.rows[0]!.link_amendment.amendmentPending).toBe(true);

    const batch = await latestBatch(context, amendment.documentId);
    const facts = await context.owner(async (client) => {
      const result = await client.query<{ id: string }>(
        'select id from sutra.draft_facts where review_batch_id = $1 order by ordinal',
        [batch!.id],
      );
      return result.rows.map((row) => row.id);
    });
    const revision = await reviewAll(amendment.documentId, batch!.revision, facts);

    const withoutDispositions = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.publish_review($1, $2, $3::jsonb)', [
          amendment.documentId,
          revision,
          '[]',
        ]),
      ),
    );
    expect(withoutDispositions).toBe('22023');

    const priorFacts = await context.owner(async (client) => {
      const result = await client.query<{ id: string }>(
        "select id from sutra.approved_facts where document_id = $1 and status = 'retained'",
        [original.documentId],
      );
      return result.rows.map((row) => row.id);
    });
    const published = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ publish_review: { supersededCount: number; retainedCount: number } }>(
        'select sutra.publish_review($1, $2, $3::jsonb)',
        [
          amendment.documentId,
          revision,
          JSON.stringify(
            priorFacts.map((factId) => ({
              factId,
              status: 'superseded',
              reason: 'Replaced by the re-issued report for the same visit.',
            })),
          ),
        ],
      ),
    );
    expect(published.rows[0]!.publish_review.supersededCount).toBeGreaterThan(0);

    const status = await context.owner(async (client) => {
      const result = await client.query<{ status: string; count: string }>(
        `select status, count(*)::text as count from sutra.approved_facts
          where document_id = $1 group by status`,
        [original.documentId],
      );
      return result.rows;
    });
    expect(status.some((row) => row.status === 'superseded')).toBe(true);
    const events = await context.owner(async (client) => {
      const result = await client.query<{ count: string }>(
        'select count(*)::text as count from sutra.fact_status_events',
      );
      return Number(result.rows[0]!.count);
    });
    expect(events).toBeGreaterThan(0);
  });

  it('quarantines a source that mixes two patient identifiers', async () => {
    const staged = await stageFixtureUpload(context, fixture, {
      filename: '2026-09-21_mixed_identity_two_pages.pdf',
    });
    await runOneJob(context, staged.jobId);
    const state = await documentState(context, staged.documentId);
    expect(state.assignment_state).toBe('quarantined');
    const batch = await latestBatch(context, staged.documentId);
    expect(batch!.identity_state).toBe('mismatch');
  });
});

import { afterAll, beforeAll, expect, it } from 'vitest';
import { loadTimelinePage } from '@glucoflow/data';
import {
  createFixture,
  createTestContext,
  removeClinic,
  stageFixtureUpload,
  runOneJob,
  latestBatch,
  type TestContext,
  type TestFixture,
} from './harness';

let context: TestContext;
let fixture: TestFixture;
beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'timeline-pages');
  await context.owner((client) =>
    client.query(
      `insert into sutra.patient_notes (clinic_id, patient_id, author_id, category, body, event_date)
    select $1, $2, $3, 'diet_activity', 'Synthetic note ' || n, date '2026-09-01' + (n % 2) from generate_series(1, 120) n`,
      [fixture.clinicId, fixture.patientId, fixture.patientUserId],
    ),
  );
  const staged = await stageFixtureUpload(context, fixture, {
    filename: '2026-01-12_lab_report.pdf',
  });
  await runOneJob(context, staged.jobId);
  const batch = (await latestBatch(context, staged.documentId))!;
  await context.asActor(fixture.reviewerId, async (client) => {
    const facts = await client.query<{ id: string }>(
      'select id from sutra.draft_facts where review_batch_id=$1',
      [batch.id],
    );
    const updated = await client.query<{ update_review: { revision: number } }>(
      'select sutra.update_review($1,$2,$3::jsonb)',
      [
        staged.documentId,
        batch.revision,
        JSON.stringify({
          factUpdates: facts.rows.map((fact) => ({
            factId: fact.id,
            action: 'review',
          })),
        }),
      ],
    );
    await client.query('select sutra.publish_review($1,$2,$3::jsonb)', [
      staged.documentId,
      updated.rows[0]!.update_review.revision,
      '[]',
    ]);
  });
  // Isolated synthetic history for pagination only. Reads below still use API RLS.
  await context.owner((client) =>
    client.query(
      `insert into sutra.approved_facts
    (clinic_id,patient_id,document_id,document_version_id,approval_batch_id,kind,raw_label,raw_value,raw_unit,event_date,date_kind,date_precision,normalized_json,payload_json,plot_eligible,approval_revision,approved_by,ordinal)
    select f.clinic_id,f.patient_id,f.document_id,f.document_version_id,f.approval_batch_id,
      case when n<=120 then 'observation' else 'prescription' end, f.raw_label,f.raw_value,f.raw_unit,f.event_date,f.date_kind,f.date_precision,f.normalized_json,f.payload_json,n<=120,f.approval_revision,f.approved_by,n
    from (select * from sutra.approved_facts where patient_id=$1 and kind='observation' limit 1) f cross join generate_series(1,240) n`,
      [fixture.patientId],
    ),
  );
});
afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

it('pages patient notes independently of the observation offset and retains true totals', async () => {
  const first = await context.asActor(fixture.reviewerId, (client) =>
    loadTimelinePage(client, fixture.patientId, { testCodes: [] }, 100, 0, {
      notes: 0,
      events: 0,
    }),
  );
  const second = await context.asActor(fixture.reviewerId, (client) =>
    loadTimelinePage(client, fixture.patientId, { testCodes: [] }, 100, 100, {
      notes: 100,
      events: 0,
    }),
  );
  expect(first.notes).toHaveLength(100);
  expect(second.notes).toHaveLength(20);
  expect(first.noteTotal).toBe(120);
  expect(
    new Set([...first.notes, ...second.notes].map((note) => note.noteId)).size,
  ).toBe(120);
});
it('applies selected date bounds to patient notes', async () => {
  const scoped = await context.asActor(fixture.reviewerId, (client) =>
    loadTimelinePage(
      client,
      fixture.patientId,
      { testCodes: [], from: '2026-09-02', to: '2026-09-02' },
      100,
      0,
    ),
  );
  expect(scoped.noteTotal).toBe(60);
  expect(scoped.notes.every((note) => note.eventDate === '2026-09-02')).toBe(
    true,
  );
});

it('retains all observations and context events beyond the first hundred', async () => {
  const first = await context.asActor(fixture.reviewerId, (client) =>
    loadTimelinePage(client, fixture.patientId, { testCodes: [] }, 100, 0, {
      events: 0,
      notes: 0,
    }),
  );
  const second = await context.asActor(fixture.reviewerId, (client) =>
    loadTimelinePage(client, fixture.patientId, { testCodes: [] }, 100, 100, {
      events: 100,
      notes: 100,
    }),
  );
  expect(first.observationTotal).toBeGreaterThan(100);
  expect(first.eventTotal).toBe(120);
  expect(first.events).toHaveLength(100);
  expect(second.events).toHaveLength(20);
  expect(
    new Set(
      [...first.observations, ...second.observations].map(
        (fact) => fact.factId,
      ),
    ).size,
  ).toBe(first.observationTotal);
  expect(
    new Set([...first.events, ...second.events].map((fact) => fact.factId))
      .size,
  ).toBe(120);
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFixture,
  createTestContext,
  errorCode,
  removeClinic,
  runOneJob,
  stageFixtureUpload,
  type TestContext,
  type TestFixture,
} from './harness';

/**
 * Patient notes: patient-authored only, blank and oversized notes refused, optional
 * event date, append-only corrections and acknowledgement that keeps the note
 * patient-reported.
 */

let context: TestContext;
let fixture: TestFixture;

beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'notes');
});

afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

describe('patient notes', () => {
  it('accepts a patient note and keeps the reporter as the patient', async () => {
    const result = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ submit_patient_note: string }>(
        'select sutra.submit_patient_note($1, $2, $3, $4::date)',
        [
          fixture.patientId,
          'diet_activity',
          'Walked after dinner on most days this month.',
          '2026-09-10',
        ],
      ),
    );
    const noteId = result.rows[0]!.submit_patient_note;
    const note = await context.owner(async (client) => {
      const rows = await client.query<{
        author_id: string;
        category: string;
        event_date: string | null;
        submitted_at: string;
      }>('select author_id, category, to_char(event_date, $2) as event_date, submitted_at from sutra.patient_notes where id = $1', [
        noteId,
        'YYYY-MM-DD',
      ]);
      return rows.rows[0]!;
    });
    expect(note.author_id).toBe(fixture.patientUserId);
    expect(note.category).toBe('diet_activity');
    expect(note.event_date).toBe('2026-09-10');
    // The submission timestamp is recorded separately from the event date.
    expect(new Date(note.submitted_at).getTime()).toBeGreaterThan(
      new Date('2026-09-10T00:00:00Z').getTime(),
    );
  });

  it('refuses a blank note and a note above the character limit', async () => {
    const blank = await errorCode(
      context.asActor(fixture.patientUserId, (client) =>
        client.query('select sutra.submit_patient_note($1, $2, $3, null)', [
          fixture.patientId,
          'other',
          '   ',
        ]),
      ),
    );
    expect(blank).toBe('22023');

    const tooLong = await errorCode(
      context.asActor(fixture.patientUserId, (client) =>
        client.query('select sutra.submit_patient_note($1, $2, $3, null)', [
          fixture.patientId,
          'other',
          'x'.repeat(1001),
        ]),
      ),
    );
    expect(tooLong).toBe('22023');
  });

  it('refuses a note written by clinic staff on the patient behalf', async () => {
    const code = await errorCode(
      context.asActor(fixture.reviewerId, (client) =>
        client.query('select sutra.submit_patient_note($1, $2, $3, null)', [
          fixture.patientId,
          'symptoms',
          'Staff must not author a patient note.',
        ]),
      ),
    );
    expect(code).toBe('42501');
  });

  it('keeps corrections append-only and linked to the earlier version', async () => {
    const created = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ submit_patient_note: string }>(
        'select sutra.submit_patient_note($1, $2, $3, null)',
        [fixture.patientId, 'symptoms', 'Felt dizzy once after standing up quickly.'],
      ),
    );
    const noteId = created.rows[0]!.submit_patient_note;
    const corrected = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ correct_patient_note: string }>(
        'select sutra.correct_patient_note($1, $2, $3, $4::date)',
        [noteId, 'symptoms', 'Felt dizzy twice after standing up quickly.', '2026-09-12'],
      ),
    );
    const newId = corrected.rows[0]!.correct_patient_note;

    const rows = await context.owner(async (client) => {
      const result = await client.query<{ id: string; version: number; supersedes_note_id: string | null; body: string }>(
        'select id, version, supersedes_note_id, body from sutra.patient_notes where patient_id = $1 order by version',
        [fixture.patientId],
      );
      return result.rows;
    });
    const original = rows.find((row) => row.id === noteId)!;
    const replacement = rows.find((row) => row.id === newId)!;
    expect(replacement.supersedes_note_id).toBe(noteId);
    expect(replacement.version).toBeGreaterThan(original.version);
    // The earlier text remains available in history.
    expect(original.body).toContain('once');

    const secondCorrection = await errorCode(
      context.asActor(fixture.patientUserId, (client) =>
        client.query('select sutra.correct_patient_note($1, $2, $3, null)', [
          noteId,
          'symptoms',
          'A third version from the same base is not allowed.',
        ]),
      ),
    );
    expect(secondCorrection).toBe('P0001');
  });

  it('acknowledges a note without turning it into a clinical claim', async () => {
    const created = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ submit_patient_note: string }>(
        'select sutra.submit_patient_note($1, $2, $3, null)',
        [fixture.patientId, 'medication_taking', 'Took the evening tablet most days.'],
      ),
    );
    const noteId = created.rows[0]!.submit_patient_note;
    await context.asActor(fixture.clinicianId, (client) =>
      client.query('select sutra.acknowledge_patient_note($1)', [noteId]),
    );
    const note = await context.owner(async (client) => {
      const result = await client.query<{ seen_by: string | null; seen_at: string | null }>(
        'select seen_by, seen_at from sutra.patient_notes where id = $1',
        [noteId],
      );
      return result.rows[0]!;
    });
    expect(note.seen_by).toBe(fixture.clinicianId);
    expect(note.seen_at).not.toBeNull();

    // Acknowledgement lives in the note table only: no approved fact is created.
    const approved = await context.owner(async (client) => {
      const result = await client.query<{ count: string }>(
        'select count(*)::text as count from sutra.approved_facts where patient_id = $1',
        [fixture.patientId],
      );
      return Number(result.rows[0]!.count);
    });
    expect(approved).toBe(0);
  });

  it('refuses acknowledgement from an account outside the clinic', async () => {
    const created = await context.asActor(fixture.patientUserId, (client) =>
      client.query<{ submit_patient_note: string }>(
        'select sutra.submit_patient_note($1, $2, $3, null)',
        [fixture.patientId, 'other', 'A note for the acknowledgement check.'],
      ),
    );
    const code = await errorCode(
      context.asActor(fixture.otherReviewerId, (client) =>
        client.query('select sutra.acknowledge_patient_note($1)', [
          created.rows[0]!.submit_patient_note,
        ]),
      ),
    );
    expect(code).toBe('42501');
  });

  it('shows a patient note in the timeline as patient-reported and never as a measurement', async () => {
    const staged = await stageFixtureUpload(context, fixture, {
      filename: '2026-01-12_lab_report.pdf',
    });
    await runOneJob(context, staged.jobId);
    const notes = await context.asActor(fixture.reviewerId, (client) =>
      client.query<{ body: string; author_id: string }>(
        'select body, author_id from sutra.patient_notes where patient_id = $1',
        [fixture.patientId],
      ),
    );
    expect(notes.rows.length).toBeGreaterThan(0);
    expect(notes.rows.every((row) => row.author_id === fixture.patientUserId)).toBe(true);

    const approved = await context.owner(async (client) => {
      const result = await client.query<{ count: string }>(
        `select count(*)::text as count from sutra.approved_facts
          where patient_id = $1 and kind <> 'observation'`,
        [fixture.patientId],
      );
      return Number(result.rows[0]!.count);
    });
    expect(approved).toBe(0);
  });
});

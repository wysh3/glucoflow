import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createResult } from '@glucoflow/data';
import {
  createFixture,
  createTestContext,
  errorCode,
  removeClinic,
  type TestContext,
  type TestFixture,
} from './harness';

let context: TestContext;
let fixture: TestFixture;
let deskId: string;
let nurseId: string;
let qualityId: string;

const now = new Date().toISOString();

beforeAll(async () => {
  context = await createTestContext();
  fixture = await createFixture(context, 'obligation');

  const created = await context.owner(async (client) => {
    const make = async (email: string, name: string): Promise<string> => {
      const user = await client.query<{ id: string }>(
        'insert into sutra.app_users (email, display_name) values ($1, $2) returning id',
        [email, name],
      );
      return user.rows[0]!.id;
    };
    const desk = await make(`desk-${Date.now()}@test.local`, 'Desk');
    const nurse = await make(`nurse-${Date.now()}@test.local`, 'Nurse');
    const quality = await make(`quality-${Date.now()}@test.local`, 'Quality');
    await client.query(
      `insert into sutra.memberships (clinic_id, user_id, desk, nurse, quality) values
         ($1, $2, true, false, false),
         ($1, $3, false, true, false),
         ($1, $4, false, false, true)`,
      [fixture.clinicId, desk, nurse, quality],
    );
    return { desk, nurse, quality };
  });
  deskId = created.desk;
  nurseId = created.nurse;
  qualityId = created.quality;
});

afterAll(async () => {
  await removeClinic(context, fixture.clinicId);
  await removeClinic(context, fixture.otherClinicId);
  await context.close();
});

async function createCritical(): Promise<string> {
  return context.asActor(fixture.reviewerId, (client) =>
    createResult(client, fixture.clinicId, {
      patientId: fixture.patientId,
      externalRef: `obligation-${Math.random().toString(36).slice(2)}`,
      sourceChannel: 'whatsapp',
      labName: 'SRL Diagnostics',
      reportReceivedAt: now,
      labReleasedAt: now,
      patientNameRaw: 'Asha Rao',
      patientIdentifierRaw: fixture.patientIdentifier,
      testName: 'Potassium',
      valueText: '5.9',
      unit: 'mmol/L',
      labFlag: 'critical',
      labHold: false,
      resultKind: 'unscheduled',
    }),
  );
}

async function as<T>(actorId: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return context.asActor(actorId, async (client) => {
    const result = await client.query(sql, params);
    return result.rows as T[];
  });
}

async function run(actorId: string, sql: string, params: unknown[] = []): Promise<void> {
  await as(actorId, sql, params);
}

describe('obligation lifecycle', () => {
  it('runs custody, review, communication and close through the procedures', async () => {
    const resultId = await createCritical();

    await run(deskId, 'select sutra.accept_custody($1)', [resultId]);
    const accepted = await as<{ custody_state: string; custody_due_at: string | null }>(
      deskId,
      'select custody_state, custody_due_at from sutra.results where id = $1',
      [resultId],
    );
    expect(accepted[0]?.custody_state).toBe('accepted');
    expect(accepted[0]?.custody_due_at).not.toBeNull();

    await run(deskId, 'select sutra.assign_clinician($1, $2)', [resultId, fixture.clinicianId]);
    const assigned = await as<{ review_state: string; status: string; owner_id: string }>(
      deskId,
      'select review_state, status, owner_id from sutra.results where id = $1',
      [resultId],
    );
    expect(assigned[0]?.review_state).toBe('pending');
    expect(assigned[0]?.status).toBe('owned');
    expect(assigned[0]?.owner_id).toBe(fixture.clinicianId);

    const line = await as<{ id: string }>(
      fixture.clinicianId,
      'select id from sutra.obligation_line($1, $2)',
      [fixture.clinicId, fixture.clinicianId],
    );
    expect(line.map((row) => row.id)).toContain(resultId);

    await run(fixture.clinicianId, 'select sutra.see_result($1, $2, $3, null)', [
      resultId,
      '5.9',
      'critical',
    ]);
    const seen = await as<{ review_state: string; status: string; review_due_at: string | null }>(
      fixture.clinicianId,
      'select review_state, status, review_due_at from sutra.results where id = $1',
      [resultId],
    );
    expect(seen[0]?.review_state).toBe('seen');
    expect(seen[0]?.status).toBe('acknowledged');
    expect(seen[0]?.review_due_at).toBeNull();

    const calls = await as<{ id: string }>(
      nurseId,
      'select id from sutra.obligation_calls($1)',
      [fixture.clinicId],
    );
    expect(calls.map((row) => row.id)).toContain(resultId);

    await run(
      nurseId,
      'select sutra.record_informed($1, $2, $3, $4, $5, $6, null, null)',
      [resultId, 'call', 'informed_patient', true, true, 'book_appointment'],
    );
    const informed = await as<{ communication_state: string; status: string }>(
      nurseId,
      'select communication_state, status from sutra.results where id = $1',
      [resultId],
    );
    expect(informed[0]?.communication_state).toBe('informed');
    expect(informed[0]?.status).toBe('patient_informed');

    await run(nurseId, 'select sutra.close_result_v2($1, $2, null)', [resultId, 'reviewed_action']);
    const closed = await as<{ terminal_state: string; status: string; closed_at: string }>(
      nurseId,
      'select terminal_state, status, closed_at from sutra.results where id = $1',
      [resultId],
    );
    expect(closed[0]?.terminal_state).toBe('closed');
    expect(closed[0]?.status).toBe('closed');
    expect(closed[0]?.closed_at).not.toBeNull();
  });

  it('refuses clinical review by a nurse and a critical close without a read-back', async () => {
    const resultId = await createCritical();
    await run(deskId, 'select sutra.accept_custody($1)', [resultId]);
    await run(deskId, 'select sutra.assign_clinician($1, $2)', [resultId, fixture.clinicianId]);

    const wrongRole = context.asActor(nurseId, (client) =>
      client.query('select sutra.see_result($1, $2, $3, null)', [resultId, '5.9', 'critical']),
    );
    expect(await errorCode(wrongRole)).toBe('42501');

    await run(fixture.clinicianId, 'select sutra.see_result($1, $2, $3, null)', [
      resultId,
      '5.9',
      'critical',
    ]);

    const noReadBack = context.asActor(nurseId, (client) =>
      client.query('select sutra.record_informed($1, $2, $3, $4, $5, null, null, null)', [
        resultId,
        'call',
        'informed_patient',
        false,
        false,
      ]),
    );
    expect(await errorCode(noReadBack)).toBe('22023');
  });

  it('refuses an exception close before two attempts on different days', async () => {
    const resultId = await createCritical();
    await run(deskId, 'select sutra.accept_custody($1)', [resultId]);
    await run(deskId, 'select sutra.assign_clinician($1, $2)', [resultId, fixture.clinicianId]);
    await run(fixture.clinicianId, 'select sutra.see_result($1, $2, $3, null)', [
      resultId,
      '5.9',
      'critical',
    ]);
    await run(nurseId, 'select sutra.record_attempt($1, $2, $3, null)', [
      resultId,
      'call',
      'unreachable',
    ]);

    const refused = context.asActor(nurseId, (client) =>
      client.query('select sutra.close_result_unreachable($1, $2, null)', [resultId, 'unreachable']),
    );
    expect(await errorCode(refused)).toBe('P0001');
  });

  it('pauses and resumes the clock, and treats a repeat pause as a no-op', async () => {
    const resultId = await createCritical();
    await run(deskId, 'select sutra.accept_custody($1)', [resultId]);

    const before = await as<{ custody_due_at: string }>(
      deskId,
      'select custody_due_at from sutra.results where id = $1',
      [resultId],
    );
    await run(deskId, 'select sutra.pause_result($1, $2)', [resultId, 'in theatre']);
    await run(deskId, 'select sutra.pause_result($1, $2)', [resultId, 'in theatre again']);
    const paused = await as<{ paused_at: string | null; pause_reason: string }>(
      deskId,
      'select paused_at, pause_reason from sutra.results where id = $1',
      [resultId],
    );
    expect(paused[0]?.paused_at).not.toBeNull();
    expect(paused[0]?.pause_reason).toBe('in theatre');

    await run(deskId, 'select sutra.resume_result($1)', [resultId]);
    const resumed = await as<{
      paused_at: string | null;
      paused_seconds: number;
      custody_due_at: string;
    }>(
      deskId,
      'select paused_at, paused_seconds, custody_due_at from sutra.results where id = $1',
      [resultId],
    );
    expect(resumed[0]?.paused_at).toBeNull();
    expect(resumed[0]?.paused_seconds).toBeGreaterThanOrEqual(0);
    expect(new Date(resumed[0]!.custody_due_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before[0]!.custody_due_at).getTime(),
    );
  });
});

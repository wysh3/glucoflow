import { describe, expect, it } from 'vitest';
import {
  applyAction,
  attemptDayCount,
  breachAt,
  deriveStatus,
  EMPTY_CLOCKS,
  pauseClocks,
  resumeClocks,
  stageDueAt,
  valuesMatch,
  type ObligationActor,
  type ObligationContext,
  type ObligationPhase,
  type ObligationResult,
} from './obligation';

const desk: ObligationActor = { id: 'user-desk', role: 'desk' };
const nurse: ObligationActor = { id: 'user-nurse', role: 'nurse' };
const clinician: ObligationActor = { id: 'user-doctor', role: 'clinician' };
const otherClinician: ObligationActor = { id: 'user-doctor-2', role: 'clinician' };
const quality: ObligationActor = { id: 'user-quality', role: 'quality' };

const critical: ObligationContext = { labFlag: 'critical' };
const abnormal: ObligationContext = { labFlag: 'abnormal' };

function expectOk(result: ObligationResult): Extract<ObligationResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${result.code}: ${result.message}`);
  return result;
}

function expectFail(result: ObligationResult): Extract<ObligationResult, { ok: false }> {
  if (result.ok) throw new Error('expected a refusal');
  return result;
}

function accepted(clinicianId = clinician.id): ObligationPhase {
  return {
    kind: 'assigned',
    clinicianId,
  };
}

function seen(clinicianId = clinician.id): ObligationPhase {
  return { kind: 'seen', clinicianId, seenBy: clinicianId };
}

function informed(): ObligationPhase {
  return {
    kind: 'informed',
    clinicianId: clinician.id,
    seenBy: clinician.id,
    attempts: [{ outcome: 'informed_patient', at: '2026-11-04T09:31:00.000Z' }],
    informedBy: nurse.id,
    readBack: true,
    nextStep: null,
  };
}

describe('obligation phase machine', () => {
  it('runs the whole loop in order', () => {
    let phase: ObligationPhase = { kind: 'received' };

    phase = expectOk(
      applyAction(phase, { type: 'accept', actor: desk }, abnormal),
    ).phase;
    expect(phase).toEqual({ kind: 'accepted', acceptedBy: desk.id });

    phase = expectOk(
      applyAction(phase, { type: 'assign', actor: desk, clinicianId: clinician.id }, abnormal),
    ).phase;
    expect(phase).toEqual({ kind: 'assigned', clinicianId: clinician.id });

    phase = expectOk(
      applyAction(
        phase,
        {
          type: 'see',
          actor: clinician,
          valueEcho: '6.2',
          expectedValue: '6.2',
        },
        critical,
      ),
    ).phase;
    expect(phase).toEqual({ kind: 'seen', clinicianId: clinician.id, seenBy: clinician.id });

    phase = expectOk(
      applyAction(
        phase,
        {
          type: 'inform',
          actor: nurse,
          outcome: 'informed_patient',
          at: '2026-11-04T09:31:00.000Z',
          readBack: true,
          nextStep: 'book_appointment',
        },
        critical,
      ),
    ).phase;
    expect(phase.kind).toBe('informed');

    phase = expectOk(
      applyAction(phase, { type: 'close', actor: nurse, disposition: 'reviewed_action' }, critical),
    ).phase;
    expect(phase.kind).toBe('closed');
  });

  it('lets the desk or a nurse accept custody, and nobody else', () => {
    expectOk(applyAction({ kind: 'received' }, { type: 'accept', actor: nurse }, abnormal));
    const refused = expectFail(
      applyAction({ kind: 'received' }, { type: 'accept', actor: clinician }, abnormal),
    );
    expect(refused.code).toBe('wrong_role');
  });

  it('converges when the same desk user accepts twice', () => {
    const phase: ObligationPhase = { kind: 'accepted', acceptedBy: desk.id };
    const again = expectOk(applyAction(phase, { type: 'accept', actor: desk }, abnormal));
    expect(again.changed).toBe(false);
    expect(again.phase).toBe(phase);
  });

  it('refuses a second accept from a different user', () => {
    const phase: ObligationPhase = { kind: 'accepted', acceptedBy: desk.id };
    const secondDesk: ObligationActor = { id: 'user-desk-2', role: 'desk' };
    expect(expectFail(applyAction(phase, { type: 'accept', actor: secondDesk }, abnormal)).code).toBe(
      'wrong_phase',
    );
  });

  it('refuses assignment before custody is accepted', () => {
    const refused = expectFail(
      applyAction(
        { kind: 'received' },
        { type: 'assign', actor: desk, clinicianId: clinician.id },
        abnormal,
      ),
    );
    expect(refused.code).toBe('wrong_phase');
  });

  it('refuses a clinician who is not the assigned one', () => {
    const refused = expectFail(
      applyAction(
        accepted(),
        { type: 'see', actor: otherClinician, valueEcho: '6.2', expectedValue: '6.2' },
        critical,
      ),
    );
    expect(refused.code).toBe('not_assigned_clinician');
  });

  it('refuses a value echo that does not match, and accepts a dispute', () => {
    const mismatch = expectFail(
      applyAction(
        accepted(),
        { type: 'see', actor: clinician, valueEcho: '6.3', expectedValue: '6.2' },
        critical,
      ),
    );
    expect(mismatch.code).toBe('value_mismatch');

    const disputed = expectOk(
      applyAction(
        accepted(),
        {
          type: 'see',
          actor: clinician,
          valueEcho: '6.3',
          expectedValue: '6.2',
          flagDispute: { flag: 'abnormal', reason: 'The lab flag was for a different sample.' },
        },
        critical,
      ),
    );
    expect(disputed.phase.kind).toBe('seen');
  });

  it('requires a read-back for a critical result and not for an abnormal one', () => {
    const missing = expectFail(
      applyAction(
        seen(),
        {
          type: 'inform',
          actor: nurse,
          outcome: 'informed_patient',
          at: '2026-11-04T09:31:00.000Z',
          readBack: false,
          nextStep: null,
        },
        critical,
      ),
    );
    expect(missing.code).toBe('readback_required');

    expectOk(
      applyAction(
        seen(),
        {
          type: 'inform',
          actor: nurse,
          outcome: 'informed_patient',
          at: '2026-11-04T09:31:00.000Z',
          readBack: false,
          nextStep: null,
        },
        abnormal,
      ),
    );
  });

  it('separates attempt outcomes from informed outcomes', () => {
    const attemptWithInformed = expectFail(
      applyAction(
        seen(),
        { type: 'attempt', actor: nurse, outcome: 'informed_patient', at: '2026-11-04T09:00:00.000Z' },
        abnormal,
      ),
    );
    expect(attemptWithInformed.code).toBe('use_attempt_outcome');

    const informWithUnreachable = expectFail(
      applyAction(
        seen(),
        {
          type: 'inform',
          actor: nurse,
          outcome: 'unreachable',
          at: '2026-11-04T09:00:00.000Z',
          readBack: false,
          nextStep: null,
        },
        abnormal,
      ),
    );
    expect(informWithUnreachable.code).toBe('use_inform_outcome');
  });

  it('requires two attempts on different days before an exception close', () => {
    const oneDay = expectOk(
      applyAction(
        seen(),
        { type: 'attempt', actor: nurse, outcome: 'unreachable', at: '2026-11-04T10:00:00.000Z' },
        abnormal,
      ),
    ).phase;
    const sameDay = expectOk(
      applyAction(
        oneDay,
        { type: 'attempt', actor: nurse, outcome: 'unreachable', at: '2026-11-04T16:00:00.000Z' },
        abnormal,
      ),
    ).phase;

    expect(
      expectFail(
        applyAction(sameDay, { type: 'close_unreachable', actor: nurse, disposition: 'unreachable' }, abnormal),
      ).code,
    ).toBe('attempts_insufficient');

    const nextDay = expectOk(
      applyAction(
        sameDay,
        { type: 'attempt', actor: nurse, outcome: 'unreachable', at: '2026-11-05T10:00:00.000Z' },
        abnormal,
      ),
    ).phase;

    const closed = expectOk(
      applyAction(
        nextDay,
        { type: 'close_unreachable', actor: nurse, disposition: 'unreachable' },
        abnormal,
      ),
    ).phase;
    expect(closed.kind).toBe('closed_unreachable');
  });

  it('refuses to close a patient who was not informed', () => {
    const refused = expectFail(
      applyAction(seen(), { type: 'close', actor: nurse, disposition: 'reviewed_action' }, abnormal),
    );
    expect(refused.code).toBe('wrong_phase');
  });

  it('allows the quality head to close an informed loop', () => {
    expectOk(
      applyAction(informed(), { type: 'close', actor: quality, disposition: 'reviewed_action' }, abnormal),
    );
  });

  it('reassigns an open result and treats the same clinician as a no-op', () => {
    const moved = expectOk(
      applyAction(
        accepted(),
        { type: 'reassign', actor: desk, clinicianId: otherClinician.id },
        abnormal,
      ),
    );
    expect(moved.phase).toEqual({ kind: 'assigned', clinicianId: otherClinician.id });

    const same = expectOk(
      applyAction(moved.phase, { type: 'reassign', actor: desk, clinicianId: otherClinician.id }, abnormal),
    );
    expect(same.changed).toBe(false);
  });
});

describe('legacy status projection', () => {
  it('derives the six-state status from the phase', () => {
    expect(deriveStatus({ kind: 'received' }, false)).toBe('unmatched');
    expect(deriveStatus({ kind: 'received' }, true)).toBe('matched');
    expect(deriveStatus({ kind: 'accepted', acceptedBy: desk.id }, true)).toBe('matched');
    expect(deriveStatus(accepted(), true)).toBe('owned');
    expect(deriveStatus(seen(), true)).toBe('acknowledged');
    expect(deriveStatus(informed(), true)).toBe('patient_informed');
    expect(deriveStatus({ kind: 'closed', clinicianId: clinician.id, disposition: 'reviewed_action', closedBy: nurse.id }, true)).toBe('closed');
  });
});

describe('value echo', () => {
  it('tolerates units, spacing and numeric formatting', () => {
    expect(valuesMatch('6.2', '6.20')).toBe(true);
    expect(valuesMatch('6.2', '6.2 mg/dL')).toBe(true);
    expect(valuesMatch('6,2', '6.2')).toBe(true);
    expect(valuesMatch(' 6.2 ', '6.2')).toBe(true);
  });

  it('rejects a different value, a qualifier, or an empty echo', () => {
    expect(valuesMatch('6.2', '6.3')).toBe(false);
    expect(valuesMatch('<6.5', '6.5')).toBe(false);
    expect(valuesMatch('6.2', '')).toBe(false);
  });
});

describe('attempt days', () => {
  it('counts distinct UTC dates, not attempts', () => {
    expect(
      attemptDayCount([
        { outcome: 'unreachable', at: '2026-11-04T10:00:00.000Z' },
        { outcome: 'unreachable', at: '2026-11-04T16:00:00.000Z' },
      ]),
    ).toBe(1);
    expect(
      attemptDayCount([
        { outcome: 'unreachable', at: '2026-11-04T10:00:00.000Z' },
        { outcome: 'unreachable', at: '2026-11-05T10:00:00.000Z' },
      ]),
    ).toBe(2);
  });
});

describe('clocks', () => {
  it('uses the published SLA for each stage', () => {
    expect(stageDueAt('custody', '2026-11-04T08:47:00.000Z', 'critical')).toBe(
      '2026-11-04T09:02:00.000Z',
    );
    expect(stageDueAt('review', '2026-11-04T08:47:00.000Z', 'critical')).toBe(
      '2026-11-04T09:47:00.000Z',
    );
    expect(stageDueAt('communication', '2026-11-04T08:47:00.000Z', 'abnormal')).toBe(
      '2026-11-05T08:47:00.000Z',
    );
  });

  it('pauses once, resumes once, and shifts the open deadlines', () => {
    const clocks = { ...EMPTY_CLOCKS, custodyDueAt: '2026-11-04T09:00:00.000Z' };
    const paused = pauseClocks(clocks, '2026-11-04T08:00:00.000Z');
    expect(pauseClocks(paused, '2026-11-04T08:10:00.000Z')).toBe(paused);

    const resumed = resumeClocks(paused, '2026-11-04T08:30:00.000Z');
    expect(resumed.custodyDueAt).toBe('2026-11-04T09:30:00.000Z');
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.pausedSeconds).toBe(1800);
    expect(resumeClocks(resumed, '2026-11-04T09:00:00.000Z')).toBe(resumed);
  });

  it('reports the earliest open deadline, and none while paused', () => {
    const clocks = {
      custodyDueAt: '2026-11-04T09:02:00.000Z',
      reviewDueAt: '2026-11-04T09:47:00.000Z',
      communicationDueAt: null,
      pausedAt: null,
      pausedSeconds: 0,
    };
    expect(breachAt(clocks)).toBe('2026-11-04T09:02:00.000Z');
    expect(breachAt({ ...clocks, pausedAt: '2026-11-04T08:00:00.000Z' })).toBeNull();
  });
});

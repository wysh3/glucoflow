import type {
  CommunicationOutcome,
  Disposition,
  NextStep,
  ResultFlag,
  ResultStatus,
} from '@glucoflow/contracts';

/**
 * The obligation is the unit of work: a lab result that a named human must see,
 * communicate and close. This module is the authoritative transition table in
 * TypeScript. The PL/pgSQL procedures enforce the same table; the tests pin both.
 *
 * Source: docs/research/2026-11-04-final/09-ARCHITECTURE-AND-JOURNEY.md
 */

export type ActorRole = 'desk' | 'nurse' | 'clinician' | 'quality';

export type ObligationActor = { id: string; role: ActorRole };

export type ObligationAttempt = {
  outcome: CommunicationOutcome;
  /** ISO instant, server-authored at the boundary. */
  at: string;
};

/**
 * One phase, not four booleans. Every combination that cannot happen is absent
 * from the union, so a caller cannot construct "informed but never seen".
 */
export type ObligationPhase =
  | { kind: 'received' }
  | { kind: 'accepted'; acceptedBy: string }
  | { kind: 'assigned'; clinicianId: string }
  | { kind: 'seen'; clinicianId: string; seenBy: string }
  | { kind: 'attempted'; clinicianId: string; seenBy: string; attempts: ObligationAttempt[] }
  | {
      kind: 'informed';
      clinicianId: string;
      seenBy: string;
      attempts: ObligationAttempt[];
      informedBy: string;
      readBack: boolean;
      nextStep: NextStep | null;
    }
  | { kind: 'closed'; clinicianId: string; disposition: Disposition; closedBy: string }
  | {
      kind: 'closed_unreachable';
      clinicianId: string;
      disposition: Disposition;
      closedBy: string;
      attempts: ObligationAttempt[];
    };

export type ObligationAction =
  | { type: 'accept'; actor: ObligationActor }
  | { type: 'assign'; actor: ObligationActor; clinicianId: string }
  | {
      type: 'see';
      actor: ObligationActor;
      valueEcho: string;
      expectedValue: string;
      flagDispute?: { flag: ResultFlag; reason: string };
    }
  | { type: 'attempt'; actor: ObligationActor; outcome: CommunicationOutcome; at: string }
  | {
      type: 'inform';
      actor: ObligationActor;
      outcome: CommunicationOutcome;
      at: string;
      readBack: boolean;
      nextStep: NextStep | null;
    }
  | { type: 'close'; actor: ObligationActor; disposition: Disposition }
  | { type: 'close_unreachable'; actor: ObligationActor; disposition: Disposition }
  | { type: 'reassign'; actor: ObligationActor; clinicianId: string };

export type ObligationErrorCode =
  | 'wrong_role'
  | 'wrong_phase'
  | 'value_mismatch'
  | 'readback_required'
  | 'attempts_insufficient'
  | 'not_assigned_clinician'
  | 'use_attempt_outcome'
  | 'use_inform_outcome';

export type ObligationResult =
  | { ok: true; phase: ObligationPhase; changed: boolean }
  | { ok: false; code: ObligationErrorCode; message: string };

export type ObligationContext = {
  labFlag: ResultFlag;
};

const INFORMED_OUTCOMES: ReadonlySet<CommunicationOutcome> = new Set([
  'informed_patient',
  'informed_caregiver',
  'informed_treating_doctor',
]);

export function isInformedOutcome(outcome: CommunicationOutcome): boolean {
  return INFORMED_OUTCOMES.has(outcome);
}

export function isOpen(phase: ObligationPhase): boolean {
  return phase.kind !== 'closed' && phase.kind !== 'closed_unreachable';
}

export function isTerminal(phase: ObligationPhase): boolean {
  return !isOpen(phase);
}

function fail(code: ObligationErrorCode, message: string): ObligationResult {
  return { ok: false, code, message };
}

function ok(phase: ObligationPhase, changed = true): ObligationResult {
  return { ok: true, phase, changed };
}

/**
 * Apply one intent. Repeated intents by the same actor converge: a second
 * `accept` from the same desk user returns `changed: false` rather than a
 * contradictory state. Every other repeat is a typed refusal, not a silent write.
 */
export function applyAction(
  phase: ObligationPhase,
  action: ObligationAction,
  context: ObligationContext,
): ObligationResult {
  switch (action.type) {
    case 'accept': {
      if (action.actor.role !== 'desk' && action.actor.role !== 'nurse') {
        return fail('wrong_role', 'Only the desk or a nurse can accept custody.');
      }
      if (phase.kind === 'accepted' && phase.acceptedBy === action.actor.id) {
        return ok(phase, false);
      }
      if (phase.kind !== 'received') {
        return fail('wrong_phase', 'Custody can only be accepted once, from received.');
      }
      return ok({ kind: 'accepted', acceptedBy: action.actor.id });
    }

    case 'assign': {
      if (action.actor.role !== 'desk') {
        return fail('wrong_role', 'Only the desk can assign a clinician.');
      }
      if (phase.kind !== 'accepted') {
        return fail('wrong_phase', 'A clinician can only be assigned after custody is accepted.');
      }
      if (action.clinicianId.trim() === '') {
        return fail('not_assigned_clinician', 'A clinician id is required.');
      }
      return ok({ kind: 'assigned', clinicianId: action.clinicianId });
    }

    case 'see': {
      if (action.actor.role !== 'clinician') {
        return fail('wrong_role', 'Only a clinician can record clinical review.');
      }
      if (phase.kind === 'seen' && phase.seenBy === action.actor.id) {
        return ok(phase, false);
      }
      if (phase.kind !== 'assigned') {
        return fail('wrong_phase', 'The result must be assigned before it can be seen.');
      }
      if (phase.clinicianId !== action.actor.id) {
        return fail('not_assigned_clinician', 'Only the assigned clinician can see this result.');
      }
      if (!valuesMatch(action.expectedValue, action.valueEcho) && !action.flagDispute) {
        return fail(
          'value_mismatch',
          'The echoed value does not match the report. Correct it or record a dispute reason.',
        );
      }
      return ok({ kind: 'seen', clinicianId: phase.clinicianId, seenBy: action.actor.id });
    }

    case 'attempt': {
      if (action.actor.role !== 'nurse') {
        return fail('wrong_role', 'Only a nurse can record a contact attempt.');
      }
      if (isInformedOutcome(action.outcome)) {
        return fail('use_attempt_outcome', 'Use the informed action for a successful contact.');
      }
      if (phase.kind !== 'seen' && phase.kind !== 'attempted') {
        return fail('wrong_phase', 'A contact attempt follows clinical review.');
      }
      const attempts = [...(phase.kind === 'attempted' ? phase.attempts : []), {
        outcome: action.outcome,
        at: action.at,
      }];
      return ok({
        kind: 'attempted',
        clinicianId: phase.clinicianId,
        seenBy: phase.seenBy,
        attempts,
      });
    }

    case 'inform': {
      if (action.actor.role !== 'nurse') {
        return fail('wrong_role', 'Only a nurse can record the patient communication.');
      }
      if (!isInformedOutcome(action.outcome)) {
        return fail('use_inform_outcome', 'Use the attempt action for an unsuccessful contact.');
      }
      if (phase.kind !== 'seen' && phase.kind !== 'attempted') {
        return fail('wrong_phase', 'The clinician must see the result before the patient is told.');
      }
      if (context.labFlag === 'critical' && !action.readBack) {
        return fail('readback_required', 'A critical result needs a recorded read-back.');
      }
      const attempts = [...(phase.kind === 'attempted' ? phase.attempts : []), {
        outcome: action.outcome,
        at: action.at,
      }];
      return ok({
        kind: 'informed',
        clinicianId: phase.clinicianId,
        seenBy: phase.seenBy,
        attempts,
        informedBy: action.actor.id,
        readBack: action.readBack,
        nextStep: action.nextStep,
      });
    }

    case 'close': {
      if (action.actor.role !== 'nurse' && action.actor.role !== 'quality') {
        return fail('wrong_role', 'Only a nurse or the quality head can close.');
      }
      if (phase.kind !== 'informed') {
        return fail('wrong_phase', 'Only an informed patient can be closed as a completed loop.');
      }
      return ok({
        kind: 'closed',
        clinicianId: phase.clinicianId,
        disposition: action.disposition,
        closedBy: action.actor.id,
      });
    }

    case 'close_unreachable': {
      if (action.actor.role !== 'nurse' && action.actor.role !== 'quality') {
        return fail('wrong_role', 'Only a nurse or the quality head can close an exception.');
      }
      if (phase.kind !== 'attempted') {
        return fail('wrong_phase', 'An exception close follows at least two recorded attempts.');
      }
      if (attemptSpanHours(phase.attempts) < UNREACHABLE_MIN_SPAN_HOURS) {
        return fail(
          'attempts_insufficient',
          'Two attempts at least 20 hours apart are required before closing as unreachable.',
        );
      }
      return ok({
        kind: 'closed_unreachable',
        clinicianId: phase.clinicianId,
        disposition: action.disposition,
        closedBy: action.actor.id,
        attempts: phase.attempts,
      });
    }

    case 'reassign': {
      if (action.actor.role !== 'desk') {
        return fail('wrong_role', 'Only the desk can reassign a clinician.');
      }
      if (
        phase.kind !== 'assigned' &&
        phase.kind !== 'seen' &&
        phase.kind !== 'attempted'
      ) {
        return fail('wrong_phase', 'Only an open, assigned result can be reassigned.');
      }
      if (action.clinicianId.trim() === '') {
        return fail('not_assigned_clinician', 'A clinician id is required.');
      }
      if (phase.clinicianId === action.clinicianId) {
        return ok(phase, false);
      }
      if (phase.kind === 'seen' || phase.kind === 'attempted') {
        return ok({ ...phase, clinicianId: action.clinicianId });
      }
      return ok({ kind: 'assigned', clinicianId: action.clinicianId });
    }
  }
}

/**
 * The legacy six-state status is a projection of the phase, never a second
 * truth. `patientMatched` comes from the report-to-patient binding, which is
 * the one piece of state the phase does not carry.
 */
export function deriveStatus(phase: ObligationPhase, patientMatched: boolean): ResultStatus {
  switch (phase.kind) {
    case 'received':
    case 'accepted':
      return patientMatched ? 'matched' : 'unmatched';
    case 'assigned':
      return 'owned';
    case 'seen':
    case 'attempted':
      return 'acknowledged';
    case 'informed':
      return 'patient_informed';
    case 'closed':
    case 'closed_unreachable':
      return 'closed';
  }
}

/** Hours between the first and the last recorded attempt. */
export const UNREACHABLE_MIN_SPAN_HOURS = 20;

export function attemptSpanHours(attempts: readonly ObligationAttempt[]): number {
  if (attempts.length < 2) return 0;
  const times = attempts.map((attempt) => Date.parse(attempt.at));
  return (Math.max(...times) - Math.min(...times)) / 3_600_000;
}

function normalizeValue(raw: string): string {
  return raw
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/\s*(mg\/dl|mmol\/l|g\/dl|meq\/l|iu\/l|mg\/g|ml\/min\/1\.73m2|%)\s*$/i, '')
    .trim();
}

/**
 * The value echo exists to catch a transcription error, not to be a parser.
 * Numeric equality tolerates 6.20 vs 6.2; everything else must match the
 * printed text after units and spacing are normalised.
 */
export function valuesMatch(expected: string, echoed: string): boolean {
  const left = normalizeValue(expected);
  const right = normalizeValue(echoed);
  if (left === '' || right === '') return false;
  if (left === right) return true;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return Math.abs(leftNumber - rightNumber) < 1e-9;
  }
  return false;
}

export type ClockStage = 'custody' | 'review' | 'communication';

const SLA_MINUTES: Record<ClockStage, Record<ResultFlag, number>> = {
  custody: { critical: 15, abnormal: 240, normal: 240, unknown: 240 },
  review: { critical: 60, abnormal: 1440, normal: 1440, unknown: 1440 },
  communication: { critical: 60, abnormal: 1440, normal: 1440, unknown: 1440 },
};

export function stageDueAt(stage: ClockStage, from: string, flag: ResultFlag): string {
  const start = Date.parse(from);
  if (!Number.isFinite(start)) {
    throw new Error(`Invalid clock start: ${from}`);
  }
  return new Date(start + SLA_MINUTES[stage][flag] * 60_000).toISOString();
}

export type ClockSet = {
  custodyDueAt: string | null;
  reviewDueAt: string | null;
  communicationDueAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number;
};

export const EMPTY_CLOCKS: ClockSet = {
  custodyDueAt: null,
  reviewDueAt: null,
  communicationDueAt: null,
  pausedAt: null,
  pausedSeconds: 0,
};

export function pauseClocks(clocks: ClockSet, at: string): ClockSet {
  if (clocks.pausedAt !== null) return clocks;
  return { ...clocks, pausedAt: at };
}

/**
 * Resuming shifts every open deadline by the paused duration. Running resume
 * twice is a no-op, so a retried command cannot inflate the clock.
 */
export function resumeClocks(clocks: ClockSet, at: string): ClockSet {
  if (clocks.pausedAt === null) return clocks;
  const elapsedMs = Math.max(0, Date.parse(at) - Date.parse(clocks.pausedAt));
  const shift = (value: string | null): string | null =>
    value === null ? null : new Date(Date.parse(value) + elapsedMs).toISOString();
  return {
    custodyDueAt: shift(clocks.custodyDueAt),
    reviewDueAt: shift(clocks.reviewDueAt),
    communicationDueAt: shift(clocks.communicationDueAt),
    pausedAt: null,
    pausedSeconds: clocks.pausedSeconds + Math.floor(elapsedMs / 1000),
  };
}

/** The next deadline, or null while paused. Lists order by this value. */
export function breachAt(clocks: ClockSet): string | null {
  if (clocks.pausedAt !== null) return null;
  const due = [clocks.custodyDueAt, clocks.reviewDueAt, clocks.communicationDueAt]
    .filter((value): value is string => value !== null)
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  if (due.length === 0) return null;
  return new Date(Math.min(...due)).toISOString();
}

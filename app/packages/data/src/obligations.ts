import type {
  CloseObligationInput,
  ObligationRow,
  ObligationView,
  RecordAttemptInput,
  RecordInformedInput,
  SeeResultInput,
  TerminalState,
} from '@glucoflow/contracts';
import type { DbClient } from './pool';

/** Reads and commands for the role-separated obligation lifecycle. */

const VIEW_CALL: Record<ObligationView, string> = {
  line: 'sutra.obligation_line($1, $2)',
  calls: 'sutra.obligation_calls($1)',
  intake: 'sutra.obligation_intake($1)',
  register: 'sutra.obligation_register($1, $2, $3)',
  exceptions: 'sutra.obligation_exceptions($1)',
};

const ROW_PROJECTION = `
  r.*,
  sutra.obligation_breach(r) as breach_at,
  (select count(*)::int from sutra.result_attempts a where a.result_id = r.id) as attempt_count,
  (select max(a.attempted_at) from sutra.result_attempts a where a.result_id = r.id) as last_attempt_at,
  u.display_name as owner_name
`;

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function mapRow(row: Record<string, unknown>): ObligationRow {
  return {
    id: String(row.id),
    receiptCode: String(row.receipt_code),
    patientId: text(row.patient_id),
    patientName: text(row.patient_name_raw),
    patientIdentifier: text(row.patient_identifier_raw),
    labName: text(row.lab_name),
    sourceChannel: String(row.source_channel),
    testName: String(row.test_name),
    valueText: String(row.value_text),
    unit: text(row.unit),
    labFlag: row.lab_flag as ObligationRow['labFlag'],
    clinicianFlag: (row.clinician_flag as ObligationRow['clinicianFlag']) ?? null,
    flagDisputed: Boolean(row.flag_disputed),
    disputeReason: text(row.dispute_reason),
    status: row.status as ObligationRow['status'],
    custody: row.custody_state as ObligationRow['custody'],
    review: row.review_state as ObligationRow['review'],
    communication: row.communication_state as ObligationRow['communication'],
    terminal: (row.terminal_state as TerminalState | null) ?? null,
    ownerId: text(row.owner_id),
    ownerName: text(row.owner_name),
    receivedAt: iso(row.report_received_at) ?? '',
    dueAt: iso(row.due_at),
    breachAt: iso(row.breach_at),
    pausedAt: iso(row.paused_at),
    pauseReason: text(row.pause_reason),
    pausedSeconds: Number(row.paused_seconds ?? 0),
    attemptCount: Number(row.attempt_count ?? 0),
    lastAttemptAt: iso(row.last_attempt_at),
    informedAt: iso(row.informed_at),
    closedAt: iso(row.closed_at),
    disposition: text(row.disposition),
  };
}

export async function listObligations(
  client: DbClient,
  view: ObligationView,
  clinicId: string,
  actorId: string | null,
  from?: string,
  to?: string,
): Promise<ObligationRow[]> {
  const params: unknown[] =
    view === 'line'
      ? [clinicId, actorId]
      : view === 'register'
        ? [clinicId, from ?? null, to ?? null]
        : [clinicId];
  const result = await client.query<Record<string, unknown>>(
    `select ${ROW_PROJECTION}
       from ${VIEW_CALL[view]} r
       left join sutra.app_users u on u.id = r.owner_id`,
    params,
  );
  return result.rows.map(mapRow);
}

export async function getObligation(
  client: DbClient,
  resultId: string,
): Promise<ObligationRow | null> {
  const result = await client.query<Record<string, unknown>>(
    `select ${ROW_PROJECTION}
       from sutra.results r
       left join sutra.app_users u on u.id = r.owner_id
      where r.id = $1`,
    [resultId],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function acceptCustody(client: DbClient, resultId: string): Promise<void> {
  await client.query('select sutra.accept_custody($1)', [resultId]);
}

export async function assignClinician(
  client: DbClient,
  resultId: string,
  clinicianId: string,
): Promise<void> {
  await client.query('select sutra.assign_clinician($1, $2)', [resultId, clinicianId]);
}

export async function seeResult(
  client: DbClient,
  resultId: string,
  input: SeeResultInput,
): Promise<void> {
  await client.query('select sutra.see_result($1, $2, $3, $4)', [
    resultId,
    input.valueEcho,
    input.flag ?? null,
    input.disputeReason ?? null,
  ]);
}

export async function recordAttempt(
  client: DbClient,
  resultId: string,
  input: RecordAttemptInput,
): Promise<void> {
  await client.query('select sutra.record_attempt($1, $2, $3, $4)', [
    resultId,
    input.channel,
    input.outcome,
    input.note ?? null,
  ]);
}

export async function recordInformed(
  client: DbClient,
  resultId: string,
  input: RecordInformedInput,
): Promise<void> {
  await client.query('select sutra.record_informed($1, $2, $3, $4, $5, $6, $7, $8)', [
    resultId,
    input.channel,
    input.outcome,
    input.readBack,
    input.teachBack,
    input.nextStep ?? null,
    input.nextStepDueAt ?? null,
    input.note ?? null,
  ]);
}

export async function closeObligation(
  client: DbClient,
  resultId: string,
  input: CloseObligationInput,
): Promise<void> {
  await client.query('select sutra.close_result_v2($1, $2, $3)', [
    resultId,
    input.disposition,
    input.note ?? null,
  ]);
}

export async function closeObligationUnreachable(
  client: DbClient,
  resultId: string,
  input: CloseObligationInput,
): Promise<void> {
  await client.query('select sutra.close_result_unreachable($1, $2, $3)', [
    resultId,
    input.disposition,
    input.note ?? null,
  ]);
}

export async function pauseObligation(
  client: DbClient,
  resultId: string,
  reason: string,
): Promise<void> {
  await client.query('select sutra.pause_result($1, $2)', [resultId, reason]);
}

export async function resumeObligation(client: DbClient, resultId: string): Promise<void> {
  await client.query('select sutra.resume_result($1)', [resultId]);
}

export async function reassignObligation(
  client: DbClient,
  resultId: string,
  clinicianId: string,
): Promise<void> {
  await client.query('select sutra.reassign_result($1, $2)', [resultId, clinicianId]);
}

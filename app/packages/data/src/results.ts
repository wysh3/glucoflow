import type {
  AcknowledgeResultInput,
  CloseResultInput,
  CreateResultInput,
  InformedResultInput,
  ResultDto,
  ResultEventDto,
  ResultFilter,
  ResultListDto,
  ResultMatchCandidateDto,
  ResultProofDto,
  ResultRowDto,
  ResultStatsDto,
  PublicReceiptStage,
} from '@glucoflow/contracts';
import { RESULT_STATUS_LABELS } from '@glucoflow/contracts';
import type { DbClient } from './pool';

/** Reads and commands for the administrative result-closure ledger. */

type ResultRow = {
  result_id: string;
  receipt_code: string;
  clinic_id: string;
  patient_id: string | null;
  patient_name: string | null;
  patient_identifier: string | null;
  document_id: string | null;
  document_version_id: string | null;
  filename: string | null;
  source_channel: ResultDto['sourceChannel'];
  lab_name: string | null;
  report_received_at: string;
  lab_released_at: string | null;
  lab_hold: boolean;
  patient_name_raw: string;
  patient_identifier_raw: string | null;
  test_name: string;
  value_text: string;
  unit: string | null;
  lab_flag: ResultDto['labFlag'];
  result_kind: ResultDto['resultKind'];
  monitoring_protocol: string | null;
  monitoring_started_at: string | null;
  monitoring_due_at: string | null;
  status: ResultDto['status'];
  owner_id: string | null;
  owner_name: string | null;
  due_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  acknowledged_value_text: string | null;
  acknowledged_flag: ResultDto['labFlag'] | null;
  lab_notifier_name: string | null;
  lab_notifier_role: string | null;
  lab_read_back_value_text: string | null;
  lab_read_back_at: string | null;
  informed_at: string | null;
  informed_by_name: string | null;
  informed_channel: ResultDto['informedChannel'];
  communication_outcome: ResultDto['communicationOutcome'];
  communication_recipient: string | null;
  communication_relation: string | null;
  communication_language: string | null;
  next_step: ResultDto['nextStep'];
  next_step_due_at: string | null;
  next_step_completed_at: string | null;
  teach_back_confirmed: boolean;
  read_back_confirmed: boolean;
  read_back_at: string | null;
  disposition: ResultDto['disposition'];
  closed_without_informed: boolean;
  escalation_level: number;
  last_escalated_at: string | null;
  closed_at: string | null;
  created_at: string;
};

type EventRow = {
  event_id: string;
  event_type: ResultEventDto['eventType'];
  actor_name: string | null;
  from_status: ResultEventDto['fromStatus'];
  to_status: ResultEventDto['toStatus'];
  note: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

type AttemptRow = {
  attempt_id: string;
  channel: Exclude<ResultDto['informedChannel'], null>;
  outcome: Exclude<ResultDto['communicationOutcome'], null>;
  recipient: string | null;
  relation: string | null;
  language: string | null;
  note: string | null;
  attempted_at: string;
  actor_name: string | null;
};

type ClosureStats = {
  eligible?: number;
  closedWithin7Days?: number;
  openLastMile?: number;
  informed?: number;
  teachBackConfirmed?: number;
  nextStepCompleted?: number;
  unreachable?: number;
  medianContactMinutes?: number | null;
  closureRate7d?: number | null;
  teachBackShare?: number | null;
  nextStepCompletionShare?: number | null;
  monitoringEligible?: number;
  monitoringClosedWithinWindow?: number;
  monitoringOpen?: number;
  monitoringClosureRate?: number | null;
};

const RESULT_SELECT = `
  select
    r.id as result_id,
    r.receipt_code,
    r.clinic_id,
    r.patient_id,
    p.display_name as patient_name,
    p.clinic_identifier,
    r.document_id,
    r.document_version_id,
    dv.source_manifest_json -> 'items' -> 0 ->> 'filename' as filename,
    r.source_channel,
    r.lab_name,
    r.report_received_at,
    r.lab_released_at,
    r.lab_hold,
    r.patient_name_raw,
    r.patient_identifier_raw,
    r.test_name,
    r.value_text,
    r.unit,
    r.lab_flag,
    r.result_kind,
    r.monitoring_protocol,
    r.monitoring_started_at,
    r.monitoring_due_at,
    r.status,
    r.owner_id,
    owner.display_name as owner_name,
    r.due_at,
    r.acknowledged_at,
    ack.display_name as acknowledged_by_name,
    r.acknowledged_value_text,
    r.acknowledged_flag,
    r.lab_notifier_name,
    r.lab_notifier_role,
    r.lab_read_back_value_text,
    r.lab_read_back_at,
    r.informed_at,
    informed.display_name as informed_by_name,
    r.informed_channel,
    r.communication_outcome,
    r.communication_recipient,
    r.communication_relation,
    r.communication_language,
    r.next_step,
    r.next_step_due_at,
    r.next_step_completed_at,
    r.teach_back_confirmed,
    r.read_back_confirmed,
    r.read_back_at,
    r.disposition,
    r.closed_without_informed,
    r.escalation_level,
    r.last_escalated_at,
    r.closed_at,
    r.created_at
  from sutra.results r
  left join sutra.patients p on p.id = r.patient_id
  left join sutra.document_versions dv on dv.id = r.document_version_id
  left join sutra.app_users owner on owner.id = r.owner_id
  left join sutra.app_users ack on ack.id = r.acknowledged_by
  left join sutra.app_users informed on informed.id = r.informed_by`;

function iso(value: string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function mapRow(row: ResultRow): ResultRowDto {
  return {
    resultId: row.result_id,
    receiptCode: row.receipt_code,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientIdentifier: row.patient_identifier,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    filename: row.filename,
    sourceChannel: row.source_channel,
    labName: row.lab_name,
    reportReceivedAt: new Date(row.report_received_at).toISOString(),
    labReleasedAt: iso(row.lab_released_at),
    labHold: row.lab_hold,
    patientNameRaw: row.patient_name_raw,
    patientIdentifierRaw: row.patient_identifier_raw,
    testName: row.test_name,
    valueText: row.value_text,
    unit: row.unit,
    labFlag: row.lab_flag,
    resultKind: row.result_kind,
    monitoringProtocol: row.monitoring_protocol,
    monitoringStartedAt: iso(row.monitoring_started_at),
    monitoringDueAt: iso(row.monitoring_due_at),
    status: row.status,
    statusLabel: RESULT_STATUS_LABELS[row.status],
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    dueAt: iso(row.due_at),
    acknowledgedAt: iso(row.acknowledged_at),
    acknowledgedByName: row.acknowledged_by_name,
    acknowledgedValueText: row.acknowledged_value_text,
    acknowledgedFlag: row.acknowledged_flag,
    labNotifierName: row.lab_notifier_name,
    labNotifierRole: row.lab_notifier_role,
    labReadBackValueText: row.lab_read_back_value_text,
    labReadBackAt: iso(row.lab_read_back_at),
    informedAt: iso(row.informed_at),
    informedByName: row.informed_by_name,
    informedChannel: row.informed_channel,
    communicationOutcome: row.communication_outcome,
    communicationRecipient: row.communication_recipient,
    communicationRelation: row.communication_relation,
    communicationLanguage: row.communication_language,
    nextStep: row.next_step,
    nextStepDueAt: iso(row.next_step_due_at),
    nextStepCompletedAt: iso(row.next_step_completed_at),
    teachBackConfirmed: row.teach_back_confirmed,
    readBackConfirmed: row.read_back_confirmed,
    readBackAt: iso(row.read_back_at),
    disposition: row.disposition,
    closedWithoutInformed: row.closed_without_informed,
    escalationLevel: row.escalation_level,
    lastEscalatedAt: iso(row.last_escalated_at),
    closedAt: iso(row.closed_at),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function filterSql(filter: ResultFilter): string {
  switch (filter) {
    case 'critical':
      return "r.lab_flag = 'critical' and r.status not in ('patient_informed', 'closed')";
    case 'overdue':
      return "r.due_at < now() and r.status in ('unmatched', 'matched', 'owned', 'acknowledged')";
    case 'unowned':
      return "r.owner_id is null and r.status <> 'closed'";
    case 'monitoring':
      return "r.result_kind = 'monitoring' and r.status <> 'closed'";
    case 'closed':
      return "r.status = 'closed'";
    case 'all':
      return 'true';
    case 'open':
    default:
      return "r.status <> 'closed'";
  }
}

export async function listResults(
  client: DbClient,
  clinicId: string,
  filter: ResultFilter,
  limit: number,
): Promise<ResultListDto> {
  const where = filterSql(filter);
  const [rows, total] = await Promise.all([
    client.query<ResultRow>(
      `${RESULT_SELECT}
       where r.clinic_id = $1 and (${where})
       order by case when r.lab_flag = 'critical' and r.status not in ('patient_informed', 'closed') then 0 else 1 end,
                r.due_at asc nulls last, r.report_received_at asc
       limit $2`,
      [clinicId, limit],
    ),
    client.query<{ total: string }>(
      `select count(*)::text as total from sutra.results r where r.clinic_id = $1 and (${where})`,
      [clinicId],
    ),
  ]);
  return { items: rows.rows.map(mapRow), total: Number(total.rows[0]?.total ?? 0) };
}

export async function getResult(
  client: DbClient,
  resultId: string,
): Promise<ResultDto | null> {
  const [result, events, attempts] = await Promise.all([
    client.query<ResultRow>(`${RESULT_SELECT} where r.id = $1`, [resultId]),
    client.query<EventRow>(
      `select e.id as event_id, e.event_type, u.display_name as actor_name,
              e.from_status, e.to_status, e.note, e.detail, e.created_at
         from sutra.result_events e
         left join sutra.app_users u on u.id = e.actor_id
        where e.result_id = $1
        order by e.created_at asc, e.id asc`,
      [resultId],
    ),
    client.query<AttemptRow>(
      `select a.id as attempt_id, a.channel, a.outcome, a.recipient, a.relation,
              a.language, a.note, a.attempted_at, u.display_name as actor_name
         from sutra.result_attempts a
         left join sutra.app_users u on u.id = a.actor_id
        where a.result_id = $1
        order by a.attempted_at asc, a.created_at asc`,
      [resultId],
    ),
  ]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...mapRow(row),
    events: events.rows.map((event) => ({
      eventId: event.event_id,
      eventType: event.event_type,
      actorName: event.actor_name,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      note: event.note,
      detail: event.detail ?? {},
      createdAt: new Date(event.created_at).toISOString(),
    })),
    attempts: attempts.rows.map((attempt) => ({
      attemptId: attempt.attempt_id,
      channel: attempt.channel,
      outcome: attempt.outcome,
      recipient: attempt.recipient,
      relation: attempt.relation,
      language: attempt.language,
      note: attempt.note,
      attemptedAt: new Date(attempt.attempted_at).toISOString(),
      actorName: attempt.actor_name,
    })),
  };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function resultStats(client: DbClient, clinicId: string): Promise<ResultStatsDto> {
  const [result, closure] = await Promise.all([
    client.query<{
      open: string;
      unowned: string;
      overdue: string;
      critical_open: string;
      acknowledged: string;
      patient_informed: string;
      closed: string;
      median_ack: string | null;
      informed_share: string | null;
    }>(
      `select
         count(*) filter (where status <> 'closed')::text as open,
         count(*) filter (where owner_id is null and status <> 'closed')::text as unowned,
         count(*) filter (where due_at < now() and status in ('unmatched', 'matched', 'owned', 'acknowledged'))::text as overdue,
         count(*) filter (where lab_flag = 'critical' and status not in ('patient_informed', 'closed'))::text as critical_open,
         count(*) filter (where status in ('acknowledged', 'patient_informed', 'closed'))::text as acknowledged,
         count(*) filter (where status in ('patient_informed', 'closed'))::text as patient_informed,
         count(*) filter (where status = 'closed')::text as closed,
         round(percentile_cont(0.5) within group (
           order by extract(epoch from (acknowledged_at - coalesce(lab_released_at, report_received_at))) / 60
         ) filter (where acknowledged_at is not null))::text as median_ack,
         round(
           count(*) filter (where status in ('patient_informed', 'closed'))::numeric
           / nullif(count(*) filter (where status in ('acknowledged', 'patient_informed', 'closed')), 0),
           3
         )::text as informed_share
       from sutra.results
       where clinic_id = $1`,
      [clinicId],
    ),
    client.query<{ stats: ClosureStats }>(
      'select sutra.result_closure_stats($1) as stats',
      [clinicId],
    ),
  ]);
  const row = result.rows[0];
  const c = closure.rows[0]?.stats ?? {};
  return {
    open: Number(row?.open ?? 0),
    unowned: Number(row?.unowned ?? 0),
    overdue: Number(row?.overdue ?? 0),
    criticalOpen: Number(row?.critical_open ?? 0),
    acknowledged: Number(row?.acknowledged ?? 0),
    patientInformed: Number(row?.patient_informed ?? 0),
    closed: Number(row?.closed ?? 0),
    medianAcknowledgeMinutes: row?.median_ack ? Number(row.median_ack) : null,
    informedShare: row?.informed_share ? Number(row.informed_share) : null,
    eligible: Number(c.eligible ?? 0),
    closedWithin7Days: Number(c.closedWithin7Days ?? 0),
    openLastMile: Number(c.openLastMile ?? 0),
    informed: Number(c.informed ?? 0),
    teachBackConfirmed: Number(c.teachBackConfirmed ?? 0),
    nextStepCompleted: Number(c.nextStepCompleted ?? 0),
    unreachable: Number(c.unreachable ?? 0),
    medianContactMinutes: numberOrNull(c.medianContactMinutes),
    closureRate7d: numberOrNull(c.closureRate7d),
    teachBackShare: numberOrNull(c.teachBackShare),
    nextStepCompletionShare: numberOrNull(c.nextStepCompletionShare),
    monitoringEligible: Number(c.monitoringEligible ?? 0),
    monitoringClosedWithinWindow: Number(c.monitoringClosedWithinWindow ?? 0),
    monitoringOpen: Number(c.monitoringOpen ?? 0),
    monitoringClosureRate: numberOrNull(c.monitoringClosureRate),
  };
}

export async function resultExport(client: DbClient, clinicId: string): Promise<ResultRowDto[]> {
  const rows = await client.query<ResultRow>(
    `${RESULT_SELECT} where r.clinic_id = $1 order by r.report_received_at asc`,
    [clinicId],
  );
  return rows.rows.map(mapRow);
}

export async function matchResult(
  client: DbClient,
  resultId: string,
  patientId: string,
): Promise<void> {
  await client.query('select sutra.match_result($1, $2)', [resultId, patientId]);
}

export async function assignResult(
  client: DbClient,
  resultId: string,
  ownerId?: string,
  dueAt?: string,
): Promise<void> {
  await client.query('select sutra.assign_result($1, $2, $3)', [
    resultId,
    ownerId ?? null,
    dueAt ?? null,
  ]);
}

export async function acknowledgeResult(
  client: DbClient,
  resultId: string,
  input: AcknowledgeResultInput,
): Promise<void> {
  await client.query(
    'select sutra.acknowledge_result($1, $2, $3, $4, $5, $6, $7)',
    [
      resultId,
      input.note ?? null,
      input.valueText,
      input.flag,
      input.notifierName ?? null,
      input.notifierRole ?? null,
      input.readBackValue ?? null,
    ],
  );
}

export async function recordResultCommunication(
  client: DbClient,
  resultId: string,
  input: InformedResultInput,
): Promise<void> {
  await client.query(
    'select sutra.record_result_communication($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [
      resultId,
      input.channel,
      input.outcome,
      input.recipient ?? null,
      input.relation ?? null,
      input.language ?? null,
      input.note ?? null,
      input.attemptedAt ?? null,
      input.nextStep ?? null,
      input.teachBack,
      input.nextStepDueAt ?? null,
    ],
  );
}

export async function markNextStepCompleted(
  client: DbClient,
  resultId: string,
  note: string,
  completedAt?: string,
): Promise<void> {
  await client.query('select sutra.mark_next_step_completed($1, $2, $3)', [
    resultId,
    note,
    completedAt ?? null,
  ]);
}

export async function escalateResult(
  client: DbClient,
  resultId: string,
  reason: string,
): Promise<void> {
  await client.query('select sutra.escalate_result($1, $2)', [resultId, reason]);
}

export async function escalateOverdueResults(
  client: DbClient,
  clinicId: string,
): Promise<number> {
  const result = await client.query<{ escalated: number }>(
    'select sutra.escalate_overdue_results($1) as escalated',
    [clinicId],
  );
  return Number(result.rows[0]?.escalated ?? 0);
}

export async function closeResult(
  client: DbClient,
  resultId: string,
  input: CloseResultInput,
): Promise<void> {
  await client.query('select sutra.close_result($1, $2, $3)', [
    resultId,
    input.note,
    input.disposition,
  ]);
}

export async function createResult(
  client: DbClient,
  clinicId: string,
  input: CreateResultInput,
): Promise<string> {
  const result = await client.query<{ create_result: string }>(
    `select sutra.create_result_v2(
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
     ) as create_result`,
    [
      clinicId,
      input.patientId ?? null,
      input.documentId ?? null,
      input.externalRef ?? null,
      input.sourceChannel,
      input.labName ?? null,
      input.reportReceivedAt ?? null,
      input.labReleasedAt ?? null,
      input.patientNameRaw,
      input.patientIdentifierRaw ?? null,
      input.testName,
      input.valueText,
      input.unit ?? null,
      input.labFlag,
      input.labNotifierName ?? null,
      input.labNotifierRole ?? null,
      input.labHold,
      input.resultKind,
      input.monitoringProtocol ?? null,
      input.monitoringStartedAt ?? null,
      input.monitoringDueAt ?? null,
    ],
  );
  return result.rows[0]!.create_result;
}

/** A small deterministic entity-resolution score; no model is required. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaroWinkler(left: string, right: string): number {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
}

function valuesMatch(expected: string, actual: string | null): boolean {
  if (!actual) return false;
  const left = expected.trim().toLowerCase();
  const right = actual.trim().toLowerCase();
  if (left === right) return true;
  if (/^\d+(\.\d+)?$/.test(left) && /^\d+(\.\d+)?$/.test(right)) {
    return Number(left) === Number(right);
  }
  return false;
}

export async function resultMatchCandidates(
  client: DbClient,
  clinicId: string,
  resultId: string,
): Promise<ResultMatchCandidateDto[]> {
  const result = await client.query<{
    patient_name_raw: string;
    patient_identifier_raw: string | null;
  }>(
    'select patient_name_raw, patient_identifier_raw from sutra.results where id = $1 and clinic_id = $2',
    [resultId, clinicId],
  );
  const raw = result.rows[0];
  if (!raw) return [];
  const patients = await client.query<{
    patient_id: string;
    display_name: string;
    clinic_identifier: string;
  }>(
    `select id as patient_id, display_name, clinic_identifier
       from sutra.patients
      where clinic_id = $1
      order by display_name asc
      limit 200`,
    [clinicId],
  );
  const rawId = (raw.patient_identifier_raw ?? '').trim().toLowerCase();
  const scored = patients.rows.map((patient) => {
    const candidateId = patient.clinic_identifier.trim().toLowerCase();
    const idExact = Boolean(rawId) && rawId === candidateId;
    const nameScore = jaroWinkler(raw.patient_name_raw, patient.display_name);
    const score = rawId
      ? Math.min(1, (idExact ? 0.7 : 0) + nameScore * 0.3)
      : Math.min(0.95, nameScore * 0.85 + 0.05);
    const reasons: string[] = [];
    if (idExact) reasons.push('Clinic ID matches exactly');
    if (nameScore >= 0.88) reasons.push(`Name similarity ${Math.round(nameScore * 100)}%`);
    if (!idExact && nameScore >= 0.92) reasons.push('Same name, different clinic ID');
    if (!reasons.length) reasons.push(`Name similarity ${Math.round(nameScore * 100)}%`);
    return {
      patientId: patient.patient_id,
      displayName: patient.display_name,
      clinicIdentifier: patient.clinic_identifier,
      score: Math.round(score * 100) / 100,
      reasons,
      ambiguous: false,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 5);

  const top = scored[0]?.score ?? 0;
  const second = scored[1]?.score ?? 0;
  const ambiguous = top < 0.9 || (scored.length > 1 && top - second < 0.1);
  const exactTop = top >= 0.9 && Boolean(scored[0]?.reasons.includes('Clinic ID matches exactly'));
  return scored.map((candidate, index) => ({
    ...candidate,
    ambiguous: index === 0 ? !exactTop : true,
  }));
}

export async function getResultProof(
  client: DbClient,
  resultId: string,
): Promise<ResultProofDto | null> {
  const result = await getResult(client, resultId);
  if (!result) return null;
  const chain = await client.query<{
    valid: boolean;
    count: number;
    head: string | null;
    brokenAt: string | null;
  }>(`select (proof ->> 'valid')::boolean as valid, (proof ->> 'count')::int as count,
              proof ->> 'head' as head, proof ->> 'brokenAt' as "brokenAt"
         from (select sutra.verify_result_chain($1) as proof) q`, [resultId]);
  const row = chain.rows[0] ?? { valid: false, count: 0, head: null, brokenAt: null };
  const events = result.events;
  const ids = (types: string[]) => events.filter((event) => types.includes(event.eventType)).map((event) => event.eventId);
  const valueEcho = valuesMatch(result.valueText, result.acknowledgedValueText)
    && result.acknowledgedFlag === result.labFlag;
  const labReadBack = result.labFlag === 'critical'
    ? Boolean(result.labNotifierName) && valuesMatch(result.valueText, result.labReadBackValueText)
    : null;
  const contactEvidence = Boolean(result.informedAt)
    || (result.closedWithoutInformed
      && result.attempts.length >= 2
      && ['unreachable', 'invalid_number', 'declined', 'deceased', 'transferred'].includes(result.communicationOutcome ?? ''));
  const controls: ResultProofDto['controls'] = [
    {
      code: 'LAB-RELEASE',
      label: 'Lab release time and source',
      status: result.labReleasedAt ? 'present' : 'missing',
      evidenceEventIds: ids(['received']),
      note: 'The clock starts at the lab release time, not when a PDF reached a phone.',
    },
    {
      code: 'VALUE-ECHO',
      label: 'Value echoed by the acknowledging clinician',
      status: valueEcho ? 'present' : 'missing',
      evidenceEventIds: ids(['acknowledged']),
      note: 'The acknowledger entered the printed value and selected the printed flag.',
    },
    {
      code: 'LAB-READBACK',
      label: 'Lab to clinician read-back',
      status: labReadBack === null ? 'not_applicable' : labReadBack ? 'present' : 'missing',
      evidenceEventIds: ids(['acknowledged']),
      note: labReadBack === null
        ? 'The lab did not flag this result critical.'
        : 'The notifier and the value read back were recorded.',
    },
    {
      code: 'PATIENT-CONTACT',
      label: 'Patient or caregiver contact, or documented attempts',
      status: contactEvidence ? 'present' : 'missing',
      evidenceEventIds: ids(['patient_informed', 'communication_attempt', 'closed']),
      note: 'Unreachable is a recorded outcome, never an inference.',
    },
    {
      code: 'NEXT-STEP',
      label: 'Next administrative step recorded',
      status: result.nextStep ? 'present' : 'missing',
      evidenceEventIds: ids(['patient_informed', 'next_step_completed']),
      note: result.nextStepCompletedAt
        ? 'The next step is recorded as completed.'
        : 'The next step is recorded; completion is tracked separately.',
    },
    {
      code: 'CHAIN',
      label: 'Anchored audit chain',
      status: row.valid ? 'present' : 'missing',
      evidenceEventIds: ids(['received', 'matched', 'assigned', 'acknowledged', 'patient_informed', 'communication_attempt', 'auto_escalated', 'next_step_completed', 'closed']),
      note: 'SHA-256 event chain with a stored count and head; the assessor decides what it proves.',
    },
  ];
  return {
    resultId: result.resultId,
    receiptCode: result.receiptCode,
    valid: row.valid,
    eventCount: row.count,
    head: row.head,
    brokenAt: row.brokenAt,
    checkedAt: new Date().toISOString(),
    controls,
  };
}

export async function verifyReceiptByCode(
  client: DbClient,
  code: string,
): Promise<{ found: boolean; valid: boolean; stage: PublicReceiptStage }> {
  const result = await client.query<{ found: boolean; valid: boolean; stage: string }>(
    `select (proof ->> 'found')::boolean as found,
            (proof ->> 'valid')::boolean as valid,
            proof ->> 'stage' as stage
       from (select sutra.verify_receipt_code($1) as proof) q`,
    [code],
  );
  const row = result.rows[0];
  return row
    ? { found: row.found, valid: row.valid, stage: row.stage as PublicReceiptStage }
    : { found: false, valid: false, stage: 'not_found' };
}

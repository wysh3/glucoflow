import type {
  ResultDto,
  ResultEventDto,
  CreateResultInput,
  ResultFilter,
  ResultListDto,
  ResultRowDto,
  ResultStatsDto,
} from '@glucoflow/contracts';
import { RESULT_STATUS_LABELS } from '@glucoflow/contracts';
import type { DbClient } from './pool';

/** Reads and commands for the administrative result-accountability ledger. */

type ResultRow = {
  result_id: string;
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
  patient_name_raw: string;
  patient_identifier_raw: string | null;
  test_name: string;
  value_text: string;
  unit: string | null;
  lab_flag: ResultDto['labFlag'];
  status: ResultDto['status'];
  owner_id: string | null;
  owner_name: string | null;
  due_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  informed_at: string | null;
  informed_by_name: string | null;
  informed_channel: ResultDto['informedChannel'];
  read_back_confirmed: boolean;
  read_back_at: string | null;
  escalation_level: number;
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
  created_at: string;
};

const RESULT_SELECT = `
  select
    r.id as result_id,
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
    r.patient_name_raw,
    r.patient_identifier_raw,
    r.test_name,
    r.value_text,
    r.unit,
    r.lab_flag,
    r.status,
    r.owner_id,
    owner.display_name as owner_name,
    r.due_at,
    r.acknowledged_at,
    ack.display_name as acknowledged_by_name,
    r.informed_at,
    informed.display_name as informed_by_name,
    r.informed_channel,
    r.read_back_confirmed,
    r.read_back_at,
    r.escalation_level,
    r.closed_at,
    r.created_at
  from sutra.results r
  left join sutra.patients p on p.id = r.patient_id
  left join sutra.document_versions dv on dv.id = r.document_version_id
  left join sutra.app_users owner on owner.id = r.owner_id
  left join sutra.app_users ack on ack.id = r.acknowledged_by
  left join sutra.app_users informed on informed.id = r.informed_by`;

function mapRow(row: ResultRow): ResultRowDto {
  return {
    resultId: row.result_id,
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
    patientNameRaw: row.patient_name_raw,
    patientIdentifierRaw: row.patient_identifier_raw,
    testName: row.test_name,
    valueText: row.value_text,
    unit: row.unit,
    labFlag: row.lab_flag,
    status: row.status,
    statusLabel: RESULT_STATUS_LABELS[row.status],
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : null,
    acknowledgedByName: row.acknowledged_by_name,
    informedAt: row.informed_at ? new Date(row.informed_at).toISOString() : null,
    informedByName: row.informed_by_name,
    informedChannel: row.informed_channel,
    readBackConfirmed: row.read_back_confirmed,
    readBackAt: row.read_back_at ? new Date(row.read_back_at).toISOString() : null,
    escalationLevel: row.escalation_level,
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function filterSql(filter: ResultFilter): string {
  switch (filter) {
    case 'critical':
      return "r.lab_flag = 'critical' and r.status not in ('patient_informed', 'closed')";
    case 'overdue':
      return "r.due_at < now() and r.status in ('owned', 'acknowledged')";
    case 'unowned':
      return "r.owner_id is null and r.status not in ('closed')";
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
  const [result, events] = await Promise.all([
    client.query<ResultRow>(`${RESULT_SELECT} where r.id = $1`, [resultId]),
    client.query<EventRow>(
      `select e.id as event_id, e.event_type, u.display_name as actor_name,
              e.from_status, e.to_status, e.note, e.created_at
         from sutra.result_events e
         left join sutra.app_users u on u.id = e.actor_id
        where e.result_id = $1
        order by e.created_at asc, e.id asc`,
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
      createdAt: new Date(event.created_at).toISOString(),
    })),
  };
}

export async function resultStats(client: DbClient, clinicId: string): Promise<ResultStatsDto> {
  const result = await client.query<{
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
       count(*) filter (where due_at < now() and status in ('owned', 'acknowledged'))::text as overdue,
       count(*) filter (where lab_flag = 'critical' and status not in ('patient_informed', 'closed'))::text as critical_open,
       count(*) filter (where status in ('acknowledged', 'patient_informed', 'closed'))::text as acknowledged,
       count(*) filter (where status in ('patient_informed', 'closed'))::text as patient_informed,
       count(*) filter (where status = 'closed')::text as closed,
       round(percentile_cont(0.5) within group (
         order by extract(epoch from (acknowledged_at - report_received_at)) / 60
       ) filter (where acknowledged_at is not null))::text as median_ack,
       round(
         count(*) filter (where status in ('patient_informed', 'closed'))::numeric
         / nullif(count(*) filter (where status in ('acknowledged', 'patient_informed', 'closed')), 0),
         3
       )::text as informed_share
     from sutra.results
     where clinic_id = $1`,
    [clinicId],
  );
  const row = result.rows[0];
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
  note?: string,
): Promise<void> {
  await client.query('select sutra.acknowledge_result($1, $2)', [resultId, note ?? null]);
}

export async function recordResultInformed(
  client: DbClient,
  resultId: string,
  channel: string,
  note?: string,
  readBack = false,
): Promise<void> {
  await client.query('select sutra.record_result_informed($1, $2, $3, $4)', [
    resultId,
    channel,
    note ?? null,
    readBack,
  ]);
}

export async function escalateResult(
  client: DbClient,
  resultId: string,
  reason: string,
): Promise<void> {
  await client.query('select sutra.escalate_result($1, $2)', [resultId, reason]);
}

export async function closeResult(
  client: DbClient,
  resultId: string,
  note: string,
): Promise<void> {
  await client.query('select sutra.close_result($1, $2)', [resultId, note]);
}


export async function createResult(
  client: DbClient,
  clinicId: string,
  input: CreateResultInput,
): Promise<string> {
  const result = await client.query<{ create_result: string }>(
    `select sutra.create_result($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) as create_result`,
    [
      clinicId,
      input.patientId ?? null,
      input.documentId ?? null,
      input.externalRef ?? null,
      input.sourceChannel,
      input.labName ?? null,
      input.reportReceivedAt ?? null,
      input.patientNameRaw,
      input.patientIdentifierRaw ?? null,
      input.testName,
      input.valueText,
      input.unit ?? null,
      input.labFlag,
    ],
  );
  return result.rows[0]!.create_result;
}

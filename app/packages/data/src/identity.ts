import type {
  Capabilities,
  Context,
  PatientSummaryDto,
  UUID,
} from '@sutra/contracts';
import type { DbClient } from './pool';

/**
 * Actor identity and authorized context resolution.
 * Permissions always come from active database membership, never from a token claim
 * or a client-supplied role.
 */

export type ActorProfile = {
  userId: UUID;
  email: string;
  displayName: string;
};

export async function loadActorProfile(
  client: DbClient,
  userId: string,
): Promise<ActorProfile | null> {
  const result = await client.query<{ id: string; email: string; display_name: string }>(
    'select id, email, display_name from sutra.app_users where id = $1',
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { userId: row.id, email: row.email, displayName: row.display_name };
}

export async function loadActorContexts(client: DbClient, userId: string): Promise<Context[]> {
  const memberships = await client.query<{
    clinic_id: string;
    reviewer: boolean;
    clinician: boolean;
  }>(
    `select clinic_id, reviewer, clinician
       from sutra.memberships
      where user_id = $1 and active
      order by clinic_id`,
    [userId],
  );

  const links = await client.query<{ clinic_id: string; patient_id: string }>(
    `select clinic_id, patient_id
       from sutra.patient_accounts
      where user_id = $1 and active
      order by patient_id`,
    [userId],
  );

  const contexts: Context[] = [];
  for (const row of memberships.rows) {
    contexts.push({
      kind: 'clinic',
      clinicId: row.clinic_id,
      reviewer: row.reviewer,
      clinician: row.clinician,
    });
    if (!row.reviewer && !row.clinician) {
      // A membership without a clinical capability grants no record access.
      contexts.pop();
    }
  }
  for (const row of links.rows) {
    contexts.push({ kind: 'patient', clinicId: row.clinic_id, patientId: row.patient_id });
  }
  return contexts;
}

export function capabilitiesFromContexts(contexts: Context[]): Capabilities {
  const clinicContexts = contexts.filter((context) => context.kind === 'clinic');
  const patientContexts = contexts.filter((context) => context.kind === 'patient');
  const canReview = clinicContexts.some((context) => context.reviewer);
  const canViewApproved = clinicContexts.length > 0 || patientContexts.length > 0;
  return {
    canReview,
    canViewApproved,
    canUploadForPatient: canViewApproved,
    canExport: canViewApproved,
    canAcknowledgeNote: clinicContexts.length > 0,
    patientIds: patientContexts.map((context) => context.patientId),
    clinicIds: [...new Set(clinicContexts.map((context) => context.clinicId))],
  };
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined | null): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { o?: number };
    if (typeof parsed.o === 'number' && Number.isFinite(parsed.o) && parsed.o >= 0) {
      return Math.floor(parsed.o);
    }
  } catch {
    // fall through
  }
  throw new Error('invalid cursor');
}

export type ListPatientsInput = {
  search?: string;
  cursor?: string;
  limit?: number;
};

export async function listPatients(
  client: DbClient,
  input: ListPatientsInput,
): Promise<{ items: PatientSummaryDto[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = decodeCursor(input.cursor);
  const search = input.search?.trim() ? `%${input.search.trim()}%` : null;

  const result = await client.query<{
    patient_id: string;
    clinic_id: string;
    clinic_identifier: string;
    display_name: string;
    birth_date: string | null;
    approval_revision: number;
    last_record_date: string | null;
    pending_count: string;
    document_count: string;
    latest_report_date: string | null;
    latest_upload_at: string | null;
  }>(
    `select
       p.id as patient_id,
       p.clinic_id,
       p.clinic_identifier,
       p.display_name,
       to_char(p.birth_date, 'YYYY-MM-DD') as birth_date,
       p.approval_revision,
       (select max(f.event_date)::text from sutra.approved_facts f
         where f.patient_id = p.id and f.status = 'retained') as last_record_date,
       (select count(*) from sutra.documents d
         where d.patient_id = p.id
           and d.assignment_state <> 'quarantined'
           and d.duplicate_of_document_id is null
           and not exists (select 1 from sutra.approval_batches ab where ab.document_id = d.id)
           and not exists (
             select 1 from sutra.review_batches b
             where b.document_id = d.id and b.state = 'published'
           )) as pending_count,
       (select count(*) from sutra.documents d where d.patient_id = p.id) as document_count,
       (select max(f.event_date)::text from sutra.approved_facts f
         where f.patient_id = p.id and f.status = 'retained') as latest_report_date,
       (select max(v.created_at)::text from sutra.documents d
         join sutra.document_versions v on v.document_id = d.id
         where d.patient_id = p.id) as latest_upload_at
     from sutra.patients p
     where ($1::text is null or p.display_name ilike $1 or p.clinic_identifier ilike $1)
     order by p.display_name, p.id
     limit $2 offset $3`,
    [search, limit + 1, offset],
  );

  const rows = result.rows.slice(0, limit);
  const items: PatientSummaryDto[] = rows.map((row) => ({
    patientId: row.patient_id,
    clinicId: row.clinic_id,
    clinicIdentifier: row.clinic_identifier,
    displayName: row.display_name,
    birthDate: row.birth_date,
    approvalRevision: row.approval_revision,
    lastRecordDate: row.last_record_date,
    pendingCount: Number(row.pending_count),
    documentCount: Number(row.document_count),
    latestReportDate: row.latest_report_date,
  }));
  const nextCursor = result.rows.length > limit ? encodeCursor(offset + limit) : null;
  return { items, nextCursor };
}

export async function getPatientSummary(
  client: DbClient,
  patientId: string,
): Promise<PatientSummaryDto | null> {
  const result = await client.query<{
    patient_id: string;
    clinic_id: string;
    clinic_identifier: string;
    display_name: string;
    birth_date: string | null;
    approval_revision: number;
    last_record_date: string | null;
    pending_count: string;
    document_count: string;
    latest_report_date: string | null;
  }>(
    `select
       p.id as patient_id, p.clinic_id, p.clinic_identifier, p.display_name,
       to_char(p.birth_date, 'YYYY-MM-DD') as birth_date, p.approval_revision,
       (select max(f.event_date)::text from sutra.approved_facts f
         where f.patient_id = p.id and f.status = 'retained') as last_record_date,
       (select count(*) from sutra.documents d
         where d.patient_id = p.id
           and d.assignment_state <> 'quarantined'
           and d.duplicate_of_document_id is null
           and not exists (select 1 from sutra.approval_batches ab where ab.document_id = d.id)
           and not exists (
             select 1 from sutra.review_batches b
             where b.document_id = d.id and b.state = 'published'
           )) as pending_count,
       (select count(*) from sutra.documents d where d.patient_id = p.id) as document_count,
       (select max(f.event_date)::text from sutra.approved_facts f
         where f.patient_id = p.id and f.status = 'retained') as latest_report_date
     from sutra.patients p
     where p.id = $1`,
    [patientId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    patientId: row.patient_id,
    clinicId: row.clinic_id,
    clinicIdentifier: row.clinic_identifier,
    displayName: row.display_name,
    birthDate: row.birth_date,
    approvalRevision: row.approval_revision,
    lastRecordDate: row.last_record_date,
    pendingCount: Number(row.pending_count),
    documentCount: Number(row.document_count),
    latestReportDate: row.latest_report_date,
  };
}

export async function clinicName(client: DbClient, clinicId: string): Promise<string | null> {
  const result = await client.query<{ display_name: string }>(
    'select display_name from sutra.clinics where id = $1',
    [clinicId],
  );
  return result.rows[0]?.display_name ?? null;
}

export async function actorDisplayNames(
  client: DbClient,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const result = await client.query<{ id: string; display_name: string }>(
    'select id, display_name from sutra.app_users where id = any($1::uuid[])',
    [userIds],
  );
  return new Map(result.rows.map((row) => [row.id, row.display_name]));
}

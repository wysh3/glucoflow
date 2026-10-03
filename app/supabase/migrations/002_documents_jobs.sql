-- 002_documents_jobs.sql
-- Upload sessions, documents, versions, durable jobs and idempotency.
-- Sources: docs/mvp/05-data-and-api.md "Tables", docs/mvp/03-architecture.md
-- "Durable job contract", docs/mvp/09-fixed-contracts.md "Upload limits and lifecycle".

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function sutra.write_audit(
  p_clinic uuid,
  p_patient uuid,
  p_actor uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_revision integer default null,
  p_reason text default null
)
returns void
language sql
security definer
set search_path = sutra, pg_temp
as $$
  insert into sutra.audit_events
    (clinic_id, patient_id, actor_id, entity_type, entity_id, action, revision, reason)
  values (p_clinic, p_patient, p_actor, p_entity_type, p_entity_id, p_action, p_revision, p_reason);
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table sutra.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  actor_id uuid not null references sutra.app_users (id) on delete cascade,
  kind text not null,
  manifest_json jsonb not null,
  state text not null default 'created',
  provider_token_expires_at timestamptz not null,
  completion_expires_at timestamptz not null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  document_id uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint upload_sessions_kind_check check (kind in ('file', 'photos')),
  constraint upload_sessions_state_check
    check (state in ('created', 'completed', 'cancelled', 'expired')),
  constraint upload_sessions_manifest_check check (jsonb_typeof(manifest_json) = 'object')
);

create unique index upload_sessions_idempotency_key
  on sutra.upload_sessions (clinic_id, actor_id, idempotency_key)
  where idempotency_key is not null;

create index upload_sessions_pending_idx
  on sutra.upload_sessions (patient_id, state, completion_expires_at desc);

create table sutra.documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  uploader_id uuid not null references sutra.app_users (id) on delete restrict,
  current_version_id uuid,
  assignment_state text not null default 'assigned',
  released_to_patient boolean not null default false,
  duplicate_of_document_id uuid references sutra.documents (id) on delete set null,
  supersedes_document_id uuid references sutra.documents (id) on delete set null,
  quarantine_reason text,
  amendment_pending boolean not null default false,
  created_at timestamptz not null default now(),
  constraint documents_assignment_state_check
    check (assignment_state in ('assigned', 'quarantined', 'unassigned', 'duplicate'))
);

create index documents_patient_created_idx on sutra.documents (patient_id, created_at desc);

create table sutra.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references sutra.documents (id) on delete cascade,
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  source_manifest_json jsonb not null,
  sha256 text not null,
  bytes bigint not null,
  page_count integer,
  version_number integer not null,
  supersedes_version_id uuid references sutra.document_versions (id) on delete set null,
  source_kind text not null default 'file',
  created_at timestamptz not null default now(),
  constraint document_versions_unique_number unique (document_id, version_number),
  constraint document_versions_positive_bytes check (bytes > 0),
  constraint document_versions_sha256_shape check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint document_versions_source_kind_check check (source_kind in ('file', 'photos'))
);

alter table sutra.documents
  add constraint documents_current_version_fk
  foreign key (current_version_id) references sutra.document_versions (id) on delete set null;

-- Thread of documents that amend one logical record.
create or replace function sutra.logical_document_id(p_document uuid)
returns uuid
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  with recursive chain as (
    select d.id, d.supersedes_document_id
    from sutra.documents d
    where d.id = p_document
    union all
    select c.id, d.supersedes_document_id
    from chain c
    join sutra.documents d on d.id = c.supersedes_document_id
  )
  select id from chain where supersedes_document_id is null limit 1;
$$;

create table sutra.jobs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid references sutra.patients (id) on delete cascade,
  kind text not null,
  target_id uuid not null,
  state text not null default 'queued',
  stage text,
  attempt integer not null default 0,
  max_attempts integer not null default 3,
  lease_token uuid,
  lease_until timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  available_at timestamptz not null default now(),
  last_heartbeat_at timestamptz,
  error_code text,
  error_message text,
  run_number integer not null default 1,
  created_by uuid references sutra.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_kind_check check (kind in ('process_document', 'render_export')),
  constraint jobs_state_check
    check (state in ('queued', 'running', 'retry_wait', 'succeeded', 'failed')),
  constraint jobs_attempt_check check (attempt >= 0 and attempt <= max_attempts)
);

create index jobs_claim_idx on sutra.jobs (state, available_at);
create index jobs_target_idx on sutra.jobs (target_id, created_at desc);

-- One extraction job per document version. A completion retry returns the same job.
create unique index jobs_one_process_document_per_target
  on sutra.jobs (target_id)
  where kind = 'process_document' and run_number = 1;

create table sutra.job_stage_outputs (
  job_id uuid not null references sutra.jobs (id) on delete cascade,
  stage text not null,
  document_version_id uuid references sutra.document_versions (id) on delete cascade,
  output_ref jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  primary key (job_id, stage)
);

create table sutra.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  actor_id uuid not null references sutra.app_users (id) on delete cascade,
  route text not null,
  key text not null,
  request_hash text not null,
  response_json jsonb,
  state text not null default 'in_progress',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  unique (clinic_id, actor_id, route, key)
);

create or replace function sutra.can_read_document(p_document uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
    from sutra.documents d
    where d.id = p_document
      and (
        sutra.is_clinic_member(d.clinic_id)
        or (
          sutra.is_linked_patient(d.patient_id)
          and d.assignment_state <> 'quarantined'
        )
      )
  );
$$;

create or replace function sutra.can_review_document(p_document uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
    from sutra.documents d
    where d.id = p_document
      and sutra.is_clinic_member(d.clinic_id, 'reviewer')
      and d.assignment_state <> 'quarantined'
  );
$$;

-- True when the actor may upload for this patient: clinic staff or the linked patient.
create or replace function sutra.can_upload_for_patient(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
    from sutra.patients p
    where p.id = p_patient
      and (
        sutra.is_clinic_member(p.clinic_id, 'reviewer')
        or sutra.is_clinic_member(p.clinic_id, 'clinician')
        or sutra.is_linked_patient(p.id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table sutra.upload_sessions enable row level security;
alter table sutra.documents enable row level security;
alter table sutra.document_versions enable row level security;
alter table sutra.jobs enable row level security;
alter table sutra.job_stage_outputs enable row level security;
alter table sutra.idempotency_keys enable row level security;

drop policy if exists upload_sessions_actor_read on sutra.upload_sessions;
create policy upload_sessions_actor_read on sutra.upload_sessions
  for select to :api_role
  using (
    actor_id = sutra.current_actor_id()
    or sutra.is_clinic_member(clinic_id, 'reviewer')
    or sutra.is_clinic_member(clinic_id, 'clinician')
  );

drop policy if exists documents_read on sutra.documents;
create policy documents_read on sutra.documents
  for select to :api_role
  using (
    sutra.is_clinic_member(clinic_id)
    or (sutra.is_linked_patient(patient_id) and assignment_state <> 'quarantined')
  );

drop policy if exists document_versions_read on sutra.document_versions;
create policy document_versions_read on sutra.document_versions
  for select to :api_role
  using (sutra.can_read_document(document_id));

drop policy if exists jobs_read on sutra.jobs;
create policy jobs_read on sutra.jobs
  for select to :api_role
  using (
    sutra.is_clinic_member(clinic_id)
    or exists (
      select 1 from sutra.documents d
      where d.id = jobs.target_id
        and sutra.is_linked_patient(d.patient_id)
        and d.assignment_state <> 'quarantined'
    )
    or exists (
      select 1 from sutra.patient_accounts pa
      join sutra.patients p on p.id = pa.patient_id
      where pa.user_id = sutra.current_actor_id() and pa.active and p.id = jobs.patient_id
    )
  );

drop policy if exists job_stage_outputs_read on sutra.job_stage_outputs;
create policy job_stage_outputs_read on sutra.job_stage_outputs
  for select to :api_role
  using (
    exists (select 1 from sutra.jobs j where j.id = job_stage_outputs.job_id)
  );

drop policy if exists idempotency_keys_actor on sutra.idempotency_keys;
create policy idempotency_keys_actor on sutra.idempotency_keys
  for all to :api_role
  using (actor_id = sutra.current_actor_id())
  with check (actor_id = sutra.current_actor_id());

-- The worker is an elevated server-side role. It sees only queue and document
-- state and never receives approved clinical data through these policies.
drop policy if exists worker_upload_sessions on sutra.upload_sessions;
create policy worker_upload_sessions on sutra.upload_sessions
  for select to sutra_worker using (true);

drop policy if exists worker_documents on sutra.documents;
create policy worker_documents on sutra.documents
  for all to sutra_worker using (true) with check (true);

drop policy if exists worker_document_versions on sutra.document_versions;
create policy worker_document_versions on sutra.document_versions
  for all to sutra_worker using (true) with check (true);

drop policy if exists worker_jobs on sutra.jobs;
create policy worker_jobs on sutra.jobs
  for all to sutra_worker using (true) with check (true);

drop policy if exists worker_job_stage_outputs on sutra.job_stage_outputs;
create policy worker_job_stage_outputs on sutra.job_stage_outputs
  for all to sutra_worker using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select on sutra.upload_sessions, sutra.documents, sutra.document_versions,
  sutra.jobs, sutra.job_stage_outputs to :api_role;
grant select, insert, update, delete on sutra.idempotency_keys to :api_role;

grant select, insert, update on sutra.upload_sessions to sutra_worker;
grant select, insert, update on sutra.documents to sutra_worker;
grant select, insert, update on sutra.document_versions to sutra_worker;
grant select, insert, update on sutra.jobs to sutra_worker;
grant select, insert, update on sutra.job_stage_outputs to sutra_worker;

-- ---------------------------------------------------------------------------
-- Procedures. The API role has no direct write grants on these tables.
-- ---------------------------------------------------------------------------

create or replace function sutra.create_upload_session(
  p_patient uuid,
  p_kind text,
  p_manifest jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_clinic uuid;
  v_existing sutra.upload_sessions;
  v_id uuid;
  v_now timestamptz := now();
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('file', 'photos') then
    raise exception 'unsupported upload kind' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_manifest -> 'items', '[]'::jsonb)) < 1 then
    raise exception 'upload manifest is empty' using errcode = '22023';
  end if;
  select p.clinic_id into v_clinic from sutra.patients p where p.id = p_patient;
  if v_clinic is null then
    raise exception 'patient not found' using errcode = 'P0002';
  end if;
  if not sutra.can_upload_for_patient(p_patient) then
    raise exception 'not authorized to upload for this patient' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
    from sutra.upload_sessions s
    where s.clinic_id = v_clinic
      and s.actor_id = v_actor
      and s.idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'sessionId', v_existing.id,
        'state', v_existing.state,
        'manifest', v_existing.manifest_json,
        'completionExpiresAt', v_existing.completion_expires_at,
        'providerTokenExpiresAt', v_existing.provider_token_expires_at,
        'reused', true
      );
    end if;
  end if;

  insert into sutra.upload_sessions (
    clinic_id, patient_id, actor_id, kind, manifest_json, state,
    provider_token_expires_at, completion_expires_at, idempotency_key
  )
  values (
    v_clinic, p_patient, v_actor, p_kind, p_manifest, 'created',
    v_now + interval '2 hours', v_now + interval '15 minutes', p_idempotency_key
  )
  returning id into v_id;

  perform sutra.write_audit(v_clinic, p_patient, v_actor, 'upload_session', v_id, 'upload_created');

  return jsonb_build_object(
    'sessionId', v_id,
    'state', 'created',
    'manifest', p_manifest,
    'completionExpiresAt', v_now + interval '15 minutes',
    'providerTokenExpiresAt', v_now + interval '2 hours',
    'reused', false
  );
end
$$;

create or replace function sutra.cancel_upload_session(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_session sutra.upload_sessions;
begin
  select * into v_session from sutra.upload_sessions s where s.id = p_session for update;
  if not found then
    raise exception 'upload session not found' using errcode = 'P0002';
  end if;
  if v_session.actor_id <> v_actor and not sutra.is_clinic_member(v_session.clinic_id, 'reviewer') then
    raise exception 'not authorized for this upload session' using errcode = '42501';
  end if;
  if v_session.state = 'completed' then
    raise exception 'a completed upload cannot be cancelled' using errcode = 'P0001';
  end if;
  if v_session.state = 'cancelled' then
    return jsonb_build_object('sessionId', v_session.id, 'state', 'cancelled');
  end if;
  update sutra.upload_sessions
    set state = 'cancelled', cancelled_at = now()
    where id = p_session;
  perform sutra.write_audit(v_session.clinic_id, v_session.patient_id, v_actor,
    'upload_session', p_session, 'upload_cancelled');
  return jsonb_build_object('sessionId', p_session, 'state', 'cancelled');
end
$$;

-- Completion freezes the manifest and queues processing exactly once. A repeated
-- successful completion returns its original document and job identifiers.
create or replace function sutra.complete_upload_session(
  p_session uuid,
  p_sha256 text,
  p_bytes bigint,
  p_page_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_session sutra.upload_sessions;
  v_document_id uuid;
  v_version_id uuid;
  v_job_id uuid;
begin
  select * into v_session from sutra.upload_sessions s where s.id = p_session for update;
  if not found then
    raise exception 'upload session not found' using errcode = 'P0002';
  end if;
  if v_session.actor_id <> v_actor and not sutra.is_clinic_member(v_session.clinic_id, 'reviewer') then
    raise exception 'not authorized for this upload session' using errcode = '42501';
  end if;

  if v_session.state = 'completed' then
    select j.id into v_job_id
    from sutra.jobs j
    where j.target_id = v_session.document_id and j.kind = 'process_document'
    order by j.created_at asc
    limit 1;
    return jsonb_build_object(
      'documentId', v_session.document_id,
      'jobId', v_job_id,
      'reused', true
    );
  end if;

  if v_session.state = 'cancelled' then
    raise exception 'this upload was cancelled' using errcode = 'P0001';
  end if;
  if v_session.state = 'expired' or v_session.completion_expires_at < now() then
    update sutra.upload_sessions set state = 'expired' where id = p_session and state = 'created';
    raise exception 'the upload completion window has expired' using errcode = 'P0001';
  end if;

  insert into sutra.documents (clinic_id, patient_id, uploader_id, assignment_state)
  values (v_session.clinic_id, v_session.patient_id, v_session.actor_id, 'assigned')
  returning id into v_document_id;

  insert into sutra.document_versions (
    document_id, clinic_id, source_manifest_json, sha256, bytes, page_count,
    version_number, source_kind
  )
  values (
    v_document_id, v_session.clinic_id,
    jsonb_build_object(
      'kind', v_session.kind,
      'items', v_session.manifest_json -> 'items'
    ),
    p_sha256, p_bytes, p_page_count, 1, v_session.kind
  )
  returning id into v_version_id;

  update sutra.documents set current_version_id = v_version_id where id = v_document_id;
  update sutra.upload_sessions
    set state = 'completed', completed_at = now(), document_id = v_document_id
    where id = p_session;

  insert into sutra.jobs (clinic_id, patient_id, kind, target_id, created_by)
  values (v_session.clinic_id, v_session.patient_id, 'process_document', v_document_id, v_actor)
  returning id into v_job_id;

  perform sutra.write_audit(v_session.clinic_id, v_session.patient_id, v_actor,
    'document', v_document_id, 'upload_completed');

  return jsonb_build_object(
    'documentId', v_document_id,
    'documentVersionId', v_version_id,
    'jobId', v_job_id,
    'reused', false
  );
end
$$;

-- A manual retry is a new run for the same document, subject to an hourly cap.
create or replace function sutra.request_document_retry(p_document uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_document sutra.documents;
  v_recent integer;
  v_job_id uuid;
  v_run integer;
  v_state text;
begin
  select * into v_document from sutra.documents d where d.id = p_document for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if not (
    v_document.uploader_id = v_actor
    or sutra.is_clinic_member(v_document.clinic_id, 'reviewer')
  ) then
    raise exception 'not authorized to retry this document' using errcode = '42501';
  end if;
  if v_document.assignment_state = 'quarantined' then
    raise exception 'a quarantined upload cannot be retried; upload the correct document'
      using errcode = 'P0001';
  end if;

  select j.state into v_state
  from sutra.jobs j
  where j.target_id = p_document and j.kind = 'process_document'
  order by j.run_number desc
  limit 1;
  if v_state is null then
    raise exception 'this document has no processing run yet' using errcode = 'P0001';
  end if;
  if v_state not in ('failed') then
    raise exception 'a retry is only available after a failed run' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from sutra.jobs j
  where j.target_id = p_document
    and j.kind = 'process_document'
    and j.run_number > 1
    and j.created_at > now() - interval '1 hour';
  if v_recent >= 3 then
    raise exception 'retry limit reached for this document (3 per hour)' using errcode = 'P0001';
  end if;

  select coalesce(max(j.run_number), 0) + 1 into v_run
  from sutra.jobs j
  where j.target_id = p_document and j.kind = 'process_document';

  insert into sutra.jobs (clinic_id, patient_id, kind, target_id, created_by, run_number)
  values (v_document.clinic_id, v_document.patient_id, 'process_document', p_document, v_actor, v_run)
  returning id into v_job_id;

  perform sutra.write_audit(v_document.clinic_id, v_document.patient_id, v_actor,
    'document', p_document, 'retry_requested', v_run, p_reason);

  return jsonb_build_object('jobId', v_job_id, 'runNumber', v_run);
end
$$;

grant execute on function sutra.create_upload_session(uuid, text, jsonb, text) to :api_role;
grant execute on function sutra.cancel_upload_session(uuid) to :api_role;
grant execute on function sutra.complete_upload_session(uuid, text, bigint, integer) to :api_role;
grant execute on function sutra.request_document_retry(uuid, text) to :api_role;
grant execute on function sutra.write_audit(uuid, uuid, uuid, text, uuid, text, integer, text) to :api_role, sutra_worker;
grant execute on function sutra.can_read_document(uuid) to :api_role, sutra_worker;
grant execute on function sutra.can_review_document(uuid) to :api_role;
grant execute on function sutra.can_upload_for_patient(uuid) to :api_role;
grant execute on function sutra.logical_document_id(uuid) to :api_role, sutra_worker;

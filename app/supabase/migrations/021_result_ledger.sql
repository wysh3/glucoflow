-- 021_result_ledger.sql
-- Administrative result accountability ledger.
--
-- A result is a receipt for an incoming report, not an interpretation. The lab's
-- own flag is copied into lab_flag; no function in this schema derives a clinical
-- judgement. Every state change is append-only in result_events.

create table if not exists sutra.results (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid references sutra.patients (id) on delete restrict,
  document_id uuid references sutra.documents (id) on delete set null,
  document_version_id uuid references sutra.document_versions (id) on delete set null,
  external_ref text,
  source_channel text not null default 'pdf'
    check (source_channel in ('pdf', 'paper', 'whatsapp', 'portal', 'email', 'other')),
  lab_name text,
  report_received_at timestamptz not null,
  patient_name_raw text not null check (length(btrim(patient_name_raw)) > 0),
  patient_identifier_raw text,
  test_name text not null check (length(btrim(test_name)) > 0),
  value_text text not null check (length(btrim(value_text)) > 0),
  unit text,
  lab_flag text not null default 'unknown'
    check (lab_flag in ('critical', 'abnormal', 'normal', 'unknown')),
  criticality_source text not null default 'lab_flag'
    check (criticality_source = 'lab_flag'),
  status text not null default 'unmatched'
    check (status in ('unmatched', 'matched', 'owned', 'acknowledged', 'patient_informed', 'closed')),
  owner_id uuid references sutra.app_users (id) on delete set null,
  due_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references sutra.app_users (id) on delete set null,
  informed_at timestamptz,
  informed_by uuid references sutra.app_users (id) on delete set null,
  informed_channel text check (informed_channel in ('call', 'whatsapp', 'sms', 'in_person', 'letter', 'other')),
  escalation_level integer not null default 0 check (escalation_level >= 0),
  closed_at timestamptz,
  closed_by uuid references sutra.app_users (id) on delete set null,
  created_by uuid references sutra.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists results_clinic_external_ref_key
  on sutra.results (clinic_id, external_ref)
  where external_ref is not null;

create index if not exists results_clinic_status_due_idx
  on sutra.results (clinic_id, status, due_at);
create index if not exists results_clinic_flag_status_idx
  on sutra.results (clinic_id, lab_flag, status);
create index if not exists results_owner_due_idx
  on sutra.results (owner_id, due_at)
  where status not in ('patient_informed', 'closed');

create table if not exists sutra.result_events (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references sutra.results (id) on delete cascade,
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  actor_id uuid references sutra.app_users (id) on delete set null,
  event_type text not null
    check (event_type in ('received', 'matched', 'assigned', 'acknowledged', 'patient_informed', 'escalated', 'closed')),
  from_status text,
  to_status text,
  note text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists result_events_result_created_idx
  on sutra.result_events (result_id, created_at, id);

alter table sutra.results enable row level security;
alter table sutra.result_events enable row level security;

drop policy if exists results_clinic_read on sutra.results;
create policy results_clinic_read on sutra.results
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id));

drop policy if exists result_events_clinic_read on sutra.result_events;
create policy result_events_clinic_read on sutra.result_events
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id));

grant select on sutra.results, sutra.result_events to :api_role;

-- The API never writes these tables outside these procedures.
create or replace function sutra.result_event(
  p_result uuid,
  p_actor uuid,
  p_event_type text,
  p_from text,
  p_to text,
  p_note text default null,
  p_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = sutra, pg_temp
as $$
  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail)
  select p_result, r.clinic_id, p_actor, p_event_type, p_from, p_to, p_note, p_detail
  from sutra.results r where r.id = p_result;
$$;

create or replace function sutra.create_result(
  p_clinic uuid,
  p_patient uuid,
  p_document uuid,
  p_external_ref text,
  p_source_channel text,
  p_lab_name text,
  p_received_at timestamptz,
  p_patient_name_raw text,
  p_patient_identifier_raw text,
  p_test_name text,
  p_value_text text,
  p_unit text,
  p_lab_flag text
)
returns uuid
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_result uuid;
  v_status text;
  v_patient uuid := p_patient;
begin
  if not sutra.is_clinic_member(p_clinic) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;
  if p_external_ref is not null and exists (
    select 1 from sutra.results where clinic_id = p_clinic and external_ref = p_external_ref
  ) then
    raise exception 'this report was already received' using errcode = '23505';
  end if;
  if v_patient is null and p_document is not null then
    select patient_id into v_patient from sutra.documents where id = p_document and clinic_id = p_clinic;
  end if;
  if v_patient is not null and not exists (
    select 1 from sutra.patients where id = v_patient and clinic_id = p_clinic
  ) then
    raise exception 'patient does not belong to this clinic' using errcode = '22023';
  end if;
  v_status := case when v_patient is null then 'unmatched' else 'matched' end;
  insert into sutra.results (
    clinic_id, patient_id, document_id, external_ref, source_channel, lab_name,
    report_received_at, patient_name_raw, patient_identifier_raw, test_name,
    value_text, unit, lab_flag, status, created_by
  ) values (
    p_clinic, v_patient, p_document, nullif(btrim(p_external_ref), ''), p_source_channel, p_lab_name,
    coalesce(p_received_at, now()), p_patient_name_raw, p_patient_identifier_raw, p_test_name,
    p_value_text, p_unit, p_lab_flag, v_status, v_actor
  ) returning id into v_result;
  perform sutra.result_event(v_result, v_actor, 'received', null, v_status, null,
    jsonb_build_object('labFlag', p_lab_flag, 'criticalitySource', 'lab_flag'));
  return v_result;
end
$$;

create or replace function sutra.match_result(p_result uuid, p_patient uuid)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  select * into v_result from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not sutra.is_clinic_member(v_result.clinic_id) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;
  if v_result.status <> 'unmatched' then
    raise exception 'only an unmatched result can be matched' using errcode = 'P0001';
  end if;
  if not exists (select 1 from sutra.patients where id = p_patient and clinic_id = v_result.clinic_id) then
    raise exception 'patient does not belong to this clinic' using errcode = '22023';
  end if;
  update sutra.results set patient_id = p_patient, status = 'matched', updated_at = now() where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'matched', 'unmatched', 'matched', null,
    jsonb_build_object('patientId', p_patient));
end
$$;

create or replace function sutra.assign_result(
  p_result uuid,
  p_owner uuid default null,
  p_due timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_owner uuid := coalesce(p_owner, sutra.current_actor_id());
  v_due timestamptz;
begin
  select * into v_result from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not sutra.is_clinic_member(v_result.clinic_id) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;
  if v_result.status not in ('matched', 'owned') then
    raise exception 'match the report and keep it open before assigning an owner' using errcode = 'P0001';
  end if;
  if not sutra.is_clinic_member(v_result.clinic_id) or not exists (
    select 1 from sutra.memberships m where m.clinic_id = v_result.clinic_id and m.user_id = v_owner and m.active
  ) then
    raise exception 'the owner must be an active clinic member' using errcode = '22023';
  end if;
  v_due := coalesce(p_due, now() + case v_result.lab_flag
    when 'critical' then interval '15 minutes'
    when 'abnormal' then interval '24 hours'
    else interval '48 hours' end);
  update sutra.results
    set owner_id = v_owner, due_at = v_due, status = 'owned', updated_at = now()
    where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'assigned', v_result.status, 'owned', null,
    jsonb_build_object('ownerId', v_owner, 'dueAt', v_due));
end
$$;

create or replace function sutra.acknowledge_result(p_result uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  select * into v_result from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v_result.clinic_id, 'clinician') or sutra.is_clinic_member(v_result.clinic_id, 'reviewer')) then
    raise exception 'clinician or reviewer capability required' using errcode = '42501';
  end if;
  if v_result.status <> 'owned' then
    raise exception 'the result must be owned before acknowledgement' using errcode = 'P0001';
  end if;
  update sutra.results
    set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = v_actor, updated_at = now()
    where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'acknowledged', 'owned', 'acknowledged', p_note,
    jsonb_build_object('acknowledgedBy', v_actor));
end
$$;

create or replace function sutra.record_result_informed(
  p_result uuid,
  p_channel text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  select * into v_result from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v_result.clinic_id, 'clinician') or sutra.is_clinic_member(v_result.clinic_id, 'reviewer')) then
    raise exception 'clinician or reviewer capability required' using errcode = '42501';
  end if;
  if v_result.status <> 'acknowledged' then
    raise exception 'acknowledge the result before recording patient communication' using errcode = 'P0001';
  end if;
  if p_channel not in ('call', 'whatsapp', 'sms', 'in_person', 'letter', 'other') then
    raise exception 'unknown communication channel' using errcode = '22023';
  end if;
  update sutra.results
    set status = 'patient_informed', informed_at = now(), informed_by = v_actor,
        informed_channel = p_channel, updated_at = now()
    where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'patient_informed', 'acknowledged', 'patient_informed', p_note,
    jsonb_build_object('channel', p_channel));
end
$$;

create or replace function sutra.escalate_result(p_result uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'escalation requires a reason' using errcode = '22023';
  end if;
  select * into v_result from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not sutra.is_clinic_member(v_result.clinic_id) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;
  if v_result.status in ('patient_informed', 'closed') then
    raise exception 'a completed result cannot be escalated' using errcode = 'P0001';
  end if;
  update sutra.results set escalation_level = escalation_level + 1, updated_at = now() where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'escalated', v_result.status, v_result.status, p_reason,
    jsonb_build_object('level', v_result.escalation_level + 1));
end
$$;

create or replace function sutra.close_result(p_result uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  if nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'closing a result requires a note' using errcode = '22023';
  end if;
  select * into v_result from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v_result.clinic_id, 'clinician') or sutra.is_clinic_member(v_result.clinic_id, 'reviewer')) then
    raise exception 'clinician or reviewer capability required' using errcode = '42501';
  end if;
  if v_result.status <> 'patient_informed' then
    raise exception 'record patient communication before closing the result' using errcode = 'P0001';
  end if;
  update sutra.results
    set status = 'closed', closed_at = now(), closed_by = v_actor, updated_at = now()
    where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'closed', 'patient_informed', 'closed', p_note);
end
$$;

grant execute on function sutra.create_result(uuid, uuid, uuid, text, text, text, timestamptz, text, text, text, text, text, text) to :api_role;
grant execute on function sutra.match_result(uuid, uuid) to :api_role;
grant execute on function sutra.assign_result(uuid, uuid, timestamptz) to :api_role;
grant execute on function sutra.acknowledge_result(uuid, text) to :api_role;
grant execute on function sutra.record_result_informed(uuid, text, text) to :api_role;
grant execute on function sutra.escalate_result(uuid, text) to :api_role;
grant execute on function sutra.close_result(uuid, text) to :api_role;

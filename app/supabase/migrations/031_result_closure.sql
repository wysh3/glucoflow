-- 031_result_closure.sql
-- The patient-side last mile.
--
-- A result is not closed because a clinician tapped acknowledge. The clinic has
-- to prove three separate things: the lab value was echoed back by the person who
-- took the call, the patient (or a documented alternative) was contacted, and the
-- next administrative step was recorded. A patient who cannot be reached is a
-- first-class disposition; it must never be recorded as "informed".
--
-- This migration is deliberately additive. The original state machine stays; the
-- new columns and procedures make the unsafe paths explicit and auditable.

alter table sutra.results
  add column if not exists lab_released_at timestamptz,
  add column if not exists lab_hold boolean not null default false,
  add column if not exists lab_notifier_name text,
  add column if not exists lab_notifier_role text,
  add column if not exists acknowledged_value_text text,
  add column if not exists acknowledged_flag text,
  add column if not exists lab_read_back_value_text text,
  add column if not exists lab_read_back_at timestamptz,
  add column if not exists communication_outcome text,
  add column if not exists communication_recipient text,
  add column if not exists communication_relation text,
  add column if not exists communication_language text,
  add column if not exists next_step text,
  add column if not exists next_step_due_at timestamptz,
  add column if not exists next_step_completed_at timestamptz,
  add column if not exists teach_back_confirmed boolean not null default false,
  add column if not exists disposition text,
  add column if not exists closed_without_informed boolean not null default false,
  add column if not exists last_escalated_at timestamptz,
  add column if not exists result_kind text not null default 'unscheduled',
  add column if not exists monitoring_protocol text,
  add column if not exists monitoring_started_at timestamptz,
  add column if not exists monitoring_due_at timestamptz;

update sutra.results
   set lab_released_at = coalesce(lab_released_at, report_received_at)
 where lab_released_at is null;

alter table sutra.results
  drop constraint if exists results_acknowledged_flag_check,
  add constraint results_acknowledged_flag_check
    check (acknowledged_flag is null or acknowledged_flag in ('critical', 'abnormal', 'normal', 'unknown')),
  drop constraint if exists results_communication_outcome_check,
  add constraint results_communication_outcome_check
    check (communication_outcome is null or communication_outcome in (
      'informed_patient', 'informed_caregiver', 'informed_treating_doctor',
      'declined', 'unreachable', 'invalid_number', 'deceased', 'transferred'
    )),
  drop constraint if exists results_next_step_check,
  add constraint results_next_step_check
    check (next_step is null or next_step in (
      'book_appointment', 'repeat_test', 'see_specialist', 'collect_report',
      'urgent_attendance', 'other'
    )),
  drop constraint if exists results_disposition_check,
  add constraint results_disposition_check
    check (disposition is null or disposition in (
      'reviewed_action', 'ongoing_management', 'no_action', 'transferred',
      'unreachable', 'declined', 'deceased', 'invalid_number'
    )),
  drop constraint if exists results_result_kind_check,
  add constraint results_result_kind_check
    check (result_kind in ('unscheduled', 'monitoring'));

create table if not exists sutra.result_attempts (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references sutra.results (id) on delete cascade,
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  actor_id uuid references sutra.app_users (id) on delete set null,
  channel text not null check (channel in ('call', 'whatsapp', 'sms', 'in_person', 'letter', 'other')),
  outcome text not null check (outcome in (
    'informed_patient', 'informed_caregiver', 'informed_treating_doctor',
    'declined', 'unreachable', 'invalid_number', 'deceased', 'transferred'
  )),
  recipient text,
  relation text,
  language text,
  note text,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists result_attempts_result_created_idx
  on sutra.result_attempts (result_id, attempted_at, created_at);

create table if not exists sutra.result_notifications (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references sutra.results (id) on delete cascade,
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  level integer not null check (level between 1 and 3),
  recipient_role text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'sms', 'whatsapp', 'email')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists result_notifications_result_created_idx
  on sutra.result_notifications (result_id, created_at desc);

alter table sutra.result_attempts enable row level security;
alter table sutra.result_notifications enable row level security;

drop policy if exists result_attempts_clinic_read on sutra.result_attempts;
create policy result_attempts_clinic_read on sutra.result_attempts
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id));

drop policy if exists result_notifications_clinic_read on sutra.result_notifications;
create policy result_notifications_clinic_read on sutra.result_notifications
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id));

grant select on sutra.result_attempts, sutra.result_notifications to :api_role;

-- The event table is append-only. Adding new event names does not change that.
alter table sutra.result_events
  drop constraint if exists result_events_event_type_check;
alter table sutra.result_events
  add constraint result_events_event_type_check check (event_type in (
    'received', 'matched', 'assigned', 'acknowledged', 'patient_informed',
    'escalated', 'closed', 'communication_attempt', 'auto_escalated',
    'next_step_completed'
  ));

-- Numeric values printed as 6.4 and 6.40 are the same echo. Text values are
-- compared after trimming and case folding; no clinical interpretation is done.
create or replace function sutra.result_value_matches(p_expected text, p_actual text)
returns boolean
language sql
immutable
as $$
  select case
    when nullif(btrim(coalesce(p_expected, '')), '') is null then false
    when nullif(btrim(coalesce(p_actual, '')), '') is null then false
    when lower(btrim(p_expected)) = lower(btrim(p_actual)) then true
    when btrim(p_expected) ~ '^[0-9]+([.][0-9]+)?$'
     and btrim(p_actual) ~ '^[0-9]+([.][0-9]+)?$'
      then btrim(p_expected)::numeric = btrim(p_actual)::numeric
    else false
  end;
$$;

grant execute on function sutra.result_value_matches(text, text) to :api_role;

-- New creates carry the lab release time and, for a critical, the notifier.
-- The due clock starts at lab release, not when the PDF reached a WhatsApp folder.
create or replace function sutra.create_result_v2(
  p_clinic uuid,
  p_patient uuid,
  p_document uuid,
  p_external_ref text,
  p_source_channel text,
  p_lab_name text,
  p_received_at timestamptz,
  p_lab_released_at timestamptz,
  p_patient_name_raw text,
  p_patient_identifier_raw text,
  p_test_name text,
  p_value_text text,
  p_unit text,
  p_lab_flag text,
  p_lab_notifier_name text,
  p_lab_notifier_role text,
  p_lab_hold boolean,
  p_result_kind text,
  p_monitoring_protocol text,
  p_monitoring_started_at timestamptz,
  p_monitoring_due_at timestamptz
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
  v_release timestamptz := coalesce(p_lab_released_at, p_received_at, now());
  v_due timestamptz;
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
  if coalesce(p_result_kind, 'unscheduled') not in ('unscheduled', 'monitoring') then
    raise exception 'unknown result kind' using errcode = '22023';
  end if;
  if p_result_kind = 'monitoring' and nullif(btrim(coalesce(p_monitoring_protocol, '')), '') is null then
    raise exception 'a monitoring receipt needs a protocol label' using errcode = '22023';
  end if;
  v_status := case when v_patient is null then 'unmatched' else 'matched' end;
  v_due := case
    when coalesce(p_lab_hold, false) then null
    else v_release + case p_lab_flag
      when 'critical' then interval '15 minutes'
      when 'abnormal' then interval '24 hours'
      else interval '48 hours' end
  end;
  insert into sutra.results (
    clinic_id, patient_id, document_id, external_ref, source_channel, lab_name,
    report_received_at, lab_released_at, lab_hold, patient_name_raw, patient_identifier_raw,
    test_name, value_text, unit, lab_flag, lab_notifier_name, lab_notifier_role,
    result_kind, monitoring_protocol, monitoring_started_at, monitoring_due_at,
    status, due_at, created_by
  ) values (
    p_clinic, v_patient, p_document, nullif(btrim(p_external_ref), ''), p_source_channel, p_lab_name,
    coalesce(p_received_at, now()), v_release, coalesce(p_lab_hold, false),
    p_patient_name_raw, p_patient_identifier_raw, p_test_name, p_value_text, p_unit, p_lab_flag,
    nullif(btrim(coalesce(p_lab_notifier_name, '')), ''),
    nullif(btrim(coalesce(p_lab_notifier_role, '')), ''),
    coalesce(p_result_kind, 'unscheduled'),
    nullif(btrim(coalesce(p_monitoring_protocol, '')), ''),
    p_monitoring_started_at,
    p_monitoring_due_at,
    v_status, v_due, v_actor
  ) returning id into v_result;
  perform sutra.result_event(v_result, v_actor, 'received', null, v_status, null,
    jsonb_build_object(
      'labFlag', p_lab_flag,
      'criticalitySource', 'lab_flag',
      'labReleasedAt', v_release,
      'labHold', coalesce(p_lab_hold, false),
      'dueAt', v_due,
      'resultKind', coalesce(p_result_kind, 'unscheduled'),
      'monitoringProtocol', p_monitoring_protocol
    ));
  return v_result;
end
$$;

grant execute on function sutra.create_result_v2(
  uuid, uuid, uuid, text, text, text, timestamptz, timestamptz, text, text, text, text, text, text, text, text, boolean,
  text, text, timestamptz, timestamptz
) to :api_role;

-- Assignment must not reset the lab-release clock. The owner can add a manual
-- due time, but the default is the earlier of the existing due time and a new one.
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
    select 1 from sutra.memberships m
     where m.clinic_id = v_result.clinic_id and m.user_id = v_owner and m.active
  ) then
    raise exception 'the owner must be an active clinic member' using errcode = '22023';
  end if;
  v_due := coalesce(
    p_due,
    v_result.due_at,
    coalesce(v_result.lab_released_at, v_result.report_received_at, now()) + case v_result.lab_flag
      when 'critical' then interval '15 minutes'
      when 'abnormal' then interval '24 hours'
      else interval '48 hours' end
  );
  if v_result.lab_hold then
    v_due := null;
  end if;
  update sutra.results
    set owner_id = v_owner, due_at = v_due, status = 'owned', updated_at = now()
    where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'assigned', v_result.status, 'owned', null,
    jsonb_build_object('ownerId', v_owner, 'dueAt', v_due));
end
$$;

-- Acknowledge is a value echo, not a click. For a critical result the person who
-- takes the lab call records who called and the value they read back. This is the
-- lab-to-clinician read-back; patient communication is a separate procedure.
drop function if exists sutra.acknowledge_result(uuid, text);

create or replace function sutra.acknowledge_result(
  p_result uuid,
  p_note text,
  p_value_text text,
  p_flag text,
  p_notifier_name text,
  p_notifier_role text,
  p_read_back_value text
)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_readback text := nullif(btrim(coalesce(p_read_back_value, '')), '');
  v_notifier text := nullif(btrim(coalesce(p_notifier_name, '')), '');
  v_role text := nullif(btrim(coalesce(p_notifier_role, '')), '');
begin
  select * into v_result from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v_result.clinic_id, 'clinician') or sutra.is_clinic_member(v_result.clinic_id, 'reviewer')) then
    raise exception 'clinician or reviewer capability required' using errcode = '42501';
  end if;
  if v_result.status <> 'owned' then
    raise exception 'the result must be owned before acknowledgement' using errcode = 'P0001';
  end if;
  if not sutra.result_value_matches(v_result.value_text, p_value_text) then
    raise exception 'the value you entered does not match the report. Read the report and enter the printed value.' using errcode = '22023';
  end if;
  if p_flag is null or p_flag <> v_result.lab_flag then
    raise exception 'select the lab flag printed on the report' using errcode = '22023';
  end if;
  if v_result.lab_flag = 'critical' then
    if v_notifier is null or v_role is null then
      raise exception 'record who called from the lab and their role' using errcode = '22023';
    end if;
    if v_readback is null or not sutra.result_value_matches(v_result.value_text, v_readback) then
      raise exception 'the read-back value does not match the report' using errcode = '22023';
    end if;
  elsif v_readback is not null and not sutra.result_value_matches(v_result.value_text, v_readback) then
    raise exception 'the read-back value does not match the report' using errcode = '22023';
  end if;
  update sutra.results
     set status = 'acknowledged',
         acknowledged_at = now(),
         acknowledged_by = v_actor,
         acknowledged_value_text = btrim(p_value_text),
         acknowledged_flag = p_flag,
         lab_notifier_name = v_notifier,
         lab_notifier_role = v_role,
         lab_read_back_value_text = v_readback,
         lab_read_back_at = case when v_readback is not null then now() else null end,
         read_back_confirmed = v_readback is not null,
         read_back_at = case when v_readback is not null then now() else null end,
         read_back_by = case when v_readback is not null then v_actor else null end,
         updated_at = now()
   where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'acknowledged', 'owned', 'acknowledged', p_note,
    jsonb_build_object(
      'acknowledgedBy', v_actor,
      'valueEcho', btrim(p_value_text),
      'flagEcho', p_flag,
      'notifier', v_notifier,
      'notifierRole', v_role,
      'readBack', v_readback
    ));
end
$$;

grant execute on function sutra.acknowledge_result(uuid, text, text, text, text, text, text) to :api_role;

-- Patient communication is not a read-back. A patient cannot verify a potassium;
-- the clinic tells them the report is ready and records the next administrative
-- step. An unreachable patient is recorded as unreachable after attempts, not as
-- informed.
drop function if exists sutra.record_result_informed(uuid, text, text, boolean);
drop function if exists sutra.record_result_informed(uuid, text, text);

create or replace function sutra.record_result_communication(
  p_result uuid,
  p_channel text,
  p_outcome text,
  p_recipient text,
  p_relation text,
  p_language text,
  p_note text,
  p_attempted_at timestamptz,
  p_next_step text,
  p_teach_back boolean,
  p_next_step_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_attempt timestamptz := coalesce(p_attempted_at, now());
  v_informed boolean;
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
  if p_outcome not in (
    'informed_patient', 'informed_caregiver', 'informed_treating_doctor',
    'declined', 'unreachable', 'invalid_number', 'deceased', 'transferred'
  ) then
    raise exception 'unknown patient communication outcome' using errcode = '22023';
  end if;
  v_informed := p_outcome in ('informed_patient', 'informed_caregiver', 'informed_treating_doctor');
  if v_informed and nullif(btrim(coalesce(p_recipient, '')), '') is null then
    raise exception 'record who was spoken to' using errcode = '22023';
  end if;
  if v_informed and (p_next_step is null or p_next_step not in (
    'book_appointment', 'repeat_test', 'see_specialist', 'collect_report', 'urgent_attendance', 'other'
  )) then
    raise exception 'record the next administrative step' using errcode = '22023';
  end if;
  if not v_informed and p_next_step is not null then
    raise exception 'a next step can only be recorded when the patient or caregiver was reached' using errcode = '22023';
  end if;

  insert into sutra.result_attempts (
    result_id, clinic_id, actor_id, channel, outcome, recipient, relation, language, note, attempted_at
  ) values (
    p_result, v_result.clinic_id, v_actor, p_channel, p_outcome,
    nullif(btrim(coalesce(p_recipient, '')), ''),
    nullif(btrim(coalesce(p_relation, '')), ''),
    nullif(btrim(coalesce(p_language, '')), ''),
    p_note, v_attempt
  );

  if v_informed then
    update sutra.results
       set status = 'patient_informed',
           informed_at = v_attempt,
           informed_by = v_actor,
           informed_channel = p_channel,
           communication_outcome = p_outcome,
           communication_recipient = nullif(btrim(coalesce(p_recipient, '')), ''),
           communication_relation = nullif(btrim(coalesce(p_relation, '')), ''),
           communication_language = nullif(btrim(coalesce(p_language, '')), ''),
           next_step = p_next_step,
           next_step_due_at = coalesce(p_next_step_due_at, v_attempt + interval '7 days'),
           teach_back_confirmed = coalesce(p_teach_back, false),
           read_back_confirmed = true,
           read_back_at = coalesce(read_back_at, v_attempt),
           read_back_by = coalesce(read_back_by, v_actor),
           updated_at = now()
     where id = p_result;
    perform sutra.result_event(p_result, v_actor, 'patient_informed', 'acknowledged', 'patient_informed', p_note,
      jsonb_build_object(
        'channel', p_channel,
        'outcome', p_outcome,
        'recipient', p_recipient,
        'relation', p_relation,
        'language', p_language,
        'nextStep', p_next_step,
        'teachBack', coalesce(p_teach_back, false),
        'attemptedAt', v_attempt
      ));
  else
    update sutra.results
       set communication_outcome = p_outcome,
           communication_recipient = nullif(btrim(coalesce(p_recipient, '')), ''),
           communication_relation = nullif(btrim(coalesce(p_relation, '')), ''),
           communication_language = nullif(btrim(coalesce(p_language, '')), ''),
           updated_at = now()
     where id = p_result;
    perform sutra.result_event(p_result, v_actor, 'communication_attempt', 'acknowledged', 'acknowledged', p_note,
      jsonb_build_object(
        'channel', p_channel,
        'outcome', p_outcome,
        'recipient', p_recipient,
        'relation', p_relation,
        'language', p_language,
        'attemptedAt', v_attempt
      ));
  end if;
end
$$;

grant execute on function sutra.record_result_communication(
  uuid, text, text, text, text, text, text, timestamptz, text, boolean, timestamptz
) to :api_role;

create or replace function sutra.mark_next_step_completed(
  p_result uuid,
  p_note text,
  p_completed_at timestamptz default null
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
  if v_result.status not in ('patient_informed', 'closed') then
    raise exception 'record patient communication before completing the next step' using errcode = 'P0001';
  end if;
  update sutra.results
     set next_step_completed_at = coalesce(p_completed_at, now()), updated_at = now()
   where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'next_step_completed', v_result.status, v_result.status, p_note,
    jsonb_build_object('completedAt', coalesce(p_completed_at, now())));
end
$$;

grant execute on function sutra.mark_next_step_completed(uuid, text, timestamptz) to :api_role;

-- A patient who cannot be reached must be closable without a false affirmation.
-- Unreachable/invalid require two attempts; declined/deceased/transferred require
-- one documented attempt.
drop function if exists sutra.close_result(uuid, text);

create or replace function sutra.close_result(
  p_result uuid,
  p_note text,
  p_disposition text
)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_attempts integer;
  v_without boolean;
begin
  if nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'closing a result requires a note' using errcode = '22023';
  end if;
  select * into v_result from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v_result.clinic_id, 'clinician') or sutra.is_clinic_member(v_result.clinic_id, 'reviewer')) then
    raise exception 'clinician or reviewer capability required' using errcode = '42501';
  end if;
  if v_result.status = 'closed' then
    raise exception 'this receipt is already closed' using errcode = 'P0001';
  end if;
  select count(*) into v_attempts from sutra.result_attempts where result_id = p_result;

  if v_result.status = 'patient_informed' then
    if p_disposition not in ('reviewed_action', 'ongoing_management', 'no_action', 'transferred') then
      raise exception 'choose a disposition for a patient who was reached' using errcode = '22023';
    end if;
    v_without := false;
  elsif v_result.status = 'acknowledged'
    and v_result.communication_outcome in ('unreachable', 'invalid_number', 'declined', 'deceased', 'transferred') then
    if p_disposition not in ('unreachable', 'invalid_number', 'declined', 'deceased', 'transferred') then
      raise exception 'the disposition must match the recorded communication outcome' using errcode = '22023';
    end if;
    if p_disposition in ('unreachable', 'invalid_number') and v_attempts < 2 then
      raise exception 'record at least two contact attempts before closing an unreachable patient' using errcode = '22023';
    end if;
    if p_disposition in ('declined', 'deceased', 'transferred') and v_attempts < 1 then
      raise exception 'record the contact attempt before closing this receipt' using errcode = '22023';
    end if;
    v_without := true;
  else
    raise exception 'record patient communication, or a documented unsuccessful attempt, before closing' using errcode = 'P0001';
  end if;

  update sutra.results
     set status = 'closed',
         closed_at = now(),
         closed_by = v_actor,
         disposition = p_disposition,
         closed_without_informed = v_without,
         updated_at = now()
   where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'closed', v_result.status, 'closed', p_note,
    jsonb_build_object('disposition', p_disposition, 'closedWithoutInformed', v_without, 'attempts', v_attempts));
end
$$;

grant execute on function sutra.close_result(uuid, text, text) to :api_role;

-- A real escalation, not a button. The API calls this on a timer; each open,
-- overdue receipt gets one escalation level and one queued notification. The
-- notification adapter is deliberately separate: the evidence is the event and
-- the outbox row, not a claim that an SMS was delivered.
create or replace function sutra.escalate_overdue_results(p_clinic uuid default null)
returns integer
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  r record;
  v_count integer := 0;
  v_role text;
begin
  if p_clinic is not null and not sutra.is_clinic_member(p_clinic) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;
  for r in
    select * from sutra.results
     where (p_clinic is null or clinic_id = p_clinic)
       and status in ('unmatched', 'matched', 'owned', 'acknowledged')
       and due_at is not null
       and due_at < now()
       and escalation_level < 3
       and (last_escalated_at is null or last_escalated_at < now() - interval '10 minutes')
     order by due_at asc
     for update skip locked
  loop
    v_role := case r.escalation_level
      when 0 then 'medical_superintendent'
      when 1 then 'medical_superintendent'
      else 'quality_head' end;
    update sutra.results
       set escalation_level = r.escalation_level + 1,
           last_escalated_at = now(),
           updated_at = now()
     where id = r.id;
    perform sutra.result_event(r.id, null, 'auto_escalated', r.status, r.status,
      'Overdue receipt escalated to ' || replace(v_role, '_', ' ') || '.',
      jsonb_build_object('level', r.escalation_level + 1, 'recipientRole', v_role, 'dueAt', r.due_at));
    insert into sutra.result_notifications (result_id, clinic_id, level, recipient_role, channel, status)
    values (r.id, r.clinic_id, r.escalation_level + 1, v_role, 'in_app', 'queued');
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

grant execute on function sutra.escalate_overdue_results(uuid) to :api_role;

-- The closure metric is the product's spine: not "acknowledged", but "the patient
-- was reached and the next step was recorded". The denominator is every lab-flagged
-- abnormal or critical result in the clinic, including the ones still open.
create or replace function sutra.result_closure_stats(p_clinic uuid)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_total integer;
  v_closed_7d integer;
  v_open_last_mile integer;
  v_informed integer;
  v_teach_back integer;
  v_next_completed integer;
  v_unreachable integer;
  v_median_contact numeric;
  v_critical_open integer;
  v_monitoring_total integer;
  v_monitoring_closed_7d integer;
  v_monitoring_open integer;
begin
  if not sutra.is_clinic_member(p_clinic) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;
  select
    count(*) filter (where lab_flag in ('critical', 'abnormal')),
    count(*) filter (where lab_flag in ('critical', 'abnormal') and informed_at is not null
      and informed_at <= coalesce(lab_released_at, report_received_at) + interval '7 days'),
    count(*) filter (where lab_flag in ('critical', 'abnormal') and status <> 'closed'),
    count(*) filter (where informed_at is not null),
    count(*) filter (where informed_at is not null and teach_back_confirmed),
    count(*) filter (where next_step_completed_at is not null),
    count(*) filter (where closed_without_informed),
    count(*) filter (where lab_flag = 'critical' and status not in ('patient_informed', 'closed')),
    round(percentile_cont(0.5) within group (
      order by extract(epoch from (informed_at - coalesce(lab_released_at, report_received_at))) / 60
    ) filter (where informed_at is not null))::numeric,
    count(*) filter (where result_kind = 'monitoring'),
    count(*) filter (where result_kind = 'monitoring' and informed_at is not null
      and informed_at <= coalesce(monitoring_due_at, coalesce(lab_released_at, report_received_at) + interval '7 days')),
    count(*) filter (where result_kind = 'monitoring' and status <> 'closed')
  into v_total, v_closed_7d, v_open_last_mile, v_informed, v_teach_back, v_next_completed,
       v_unreachable, v_critical_open, v_median_contact, v_monitoring_total, v_monitoring_closed_7d,
       v_monitoring_open
  from sutra.results where clinic_id = p_clinic;

  return jsonb_build_object(
    'eligible', coalesce(v_total, 0),
    'closedWithin7Days', coalesce(v_closed_7d, 0),
    'openLastMile', coalesce(v_open_last_mile, 0),
    'informed', coalesce(v_informed, 0),
    'teachBackConfirmed', coalesce(v_teach_back, 0),
    'nextStepCompleted', coalesce(v_next_completed, 0),
    'unreachable', coalesce(v_unreachable, 0),
    'criticalOpen', coalesce(v_critical_open, 0),
    'medianContactMinutes', v_median_contact,
    'closureRate7d', case when coalesce(v_total, 0) = 0 then null
      else round((v_closed_7d::numeric / v_total::numeric), 3) end,
    'teachBackShare', case when coalesce(v_informed, 0) = 0 then null
      else round((v_teach_back::numeric / v_informed::numeric), 3) end,
    'nextStepCompletionShare', case when coalesce(v_informed, 0) = 0 then null
      else round((v_next_completed::numeric / v_informed::numeric), 3) end,
    'monitoringEligible', coalesce(v_monitoring_total, 0),
    'monitoringClosedWithinWindow', coalesce(v_monitoring_closed_7d, 0),
    'monitoringOpen', coalesce(v_monitoring_open, 0),
    'monitoringClosureRate', case when coalesce(v_monitoring_total, 0) = 0 then null
      else round((v_monitoring_closed_7d::numeric / v_monitoring_total::numeric), 3) end
  );
end
$$;

grant execute on function sutra.result_closure_stats(uuid) to :api_role;

-- The public verifier returns a stage, never a patient name, test value or clinic.
create or replace function sutra.verify_receipt_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = sutra, public, extensions, pg_temp
as $$
declare
  v_result uuid;
  v_clinic uuid;
  v_status text;
  v_outcome text;
  v_closed_without boolean;
  v_next_completed timestamptz;
  r record;
  v_prev text := 'GENESIS';
  v_count integer := 0;
  v_head text;
  v_stage text;
begin
  select id, clinic_id, status, communication_outcome, closed_without_informed, next_step_completed_at
    into v_result, v_clinic, v_status, v_outcome, v_closed_without, v_next_completed
    from sutra.results
   where receipt_code = upper(btrim(p_code));
  if v_result is null then
    return jsonb_build_object('found', false, 'valid', false, 'eventCount', 0, 'head', null, 'stage', 'not_found');
  end if;

  for r in
    select * from sutra.result_events
    where result_id = v_result
    order by created_at, id
  loop
    v_count := v_count + 1;
    if r.prev_hash <> v_prev then
      return jsonb_build_object('found', true, 'valid', false, 'eventCount', v_count - 1, 'head', v_head, 'stage', 'invalid');
    end if;
    if r.event_hash <> sutra.result_event_digest(
      r.result_id, r.clinic_id, r.event_type, r.actor_id,
      r.from_status, r.to_status, r.note, r.detail, r.created_at, r.prev_hash
    ) then
      return jsonb_build_object('found', true, 'valid', false, 'eventCount', v_count - 1, 'head', v_head, 'stage', 'invalid');
    end if;
    v_prev := r.event_hash;
    v_head := r.event_hash;
  end loop;

  v_stage := case
    when v_status = 'closed' and v_closed_without then 'closed_unreachable'
    when v_status = 'closed' then 'closed'
    when v_next_completed is not null then 'next_step_completed'
    when v_status = 'patient_informed' then 'patient_contacted'
    when v_status = 'acknowledged' then 'acknowledged'
    else 'received'
  end;
  return jsonb_build_object(
    'found', true, 'valid', true, 'eventCount', v_count, 'head', v_head, 'stage', v_stage
  );
end
$$;

grant execute on function sutra.verify_receipt_code(text) to :api_role;

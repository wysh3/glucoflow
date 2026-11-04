-- 035_obligation_lifecycle.sql
-- Role-separated obligation lifecycle: custody -> review -> communication -> terminal.
--
-- Additive by design. The legacy `status` column stays the projection the current
-- UI reads; the new procedures maintain it together with the phase columns. The
-- old procedures are untouched so the shipped flow keeps working. A follow-up
-- migration retires them and adds the consistency constraint once the client
-- reads the phase columns instead of `status`.

-- 1. Roles -------------------------------------------------------------------

alter table sutra.memberships
  add column if not exists desk boolean not null default false,
  add column if not exists nurse boolean not null default false,
  add column if not exists quality boolean not null default false;

create or replace function sutra.is_clinic_member(p_clinic uuid, p_capability text default null)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
    from sutra.memberships m
    where m.clinic_id = p_clinic
      and m.user_id = sutra.current_actor_id()
      and m.active
      and (
        p_capability is null
        or (p_capability = 'reviewer' and m.reviewer)
        or (p_capability = 'clinician' and m.clinician)
        or (p_capability = 'administrator' and m.administrator)
        or (p_capability = 'desk' and m.desk)
        or (p_capability = 'nurse' and m.nurse)
        or (p_capability = 'quality' and m.quality)
      )
  );
$$;

-- 2. Phase columns -----------------------------------------------------------

alter table sutra.results
  add column if not exists custody_state text not null default 'received',
  add column if not exists review_state text not null default 'pending',
  add column if not exists communication_state text not null default 'pending',
  add column if not exists terminal_state text,
  add column if not exists custody_actor_id uuid references sutra.app_users (id) on delete set null,
  add column if not exists review_actor_id uuid references sutra.app_users (id) on delete set null,
  add column if not exists communication_actor_id uuid references sutra.app_users (id) on delete set null,
  add column if not exists custody_due_at timestamptz,
  add column if not exists review_due_at timestamptz,
  add column if not exists communication_due_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_seconds integer not null default 0,
  add column if not exists pause_reason text,
  add column if not exists flag_disputed boolean not null default false,
  add column if not exists clinician_flag text,
  add column if not exists dispute_reason text,
  add column if not exists source_span jsonb,
  add column if not exists match_confidence numeric(5,4);

alter table sutra.results
  drop constraint if exists results_custody_state_check,
  add constraint results_custody_state_check
    check (custody_state in ('received', 'accepted', 'assigned')),
  drop constraint if exists results_review_state_check,
  add constraint results_review_state_check
    check (review_state in ('pending', 'seen')),
  drop constraint if exists results_communication_state_check,
  add constraint results_communication_state_check
    check (communication_state in ('pending', 'in_progress', 'informed', 'exception')),
  drop constraint if exists results_terminal_state_check,
  add constraint results_terminal_state_check
    check (terminal_state is null or terminal_state in (
      'closed', 'closed_unreachable', 'declined', 'transferred', 'deceased'
    )),
  drop constraint if exists results_clinician_flag_check,
  add constraint results_clinician_flag_check
    check (clinician_flag is null or clinician_flag in ('critical', 'abnormal', 'normal', 'unknown'));

create index if not exists results_line_idx
  on sutra.results (clinic_id, owner_id, review_state, terminal_state, review_due_at);
create index if not exists results_calls_idx
  on sutra.results (clinic_id, communication_state, terminal_state, communication_due_at);
create index if not exists results_intake_idx
  on sutra.results (clinic_id, custody_state, terminal_state, report_received_at);

-- 3. Backfill the phase from the legacy status -------------------------------

update sutra.results r
set custody_state = case
      when r.status in ('unmatched', 'matched') then 'received'
      else 'assigned'
    end,
    review_state = case
      when r.status in ('acknowledged', 'patient_informed', 'closed') then 'seen'
      else 'pending'
    end,
    communication_state = case
      when r.status = 'patient_informed' then 'informed'
      when r.status = 'closed' and not r.closed_without_informed and r.informed_at is not null then 'informed'
      when r.status = 'closed' then 'exception'
      else 'pending'
    end,
    terminal_state = case
      when r.status = 'closed' and (r.closed_without_informed or r.informed_at is null) then 'closed_unreachable'
      when r.status = 'closed' then 'closed'
      else null
    end,
    custody_actor_id = case when r.status <> 'unmatched' then r.owner_id else null end,
    review_actor_id = case when r.status in ('acknowledged', 'patient_informed', 'closed') then r.acknowledged_by else null end,
    communication_actor_id = case when r.status in ('patient_informed', 'closed') then r.informed_by else null end,
    custody_due_at = coalesce(r.custody_due_at, r.due_at),
    review_due_at = coalesce(r.review_due_at, r.due_at)
where r.custody_state = 'received'
  and r.review_state = 'pending'
  and r.communication_state = 'pending'
  and r.terminal_state is null
  and r.status <> 'unmatched';

update sutra.results r
set custody_state = 'received',
    review_state = 'pending',
    communication_state = 'pending',
    terminal_state = null
where r.status = 'unmatched'
  and r.custody_state = 'received'
  and r.review_state = 'pending'
  and r.communication_state = 'pending'
  and r.terminal_state is null
  and r.owner_id is not null;

-- 4. Events -----------------------------------------------------------------

alter table sutra.result_events
  add column if not exists actor_role text,
  add column if not exists source_span_hash text;

alter table sutra.result_events
  drop constraint if exists result_events_actor_role_check,
  add constraint result_events_actor_role_check
    check (actor_role is null or actor_role in ('desk', 'nurse', 'clinician', 'quality', 'system')),
  drop constraint if exists result_events_event_type_check,
  add constraint result_events_event_type_check check (event_type in (
    'received', 'matched', 'assigned', 'acknowledged', 'patient_informed',
    'escalated', 'closed', 'communication_attempt', 'auto_escalated',
    'next_step_completed', 'custody_accepted', 'seen', 'closed_unreachable',
    'paused', 'resumed', 'reassigned', 'reassigned_clinician'
  ));

drop function if exists sutra.result_event(uuid, uuid, text, text, text, text, jsonb);

create or replace function sutra.result_event(
  p_result uuid,
  p_actor uuid,
  p_event_type text,
  p_from text,
  p_to text,
  p_note text default null,
  p_detail jsonb default '{}'::jsonb,
  p_actor_role text default null,
  p_source_span_hash text default null
)
returns void
language sql
security definer
set search_path = sutra, pg_temp
as $$
  insert into sutra.result_events (
    result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail,
    actor_role, source_span_hash
  )
  select p_result, r.clinic_id, p_actor, p_event_type, p_from, p_to, p_note, p_detail,
         p_actor_role, p_source_span_hash
  from sutra.results r where r.id = p_result;
$$;

-- 5. Clocks and worklists ----------------------------------------------------

create or replace function sutra.obligation_sla(p_stage text, p_flag text)
returns interval
language sql
immutable
as $$
  select case p_stage
    when 'custody' then
      case when p_flag = 'critical' then interval '15 minutes' else interval '4 hours' end
    when 'review' then
      case when p_flag = 'critical' then interval '60 minutes' else interval '24 hours' end
    when 'communication' then
      case when p_flag = 'critical' then interval '60 minutes' else interval '24 hours' end
  end;
$$;

create or replace function sutra.obligation_breach(r sutra.results)
returns timestamptz
language sql
stable
as $$
  select case
    when r.paused_at is not null then null
    else nullif(least(
      coalesce(r.custody_due_at, 'infinity'::timestamptz),
      coalesce(r.review_due_at, 'infinity'::timestamptz),
      coalesce(r.communication_due_at, 'infinity'::timestamptz)
    ), 'infinity'::timestamptz)
  end;
$$;

create or replace function sutra.obligation_line(p_clinic uuid, p_clinician uuid default null)
returns setof sutra.results
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select r.*
  from sutra.results r
  where r.clinic_id = p_clinic
    and sutra.is_clinic_member(p_clinic)
    and r.terminal_state is null
    and r.custody_state = 'assigned'
    and r.review_state = 'pending'
    and (p_clinician is null or r.owner_id = p_clinician)
  order by sutra.obligation_breach(r) nulls last, r.report_received_at;
$$;

create or replace function sutra.obligation_calls(p_clinic uuid)
returns setof sutra.results
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select r.*
  from sutra.results r
  where r.clinic_id = p_clinic
    and sutra.is_clinic_member(p_clinic)
    and r.terminal_state is null
    and r.review_state = 'seen'
    and r.communication_state in ('pending', 'in_progress')
  order by sutra.obligation_breach(r) nulls last, r.report_received_at;
$$;

create or replace function sutra.obligation_intake(p_clinic uuid)
returns setof sutra.results
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select r.*
  from sutra.results r
  where r.clinic_id = p_clinic
    and sutra.is_clinic_member(p_clinic)
    and r.terminal_state is null
    and r.custody_state in ('received', 'accepted')
  order by r.report_received_at;
$$;

create or replace function sutra.obligation_register(
  p_clinic uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns setof sutra.results
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select r.*
  from sutra.results r
  where r.clinic_id = p_clinic
    and sutra.is_clinic_member(p_clinic)
    and (p_from is null or r.report_received_at >= p_from)
    and (p_to is null or r.report_received_at < p_to)
  order by r.report_received_at desc;
$$;

create or replace function sutra.obligation_exceptions(p_clinic uuid)
returns setof sutra.results
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select r.*
  from sutra.results r
  where r.clinic_id = p_clinic
    and sutra.is_clinic_member(p_clinic)
    and r.terminal_state in ('closed_unreachable', 'declined', 'transferred', 'deceased')
  order by r.closed_at desc nulls last;
$$;

-- 6. Commands ----------------------------------------------------------------

create or replace function sutra.accept_custody(p_result uuid)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_role text;
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v.clinic_id, 'desk')
          or sutra.is_clinic_member(v.clinic_id, 'nurse')
          or sutra.is_clinic_member(v.clinic_id, 'clinician')
          or sutra.is_clinic_member(v.clinic_id, 'reviewer')) then
    raise exception 'desk, nurse or clinician capability required' using errcode = '42501';
  end if;
  if v.custody_state = 'accepted' and v.custody_actor_id = v_actor then
    return;
  end if;
  if v.custody_state <> 'received' then
    raise exception 'custody has already been accepted' using errcode = 'P0001';
  end if;
  if v.terminal_state is not null then
    raise exception 'a closed obligation cannot accept custody' using errcode = 'P0001';
  end if;
  v_role := case
    when sutra.is_clinic_member(v.clinic_id, 'desk') then 'desk'
    when sutra.is_clinic_member(v.clinic_id, 'nurse') then 'nurse'
    when sutra.is_clinic_member(v.clinic_id, 'clinician') then 'clinician'
    else 'reviewer'
  end;
  update sutra.results
  set custody_state = 'accepted',
      custody_actor_id = v_actor,
      custody_due_at = coalesce(v.custody_due_at, v.report_received_at + sutra.obligation_sla('custody', v.lab_flag)),
      status = case when patient_id is not null then 'matched' else 'unmatched' end,
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(
    p_result, v_actor, 'custody_accepted', v.status,
    case when v.patient_id is not null then 'matched' else 'unmatched' end,
    null,
    jsonb_build_object('custodyDueAt', coalesce(v.custody_due_at, v.report_received_at + sutra.obligation_sla('custody', v.lab_flag))),
    v_role
  );
end
$$;

create or replace function sutra.assign_clinician(p_result uuid, p_clinician uuid)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not sutra.is_clinic_member(v.clinic_id, 'desk') then
    raise exception 'desk capability required' using errcode = '42501';
  end if;
  if v.custody_state <> 'accepted' then
    raise exception 'accept custody before assigning a clinician' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from sutra.memberships m
    where m.clinic_id = v.clinic_id
      and m.user_id = p_clinician
      and m.active
      and (m.clinician or m.reviewer)
  ) then
    raise exception 'the assignee must be an active clinician or reviewer' using errcode = '22023';
  end if;
  update sutra.results
  set owner_id = p_clinician,
      custody_state = 'assigned',
      review_state = 'pending',
      review_actor_id = null,
      review_due_at = now() + sutra.obligation_sla('review', v.lab_flag),
      status = 'owned',
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(
    p_result, v_actor, 'assigned', v.status, 'owned', null,
    jsonb_build_object('clinicianId', p_clinician, 'reviewDueAt', now() + sutra.obligation_sla('review', v.lab_flag)),
    'desk'
  );
end
$$;

create or replace function sutra.see_result(
  p_result uuid,
  p_value text,
  p_flag text default null,
  p_dispute_reason text default null
)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_dispute text := nullif(btrim(coalesce(p_dispute_reason, '')), '');
  v_flag text := coalesce(nullif(btrim(coalesce(p_flag, '')), ''), '');
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v.clinic_id, 'clinician') or sutra.is_clinic_member(v.clinic_id, 'reviewer')) then
    raise exception 'clinician capability required' using errcode = '42501';
  end if;
  if v.terminal_state is not null then
    raise exception 'a closed obligation cannot be seen again' using errcode = 'P0001';
  end if;
  if v.custody_state <> 'assigned' then
    raise exception 'the result must be assigned before review' using errcode = 'P0001';
  end if;
  if v.owner_id is not null and v.owner_id <> v_actor then
    raise exception 'only the assigned clinician can see this result' using errcode = '42501';
  end if;
  if v.review_state = 'seen' and v.review_actor_id = v_actor then
    return;
  end if;
  if v_dispute is null and not sutra.result_value_matches(v.value_text, p_value) then
    raise exception 'the value does not match the report. Correct it or record a dispute reason.' using errcode = '22023';
  end if;
  if v_dispute is null and v_flag <> '' and v_flag <> v.lab_flag then
    raise exception 'the flag differs from the report. Record a dispute reason.' using errcode = '22023';
  end if;
  update sutra.results
  set review_state = 'seen',
      review_actor_id = v_actor,
      review_due_at = null,
      acknowledged_at = coalesce(acknowledged_at, now()),
      acknowledged_by = coalesce(acknowledged_by, v_actor),
      acknowledged_value_text = btrim(coalesce(p_value, value_text)),
      acknowledged_flag = case when v_flag = '' then lab_flag else v_flag end,
      flag_disputed = v_dispute is not null,
      clinician_flag = case when v_dispute is not null then nullif(v_flag, '') else lab_flag end,
      dispute_reason = v_dispute,
      communication_due_at = coalesce(communication_due_at, now() + sutra.obligation_sla('communication', v.lab_flag)),
      status = 'acknowledged',
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(
    p_result, v_actor, 'seen', v.status, 'acknowledged', v_dispute,
    jsonb_build_object(
      'valueEcho', btrim(coalesce(p_value, '')),
      'flag', case when v_flag = '' then v.lab_flag else v_flag end,
      'labFlag', v.lab_flag,
      'disputed', v_dispute is not null
    ),
    'clinician'
  );
end
$$;

create or replace function sutra.record_attempt(
  p_result uuid,
  p_channel text,
  p_outcome text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not sutra.is_clinic_member(v.clinic_id, 'nurse') then
    raise exception 'nurse capability required' using errcode = '42501';
  end if;
  if v.terminal_state is not null then
    raise exception 'a closed obligation cannot take another attempt' using errcode = 'P0001';
  end if;
  if v.review_state <> 'seen' then
    raise exception 'the clinician must see the result before the patient is called' using errcode = 'P0001';
  end if;
  if p_outcome in ('informed_patient', 'informed_caregiver', 'informed_treating_doctor') then
    raise exception 'use record_informed for a successful contact' using errcode = '22023';
  end if;
  insert into sutra.result_attempts (result_id, clinic_id, actor_id, channel, outcome, note, attempted_at)
  values (p_result, v.clinic_id, v_actor, p_channel, p_outcome, p_note, now());
  update sutra.results
  set communication_state = 'in_progress',
      communication_actor_id = v_actor,
      communication_due_at = coalesce(communication_due_at, now() + sutra.obligation_sla('communication', v.lab_flag)),
      status = 'acknowledged',
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(
    p_result, v_actor, 'communication_attempt', v.status, 'acknowledged', p_note,
    jsonb_build_object('channel', p_channel, 'outcome', p_outcome),
    'nurse'
  );
end
$$;

create or replace function sutra.record_informed(
  p_result uuid,
  p_channel text,
  p_outcome text,
  p_read_back boolean,
  p_teach_back boolean,
  p_next_step text default null,
  p_next_step_due_at timestamptz default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not sutra.is_clinic_member(v.clinic_id, 'nurse') then
    raise exception 'nurse capability required' using errcode = '42501';
  end if;
  if v.terminal_state is not null then
    raise exception 'a closed obligation cannot be informed again' using errcode = 'P0001';
  end if;
  if v.review_state <> 'seen' then
    raise exception 'the clinician must see the result before the patient is told' using errcode = 'P0001';
  end if;
  if p_outcome not in ('informed_patient', 'informed_caregiver', 'informed_treating_doctor') then
    raise exception 'use record_attempt for an unsuccessful contact' using errcode = '22023';
  end if;
  if v.lab_flag = 'critical' and not coalesce(p_read_back, false) then
    raise exception 'a critical result needs a recorded read-back' using errcode = '22023';
  end if;
  insert into sutra.result_attempts (result_id, clinic_id, actor_id, channel, outcome, note, attempted_at)
  values (p_result, v.clinic_id, v_actor, p_channel, p_outcome, p_note, now());
  update sutra.results
  set communication_state = 'informed',
      communication_actor_id = v_actor,
      informed_at = now(),
      informed_by = v_actor,
      informed_channel = p_channel,
      communication_outcome = p_outcome,
      read_back_confirmed = coalesce(p_read_back, false),
      read_back_at = case when coalesce(p_read_back, false) then now() else read_back_at end,
      read_back_by = case when coalesce(p_read_back, false) then v_actor else read_back_by end,
      teach_back_confirmed = coalesce(p_teach_back, false),
      next_step = p_next_step,
      next_step_due_at = p_next_step_due_at,
      status = 'patient_informed',
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(
    p_result, v_actor, 'patient_informed', v.status, 'patient_informed', p_note,
    jsonb_build_object('channel', p_channel, 'outcome', p_outcome, 'readBack', coalesce(p_read_back, false), 'nextStep', p_next_step),
    'nurse'
  );
end
$$;

create or replace function sutra.close_result_v2(p_result uuid, p_disposition text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v.clinic_id, 'nurse') or sutra.is_clinic_member(v.clinic_id, 'quality')) then
    raise exception 'nurse or quality capability required' using errcode = '42501';
  end if;
  if v.terminal_state is not null then return; end if;
  if v.communication_state <> 'informed' then
    raise exception 'only an informed loop can close as completed' using errcode = 'P0001';
  end if;
  if v.next_step_due_at is not null and v.next_step_completed_at is null
     and p_disposition not in ('no_action', 'transferred', 'ongoing_management') then
    raise exception 'complete the next step or record a disposition that ends it' using errcode = 'P0001';
  end if;
  update sutra.results
  set terminal_state = 'closed',
      status = 'closed',
      disposition = p_disposition,
      closed_at = now(),
      closed_by = v_actor,
      closed_without_informed = false,
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(
    p_result, v_actor, 'closed', v.status, 'closed', p_note,
    jsonb_build_object('disposition', p_disposition, 'informed', true),
    'nurse'
  );
end
$$;

create or replace function sutra.close_result_unreachable(p_result uuid, p_disposition text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_days integer;
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v.clinic_id, 'nurse') or sutra.is_clinic_member(v.clinic_id, 'quality')) then
    raise exception 'nurse or quality capability required' using errcode = '42501';
  end if;
  if v.terminal_state is not null then return; end if;
  if v.communication_state <> 'in_progress' then
    raise exception 'record at least two attempts before closing as unreachable' using errcode = 'P0001';
  end if;
  select count(distinct (attempted_at at time zone 'UTC')::date)
    into v_days
    from sutra.result_attempts
   where result_id = p_result;
  if v_days < 2 then
    raise exception 'two attempts on different days are required' using errcode = 'P0001';
  end if;
  update sutra.results
  set terminal_state = 'closed_unreachable',
      communication_state = 'exception',
      status = 'closed',
      disposition = p_disposition,
      closed_at = now(),
      closed_by = v_actor,
      closed_without_informed = true,
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(
    p_result, v_actor, 'closed_unreachable', v.status, 'closed', p_note,
    jsonb_build_object('disposition', p_disposition, 'attemptDays', v_days, 'informed', false),
    'nurse'
  );
end
$$;

create or replace function sutra.pause_result(p_result uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_role text;
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not sutra.is_clinic_member(v.clinic_id) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;
  if v.paused_at is not null then return; end if;
  v_role := case
    when sutra.is_clinic_member(v.clinic_id, 'clinician') then 'clinician'
    when sutra.is_clinic_member(v.clinic_id, 'nurse') then 'nurse'
    when sutra.is_clinic_member(v.clinic_id, 'desk') then 'desk'
    else 'quality'
  end;
  update sutra.results
  set paused_at = now(), pause_reason = nullif(btrim(coalesce(p_reason, '')), ''), updated_at = now()
  where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'paused', v.status, v.status, p_reason, '{}'::jsonb, v_role);
end
$$;

create or replace function sutra.resume_result(p_result uuid)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_elapsed interval;
  v_role text;
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not sutra.is_clinic_member(v.clinic_id) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;
  if v.paused_at is null then return; end if;
  v_elapsed := now() - v.paused_at;
  v_role := case
    when sutra.is_clinic_member(v.clinic_id, 'clinician') then 'clinician'
    when sutra.is_clinic_member(v.clinic_id, 'nurse') then 'nurse'
    when sutra.is_clinic_member(v.clinic_id, 'desk') then 'desk'
    else 'quality'
  end;
  update sutra.results
  set custody_due_at = custody_due_at + v_elapsed,
      review_due_at = review_due_at + v_elapsed,
      communication_due_at = communication_due_at + v_elapsed,
      paused_seconds = paused_seconds + floor(extract(epoch from v_elapsed))::integer,
      paused_at = null,
      pause_reason = null,
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'resumed', v.status, v.status, null, jsonb_build_object('pausedSeconds', floor(extract(epoch from v_elapsed))::integer), v_role);
end
$$;

create or replace function sutra.reassign_result(p_result uuid, p_clinician uuid)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
begin
  select * into v from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not sutra.is_clinic_member(v.clinic_id, 'desk') then
    raise exception 'desk capability required' using errcode = '42501';
  end if;
  if v.terminal_state is not null then
    raise exception 'a closed obligation cannot be reassigned' using errcode = 'P0001';
  end if;
  if v.custody_state <> 'assigned' then
    raise exception 'only an assigned result can be reassigned' using errcode = 'P0001';
  end if;
  if v.owner_id = p_clinician then return; end if;
  if not exists (
    select 1 from sutra.memberships m
    where m.clinic_id = v.clinic_id
      and m.user_id = p_clinician
      and m.active
      and (m.clinician or m.reviewer)
  ) then
    raise exception 'the assignee must be an active clinician or reviewer' using errcode = '22023';
  end if;
  update sutra.results
  set owner_id = p_clinician,
      review_state = 'pending',
      review_actor_id = null,
      review_due_at = now() + sutra.obligation_sla('review', v.lab_flag),
      status = 'owned',
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(
    p_result, v_actor, 'reassigned', v.status, 'owned', null,
    jsonb_build_object('fromClinician', v.owner_id, 'toClinician', p_clinician),
    'desk'
  );
end
$$;

-- 7. Grants ------------------------------------------------------------------

grant execute on function sutra.obligation_sla(text, text) to :api_role;
grant execute on function sutra.obligation_breach(sutra.results) to :api_role;
grant execute on function sutra.obligation_line(uuid, uuid) to :api_role;
grant execute on function sutra.obligation_calls(uuid) to :api_role;
grant execute on function sutra.obligation_intake(uuid) to :api_role;
grant execute on function sutra.obligation_register(uuid, timestamptz, timestamptz) to :api_role;
grant execute on function sutra.obligation_exceptions(uuid) to :api_role;
grant execute on function sutra.accept_custody(uuid) to :api_role;
grant execute on function sutra.assign_clinician(uuid, uuid) to :api_role;
grant execute on function sutra.see_result(uuid, text, text, text) to :api_role;
grant execute on function sutra.record_attempt(uuid, text, text, text) to :api_role;
grant execute on function sutra.record_informed(uuid, text, text, boolean, boolean, text, timestamptz, text) to :api_role;
grant execute on function sutra.close_result_v2(uuid, text, text) to :api_role;
grant execute on function sutra.close_result_unreachable(uuid, text, text) to :api_role;
grant execute on function sutra.pause_result(uuid, text) to :api_role;
grant execute on function sutra.resume_result(uuid) to :api_role;
grant execute on function sutra.reassign_result(uuid, uuid) to :api_role;

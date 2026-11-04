-- 040_exception_interval.sql
-- The exception rule counted UTC calendar days. Two calls ten minutes apart
-- across UTC midnight unlocked a closure on a critical result. The rule is now a
-- 20-hour span. Reassignment moves the owner without erasing seen or attempted
-- state, so a breached record cannot become fresh.

create or replace function sutra.close_result_unreachable(p_result uuid, p_disposition text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_span_hours numeric;
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
  select extract(epoch from (max(attempted_at) - min(attempted_at))) / 3600
    into v_span_hours
    from sutra.result_attempts
   where result_id = p_result;
  if coalesce(v_span_hours, 0) < 20 then
    raise exception 'two attempts at least 20 hours apart are required' using errcode = 'P0001';
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
    jsonb_build_object('disposition', p_disposition, 'attemptSpanHours', round(v_span_hours, 1), 'informed', false),
    'nurse'
  );
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
      updated_at = now()
  where id = p_result;
  perform sutra.result_event(
    p_result, v_actor, 'reassigned', v.status, 'owned', null,
    jsonb_build_object('fromClinician', v.owner_id, 'toClinician', p_clinician),
    'desk'
  );
end
$$;

grant execute on function sutra.close_result_unreachable(uuid, text, text) to :api_role;
grant execute on function sutra.reassign_result(uuid, uuid) to :api_role;

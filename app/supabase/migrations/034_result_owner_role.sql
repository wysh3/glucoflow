-- 034_result_owner_role.sql
-- A named owner must be a clinician or reviewer, not any clinic member. The
-- membership row is the source of truth; a receptionist can still see and route
-- the receipt, but cannot be the accountable owner of a critical result.
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
  if not exists (
    select 1 from sutra.memberships m
     where m.clinic_id = v_result.clinic_id
       and m.user_id = v_owner
       and m.active
       and (m.clinician or m.reviewer)
  ) then
    raise exception 'the owner must be an active clinician or reviewer' using errcode = '22023';
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

grant execute on function sutra.assign_result(uuid, uuid, timestamptz) to :api_role;

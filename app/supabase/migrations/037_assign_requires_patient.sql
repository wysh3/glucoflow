-- 037_assign_requires_patient.sql
-- A report that is not bound to a patient cannot enter clinical review. The raw
-- printed name is not an identity; the assignment guard makes the hold explicit.

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
  if v.patient_id is null then
    raise exception 'match the report to a patient before assigning a clinician' using errcode = 'P0001';
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

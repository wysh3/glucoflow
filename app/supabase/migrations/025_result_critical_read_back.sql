-- A critical result cannot be marked patient-informed without a read-back.
create or replace function sutra.record_result_informed(
  p_result uuid,
  p_channel text,
  p_note text default null,
  p_read_back boolean default false
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
  if v_result.lab_flag = 'critical' and not coalesce(p_read_back, false) then
    raise exception 'a critical result needs a documented read-back' using errcode = '22023';
  end if;
  update sutra.results
    set status = 'patient_informed', informed_at = now(), informed_by = v_actor,
        informed_channel = p_channel,
        read_back_confirmed = coalesce(p_read_back, false),
        read_back_at = case when coalesce(p_read_back, false) then now() else null end,
        read_back_by = case when coalesce(p_read_back, false) then v_actor else null end,
        updated_at = now()
    where id = p_result;
  perform sutra.result_event(p_result, v_actor, 'patient_informed', 'acknowledged', 'patient_informed', p_note,
    jsonb_build_object('channel', p_channel, 'readBack', coalesce(p_read_back, false)));
end
$$;
grant execute on function sutra.record_result_informed(uuid, text, text, boolean) to :api_role;

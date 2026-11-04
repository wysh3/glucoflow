-- A lab, auditor or patient can verify that a receipt chain exists and is intact
-- without seeing patient identifiers, test values or clinic data. Only the chain
-- head, event count and validity are returned.
create or replace function sutra.verify_receipt_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = sutra, public, extensions, pg_temp
as $$
declare
  v_result uuid;
  v_clinic uuid;
  r record;
  v_prev text := 'GENESIS';
  v_count integer := 0;
  v_head text;
begin
  select id, clinic_id into v_result, v_clinic
    from sutra.results
   where receipt_code = upper(btrim(p_code));
  if v_result is null then
    return jsonb_build_object('found', false, 'valid', false, 'eventCount', 0, 'head', null);
  end if;

  for r in
    select * from sutra.result_events
    where result_id = v_result
    order by created_at, id
  loop
    v_count := v_count + 1;
    if r.prev_hash <> v_prev then
      return jsonb_build_object('found', true, 'valid', false, 'eventCount', v_count - 1, 'head', v_head);
    end if;
    if r.event_hash <> sutra.result_event_digest(
      r.result_id, r.clinic_id, r.event_type, r.actor_id,
      r.from_status, r.to_status, r.note, r.detail, r.created_at, r.prev_hash
    ) then
      return jsonb_build_object('found', true, 'valid', false, 'eventCount', v_count - 1, 'head', v_head);
    end if;
    v_prev := r.event_hash;
    v_head := r.event_hash;
  end loop;

  return jsonb_build_object('found', true, 'valid', true, 'eventCount', v_count, 'head', v_head);
end
$$;

grant execute on function sutra.verify_receipt_code(text) to :api_role;

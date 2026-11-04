-- 039_public_receipt_tombstone.sql
-- A tombstone lookup wrote the integer 1 into a uuid variable. Every superseded
-- receipt code threw a raw cast error on the public verifier. The tombstone now
-- selects its id, so a stale code resolves to the revoked stage.

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
  v_anchor_count integer;
  v_anchor_head text;
  v_revoked timestamptz;
  v_stage text;
  r record;
  v_prev text := 'GENESIS';
  v_count integer := 0;
  v_head text;
begin
  select id, clinic_id, status, communication_outcome, closed_without_informed,
         next_step_completed_at, chain_event_count, chain_head, receipt_revoked_at
    into v_result, v_clinic, v_status, v_outcome, v_closed_without,
         v_next_completed, v_anchor_count, v_anchor_head, v_revoked
    from sutra.results
   where receipt_code = upper(btrim(p_code));

  if v_result is null then
    select id into v_result
      from sutra.result_tombstones
     where receipt_code = upper(btrim(p_code))
     limit 1;
    if v_result is not null then
      return jsonb_build_object('found', true, 'valid', false, 'stage', 'revoked');
    end if;
    return jsonb_build_object('found', false, 'valid', false, 'stage', 'not_found');
  end if;

  if v_revoked is not null then
    return jsonb_build_object('found', true, 'valid', true, 'stage', 'revoked');
  end if;

  for r in
    select * from sutra.result_events
    where result_id = v_result
    order by created_at, id
  loop
    v_count := v_count + 1;
    if r.prev_hash <> v_prev then
      return jsonb_build_object('found', true, 'valid', false, 'stage', 'invalid');
    end if;
    if r.event_hash <> sutra.result_event_digest(
      r.result_id, r.clinic_id, r.event_type, r.actor_id,
      r.from_status, r.to_status, r.note, r.detail, r.created_at, r.prev_hash
    ) then
      return jsonb_build_object('found', true, 'valid', false, 'stage', 'invalid');
    end if;
    v_prev := r.event_hash;
    v_head := r.event_hash;
  end loop;

  if v_count <> v_anchor_count or v_head is distinct from v_anchor_head then
    return jsonb_build_object('found', true, 'valid', false, 'stage', 'invalid');
  end if;

  v_stage := case
    when v_status = 'closed' and v_closed_without then 'closed_unreachable'
    when v_status = 'closed' then 'closed'
    when v_next_completed is not null then 'next_step_completed'
    when v_status = 'patient_informed' then 'patient_contacted'
    when v_status = 'acknowledged' then 'acknowledged'
    else 'received'
  end;
  return jsonb_build_object('found', true, 'valid', true, 'stage', v_stage);
end
$$;

grant execute on function sutra.verify_receipt_code(text) to :api_role;

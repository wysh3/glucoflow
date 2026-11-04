-- 041_escalation_stage_clock.sql
-- The escalation timer read the legacy due_at while the worklists read the stage
-- clock, so it could page a superintendent about a result the product said was on
-- time. Escalation now uses the same breach function and skips paused rows.

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
    select * from sutra.results r
     where (p_clinic is null or r.clinic_id = p_clinic)
       and r.terminal_state is null
       and r.paused_at is null
       and sutra.obligation_breach(r) is not null
       and sutra.obligation_breach(r) < now()
       and r.escalation_level < 3
       and (r.last_escalated_at is null or r.last_escalated_at < now() - interval '10 minutes')
     order by sutra.obligation_breach(r) asc
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
      jsonb_build_object('level', r.escalation_level + 1, 'recipientRole', v_role, 'breachAt', sutra.obligation_breach(r)));
    insert into sutra.result_notifications (result_id, clinic_id, level, recipient_role, channel, status)
    values (r.id, r.clinic_id, r.escalation_level + 1, v_role, 'in_app', 'queued');
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

grant execute on function sutra.escalate_overdue_results(uuid) to :api_role;

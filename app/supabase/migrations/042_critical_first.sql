-- 042_critical_first.sql
-- A critical result was ordered behind three abnormals when every review clock
-- had the same due time. Severity sorts first; the clock breaks the tie.

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
  order by (r.lab_flag = 'critical') desc, sutra.obligation_breach(r) nulls last, r.report_received_at;
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
  order by (r.lab_flag = 'critical') desc, sutra.obligation_breach(r) nulls last, r.report_received_at;
$$;

grant execute on function sutra.obligation_line(uuid, uuid) to :api_role;
grant execute on function sutra.obligation_calls(uuid) to :api_role;

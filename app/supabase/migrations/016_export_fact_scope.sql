-- Scope historical fact lookup by the current actor, including patient release.
create or replace function sutra.facts_current_at(p_patient uuid, p_revision integer)
returns setof sutra.approved_facts
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select f.*
  from sutra.approved_facts f
  where f.patient_id = p_patient
    and sutra.can_read_approved_fact(f.id)
    and f.approval_revision <= p_revision
    and coalesce(
      (
        select e.status
        from sutra.fact_status_events e
        where e.fact_id = f.id and e.approval_revision <= p_revision
        order by e.approval_revision desc, e.created_at desc
        limit 1
      ),
      f.status
    ) = 'retained';
$$;

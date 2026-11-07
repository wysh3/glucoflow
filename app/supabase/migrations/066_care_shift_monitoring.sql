-- Active groups enter the same synthetic background reconciliation queue as tasks.
create index care_shift_monitor_due_idx on sutra.care_workspaces (monitor_checked_at,id)
where state->'shiftMonitoring' @? '$[*] ? (@.status == "awaiting_approval" || @.status == "monitoring" || @.status == "paused")';

create function sutra.guard_active_shift_archive() returns trigger
language plpgsql set search_path=pg_catalog,sutra as $$
begin
  if old.archived_at is null and new.archived_at is not null
    and exists (select 1 from jsonb_array_elements(coalesce(old.state->'shiftMonitoring','[]'::jsonb)) as item
      where item->>'status' in ('awaiting_approval','monitoring','paused')
        and (item->'scope'->>'expiresAt')::timestamptz > clock_timestamp()) then
    raise exception 'Stop or finish open shift monitoring before continuing' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function sutra.guard_active_shift_archive() from public;
create trigger care_shift_archive_guard before update of archived_at on sutra.care_workspaces
for each row execute function sutra.guard_active_shift_archive();

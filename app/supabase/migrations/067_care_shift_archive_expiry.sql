-- Expiry is an auditable state transition. A delayed worker must not leave a
-- workspace archived with a monitor that still appears active.
create or replace function sutra.guard_active_shift_archive() returns trigger
language plpgsql set search_path=pg_catalog,sutra as $$
begin
  if old.archived_at is null and new.archived_at is not null
    and old.state->'shiftMonitoring' @? '$[*] ? (@.status == "awaiting_approval" || @.status == "monitoring" || @.status == "paused")' then
    raise exception 'Stop or finish open shift monitoring before continuing' using errcode='P0001';
  end if;
  return new;
end;
$$;

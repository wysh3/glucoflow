-- 012_upload_expiry.sql
-- Marks upload sessions whose application completion window has closed. This runs
-- from the maintenance command rather than from the rejected completion call, so the
-- rejection itself stays a rolled-back no-op.

create or replace function sutra.expire_upload_sessions()
returns integer
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_count integer;
begin
  update sutra.upload_sessions
     set state = 'expired'
   where state = 'created'
     and completion_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

grant execute on function sutra.expire_upload_sessions() to :api_role, sutra_worker;

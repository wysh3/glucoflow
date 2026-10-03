-- 008_local_auth_hardening.sql
-- Local development credentials are readable by the API role only inside the
-- sign-in transaction (app.auth_purpose = 'signin'). A deployed environment uses
-- Supabase Auth and must not hold local credentials at all; the API refuses to
-- start in production when any row exists.

drop policy if exists local_credentials_api_read on sutra.local_credentials;
create policy local_credentials_api_read on sutra.local_credentials
  for select to :api_role
  using (current_setting('app.auth_purpose', true) = 'signin');

create or replace function sutra.local_credential_for(p_email text)
returns table (user_id uuid, password_hash text, display_name text)
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select u.id, c.password_hash, u.display_name
  from sutra.app_users u
  join sutra.local_credentials c on c.user_id = u.id
  where lower(u.email) = lower(btrim(p_email))
    -- Only the sign-in transaction may read a credential.
    and current_setting('app.auth_purpose', true) = 'signin'
  limit 1;
$$;

grant execute on function sutra.local_credential_for(text) to :api_role;

-- 011_uploader_visibility.sql
-- A clinic member must be able to read the display name of the account that uploaded
-- a document for their own patient, including a patient account that is not a clinic
-- member. Without this, patient uploads disappear from the queue and the document
-- list because the join on app_users is filtered by row level security.

create or replace function sutra.can_see_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select
    p_user = sutra.current_actor_id()
    or sutra.shares_clinic_with(p_user)
    or exists (
      select 1
      from sutra.patient_accounts pa
      join sutra.patients p on p.id = pa.patient_id
      where pa.user_id = p_user
        and pa.active
        and sutra.is_clinic_member(p.clinic_id)
    );
$$;

drop policy if exists app_users_read on sutra.app_users;
create policy app_users_read on sutra.app_users
  for select to :api_role
  using (sutra.can_see_user(id));

grant execute on function sutra.can_see_user(uuid) to :api_role, sutra_worker;

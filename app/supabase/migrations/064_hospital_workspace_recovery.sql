-- Operator recovery transfers management of an orphaned managed workspace to
-- someone who already has access. It neither enrolls staff nor alters care state.
create table sutra.hospital_workspace_recovery_audit (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references sutra.care_workspaces(id) on delete cascade,
  clinic_id uuid not null references sutra.clinics(id) on delete cascade,
  former_owner_id uuid not null references sutra.app_users(id),
  new_owner_id uuid not null references sutra.app_users(id),
  operator_role name not null default session_user,
  reference text not null check (length(btrim(reference)) between 1 and 100),
  created_at timestamptz not null default clock_timestamp()
);
alter table sutra.hospital_workspace_recovery_audit enable row level security;
create policy hospital_workspace_recovery_admin on sutra.hospital_workspace_recovery_audit
  for select to :api_role using (sutra.is_clinic_member(clinic_id,'administrator'));
grant select on sutra.hospital_workspace_recovery_audit to :api_role;

create function sutra.recover_hospital_workspace(p_clinic uuid,p_workspace uuid,p_user uuid,p_reference text)
returns void language plpgsql security invoker set search_path=pg_catalog,sutra as $$
declare w sutra.care_workspaces%rowtype;
begin
  perform 1 from sutra.clinics where id=p_clinic and hospital_managed for no key update;
  if not found then
    raise exception 'Managed hospital unavailable' using errcode='P0002';
  end if;
  select * into w from sutra.care_workspaces
    where id=p_workspace and clinic_id=p_clinic and archived_at is null for update;
  if not found then
    raise exception 'Active managed workspace unavailable' using errcode='P0002';
  end if;
  if exists (select 1 from sutra.care_workspace_team_members t
    where t.workspace_id=w.id and t.user_id=w.owner_id and t.active
      and sutra.care_membership_matches(w.clinic_id,t.user_id,t.role)) then
    raise exception 'The workspace already has an active eligible owner' using errcode='P0001';
  end if;
  if not exists (select 1 from sutra.care_workspace_team_members t
    where t.workspace_id=w.id and t.user_id=p_user and t.active
      and sutra.care_membership_matches(w.clinic_id,t.user_id,t.role)) then
    raise exception 'The replacement must already be an active eligible workspace member' using errcode='42501';
  end if;
  update sutra.care_workspaces set owner_id=p_user where id=w.id;
  insert into sutra.hospital_workspace_recovery_audit(workspace_id,clinic_id,former_owner_id,new_owner_id,reference)
    values(w.id,w.clinic_id,w.owner_id,p_user,p_reference);
end;
$$;
revoke all on function sutra.recover_hospital_workspace(uuid,uuid,uuid,text) from public;

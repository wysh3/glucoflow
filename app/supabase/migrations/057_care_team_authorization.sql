-- Explicit opt-in collaboration for synthetic care workspaces. No clinic-wide sharing.
create table sutra.care_workspace_team_members (
  workspace_id uuid not null references sutra.care_workspaces(id) on delete cascade,
  user_id uuid not null references sutra.app_users(id) on delete cascade,
  role text not null check (role in ('doctor','nurse','lab','coordinator')),
  active boolean not null default true,
  assigned_by uuid not null references sutra.app_users(id),
  assigned_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);
create table sutra.care_team_audit (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references sutra.care_workspaces(id) on delete cascade,
  actor_id uuid not null references sutra.app_users(id),
  actor_role text not null,
  action text not null check(length(action) between 1 and 80),
  revision integer,
  target_user_id uuid references sutra.app_users(id),
  created_at timestamptz not null default now()
);
create index care_team_audit_workspace on sutra.care_team_audit(workspace_id,id);

create function sutra.is_care_team_member(p_workspace uuid) returns boolean
language sql stable security definer set search_path=sutra,pg_temp as $$
 select exists(select 1 from sutra.care_workspace_team_members t
 join sutra.care_workspaces w on w.id=t.workspace_id
 join sutra.memberships m on m.clinic_id=w.clinic_id and m.user_id=t.user_id and m.active
 where t.workspace_id=p_workspace and t.user_id=sutra.current_actor_id() and t.active);
$$;
revoke all on function sutra.is_care_team_member(uuid) from public;
grant execute on function sutra.is_care_team_member(uuid) to :api_role;
create policy care_workspace_team on sutra.care_workspaces for select to :api_role
 using (sutra.is_care_team_member(id));
create policy care_workspace_team_update on sutra.care_workspaces for update to :api_role
 using (sutra.is_care_team_member(id)) with check(sutra.is_care_team_member(id));

alter table sutra.care_workspace_team_members enable row level security;
alter table sutra.care_team_audit enable row level security;
create policy care_team_read on sutra.care_workspace_team_members for select to :api_role
 using(exists(select 1 from sutra.care_workspaces w where w.id=workspace_id));
create policy care_team_audit_read on sutra.care_team_audit for select to :api_role
 using(exists(select 1 from sutra.care_workspaces w where w.id=workspace_id));
grant select on sutra.care_workspace_team_members,sutra.care_team_audit to :api_role;

create function sutra.configure_care_team_member(p_workspace uuid,p_user uuid,p_role text,p_active boolean)
returns void language plpgsql security definer set search_path=sutra,pg_temp as $$
declare w sutra.care_workspaces; a uuid:=sutra.current_actor_id(); owner_role text;
begin
 select * into w from sutra.care_workspaces where id=p_workspace for update;
 if not found or w.owner_id<>a or not sutra.is_clinic_member(w.clinic_id) then
   raise exception 'Workspace unavailable' using errcode='42501';
 end if;
 if p_role not in ('doctor','nurse','lab','coordinator') or p_role is null or p_active is null then
   raise exception 'Invalid team assignment' using errcode='22023';
 end if;
 if not exists(select 1 from sutra.memberships where clinic_id=w.clinic_id and user_id=p_user and active) then
   raise exception 'An active membership in this clinic is required' using errcode='42501';
 end if;
 if p_role='doctor' and not exists(select 1 from sutra.memberships where clinic_id=w.clinic_id and user_id=p_user and active and clinician) then
   raise exception 'Doctor role requires clinician membership' using errcode='42501';
 end if;
 if p_user=a and not p_active then raise exception 'Workspace owner cannot be removed' using errcode='22023'; end if;
 select case when clinician then 'doctor' else 'coordinator' end into owner_role
 from sutra.memberships where clinic_id=w.clinic_id and user_id=a and active;
 insert into sutra.care_workspace_team_members(workspace_id,user_id,role,assigned_by)
 values(p_workspace,a,owner_role,a) on conflict do nothing;
 insert into sutra.care_workspace_team_members(workspace_id,user_id,role,active,assigned_by)
 values(p_workspace,p_user,p_role,p_active,a)
 on conflict(workspace_id,user_id) do update set role=excluded.role,active=excluded.active,assigned_by=a,assigned_at=now();
 insert into sutra.care_team_audit(workspace_id,actor_id,actor_role,action,target_user_id)
 values(p_workspace,a,owner_role,case when p_active then 'member_assigned' else 'member_revoked' end,p_user);
end;
$$;
revoke all on function sutra.configure_care_team_member(uuid,uuid,text,boolean) from public;
grant execute on function sutra.configure_care_team_member(uuid,uuid,text,boolean) to :api_role;

create function sutra.audit_care_team_command(p_workspace uuid,p_action text,p_revision integer)
returns void language plpgsql security definer set search_path=sutra,pg_temp as $$
declare r text;
begin
 if not sutra.is_care_team_member(p_workspace) then raise exception 'Team membership required' using errcode='42501'; end if;
 select role into r from sutra.care_workspace_team_members where workspace_id=p_workspace and user_id=sutra.current_actor_id() and active;
 insert into sutra.care_team_audit(workspace_id,actor_id,actor_role,action,revision)
 values(p_workspace,sutra.current_actor_id(),r,p_action,p_revision);
end;
$$;
revoke all on function sutra.audit_care_team_command(uuid,text,integer) from public;
grant execute on function sutra.audit_care_team_command(uuid,text,integer) to :api_role;

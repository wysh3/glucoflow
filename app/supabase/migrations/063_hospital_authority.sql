-- An opted-in clinic is a hospital staff boundary. Legacy demo clinics keep
-- their private simulations and existing opt-in team behavior.
alter table sutra.clinics add column hospital_managed boolean not null default false;
alter table sutra.memberships add column care_role text
  check (care_role in ('doctor', 'nurse', 'lab', 'coordinator'));

create table sutra.hospital_staff_audit (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references sutra.clinics(id) on delete cascade,
  actor_id uuid references sutra.app_users(id),
  target_user_id uuid not null references sutra.app_users(id),
  previous_assignment jsonb,
  current_assignment jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index hospital_staff_audit_page on sutra.hospital_staff_audit(clinic_id,id desc);
alter table sutra.hospital_staff_audit enable row level security;
create policy hospital_staff_audit_admin on sutra.hospital_staff_audit
  for select to :api_role using (sutra.is_clinic_member(clinic_id, 'administrator'));
grant select on sutra.hospital_staff_audit to :api_role;

-- Managed membership alone gives directory access. Existing separately
-- provisioned record capabilities continue to govern clinical data access.
create or replace function sutra.is_clinic_member(p_clinic uuid, p_capability text default null)
returns boolean language sql stable security definer set search_path=pg_catalog,sutra as $$
  select exists (
    select 1 from sutra.memberships m join sutra.clinics c on c.id=m.clinic_id
    where m.clinic_id=p_clinic and m.user_id=sutra.current_actor_id() and m.active
      and (
        (p_capability is null and
          (not c.hospital_managed or m.clinician or m.reviewer or m.desk or m.nurse or m.quality))
        or (p_capability='reviewer' and m.reviewer)
        or (p_capability='clinician' and m.clinician)
        or (p_capability='administrator' and m.administrator)
        or (p_capability='desk' and m.desk)
        or (p_capability='nurse' and m.nurse)
        or (p_capability='quality' and m.quality)
      )
  );
$$;

create or replace function sutra.shares_clinic_with(p_user uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,sutra as $$
  select exists (
    select 1 from sutra.memberships mine
    join sutra.clinics c on c.id=mine.clinic_id
    join sutra.memberships theirs on theirs.clinic_id=mine.clinic_id
    where mine.user_id=sutra.current_actor_id() and mine.active and theirs.user_id=p_user
      and (not c.hospital_managed or theirs.active or mine.administrator)
  );
$$;

create function sutra.list_my_hospitals()
returns table (clinic_id uuid, display_name text, administrator boolean, care_role text)
language sql stable security definer set search_path=pg_catalog,sutra as $$
  select c.id,c.display_name,m.administrator,case when m.care_role='doctor' and not m.clinician then null else m.care_role end
  from sutra.clinics c join sutra.memberships m on m.clinic_id=c.id
  where c.hospital_managed and m.user_id=sutra.current_actor_id() and m.active
  order by c.display_name,c.id;
$$;

create function sutra.list_hospital_staff(p_clinic uuid,p_after uuid)
returns table (user_id uuid,display_name text,email text,administrator boolean,care_role text,clinician boolean,active boolean)
language plpgsql stable security definer set search_path=pg_catalog,sutra as $$
declare is_admin boolean;
begin
  select m.administrator into is_admin
  from sutra.memberships m join sutra.clinics c on c.id=m.clinic_id
  where c.hospital_managed and m.clinic_id=p_clinic and m.user_id=sutra.current_actor_id() and m.active;
  if not found then
    raise exception 'Hospital directory unavailable' using errcode='P0002';
  end if;
  return query
    select u.id,u.display_name,case when is_admin then u.email end,m.administrator,
      m.care_role,m.clinician,m.active
    from sutra.memberships m join sutra.app_users u on u.id=m.user_id
    where m.clinic_id=p_clinic and (m.active or is_admin) and (p_after is null or u.id>p_after)
    order by u.id limit 51;
end;
$$;

create function sutra.hospital_staff_assignment(p_membership sutra.memberships) returns jsonb
language sql immutable set search_path=pg_catalog,sutra as $$
  select jsonb_build_object('administrator',p_membership.administrator,
    'careRole',p_membership.care_role,'active',p_membership.active);
$$;

create function sutra.assign_hospital_staff(p_clinic uuid,p_user uuid,p_administrator boolean,p_role text,p_active boolean)
returns table (user_id uuid,display_name text,email text,administrator boolean,care_role text,clinician boolean,active boolean)
language plpgsql security definer set search_path=pg_catalog,sutra as $$
declare
  actor uuid := sutra.current_actor_id();
  previous sutra.memberships%rowtype;
  updated sutra.memberships%rowtype;
begin
  -- Serialize changes per hospital, including competing last-admin changes.
  perform 1 from sutra.clinics where id=p_clinic and hospital_managed for no key update;
  if not found or not sutra.is_clinic_member(p_clinic,'administrator') then
    raise exception 'Active hospital administrator access required' using errcode='42501';
  end if;
  if p_administrator is null or p_active is null
    or (p_role is not null and p_role not in ('doctor','nurse','lab','coordinator')) then
    raise exception 'Invalid hospital assignment' using errcode='22023';
  end if;
  select * into previous from sutra.memberships m where m.clinic_id=p_clinic and m.user_id=p_user for update;
  if not found then
    raise exception 'Provision a verified staff identity in this hospital first' using errcode='P0002';
  end if;
  if p_active and p_role='doctor' and not previous.clinician then
    raise exception 'Doctor assignment requires independently provisioned clinician permission' using errcode='42501';
  end if;
  if p_user=actor and p_role is distinct from previous.care_role then
    raise exception 'An administrator cannot change their own care role' using errcode='42501';
  end if;
  if previous.active and previous.administrator and not (p_active and p_administrator)
    and not exists(select 1 from sutra.memberships m where m.clinic_id=p_clinic
      and m.user_id<>p_user and m.active and m.administrator) then
    raise exception 'Keep at least one active hospital administrator' using errcode='P0001';
  end if;
  if (previous.administrator,previous.care_role,previous.active)
    is distinct from (p_administrator,p_role,p_active) then
    update sutra.memberships m set administrator=p_administrator,care_role=p_role,active=p_active
      where m.id=previous.id returning * into updated;
    -- Workspace enrollment remains a separate decision. Retained memberships
    -- follow a new authorized role without enabling any inactive workspace row.
    if p_role is not null and p_role is distinct from previous.care_role then
      update sutra.care_workspace_team_members t set role=p_role,assigned_by=actor,assigned_at=now()
      from sutra.care_workspaces w where w.id=t.workspace_id and w.clinic_id=p_clinic and t.user_id=p_user and t.active;
    end if;
    insert into sutra.hospital_staff_audit(clinic_id,actor_id,target_user_id,previous_assignment,current_assignment)
    values(p_clinic,actor,p_user,sutra.hospital_staff_assignment(previous),sutra.hospital_staff_assignment(updated));
  else
    updated := previous;
  end if;
  return query select u.id,u.display_name,u.email,updated.administrator,updated.care_role,updated.clinician,updated.active
    from sutra.app_users u where u.id=p_user;
end;
$$;

create function sutra.care_membership_matches(p_clinic uuid,p_user uuid,p_role text) returns boolean
language sql stable security definer set search_path=pg_catalog,sutra as $$
  select exists(select 1 from sutra.memberships m join sutra.clinics c on c.id=m.clinic_id
    where m.clinic_id=p_clinic and m.user_id=p_user and m.active
      and (not c.hospital_managed or m.care_role=p_role)
      and (p_role<>'doctor' or m.clinician));
$$;

create or replace function sutra.is_care_team_member(p_workspace uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,sutra as $$
  select exists(select 1 from sutra.care_workspace_team_members t
    join sutra.care_workspaces w on w.id=t.workspace_id
    where t.workspace_id=p_workspace and t.user_id=sutra.current_actor_id() and t.active
      and sutra.care_membership_matches(w.clinic_id,t.user_id,t.role));
$$;

create function sutra.care_team_role_allowed(p_workspace uuid,p_user uuid,p_role text) returns boolean
language sql stable security definer set search_path=pg_catalog,sutra as $$
  select sutra.is_care_team_member(p_workspace) and exists(select 1
    from sutra.care_workspace_team_members t join sutra.care_workspaces w on w.id=t.workspace_id
    where t.workspace_id=p_workspace and t.user_id=p_user and t.role=p_role and t.active
      and sutra.care_membership_matches(w.clinic_id,t.user_id,t.role));
$$;

create function sutra.care_workspace_hospital(p_workspace uuid) returns uuid
language sql stable security definer set search_path=pg_catalog,sutra as $$
  select w.clinic_id from sutra.care_workspaces w join sutra.clinics c on c.id=w.clinic_id
  where w.id=p_workspace and c.hospital_managed and sutra.is_care_team_member(w.id);
$$;

create function sutra.care_owner_allowed(p_clinic uuid,p_legacy boolean) returns boolean
language sql stable security definer set search_path=pg_catalog,sutra as $$
  select exists (select 1 from sutra.clinics c join sutra.memberships m on m.clinic_id=c.id
    where c.id=p_clinic and m.user_id=sutra.current_actor_id() and m.active
      and (not c.hospital_managed or
        (not p_legacy and m.care_role is not null and (m.care_role<>'doctor' or m.clinician))));
$$;

drop policy care_workspaces_owner on sutra.care_workspaces;
create policy care_workspaces_legacy_owner on sutra.care_workspaces to :api_role
  using (owner_id=sutra.current_actor_id() and sutra.care_owner_allowed(clinic_id,true))
  with check (owner_id=sutra.current_actor_id() and sutra.care_owner_allowed(clinic_id,true));
create policy care_workspaces_creator on sutra.care_workspaces for insert to :api_role
  with check (owner_id=sutra.current_actor_id() and sutra.care_owner_allowed(clinic_id,false));

create function sutra.enroll_hospital_workspace_owner() returns trigger
language plpgsql security definer set search_path=pg_catalog,sutra as $$
declare owner_role text;
begin
  -- Continuations copy only live enrollments in continue_care_workspace.
  if new.previous_workspace_id is null then
    perform 1 from sutra.clinics where id=new.clinic_id and hospital_managed for no key update;
    if not found then return new; end if;
    select m.care_role into owner_role from sutra.memberships m
    where m.clinic_id=new.clinic_id and m.user_id=new.owner_id and m.active and (m.care_role<>'doctor' or m.clinician);
    if owner_role is null then
      raise exception 'An assigned hospital care role is required' using errcode='42501';
    end if;
    insert into sutra.care_workspace_team_members(workspace_id,user_id,role,assigned_by)
    values(new.id,new.owner_id,owner_role,new.owner_id);
  end if;
  return new;
end;
$$;
create trigger hospital_workspace_owner_after_insert after insert on sutra.care_workspaces
  for each row execute function sutra.enroll_hospital_workspace_owner();

create or replace function sutra.configure_care_team_member(p_workspace uuid,p_user uuid,p_role text,p_active boolean)
returns void language plpgsql security definer set search_path=pg_catalog,sutra as $$
declare
  w sutra.care_workspaces%rowtype;
  actor uuid := sutra.current_actor_id();
  owner_role text;
  managed boolean;
begin
  select * into w from sutra.care_workspaces where id=p_workspace;
  if not found or w.owner_id is distinct from actor then
    raise exception 'Workspace unavailable' using errcode='42501';
  end if;
  select hospital_managed into managed from sutra.clinics where id=w.clinic_id for no key update;
  select * into w from sutra.care_workspaces where id=p_workspace for update;
  if not found or not sutra.care_owner_allowed(w.clinic_id,false)
    or (managed and not sutra.is_care_team_member(p_workspace)) then
    raise exception 'Workspace unavailable' using errcode='42501';
  end if;
  if w.archived_at is not null then
    raise exception 'Archived workspace teams cannot be changed' using errcode='P0001';
  end if;
  if p_role not in ('doctor','nurse','lab','coordinator') or p_role is null or p_active is null then
    raise exception 'Invalid team assignment' using errcode='22023';
  end if;
  if p_active and not sutra.care_membership_matches(w.clinic_id,p_user,p_role) then
    raise exception 'The requested role requires an active, eligible staff assignment in this clinic' using errcode='42501';
  end if;
  if p_user=actor and not p_active then
    raise exception 'Workspace owner cannot be removed' using errcode='22023';
  end if;
  if not p_active and not exists(select 1 from sutra.care_workspace_team_members
    where workspace_id=p_workspace and user_id=p_user and role=p_role) then
    raise exception 'That team assignment is not available' using errcode='P0002';
  end if;
  select case when managed then m.care_role when m.clinician then 'doctor' else 'coordinator' end into owner_role
  from sutra.memberships m where m.clinic_id=w.clinic_id and m.user_id=actor and m.active;
  insert into sutra.care_workspace_team_members(workspace_id,user_id,role,assigned_by)
    values(p_workspace,actor,owner_role,actor) on conflict do nothing;
  insert into sutra.care_workspace_team_members(workspace_id,user_id,role,active,assigned_by)
    values(p_workspace,p_user,p_role,p_active,actor)
    on conflict(workspace_id,user_id) do update set role=excluded.role,active=excluded.active,assigned_by=actor,assigned_at=now();
  insert into sutra.care_team_audit(workspace_id,actor_id,actor_role,action,target_user_id)
    values(p_workspace,actor,owner_role,case when p_active then 'member_assigned' else 'member_revoked' end,p_user);
end;
$$;

revoke all on function sutra.list_my_hospitals(), sutra.list_hospital_staff(uuid,uuid),
  sutra.hospital_staff_assignment(sutra.memberships), sutra.assign_hospital_staff(uuid,uuid,boolean,text,boolean),
  sutra.care_membership_matches(uuid,uuid,text), sutra.care_team_role_allowed(uuid,uuid,text),
  sutra.care_owner_allowed(uuid,boolean), sutra.care_workspace_hospital(uuid), sutra.enroll_hospital_workspace_owner() from public;
grant execute on function sutra.list_my_hospitals(), sutra.list_hospital_staff(uuid,uuid),
  sutra.assign_hospital_staff(uuid,uuid,boolean,text,boolean), sutra.care_team_role_allowed(uuid,uuid,text),
  sutra.care_owner_allowed(uuid,boolean), sutra.care_workspace_hospital(uuid) to :api_role;
-- Copy only live eligible workspace team memberships when starting a continuation.
create or replace function sutra.continue_care_workspace(p_id uuid,p_revision integer,p_state jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,sutra as $$
declare w sutra.care_workspaces%rowtype; next_id uuid;
begin
 select * into w from sutra.care_workspaces where id=p_id;
 if not found or w.owner_id is distinct from sutra.current_actor_id() then
  raise exception 'Only the workspace owner can continue this demo' using errcode='42501';
 end if;
 perform 1 from sutra.clinics where id=w.clinic_id and hospital_managed for no key update;
 select * into w from sutra.care_workspaces where id=p_id for update;
 if not found or not sutra.care_owner_allowed(w.clinic_id,false) then
  raise exception 'Only the workspace owner can continue this demo' using errcode='42501';
 end if;
 if exists(select 1 from sutra.care_workspace_team_members where workspace_id=p_id)
    and not sutra.is_care_team_member(p_id) then
  raise exception 'The owner no longer has their assigned team capability' using errcode='42501';
 end if;
 select id into next_id from sutra.care_workspaces where previous_workspace_id=p_id;
 if next_id is not null then return next_id; end if;
 if w.archived_at is not null or (w.state->>'revision')::integer <> p_revision then
  raise exception 'Workspace changed; reload before continuing' using errcode='40001';
 end if;
 if exists(select 1 from jsonb_array_elements(w.state->'tasks') t
   where t->>'status' in ('awaiting_approval','monitoring','awaiting_evidence','paused') or t->'transfer'->>'status'='pending')
 or exists(select 1 from jsonb_array_elements(coalesce(w.state->'coordination'->'handovers','[]'::jsonb)) h
   where h->>'status'='pending')
 or exists(select 1 from jsonb_array_elements(coalesce(w.state->'coordination'->'assignments','[]'::jsonb)) a
   where a->>'status' in ('offered','accepted'))
 or exists(select 1 from jsonb_array_elements(w.state->'encounters') e
   where e->'bedTransfer'->>'stage' in ('requested','allocated')) then
  raise exception 'Finish or cancel open tasks and transfers before continuing' using errcode='P0001';
 end if;
 next_id := (p_state->>'id')::uuid;
 if next_id=p_id or p_state->'synthetic' is distinct from 'true'::jsonb or (p_state->>'revision')::integer<>1 then
  raise exception 'Invalid synthetic continuation' using errcode='22023';
 end if;
 insert into sutra.care_workspaces(id,owner_id,clinic_id,state,previous_workspace_id)
 values(next_id,w.owner_id,w.clinic_id,p_state,p_id);
 insert into sutra.care_workspace_team_members(workspace_id,user_id,role,active,assigned_by)
 select next_id,t.user_id,t.role,true,w.owner_id from sutra.care_workspace_team_members t
 where t.workspace_id=p_id and t.active and sutra.care_membership_matches(w.clinic_id,t.user_id,t.role);
 update sutra.care_workspaces set archived_at=clock_timestamp() where id=p_id;
 return next_id;
end;
$$;
revoke all on function sutra.continue_care_workspace(uuid,integer,jsonb) from public;
grant execute on function sutra.continue_care_workspace(uuid,integer,jsonb) to :api_role;

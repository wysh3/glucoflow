-- Require the assignment observed by the administrator. Serialized writes alone
-- cannot prevent a stale editor from restoring a concurrently revoked account.
drop function sutra.assign_hospital_staff(uuid,uuid,boolean,text,boolean);

create function sutra.assign_hospital_staff(p_clinic uuid,p_user uuid,p_administrator boolean,p_role text,p_active boolean,p_expected jsonb)
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
  if p_expected is distinct from sutra.hospital_staff_assignment(previous) then
    raise exception 'This staff assignment changed. Reload before editing access.' using errcode='40001';
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

revoke all on function sutra.assign_hospital_staff(uuid,uuid,boolean,text,boolean,jsonb) from public;
grant execute on function sutra.assign_hospital_staff(uuid,uuid,boolean,text,boolean,jsonb) to :api_role;

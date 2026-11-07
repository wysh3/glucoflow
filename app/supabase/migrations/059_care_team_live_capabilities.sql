-- Team enrollment never outlives the underlying clinical capability.
create or replace function sutra.is_care_team_member(p_workspace uuid) returns boolean
language sql stable security definer set search_path=sutra,pg_temp as $$
 select exists(select 1 from sutra.care_workspace_team_members t
 join sutra.care_workspaces w on w.id=t.workspace_id
 join sutra.memberships m on m.clinic_id=w.clinic_id and m.user_id=t.user_id and m.active
 where t.workspace_id=p_workspace and t.user_id=sutra.current_actor_id() and t.active
 and (t.role<>'doctor' or m.clinician));
$$;
revoke all on function sutra.is_care_team_member(uuid) from public;
grant execute on function sutra.is_care_team_member(uuid) to :api_role;

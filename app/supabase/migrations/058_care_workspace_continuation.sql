-- Explicit settled-demo continuation. Source workspaces remain available read-only.
alter table sutra.care_workspaces add column archived_at timestamptz;
alter table sutra.care_workspaces add column previous_workspace_id uuid unique references sutra.care_workspaces(id);
create function sutra.prevent_archived_care_edits() returns trigger
language plpgsql set search_path=pg_catalog,sutra as $$
begin
 if old.archived_at is not null and new.state is distinct from old.state then
  raise exception 'Archived care workspaces are read-only' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger care_archive_read_only before update of state on sutra.care_workspaces
for each row execute function sutra.prevent_archived_care_edits();

create function sutra.continue_care_workspace(p_id uuid,p_revision integer,p_state jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,sutra as $$
declare w sutra.care_workspaces%rowtype; next_id uuid;
begin
 select * into w from sutra.care_workspaces where id=p_id for update;
 if not found or w.owner_id is distinct from sutra.current_actor_id() or not sutra.is_clinic_member(w.clinic_id) then
  raise exception 'Only the workspace owner can continue this demo' using errcode='42501';
 end if;
 select id into next_id from sutra.care_workspaces where previous_workspace_id=p_id;
 if next_id is not null then return next_id; end if;
 if w.archived_at is not null or (w.state->>'revision')::integer <> p_revision then
  raise exception 'Workspace changed; reload before continuing' using errcode='40001';
 end if;
 if exists(select 1 from jsonb_array_elements(w.state->'tasks') t
   where t->>'status' in ('awaiting_approval','monitoring','awaiting_evidence','paused') or t->'transfer'->>'status'='pending')
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
 join sutra.memberships m on m.user_id=t.user_id and m.clinic_id=w.clinic_id and m.active
 where t.workspace_id=p_id and t.active;
 update sutra.care_workspaces set archived_at=clock_timestamp() where id=p_id;
 return next_id;
end;
$$;
revoke all on function sutra.continue_care_workspace(uuid,integer,jsonb) from public;
grant execute on function sutra.continue_care_workspace(uuid,integer,jsonb) to :api_role;

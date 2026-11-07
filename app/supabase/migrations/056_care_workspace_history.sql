-- Immutable-to-application revision evidence. This is a simulator audit store,
-- not a clinical record retention policy or unlimited active-workspace store.
create table sutra.care_workspace_history (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references sutra.care_workspaces(id) on delete cascade,
  revision integer not null,
  recorded_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  worker_id text,
  baseline boolean not null default false,
  state jsonb not null
);
create index care_workspace_history_page on sutra.care_workspace_history(workspace_id,id desc);
alter table sutra.care_workspace_history enable row level security;
create policy care_workspace_history_visible on sutra.care_workspace_history
  for select to :api_role using (exists (select 1 from sutra.care_workspaces w where w.id=workspace_id));
grant select on sutra.care_workspace_history to :api_role;

-- Earlier revisions cannot be reconstructed: label migration snapshots as baseline.
insert into sutra.care_workspace_history(workspace_id,revision,state,baseline)
select id,(state->>'revision')::integer,state,true from sutra.care_workspaces;
create function sutra.record_care_workspace_history() returns trigger
language plpgsql security definer set search_path=pg_catalog,sutra as $$
begin
  if TG_OP='INSERT' or new.state is distinct from old.state then
    insert into sutra.care_workspace_history(workspace_id,revision,state,actor_id,worker_id)
    values (new.id,(new.state->>'revision')::integer,new.state,
      sutra.current_actor_id(),nullif(current_setting('app.worker_id',true),''));
  end if;
  return new;
end;
$$;
revoke all on function sutra.record_care_workspace_history() from public;
create trigger care_workspace_history_after_write after insert or update of state
on sutra.care_workspaces for each row execute function sutra.record_care_workspace_history();

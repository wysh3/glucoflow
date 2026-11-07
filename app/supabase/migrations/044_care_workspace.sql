-- Owner-scoped synthetic simulator state. Care data is separate from clinical records.
create table sutra.care_workspaces (
  id uuid primary key,
  clinic_id uuid not null references sutra.clinics(id) on delete cascade,
  owner_id uuid not null references sutra.app_users(id) on delete cascade,
  state jsonb not null,
  check (state->>'id' is not distinct from id::text),
  check (state->'synthetic' is not distinct from 'true'::jsonb),
  check (octet_length(state::text) <= 524288)
);

create index care_workspaces_owner_idx on sutra.care_workspaces (owner_id, clinic_id);
create index care_workspaces_clinic_idx on sutra.care_workspaces (clinic_id);

alter table sutra.care_workspaces enable row level security;
create policy care_workspaces_owner on sutra.care_workspaces
  to :api_role
  using (owner_id = sutra.current_actor_id() and sutra.is_clinic_member(clinic_id))
  with check (owner_id = sutra.current_actor_id() and sutra.is_clinic_member(clinic_id));

grant select, insert on sutra.care_workspaces to :api_role;
grant update (state) on sutra.care_workspaces to :api_role;

-- A command receipt is committed with the workspace revision under the workspace
-- row lock. Retries return the latest state and never rerun a committed command.
create table sutra.care_command_receipts (
  workspace_id uuid not null references sutra.care_workspaces(id) on delete cascade,
  key text not null check (length(key) between 8 and 200),
  request_hash text not null check (length(request_hash) = 64),
  revision integer not null check (revision > 0),
  primary key (workspace_id, key)
);

alter table sutra.care_command_receipts enable row level security;
create policy care_command_receipts_owner on sutra.care_command_receipts
  to :api_role
  using (exists (select 1 from sutra.care_workspaces w where w.id = workspace_id))
  with check (exists (select 1 from sutra.care_workspaces w where w.id = workspace_id));

grant select, insert on sutra.care_command_receipts to :api_role;

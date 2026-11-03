-- The doctor's decision on a delta item. Append-only: every accept, flag or
-- question is a separate event, and the latest event is the current state.
create table sutra.delta_dispositions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references sutra.patients(id) on delete cascade,
  item_id text not null check (length(item_id) between 1 and 200),
  action text not null check (action in ('accepted', 'flagged', 'asked_patient')),
  note text check (note is null or length(note) <= 1000),
  actor_id uuid not null default sutra.current_actor_id() references sutra.app_users(id),
  created_at timestamptz not null default now()
);

create index delta_dispositions_patient_order
  on sutra.delta_dispositions(patient_id, created_at desc, id);
create index delta_dispositions_item
  on sutra.delta_dispositions(patient_id, item_id, created_at desc);

alter table sutra.delta_dispositions enable row level security;

create policy delta_dispositions_read on sutra.delta_dispositions for select to :api_role
  using (
    exists (
      select 1 from sutra.patients p
      where p.id = patient_id and sutra.is_clinic_member(p.clinic_id)
    )
  );

create policy delta_dispositions_append on sutra.delta_dispositions for insert to :api_role
  with check (
    actor_id = sutra.current_actor_id()
    and exists (
      select 1 from sutra.patients p
      where p.id = patient_id and sutra.is_clinic_member(p.clinic_id)
    )
  );

grant select, insert on sutra.delta_dispositions to :api_role;

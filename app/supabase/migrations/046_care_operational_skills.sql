-- Shared template rows contain fixed operational patterns and no patient text.
-- Origin pointers are separately protected by the existing owner workspace RLS.
create table sutra.care_skill_origins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references sutra.care_workspaces(id) on delete cascade,
  encounter_id uuid not null,
  task_id uuid not null,
  event_id uuid not null,
  unique (workspace_id, task_id, event_id)
);

alter table sutra.care_skill_origins enable row level security;
create policy care_skill_origins_owner on sutra.care_skill_origins
  to :api_role
  using (exists (select 1 from sutra.care_workspaces w where w.id = workspace_id))
  with check (exists (select 1 from sutra.care_workspaces w where w.id = workspace_id));

grant select, insert on sutra.care_skill_origins to :api_role;

create table sutra.care_skills (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics(id) on delete cascade,
  pattern text not null check (pattern in ('specimen_receipt', 'result_acknowledgement')),
  version integer not null check (version between 1 and 200),
  status text not null check (status in ('draft', 'approved', 'rejected', 'superseded', 'retired')),
  origin_id uuid references sutra.care_skill_origins(id) on delete set null,
  restored_from_id uuid references sutra.care_skills(id),
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid references sutra.app_users(id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references sutra.app_users(id) on delete set null,
  test_results boolean[] not null default '{}',
  unique (clinic_id, pattern, version),
  check (cardinality(test_results) in (0, 5) and array_position(test_results, null) is null),
  check (
    (status in ('draft', 'rejected') and approved_at is null and approved_by is null) or
    (status in ('approved', 'superseded', 'retired') and approved_at is not null and
      test_results = array[true, true, true, true, true])
  )
);

create unique index care_skills_one_approved on sutra.care_skills (clinic_id, pattern) where status = 'approved';
create index care_skills_origin_idx on sutra.care_skills (origin_id);
create index care_workspaces_recovery_idx on sutra.care_workspaces (owner_id, (state->>'updatedAt') desc, id desc);

alter table sutra.care_skills enable row level security;
create policy care_skills_clinic_read on sutra.care_skills for select to :api_role
  using (sutra.is_clinic_member(clinic_id));
create policy care_skills_clinic_insert on sutra.care_skills for insert to :api_role
  with check (
    created_by = sutra.current_actor_id() and sutra.is_clinic_member(clinic_id) and
    (
      (status = 'draft' and restored_from_id is null and cardinality(test_results) = 0) or
      (status = 'approved' and restored_from_id is not null and approved_by = sutra.current_actor_id() and
        sutra.is_clinic_member(clinic_id, 'clinician'))
    )
  );
create policy care_skills_clinic_update on sutra.care_skills for update to :api_role
  using (
    sutra.is_clinic_member(clinic_id, 'clinician') or
    (status = 'draft' and created_by = sutra.current_actor_id() and sutra.is_clinic_member(clinic_id))
  )
  with check (
    sutra.is_clinic_member(clinic_id, 'clinician') or
    (status = 'draft' and created_by = sutra.current_actor_id() and sutra.is_clinic_member(clinic_id))
  );

grant select, insert on sutra.care_skills to :api_role;
grant update (status, approved_at, approved_by, test_results) on sutra.care_skills to :api_role;

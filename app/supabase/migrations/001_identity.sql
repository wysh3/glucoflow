-- 001_identity.sql
-- Identity, membership, patient link and audit foundation.
-- Source: docs/mvp/05-data-and-api.md "Tables" and "Authorization".
--
-- Role model
--   sutra_owner  owns the schema and the SECURITY DEFINER procedures (migrations only)
--   :api_role    API privilege role: RLS enforced, no ownership, no BYPASSRLS, no
--                direct write grants to approved facts, approval batches or audit events
--   sutra_worker elevated server-side worker privilege role for leased jobs and drafts
--
-- Every transaction sets its own actor through:  select set_config('app.actor_id', $1, true)

create schema if not exists sutra;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  -- The API privilege role may already exist (for example Supabase `authenticated`).
  if not exists (select 1 from pg_roles where rolname = 'sutra_api') then
    create role sutra_api nologin;
    alter role sutra_api nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'sutra_worker') then
    create role sutra_worker nologin;
    alter role sutra_worker nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
end
$$;

revoke all on schema sutra from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table sutra.clinics (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table sutra.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint app_users_email_not_blank check (length(btrim(email)) > 3)
);

create unique index app_users_email_lower_key on sutra.app_users (lower(email));

-- Local development sign-in only. A production deployment uses Supabase Auth and
-- must not create rows here; the seed script refuses to write credentials unless
-- APP_ENV is development or test.
create table sutra.local_credentials (
  user_id uuid primary key references sutra.app_users (id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table sutra.memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  user_id uuid not null references sutra.app_users (id) on delete cascade,
  reviewer boolean not null default false,
  clinician boolean not null default false,
  administrator boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table sutra.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  clinic_identifier text not null,
  display_name text not null,
  birth_date date,
  approval_revision integer not null default 0,
  created_at timestamptz not null default now(),
  unique (clinic_id, clinic_identifier),
  constraint patients_identifier_not_blank check (length(btrim(clinic_identifier)) > 0)
);

create table sutra.patient_accounts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  user_id uuid not null references sutra.app_users (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (patient_id, user_id)
);

-- One active self-link per patient in this MVP.
create unique index patient_accounts_one_active_per_patient
  on sutra.patient_accounts (patient_id)
  where active;

create table sutra.audit_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid references sutra.patients (id) on delete set null,
  actor_id uuid references sutra.app_users (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  revision integer,
  reason text,
  created_at timestamptz not null default now()
);

create index audit_events_clinic_created_idx on sutra.audit_events (clinic_id, created_at desc);
create index audit_events_patient_created_idx on sutra.audit_events (patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Actor context helpers
-- ---------------------------------------------------------------------------

-- Reads the transaction-local actor. Falls back to Supabase auth.uid() when that
-- function exists, so the same policies work on a hosted Supabase project.
create or replace function sutra.current_actor_id()
returns uuid
language plpgsql
stable
security definer
set search_path = sutra, pg_temp
as $$
declare
  v text;
begin
  v := nullif(current_setting('app.actor_id', true), '');
  if v is not null then
    begin
      return v::uuid;
    exception when others then
      return null;
    end;
  end if;
  begin
    execute 'select auth.uid()::text' into v;
    return nullif(v, '')::uuid;
  exception when others then
    return null;
  end;
end
$$;

create or replace function sutra.is_clinic_member(p_clinic uuid, p_capability text default null)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
    from sutra.memberships m
    where m.clinic_id = p_clinic
      and m.user_id = sutra.current_actor_id()
      and m.active
      and (
        p_capability is null
        or (p_capability = 'reviewer' and m.reviewer)
        or (p_capability = 'clinician' and m.clinician)
        or (p_capability = 'administrator' and m.administrator)
      )
  );
$$;

create or replace function sutra.is_linked_patient(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
    from sutra.patient_accounts pa
    where pa.patient_id = p_patient
      and pa.user_id = sutra.current_actor_id()
      and pa.active
  );
$$;

create or replace function sutra.can_see_clinic(p_clinic uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select
    sutra.is_clinic_member(p_clinic)
    or exists (
      select 1
      from sutra.patient_accounts pa
      join sutra.patients p on p.id = pa.patient_id
      where pa.user_id = sutra.current_actor_id()
        and pa.active
        and p.clinic_id = p_clinic
    );
$$;

create or replace function sutra.shares_clinic_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
    from sutra.memberships mine
    join sutra.memberships theirs on theirs.clinic_id = mine.clinic_id
    where mine.user_id = sutra.current_actor_id()
      and mine.active
      and theirs.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table sutra.clinics enable row level security;
alter table sutra.app_users enable row level security;
alter table sutra.local_credentials enable row level security;
alter table sutra.memberships enable row level security;
alter table sutra.patients enable row level security;
alter table sutra.patient_accounts enable row level security;
alter table sutra.audit_events enable row level security;

drop policy if exists clinics_read on sutra.clinics;
create policy clinics_read on sutra.clinics
  for select to :api_role
  using (sutra.can_see_clinic(id));

drop policy if exists app_users_read on sutra.app_users;
create policy app_users_read on sutra.app_users
  for select to :api_role
  using (id = sutra.current_actor_id() or sutra.shares_clinic_with(id));

-- Only the local sign-in path reads credentials. No policy is granted for other roles.
drop policy if exists local_credentials_api_read on sutra.local_credentials;
create policy local_credentials_api_read on sutra.local_credentials
  for select to :api_role
  using (true);

drop policy if exists memberships_read on sutra.memberships;
create policy memberships_read on sutra.memberships
  for select to :api_role
  using (user_id = sutra.current_actor_id() or sutra.is_clinic_member(clinic_id, 'administrator'));

drop policy if exists patients_read on sutra.patients;
create policy patients_read on sutra.patients
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id) or sutra.is_linked_patient(id));

drop policy if exists patient_accounts_read on sutra.patient_accounts;
create policy patient_accounts_read on sutra.patient_accounts
  for select to :api_role
  using (
    user_id = sutra.current_actor_id()
    or sutra.is_clinic_member(clinic_id, 'administrator')
    or sutra.is_linked_patient(patient_id)
  );

-- Audit metadata is clinic-only. Patients never read audit metadata about other users.
drop policy if exists audit_events_clinic_read on sutra.audit_events;
create policy audit_events_clinic_read on sutra.audit_events
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema sutra to :api_role, sutra_worker;

grant select on sutra.clinics, sutra.app_users, sutra.memberships, sutra.patients,
  sutra.patient_accounts, sutra.audit_events, sutra.local_credentials
  to :api_role;

grant select on sutra.clinics, sutra.patients, sutra.patient_accounts, sutra.app_users
  to sutra_worker;

-- The API role never receives insert/update/delete on audit_events or approved
-- data. All such writes happen inside SECURITY DEFINER procedures added by later
-- migrations, which write their own audit record.
revoke insert, update, delete on sutra.audit_events from :api_role;

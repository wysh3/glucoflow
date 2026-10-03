-- Revised PDF demo: actor-scoped append-only home events and frozen snapshots.
create table sutra.master_events (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references sutra.patients(id) on delete cascade,
 actor_id uuid not null default sutra.current_actor_id() references sutra.app_users(id),
 kind text not null check(kind in ('glucose','symptom','screening','category','sos','ack_sos')),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 input_hash text not null,
 request_key text not null check(length(request_key) between 8 and 200),
 digest text,
 created_at timestamptz not null default now(),
 unique(actor_id,patient_id,request_key)
);
create index master_events_patient_order on sutra.master_events(patient_id,created_at desc,id);
alter table sutra.master_events enable row level security;
create policy master_events_read on sutra.master_events for select to :api_role
 using(exists(select 1 from sutra.patients p join sutra.clinics c on c.id=p.clinic_id
  where p.id=patient_id and c.is_demo
  and (sutra.is_linked_patient(p.id) or sutra.is_clinic_member(p.clinic_id))));
create policy master_events_append on sutra.master_events for insert to :api_role
 with check(actor_id=sutra.current_actor_id() and exists(
  select 1 from sutra.patients p join sutra.clinics c on c.id=p.clinic_id
  where p.id=patient_id and c.is_demo and (
   (kind in ('glucose','symptom','sos') and sutra.is_linked_patient(p.id))
   or (kind in ('screening','category','ack_sos') and
    (sutra.is_clinic_member(p.clinic_id,'clinician') or sutra.is_clinic_member(p.clinic_id,'reviewer')))
  )));
grant select,insert on sutra.master_events to :api_role;
-- UPDATE and DELETE are deliberately not granted to application roles.

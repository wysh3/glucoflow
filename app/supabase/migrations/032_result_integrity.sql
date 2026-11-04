-- 032_result_integrity.sql
-- Integrity and attribution hardening for the patient-closure ledger.
--
-- The event chain is anchored to the result row, the core report fields are
-- immutable, a deleted receipt leaves a tombstone, and a user cannot be deleted
-- while their name is part of an audit trail. These are the controls that make
-- "the receipt was not changed" mean something inside one administrative domain.

alter table sutra.results
  add column if not exists chain_event_count integer not null default 0,
  add column if not exists chain_head text,
  add column if not exists receipt_revoked_at timestamptz,
  add column if not exists receipt_revoked_reason text,
  add column if not exists contact_consent boolean not null default false,
  add column if not exists consent_reference text,
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists retention_until date;

-- Backfill the anchor from the existing chain. A fresh result is 0 / null; that
-- is legitimate and is shown as "not yet anchored".
update sutra.results r
   set chain_event_count = c.event_count,
       chain_head = c.head
  from (
    select result_id, count(*)::int as event_count,
           (array_agg(event_hash order by created_at desc, id desc))[1] as head
      from sutra.result_events
     group by result_id
  ) c
 where c.result_id = r.id;

create table if not exists sutra.result_tombstones (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null,
  clinic_id uuid not null,
  receipt_code text not null,
  chain_event_count integer not null,
  chain_head text,
  deleted_at timestamptz not null default now(),
  reason text
);

create index if not exists result_tombstones_code_idx
  on sutra.result_tombstones (upper(receipt_code));

alter table sutra.result_tombstones enable row level security;

drop policy if exists result_tombstones_clinic_read on sutra.result_tombstones;
create policy result_tombstones_clinic_read on sutra.result_tombstones
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id));

grant select on sutra.result_tombstones to :api_role;

-- A delete is allowed for a demo reset, but it leaves a public tombstone. A
-- lawful erasure can instead revoke the receipt with receipt_revoked_at.
create or replace function sutra.tombstone_result()
returns trigger
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
begin
  insert into sutra.result_tombstones (
    result_id, clinic_id, receipt_code, chain_event_count, chain_head, reason
  ) values (
    old.id, old.clinic_id, old.receipt_code, old.chain_event_count, old.chain_head, 'deleted'
  );
  return old;
end
$$;

drop trigger if exists results_tombstone on sutra.results;
create trigger results_tombstone
  before delete on sutra.results
  for each row execute function sutra.tombstone_result();

-- The report's core identity and value are immutable after creation. The
-- workflow may change owner, status and communication fields; it may not rewrite
-- the thing the clinician is signing.
create or replace function sutra.result_core_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.clinic_id is distinct from old.clinic_id
     or new.external_ref is distinct from old.external_ref
     or new.patient_name_raw is distinct from old.patient_name_raw
     or new.patient_identifier_raw is distinct from old.patient_identifier_raw
     or new.test_name is distinct from old.test_name
     or new.value_text is distinct from old.value_text
     or new.unit is distinct from old.unit
     or new.lab_flag is distinct from old.lab_flag
     or new.lab_released_at is distinct from old.lab_released_at
     or new.report_received_at is distinct from old.report_received_at then
    raise exception 'the core report fields are immutable; create a corrected receipt instead' using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists results_core_immutable on sutra.results;
create trigger results_core_immutable
  before update on sutra.results
  for each row execute function sutra.result_core_immutable();

-- Keep the anchor current. The before-insert chain trigger has already computed
-- event_hash, so this after-insert trigger sees the final value.
create or replace function sutra.anchor_result_event()
returns trigger
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
begin
  update sutra.results
     set chain_event_count = chain_event_count + 1,
         chain_head = new.event_hash
   where id = new.result_id;
  return new;
end
$$;

drop trigger if exists result_events_anchor on sutra.result_events;
create trigger result_events_anchor
  after insert on sutra.result_events
  for each row execute function sutra.anchor_result_event();

-- A user cannot be deleted while an attribution edge points at them. Deactivate
-- the membership instead. This keeps the names in the audit trail resolvable.
create or replace function sutra.prevent_attributed_user_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from sutra.result_events where actor_id = old.id)
     or exists (
       select 1 from sutra.results
        where owner_id = old.id or acknowledged_by = old.id or informed_by = old.id
           or closed_by = old.id or created_by = old.id
     ) then
    raise exception 'this user is named in a result audit trail; deactivate the membership instead' using errcode = '42501';
  end if;
  return old;
end
$$;

drop trigger if exists app_users_attribution_guard on sutra.app_users;
create trigger app_users_attribution_guard
  before delete on sutra.app_users
  for each row execute function sutra.prevent_attributed_user_delete();

-- The verifier now checks the stored count and head, so truncating the tail is
-- detectable even if every remaining event still hashes correctly.
create or replace function sutra.verify_result_chain(p_result uuid)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  r record;
  v_prev text := 'GENESIS';
  v_count integer := 0;
  v_head text;
  v_clinic uuid;
  v_anchor_count integer;
  v_anchor_head text;
begin
  select clinic_id, chain_event_count, chain_head
    into v_clinic, v_anchor_count, v_anchor_head
    from sutra.results where id = p_result;
  if v_clinic is null then
    raise exception 'result not found' using errcode = 'P0002';
  end if;
  if not sutra.is_clinic_member(v_clinic) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;

  for r in
    select * from sutra.result_events
    where result_id = p_result
    order by created_at, id
  loop
    v_count := v_count + 1;
    if r.prev_hash <> v_prev then
      return jsonb_build_object('valid', false, 'count', v_count - 1, 'head', v_head, 'brokenAt', r.id);
    end if;
    if r.event_hash <> sutra.result_event_digest(
      r.result_id, r.clinic_id, r.event_type, r.actor_id,
      r.from_status, r.to_status, r.note, r.detail, r.created_at, r.prev_hash
    ) then
      return jsonb_build_object('valid', false, 'count', v_count - 1, 'head', v_head, 'brokenAt', r.id);
    end if;
    v_prev := r.event_hash;
    v_head := r.event_hash;
  end loop;

  if v_count <> v_anchor_count or v_head is distinct from v_anchor_head then
    return jsonb_build_object('valid', false, 'count', v_count, 'head', v_head, 'brokenAt', null);
  end if;

  return jsonb_build_object('valid', true, 'count', v_count, 'head', v_head, 'brokenAt', null);
end
$$;

grant execute on function sutra.verify_result_chain(uuid) to :api_role;

-- Public verifier: no event count, no patient fields, a withdrawn receipt is
-- distinguishable from tampering. A deleted receipt resolves to its tombstone.
create or replace function sutra.verify_receipt_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = sutra, public, extensions, pg_temp
as $$
declare
  v_result uuid;
  v_clinic uuid;
  v_status text;
  v_outcome text;
  v_closed_without boolean;
  v_next_completed timestamptz;
  v_anchor_count integer;
  v_anchor_head text;
  v_revoked timestamptz;
  v_stage text;
  r record;
  v_prev text := 'GENESIS';
  v_count integer := 0;
  v_head text;
begin
  select id, clinic_id, status, communication_outcome, closed_without_informed,
         next_step_completed_at, chain_event_count, chain_head, receipt_revoked_at
    into v_result, v_clinic, v_status, v_outcome, v_closed_without,
         v_next_completed, v_anchor_count, v_anchor_head, v_revoked
    from sutra.results
   where receipt_code = upper(btrim(p_code));

  if v_result is null then
    select 1 into v_result
      from sutra.result_tombstones
     where receipt_code = upper(btrim(p_code))
     limit 1;
    if v_result is not null then
      return jsonb_build_object('found', true, 'valid', false, 'stage', 'revoked');
    end if;
    return jsonb_build_object('found', false, 'valid', false, 'stage', 'not_found');
  end if;

  if v_revoked is not null then
    return jsonb_build_object('found', true, 'valid', true, 'stage', 'revoked');
  end if;

  for r in
    select * from sutra.result_events
    where result_id = v_result
    order by created_at, id
  loop
    v_count := v_count + 1;
    if r.prev_hash <> v_prev then
      return jsonb_build_object('found', true, 'valid', false, 'stage', 'invalid');
    end if;
    if r.event_hash <> sutra.result_event_digest(
      r.result_id, r.clinic_id, r.event_type, r.actor_id,
      r.from_status, r.to_status, r.note, r.detail, r.created_at, r.prev_hash
    ) then
      return jsonb_build_object('found', true, 'valid', false, 'stage', 'invalid');
    end if;
    v_prev := r.event_hash;
    v_head := r.event_hash;
  end loop;

  if v_count <> v_anchor_count or v_head is distinct from v_anchor_head then
    return jsonb_build_object('found', true, 'valid', false, 'stage', 'invalid');
  end if;

  v_stage := case
    when v_status = 'closed' and v_closed_without then 'closed_unreachable'
    when v_status = 'closed' then 'closed'
    when v_next_completed is not null then 'next_step_completed'
    when v_status = 'patient_informed' then 'patient_contacted'
    when v_status = 'acknowledged' then 'acknowledged'
    else 'received'
  end;
  return jsonb_build_object('found', true, 'valid', true, 'stage', v_stage);
end
$$;

grant execute on function sutra.verify_receipt_code(text) to :api_role;

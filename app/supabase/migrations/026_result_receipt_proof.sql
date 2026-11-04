-- Verifiable receipt chain.
--
-- Every result has a public receipt code. Every audit event stores the previous
-- event hash and its own SHA-256 digest. A verifier can recompute the chain and
-- detect an edited, removed or reordered event. This is not a blockchain and it
-- does not make a clinical claim.

create extension if not exists pgcrypto;

alter table sutra.results add column if not exists receipt_code text;
update sutra.results
  set receipt_code = 'GLF-' || upper(substr(md5(id::text), 1, 10))
  where receipt_code is null;
alter table sutra.results alter column receipt_code set not null;
alter table sutra.results alter column receipt_code
  set default ('GLF-' || upper(substr(md5(gen_random_uuid()::text), 1, 10)));
create unique index if not exists results_receipt_code_key on sutra.results (receipt_code);

alter table sutra.result_events add column if not exists prev_hash text;
alter table sutra.result_events add column if not exists event_hash text;

create or replace function sutra.result_event_digest(
  p_result uuid,
  p_clinic uuid,
  p_event_type text,
  p_actor uuid,
  p_from text,
  p_to text,
  p_note text,
  p_detail jsonb,
  p_created_at timestamptz,
  p_prev text
)
returns text
language sql
immutable
as $$
  select encode(
    digest(
      concat_ws('|',
        p_result::text,
        p_clinic::text,
        p_event_type,
        coalesce(p_actor::text, ''),
        coalesce(p_from, ''),
        coalesce(p_to, ''),
        coalesce(p_note, ''),
        coalesce(p_detail::text, '{}'::text),
        to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        p_prev
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- Backfill existing events in deterministic order before the chain becomes a
-- constraint for new writes.
do $$
declare
  r record;
  v_result uuid;
  v_prev text;
begin
  for r in
    select * from sutra.result_events
    order by result_id, created_at, id
  loop
    if v_result is distinct from r.result_id then
      v_result := r.result_id;
      v_prev := 'GENESIS';
    end if;
    update sutra.result_events
      set prev_hash = v_prev,
          event_hash = sutra.result_event_digest(
            r.result_id, r.clinic_id, r.event_type, r.actor_id,
            r.from_status, r.to_status, r.note, r.detail, r.created_at, v_prev
          )
      where id = r.id;
    v_prev := (select event_hash from sutra.result_events where id = r.id);
  end loop;
end
$$;

alter table sutra.result_events alter column prev_hash set not null;
alter table sutra.result_events alter column event_hash set not null;

create or replace function sutra.chain_result_event()
returns trigger
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_prev text;
begin
  select event_hash into v_prev
    from sutra.result_events
   where result_id = new.result_id
   order by created_at desc, id desc
   limit 1;
  new.prev_hash := coalesce(v_prev, 'GENESIS');
  new.event_hash := sutra.result_event_digest(
    new.result_id, new.clinic_id, new.event_type, new.actor_id,
    new.from_status, new.to_status, new.note, new.detail, new.created_at, new.prev_hash
  );
  return new;
end
$$;

drop trigger if exists result_events_chain on sutra.result_events;
create trigger result_events_chain
  before insert on sutra.result_events
  for each row execute function sutra.chain_result_event();

create or replace function sutra.result_events_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'the result audit trail is append-only' using errcode = '42501';
end
$$;

drop trigger if exists result_events_no_update on sutra.result_events;
create trigger result_events_no_update
  before update or delete on sutra.result_events
  for each row execute function sutra.result_events_immutable();

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
begin
  select clinic_id into v_clinic from sutra.results where id = p_result;
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

  return jsonb_build_object('valid', true, 'count', v_count, 'head', v_head, 'brokenAt', null);
end
$$;

grant execute on function sutra.verify_result_chain(uuid) to :api_role;

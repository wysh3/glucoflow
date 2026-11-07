-- Deployment-wide totals. No request content, patient identifiers, or timestamps are stored.
create table sutra.speech_usage_budget (
  operation text primary key check (operation in ('stt', 'tts')),
  reserved_units integer not null check (reserved_units between 0 and 1000000)
);

alter table sutra.speech_usage_budget enable row level security;

-- Reserve before dispatch, including failed or timed-out calls that may be billed.
-- The conditional upsert serializes concurrent attempts across API instances.
create function sutra.reserve_speech_usage(p_operation text, p_units integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, sutra
as $$
declare
  reserved integer;
begin
  if sutra.current_actor_id() is null then
    raise exception 'An authenticated actor is required.' using errcode = '28000';
  end if;
  if p_operation is null or p_operation not in ('stt', 'tts')
    or p_units is null or p_limit is null
    or p_units < 1 or p_limit < 1 or p_limit > 1000000 then
    raise exception 'Invalid speech reservation.' using errcode = '22023';
  end if;
  if p_units > p_limit then
    return false;
  end if;

  insert into sutra.speech_usage_budget as usage (operation, reserved_units)
  values (p_operation, p_units)
  on conflict (operation) do update
  set reserved_units = usage.reserved_units + excluded.reserved_units
  where usage.reserved_units <= p_limit - excluded.reserved_units
  returning reserved_units into reserved;

  return reserved is not null;
end
$$;

revoke all on function sutra.reserve_speech_usage(text, integer, integer) from public;
grant execute on function sutra.reserve_speech_usage(text, integer, integer) to :api_role;

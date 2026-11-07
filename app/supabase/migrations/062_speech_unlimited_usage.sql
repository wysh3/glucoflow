-- 0 means no application cumulative allowance. Keep content-free usage accounting.
-- Per-request audio/text limits and authorization remain enforced by the API.
alter table sutra.speech_usage_budget drop constraint speech_usage_budget_reserved_units_check;
alter table sutra.speech_usage_budget alter column reserved_units type bigint;
alter table sutra.speech_usage_budget add constraint speech_usage_reserved_nonnegative check (reserved_units >= 0);

create or replace function sutra.reserve_speech_usage(p_operation text, p_units integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, sutra
as $$
declare
  reserved bigint;
begin
  if sutra.current_actor_id() is null then
    raise exception 'An authenticated actor is required.' using errcode = '28000';
  end if;
  if p_operation is null or p_operation not in ('stt', 'tts')
    or p_units is null or p_limit is null
    or p_units < 1 or p_limit < 0 or p_limit > 1000000 then
    raise exception 'Invalid speech reservation.' using errcode = '22023';
  end if;
  if p_limit > 0 and p_units > p_limit then
    return false;
  end if;

  insert into sutra.speech_usage_budget as usage (operation, reserved_units)
  values (p_operation, p_units)
  on conflict (operation) do update
  set reserved_units = usage.reserved_units + excluded.reserved_units
  where p_limit = 0 or usage.reserved_units <= p_limit - excluded.reserved_units
  returning reserved_units into reserved;
  return reserved is not null;
end
$$;

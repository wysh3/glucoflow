-- pgcrypto is installed in public on a local cluster and in extensions on
-- Supabase. Resolve digest through an explicit search_path so the same function
-- works in both deployments. The hash input is unchanged.
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
set search_path = sutra, public, extensions, pg_temp
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

-- 009_upload_paths.sql
-- The server generates every storage object path. A caller cannot choose an
-- arbitrary path, and the manifest is frozen with the session.
-- Source: docs/mvp/05-data-and-api.md "Fixed upload and publication semantics".

create or replace function sutra.create_upload_session(
  p_patient uuid,
  p_kind text,
  p_manifest jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_clinic uuid;
  v_existing sutra.upload_sessions;
  v_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_index integer := 0;
  v_filename text;
  v_safe text;
  v_path text;
  v_manifest jsonb;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('file', 'photos') then
    raise exception 'unsupported upload kind' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_manifest -> 'items', '[]'::jsonb)) < 1 then
    raise exception 'upload manifest is empty' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_manifest -> 'items', '[]'::jsonb)) > 10 then
    raise exception 'a photo batch contains at most 10 images' using errcode = '22023';
  end if;

  select p.clinic_id into v_clinic from sutra.patients p where p.id = p_patient;
  if v_clinic is null then
    raise exception 'patient not found' using errcode = 'P0002';
  end if;
  if not sutra.can_upload_for_patient(p_patient) then
    raise exception 'not authorized to upload for this patient' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
    from sutra.upload_sessions s
    where s.clinic_id = v_clinic
      and s.actor_id = v_actor
      and s.idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'sessionId', v_existing.id,
        'state', v_existing.state,
        'manifest', v_existing.manifest_json,
        'completionExpiresAt', v_existing.completion_expires_at,
        'providerTokenExpiresAt', v_existing.provider_token_expires_at,
        'reused', true
      );
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_manifest -> 'items')
  loop
    v_filename := coalesce(nullif(btrim(v_item ->> 'filename'), ''), 'source');
    -- Keep a conservative character set for object keys.
    v_safe := regexp_replace(
      regexp_replace(v_filename, '[^A-Za-z0-9._-]+', '_', 'g'),
      '^_+|_+$', '', 'g'
    );
    if length(v_safe) > 80 then
      v_safe := right(v_safe, 80);
    end if;
    if v_safe = '' then
      v_safe := 'source';
    end if;
    v_path := 'clinics/' || v_clinic::text || '/patients/' || p_patient::text
      || '/uploads/' || v_id::text || '/' || lpad(v_index::text, 2, '0') || '-' || v_safe;
    v_items := v_items || jsonb_build_object(
      'index', v_index,
      'objectPath', v_path,
      'filename', v_filename,
      'contentType', v_item ->> 'contentType',
      'byteCount', coalesce((v_item ->> 'byteCount')::bigint, 0)
    );
    v_index := v_index + 1;
  end loop;

  v_manifest := jsonb_build_object('kind', p_kind, 'items', v_items);

  insert into sutra.upload_sessions (
    id, clinic_id, patient_id, actor_id, kind, manifest_json, state,
    provider_token_expires_at, completion_expires_at, idempotency_key
  )
  values (
    v_id, v_clinic, p_patient, v_actor, p_kind, v_manifest, 'created',
    v_now + interval '2 hours', v_now + interval '15 minutes', p_idempotency_key
  );

  perform sutra.write_audit(v_clinic, p_patient, v_actor, 'upload_session', v_id, 'upload_created');

  return jsonb_build_object(
    'sessionId', v_id,
    'state', 'created',
    'manifest', v_manifest,
    'completionExpiresAt', v_now + interval '15 minutes',
    'providerTokenExpiresAt', v_now + interval '2 hours',
    'reused', false
  );
end
$$;

grant execute on function sutra.create_upload_session(uuid, text, jsonb, text) to :api_role;

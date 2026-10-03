-- 007_search.sql
-- Patient-scoped record search over approved evidence, approved labels, visible
-- document metadata and patient notes. Retrieval only: no generated explanation.
-- Source: docs/mvp/05-data-and-api.md "Search contract".

create or replace function sutra.document_display_name(p_version uuid)
returns text
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select case
    when v.id is null then 'Document'
    when jsonb_array_length(coalesce(v.source_manifest_json -> 'items', '[]'::jsonb)) = 0 then 'Document'
    when jsonb_array_length(coalesce(v.source_manifest_json -> 'items', '[]'::jsonb)) = 1
      then coalesce(v.source_manifest_json -> 'items' -> 0 ->> 'filename', 'Document')
    else coalesce(v.source_manifest_json -> 'items' -> 0 ->> 'filename', 'Document')
      || ' (+' || (jsonb_array_length(v.source_manifest_json -> 'items') - 1)::text || ' more)'
  end
  from sutra.document_versions v
  where v.id = p_version;
$$;

create or replace function sutra.search_patient_records(
  p_patient uuid,
  p_query text,
  p_tsquery text,
  p_from date default null,
  p_to date default null,
  p_category text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  document_id uuid,
  document_version_id uuid,
  document_name text,
  page integer,
  document_date date,
  date_kind text,
  snippet text,
  matched_field text,
  matched_term text,
  fact_id uuid,
  note_id uuid,
  source_available boolean,
  source_only boolean,
  approval_revision integer,
  rank real
)
language plpgsql
stable
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_patient sutra.patients;
  v_clinic_member boolean;
  v_linked boolean;
  v_tsq tsquery;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 25);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  select * into v_patient from sutra.patients p where p.id = p_patient;
  if not found then
    raise exception 'patient not found' using errcode = 'P0002';
  end if;
  v_clinic_member := sutra.is_clinic_member(v_patient.clinic_id);
  v_linked := sutra.is_linked_patient(p_patient);
  if not (v_clinic_member or v_linked) then
    raise exception 'not authorized to search this patient record' using errcode = '42501';
  end if;

  begin
    v_tsq := to_tsquery('english', p_tsquery);
  exception when others then
    v_tsq := plainto_tsquery('english', p_query);
  end;
  if v_tsq is null then
    v_tsq := plainto_tsquery('english', p_query);
  end if;

  return query
  with results as (
    -- Approved fact labels, prescription names and examination text
    select
      f.document_id,
      f.document_version_id,
      sutra.document_display_name(f.document_version_id) as document_name,
      coalesce((
        select min(e.page) from sutra.approved_fact_evidence fe
        join sutra.evidence_spans e on e.id = fe.evidence_id
        where fe.fact_id = f.id
      ), 1) as page,
      f.event_date as document_date,
      f.date_kind,
      ts_headline('english', f.search_text, v_tsq,
        'MaxFragments=1,MaxWords=16,MinWords=4,StartSel=[[,StopSel=]]') as snippet,
      case f.kind
        when 'prescription' then 'prescription_name'
        when 'examination' then 'examination_text'
        else 'test_label'
      end as matched_field,
      p_query as matched_term,
      f.id as fact_id,
      null::uuid as note_id,
      sutra.can_read_document(f.document_id) as source_available,
      (not f.plot_eligible) as source_only,
      f.approval_revision,
      ts_rank(to_tsvector('english', f.search_text), v_tsq) as rank
    from sutra.approved_facts f
    join sutra.documents d on d.id = f.document_id
    where f.patient_id = p_patient
      and to_tsvector('english', f.search_text) @@ v_tsq
      and (v_clinic_member or d.released_to_patient)
      and (p_from is null or f.event_date is null or f.event_date >= p_from)
      and (p_to is null or f.event_date is null or f.event_date <= p_to)
      and (p_category is null or p_category = 'all'
           or (p_category = 'observation' and f.kind = 'observation')
           or (p_category = 'prescription' and f.kind = 'prescription')
           or (p_category = 'examination' and f.kind = 'examination'))

    union all

    -- Approved evidence quotes
    select
      f.document_id,
      f.document_version_id,
      sutra.document_display_name(f.document_version_id),
      e.page,
      f.event_date,
      f.date_kind,
      ts_headline('english', e.quote, v_tsq,
        'MaxFragments=1,MaxWords=16,MinWords=4,StartSel=[[,StopSel=]]'),
      'evidence_text'::text,
      p_query,
      f.id,
      null::uuid,
      sutra.can_read_document(f.document_id),
      (not f.plot_eligible),
      f.approval_revision,
      ts_rank(to_tsvector('english', e.quote), v_tsq)
    from sutra.approved_fact_evidence fe
    join sutra.approved_facts f on f.id = fe.fact_id
    join sutra.evidence_spans e on e.id = fe.evidence_id
    join sutra.documents d on d.id = f.document_id
    where f.patient_id = p_patient
      and to_tsvector('english', e.quote) @@ v_tsq
      and (v_clinic_member or d.released_to_patient)
      and (p_from is null or f.event_date is null or f.event_date >= p_from)
      and (p_to is null or f.event_date is null or f.event_date <= p_to)
      and (p_category is null or p_category = 'all' or p_category = 'evidence')

    union all

    -- Visible document metadata (filenames)
    select
      d.id,
      v.id,
      sutra.document_display_name(v.id),
      1,
      v.created_at::date,
      'report'::text,
      sutra.document_display_name(v.id),
      'document_filename'::text,
      p_query,
      null::uuid,
      null::uuid,
      sutra.can_read_document(d.id),
      true,
      null::integer,
      ts_rank(to_tsvector('english', sutra.document_display_name(v.id)), v_tsq)
    from sutra.documents d
    join sutra.document_versions v on v.document_id = d.id
    where d.patient_id = p_patient
      and to_tsvector('english', sutra.document_display_name(v.id)) @@ v_tsq
      and (v_clinic_member or (v_linked and d.assignment_state <> 'quarantined'))
      and (p_category is null or p_category = 'all' or p_category = 'document')

    union all

    -- Patient notes. Always attributed to the patient, never to the clinic.
    select
      null::uuid,
      null::uuid,
      'Patient note'::text,
      null::integer,
      coalesce(n.event_date, n.submitted_at::date),
      'reported'::text,
      ts_headline('english', n.body, v_tsq,
        'MaxFragments=1,MaxWords=16,MinWords=4,StartSel=[[,StopSel=]]'),
      'patient_note'::text,
      p_query,
      null::uuid,
      n.id,
      false,
      true,
      null::integer,
      ts_rank(to_tsvector('english', n.body), v_tsq)
    from sutra.patient_notes n
    where n.patient_id = p_patient
      and to_tsvector('english', n.body) @@ v_tsq
      and (v_clinic_member or v_linked)
      and (p_from is null or coalesce(n.event_date, n.submitted_at::date) >= p_from)
      and (p_to is null or coalesce(n.event_date, n.submitted_at::date) <= p_to)
      and (p_category is null or p_category = 'all' or p_category = 'note')
  )
  select
    r.document_id, r.document_version_id, r.document_name, r.page, r.document_date,
    r.date_kind, r.snippet, r.matched_field, r.matched_term, r.fact_id, r.note_id,
    r.source_available, r.source_only, r.approval_revision, r.rank
  from results r
  order by r.rank desc, r.document_date desc nulls last, r.document_id
  limit v_limit offset v_offset;
end
$$;

grant execute on function sutra.search_patient_records(uuid, text, text, date, date, text, integer, integer)
  to :api_role;
grant execute on function sutra.document_display_name(uuid) to :api_role, sutra_worker;

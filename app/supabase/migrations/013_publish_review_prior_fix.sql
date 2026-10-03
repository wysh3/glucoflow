-- 013_publish_review_prior_fix.sql
-- Corrects the declaration used when an amendment publishes decisions for the earlier
-- facts of the same document. The loop variable was declared as a record, so the
-- "->>" lookup on the disposition raised "operator does not exist: record ->> unknown"
-- and every amendment publication failed. The body is otherwise unchanged.

create or replace function sutra.publish_review(
  p_document uuid,
  p_expected_revision integer,
  p_dispositions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_document sutra.documents;
  v_batch sutra.review_batches;
  v_patient sutra.patients;
  v_revision integer;
  v_batch_id uuid;
  v_fact sutra.draft_facts;
  v_new_fact_id uuid;
  v_published uuid[] := array[]::uuid[];
  v_count integer := 0;
  v_superseded integer := 0;
  v_withdrawn integer := 0;
  v_retained integer := 0;
  v_disposition jsonb;
  v_prior jsonb;
  v_prior_ids uuid[];
  v_covered uuid[] := array[]::uuid[];
  v_evidence_count integer;
  v_plot boolean;
  v_search text;
  v_payload jsonb;
  v_now timestamptz := now();
  v_blockers jsonb;
  v_target uuid;
  v_replaces uuid;
begin
  select * into v_document from sutra.documents d where d.id = p_document for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if not sutra.is_clinic_member(v_document.clinic_id, 'reviewer') then
    raise exception 'reviewer capability required to publish' using errcode = '42501';
  end if;
  if v_document.assignment_state = 'quarantined' then
    raise exception 'a quarantined upload cannot be published' using errcode = 'P0001';
  end if;

  select * into v_batch
  from sutra.review_batches b
  where b.document_id = p_document and b.state in ('draft', 'identity_hold', 'ready')
  order by b.revision desc
  limit 1
  for update;
  if not found then
    raise exception 'no open review draft exists for this document' using errcode = 'P0002';
  end if;
  if v_batch.revision <> p_expected_revision then
    raise exception 'this record changed while you were reviewing it' using errcode = '40001';
  end if;

  v_blockers := sutra.review_blockers(v_batch.id);
  if v_blockers <> '[]'::jsonb then
    raise exception 'this review is not ready to publish: %', v_blockers::text
      using errcode = '22023';
  end if;

  -- Every reviewed entry must reference evidence from its own document version.
  select count(*) into v_evidence_count
  from sutra.draft_facts f
  where f.review_batch_id = v_batch.id
    and f.review_state = 'reviewed'
    and not exists (
      select 1
      from sutra.draft_fact_evidence fe
      join sutra.evidence_spans e on e.id = fe.evidence_id
      where fe.draft_fact_id = f.id
        and e.document_version_id = f.document_version_id
        and e.clinic_id = f.clinic_id
    );
  if v_evidence_count > 0 then
    raise exception 'every published entry needs evidence from its own source version'
      using errcode = '22023';
  end if;

  -- Prior facts affected by this publication (amendment or correction draft).
  select array_agg(f.id) into v_prior_ids
  from sutra.approved_facts f
  where f.patient_id = v_batch.patient_id
    and f.status = 'retained'
    and (
      (
        v_document.supersedes_document_id is not null
        and f.document_id = v_document.supersedes_document_id
      )
      or (
        v_batch.supersedes_batch_id is not null
        and f.document_id = v_batch.document_id
      )
    );

  if coalesce(array_length(v_prior_ids, 1), 0) > 0 then
    for v_prior in select * from jsonb_array_elements(coalesce(p_dispositions, '[]'::jsonb))
    loop
      v_covered := v_covered || (v_prior ->> 'factId')::uuid;
    end loop;
    if not (v_prior_ids <@ v_covered) then
      raise exception 'every earlier record affected by this change needs a retain, supersede or withdraw decision'
        using errcode = '22023';
    end if;
  end if;

  -- Allocate the next patient approval revision under a lock.
  select * into v_patient from sutra.patients p where p.id = v_batch.patient_id for update;
  v_revision := v_patient.approval_revision + 1;

  insert into sutra.approval_batches (
    clinic_id, patient_id, document_id, review_batch_id, revision,
    source_review_revision, actor_id, coverage_json
  )
  values (
    v_batch.clinic_id, v_batch.patient_id, v_batch.document_id, v_batch.id, v_revision,
    v_batch.revision, v_actor,
    jsonb_build_object(
      'excludedPages', v_batch.excluded_pages,
      'coverage', v_batch.coverage_json,
      'entriesReviewed', (select count(*) from sutra.draft_facts f
        where f.review_batch_id = v_batch.id and f.review_state = 'reviewed'),
      'entriesExcluded', (select count(*) from sutra.draft_facts f
        where f.review_batch_id = v_batch.id and f.review_state = 'excluded')
    )
  )
  returning id into v_batch_id;

  -- Publish reviewed entries.
  for v_fact in
    select * from sutra.draft_facts f
    where f.review_batch_id = v_batch.id and f.review_state = 'reviewed'
    order by f.ordinal
  loop
    v_plot := coalesce((v_fact.normalized_json ->> 'plotEligible')::boolean, false)
      and v_fact.kind = 'observation'
      and v_fact.normalized_json ->> 'testCode' is not null
      and v_fact.normalized_json ->> 'numericValue' is not null;
    v_search := concat_ws(' ',
      v_fact.raw_label,
      v_fact.raw_value,
      v_fact.raw_unit,
      v_fact.normalized_json ->> 'name',
      v_fact.normalized_json ->> 'strength',
      v_fact.normalized_json ->> 'instructions',
      v_fact.normalized_json ->> 'category',
      v_fact.normalized_json ->> 'sourceText'
    );
    v_payload := jsonb_build_object(
      'rawLabel', v_fact.raw_label,
      'rawValue', v_fact.raw_value,
      'rawUnit', v_fact.raw_unit,
      'eventDate', v_fact.event_date,
      'dateRaw', v_fact.date_raw,
      'dateKind', v_fact.date_kind,
      'datePrecision', v_fact.date_precision,
      'normalized', v_fact.normalized_json,
      'plotEligible', v_plot,
      'groupId', v_fact.group_id,
      'sourceOnly', v_fact.source_only
    );

    -- A replacement links to the earlier record it supersedes when the reviewer
    -- named one in the dispositions.
    v_replaces := null;
    for v_prior in select * from jsonb_array_elements(coalesce(p_dispositions, '[]'::jsonb))
    loop
      if (v_prior ->> 'status') = 'superseded'
        and (v_prior ->> 'supersededByOrdinal')::integer = v_fact.ordinal then
        v_replaces := (v_prior ->> 'factId')::uuid;
      end if;
    end loop;

    insert into sutra.approved_facts (
      clinic_id, patient_id, document_id, document_version_id, approval_batch_id,
      kind, raw_label, raw_value, raw_unit, event_date, date_raw, date_kind, date_precision,
      normalized_json, payload_json, plot_eligible, group_id, search_text,
      approval_revision, approved_by, approved_at, supersedes_fact_id, status, ordinal
    )
    values (
      v_fact.clinic_id, v_fact.patient_id, v_fact.document_id, v_fact.document_version_id,
      v_batch_id, v_fact.kind, v_fact.raw_label, v_fact.raw_value, v_fact.raw_unit,
      v_fact.event_date, v_fact.date_raw, v_fact.date_kind, v_fact.date_precision,
      v_fact.normalized_json, v_payload, v_plot, v_fact.group_id, v_search,
      v_revision, v_actor, v_now, v_replaces, 'retained', v_fact.ordinal
    )
    returning id into v_new_fact_id;

    insert into sutra.approved_fact_evidence (fact_id, evidence_id, clinic_id)
    select v_new_fact_id, fe.evidence_id, fe.clinic_id
    from sutra.draft_fact_evidence fe
    where fe.draft_fact_id = v_fact.id;

    insert into sutra.fact_status_events (fact_id, clinic_id, approval_revision, status, reason, actor_id)
    values (v_new_fact_id, v_batch.clinic_id, v_revision, 'retained', null, v_actor);

    v_published := v_published || v_new_fact_id;
    v_count := v_count + 1;
  end loop;

  -- Apply dispositions to earlier facts.
  for v_disposition in select * from jsonb_array_elements(coalesce(p_dispositions, '[]'::jsonb))
  loop
    v_target := (v_disposition ->> 'factId')::uuid;
    if v_disposition ->> 'status' = 'retained' then
      update sutra.approved_facts set status = 'retained', status_reason = null
        where id = v_target and patient_id = v_batch.patient_id;
      insert into sutra.fact_status_events (fact_id, clinic_id, approval_revision, status, reason, actor_id)
      values (v_target, v_batch.clinic_id, v_revision, 'retained', v_disposition ->> 'reason', v_actor);
      v_retained := v_retained + 1;
    elsif v_disposition ->> 'status' = 'superseded' then
      update sutra.approved_facts
        set status = 'superseded', status_reason = coalesce(v_disposition ->> 'reason', 'replaced by an approved amendment')
        where id = v_target and patient_id = v_batch.patient_id;
      insert into sutra.fact_status_events (fact_id, clinic_id, approval_revision, status, reason, actor_id)
      values (v_target, v_batch.clinic_id, v_revision, 'superseded', v_disposition ->> 'reason', v_actor);
      v_superseded := v_superseded + 1;
    elsif v_disposition ->> 'status' = 'withdrawn' then
      if nullif(v_disposition ->> 'reason', '') is null then
        raise exception 'withdrawing a record requires a reason' using errcode = '22023';
      end if;
      update sutra.approved_facts
        set status = 'withdrawn', status_reason = v_disposition ->> 'reason'
        where id = v_target and patient_id = v_batch.patient_id;
      insert into sutra.fact_status_events (fact_id, clinic_id, approval_revision, status, reason, actor_id)
      values (v_target, v_batch.clinic_id, v_revision, 'withdrawn', v_disposition ->> 'reason', v_actor);
      v_withdrawn := v_withdrawn + 1;
    end if;
  end loop;

  -- Commit the batch, patient revision and document release.
  update sutra.review_batches
    set state = 'published', approval_revision = v_revision, published_at = v_now, updated_at = v_now
    where id = v_batch.id;

  update sutra.patients set approval_revision = v_revision where id = v_batch.patient_id;
  update sutra.documents
    set released_to_patient = true,
        amendment_pending = false
    where id = v_document.id;
  if v_document.supersedes_document_id is not null then
    update sutra.documents set amendment_pending = false where id = v_document.supersedes_document_id;
  end if;

  perform sutra.write_audit(v_batch.clinic_id, v_batch.patient_id, v_actor,
    'approval_batch', v_batch_id, 'review_published', v_revision, null);

  return jsonb_build_object(
    'patientId', v_batch.patient_id,
    'approvalRevision', v_revision,
    'approvalBatchId', v_batch_id,
    'publishedFactIds', to_jsonb(v_published),
    'publishedCount', v_count,
    'supersededCount', v_superseded,
    'withdrawnCount', v_withdrawn,
    'retainedCount', v_retained,
    'coverage', jsonb_build_object(
      'excludedPages', v_batch.excluded_pages,
      'notes', case when jsonb_array_length(v_batch.excluded_pages) > 0
        then to_jsonb(array['Some pages were excluded. This source is partially represented.'])
        else '[]'::jsonb end
    )
  );
end
$$;

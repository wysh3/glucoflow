-- Correct the review batch an action targets.
--
-- A correction creates a new active draft while an earlier active batch may still
-- exist. The review page shows the newest active batch, so the mutation functions
-- must select that same batch. Revision numbers are local to a batch and are not a
-- safe ordering key across batches.

create or replace function sutra.update_review(
  p_document uuid,
  p_expected_revision integer,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_batch sutra.review_batches;
  v_document sutra.documents;
  v_change jsonb;
  v_fact sutra.draft_facts;
  v_fact_id uuid;
  v_evidence_id uuid;
  v_action text;
  v_correction jsonb;
  v_reason text;
  v_page jsonb;
  v_manual jsonb;
  v_now timestamptz := now();
  v_pages jsonb;
  v_blockers jsonb;
begin
  select * into v_document from sutra.documents d where d.id = p_document;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if not sutra.can_review_document(p_document) then
    raise exception 'reviewer capability required for this document' using errcode = '42501';
  end if;
  if v_document.assignment_state = 'quarantined' then
    raise exception 'this upload is quarantined and cannot be reviewed' using errcode = 'P0001';
  end if;

  select * into v_batch
  from sutra.review_batches b
  where b.document_id = p_document
    and b.state in ('draft', 'identity_hold', 'ready')
  order by b.created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'no review draft exists for this document' using errcode = 'P0002';
  end if;
  if v_batch.revision <> p_expected_revision then
    raise exception 'this record changed while you were reviewing it'
      using errcode = '40001';
  end if;

  -- Entry decisions and corrections --------------------------------------
  for v_change in select * from jsonb_array_elements(coalesce(p_changes -> 'factUpdates', '[]'::jsonb))
  loop
    v_action := v_change ->> 'action';
    v_reason := nullif(v_change ->> 'reason', '');
    select * into v_fact from sutra.draft_facts f
      where f.id = (v_change ->> 'factId')::uuid and f.review_batch_id = v_batch.id
      for update;
    if not found then
      raise exception 'draft entry does not belong to this review' using errcode = '22023';
    end if;

    if v_action = 'review' then
      update sutra.draft_facts
        set review_state = 'reviewed', review_reason = null, updated_at = v_now
        where id = v_fact.id;
    elsif v_action = 'exclude' then
      if v_reason is null then
        raise exception 'an exclusion requires a reason' using errcode = '22023';
      end if;
      update sutra.draft_facts
        set review_state = 'excluded', review_reason = v_reason, updated_at = v_now
        where id = v_fact.id;
    elsif v_action = 'correct' then
      if v_reason is null then
        raise exception 'a correction requires a reason' using errcode = '22023';
      end if;
      v_correction := coalesce(v_change -> 'correction', '{}'::jsonb);
      update sutra.draft_facts
        set
          raw_label = coalesce(v_correction ->> 'rawLabel', raw_label),
          raw_value = case when v_correction ? 'rawValue'
            then v_correction ->> 'rawValue' else raw_value end,
          raw_unit = case when v_correction ? 'rawUnit'
            then v_correction ->> 'rawUnit' else raw_unit end,
          event_date = case when v_correction ? 'eventDate'
            then (v_correction ->> 'eventDate')::date else event_date end,
          date_raw = case when v_correction ? 'dateRaw'
            then v_correction ->> 'dateRaw' else date_raw end,
          date_kind = coalesce(v_correction ->> 'dateKind', date_kind),
          date_precision = coalesce(v_correction ->> 'datePrecision', date_precision),
          normalized_json = normalized_json || jsonb_strip_nulls(
            jsonb_build_object(
              'testCode', v_correction -> 'testCode',
              'numericValue', v_correction -> 'numericValue',
              'unitCode', v_correction -> 'unitCode',
              'plotEligible', v_correction -> 'plotEligible',
              'name', v_correction -> 'name',
              'strength', v_correction -> 'strength',
              'instructions', v_correction -> 'instructions',
              'category', v_correction -> 'category',
              'sourceText', v_correction -> 'sourceText'
            )
          ),
          -- A correction invalidates a previous review decision.
          review_state = 'unreviewed',
          review_reason = v_reason,
          updated_at = v_now
        where id = v_fact.id;
    else
      raise exception 'unknown review action: %', v_action using errcode = '22023';
    end if;
  end loop;

  -- Manual transcription from the source page -----------------------------
  for v_manual in select * from jsonb_array_elements(coalesce(p_changes -> 'manualFacts', '[]'::jsonb))
  loop
    if nullif(v_manual ->> 'reason', '') is null then
      raise exception 'manual transcription requires a reviewer reason' using errcode = '22023';
    end if;
    insert into sutra.evidence_spans (clinic_id, document_version_id, page, quote, bbox, origin)
    values (
      v_batch.clinic_id,
      v_batch.document_version_id,
      (v_manual ->> 'page')::integer,
      v_manual ->> 'quote',
      null,
      'manual'
    )
    returning id into v_evidence_id;

    insert into sutra.draft_facts (
      clinic_id, patient_id, document_id, document_version_id, review_batch_id,
      kind, raw_label, raw_value, raw_unit, event_date, date_raw, date_kind,
      date_precision, normalized_json, issues_json, review_state, review_reason,
      ordinal, source_only
    )
    values (
      v_batch.clinic_id,
      v_batch.patient_id,
      v_batch.document_id,
      v_batch.document_version_id,
      v_batch.id,
      v_manual ->> 'kind',
      v_manual ->> 'rawLabel',
      v_manual ->> 'rawValue',
      v_manual ->> 'rawUnit',
      case when v_manual -> 'eventDate' is null or v_manual ->> 'eventDate' = ''
        then null else (v_manual ->> 'eventDate')::date end,
      v_manual ->> 'dateRaw',
      coalesce(v_manual ->> 'dateKind', 'report'),
      coalesce(v_manual ->> 'datePrecision', 'day'),
      coalesce(v_manual -> 'normalized', '{}'::jsonb),
      '[]'::jsonb,
      'reviewed',
      v_manual ->> 'reason',
      (select coalesce(max(f.ordinal), 0) + 1 from sutra.draft_facts f where f.review_batch_id = v_batch.id),
      coalesce((v_manual -> 'normalized' ->> 'plotEligible')::boolean, false) = false
    )
    returning id into v_fact_id;

    insert into sutra.draft_fact_evidence (draft_fact_id, evidence_id, clinic_id)
    values (v_fact_id, v_evidence_id, v_batch.clinic_id);
  end loop;

  -- Page exclusions --------------------------------------------------------
  for v_page in select * from jsonb_array_elements(coalesce(p_changes -> 'pageExclusions', '[]'::jsonb))
  loop
    if nullif(v_page ->> 'reason', '') is null then
      raise exception 'excluding a page requires a reason' using errcode = '22023';
    end if;
    v_pages := coalesce(v_batch.excluded_pages, '[]'::jsonb);
    if not v_pages @> jsonb_build_array((v_page ->> 'page')::integer) then
      v_pages := v_pages || to_jsonb((v_page ->> 'page')::integer);
    end if;
    update sutra.review_batches set excluded_pages = v_pages where id = v_batch.id;
    insert into sutra.audit_events (clinic_id, patient_id, actor_id, entity_type, entity_id, action, revision, reason)
    values (v_batch.clinic_id, v_batch.patient_id, v_actor, 'review_batch', v_batch.id,
      'page_excluded', v_batch.revision, v_page ->> 'reason');
  end loop;

  -- Identity confirmation --------------------------------------------------
  if p_changes -> 'identity' is not null and jsonb_typeof(p_changes -> 'identity') = 'object' then
    if (p_changes -> 'identity' ->> 'state') <> 'missing_confirmed' then
      raise exception 'only a missing-identity confirmation is accepted here' using errcode = '22023';
    end if;
    if nullif(p_changes -> 'identity' ->> 'reason', '') is null then
      raise exception 'confirming a missing identity requires a reason' using errcode = '22023';
    end if;
    update sutra.review_batches
      set identity_state = 'missing_confirmed',
          identity_reason = p_changes -> 'identity' ->> 'reason'
      where id = v_batch.id;
  end if;

  -- Recompute readiness. Only the server computes this.
  select * into v_batch from sutra.review_batches b where b.id = v_batch.id;
  v_blockers := sutra.review_blockers(v_batch.id);

  update sutra.review_batches
    set revision = v_batch.revision + 1,
        state = case
          when identity_state = 'mismatch' then 'identity_hold'
          when v_blockers = '[]'::jsonb then 'ready'
          else 'draft'
        end,
        updated_at = v_now
    where id = v_batch.id
    returning * into v_batch;

  perform sutra.write_audit(v_batch.clinic_id, v_batch.patient_id, v_actor,
    'review_batch', v_batch.id, 'review_updated', v_batch.revision, null);

  return jsonb_build_object(
    'revision', v_batch.revision,
    'state', v_batch.state,
    'identityState', v_batch.identity_state,
    'blockers', v_blockers
  );
end
$$;

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
  order by b.created_at desc
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
    for v_prior in select value from jsonb_array_elements(coalesce(p_dispositions, '[]'::jsonb))
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
    for v_prior in select value from jsonb_array_elements(coalesce(p_dispositions, '[]'::jsonb))
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

create or replace function sutra.reject_assignment(
  p_document uuid,
  p_expected_revision integer,
  p_reason text
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
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'rejecting an upload requires a reason' using errcode = '22023';
  end if;
  select * into v_document from sutra.documents d where d.id = p_document for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if not sutra.is_clinic_member(v_document.clinic_id, 'reviewer') then
    raise exception 'reviewer capability required' using errcode = '42501';
  end if;

  select * into v_batch from sutra.review_batches b
    where b.document_id = p_document and b.state in ('draft', 'identity_hold', 'ready')
    order by b.created_at desc limit 1 for update;
  if found and v_batch.revision <> p_expected_revision then
    raise exception 'this record changed while you were reviewing it' using errcode = '40001';
  end if;

  update sutra.documents
    set assignment_state = 'quarantined',
        quarantine_reason = p_reason,
        released_to_patient = false
    where id = p_document;

  if found then
    update sutra.review_batches
      set identity_state = 'mismatch', identity_reason = p_reason,
          state = 'identity_hold', revision = v_batch.revision + 1, updated_at = now()
      where id = v_batch.id;
  end if;

  perform sutra.write_audit(v_document.clinic_id, v_document.patient_id, v_actor,
    'document', p_document, 'assignment_rejected', v_batch.revision, p_reason);

  return jsonb_build_object('documentId', p_document, 'assignmentState', 'quarantined');
end
$$;

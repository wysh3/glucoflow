-- Preserve explicit nulls in corrections; invalidate obsolete numeric values and chart eligibility.
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
  where b.document_id = p_document and b.state <> 'superseded'
  order by b.revision desc
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
          normalized_json = normalized_json || coalesce((
            select jsonb_object_agg(key, value) from jsonb_each(v_correction)
             where key in ('testCode', 'numericValue', 'unitCode', 'plotEligible',
                           'name', 'strength', 'instructions', 'category', 'sourceText')
          ), '{}'::jsonb),
          source_only = case when v_correction ? 'plotEligible'
            then not coalesce((v_correction ->> 'plotEligible')::boolean, false) else source_only end,
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

-- ---------------------------------------------------------------------------
-- Publication
-- ---------------------------------------------------------------------------

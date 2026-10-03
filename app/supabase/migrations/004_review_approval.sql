-- 004_review_approval.sql
-- Approved facts, approval batches, fact status events and the publication
-- transaction. Sources: docs/mvp/05-data-and-api.md "Publication transaction",
-- docs/mvp/09-fixed-contracts.md "Review and publication".
--
-- All review and publication mutations happen inside SECURITY DEFINER procedures.
-- The API role has no direct insert/update grant on any approved or audit table.

create table sutra.approval_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  document_id uuid not null references sutra.documents (id) on delete cascade,
  review_batch_id uuid not null references sutra.review_batches (id) on delete restrict,
  revision integer not null,
  source_review_revision integer not null,
  actor_id uuid not null references sutra.app_users (id) on delete restrict,
  coverage_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- A unique publication key prevents a retried transaction from publishing twice.
  constraint approval_batches_unique_revision unique (clinic_id, patient_id, revision)
);

create table sutra.approved_facts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  document_id uuid not null references sutra.documents (id) on delete cascade,
  document_version_id uuid not null references sutra.document_versions (id) on delete cascade,
  approval_batch_id uuid not null references sutra.approval_batches (id) on delete restrict,
  kind text not null,
  raw_label text not null,
  raw_value text,
  raw_unit text,
  event_date date,
  date_raw text,
  date_kind text not null,
  date_precision text not null,
  normalized_json jsonb not null,
  payload_json jsonb not null,
  plot_eligible boolean not null default false,
  group_id text,
  search_text text not null default '',
  approval_revision integer not null,
  approved_by uuid not null references sutra.app_users (id) on delete restrict,
  approved_at timestamptz not null default now(),
  supersedes_fact_id uuid references sutra.approved_facts (id) on delete set null,
  status text not null default 'retained',
  status_reason text,
  ordinal integer not null default 0,
  constraint approved_facts_kind_check check (kind in ('observation', 'prescription', 'examination')),
  constraint approved_facts_status_check check (status in ('retained', 'superseded', 'withdrawn')),
  constraint approved_facts_date_kind_check
    check (date_kind in ('collection', 'report', 'prescription', 'examination', 'reported')),
  constraint approved_facts_date_precision_check
    check (date_precision in ('day', 'month', 'year', 'unknown'))
);

create index approved_facts_patient_idx
  on sutra.approved_facts (patient_id, event_date desc, approval_revision desc);
create index approved_facts_current_idx
  on sutra.approved_facts (patient_id, status) where status = 'retained';
create index approved_facts_search_idx on sutra.approved_facts using gin (to_tsvector('english', search_text));

create table sutra.approved_fact_evidence (
  fact_id uuid not null references sutra.approved_facts (id) on delete cascade,
  evidence_id uuid not null references sutra.evidence_spans (id) on delete cascade,
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  primary key (fact_id, evidence_id)
);

create table sutra.fact_status_events (
  id uuid primary key default gen_random_uuid(),
  fact_id uuid not null references sutra.approved_facts (id) on delete cascade,
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  approval_revision integer not null,
  status text not null,
  reason text,
  actor_id uuid references sutra.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fact_status_events_status_check
    check (status in ('retained', 'superseded', 'withdrawn'))
);

-- ---------------------------------------------------------------------------
-- Visibility helpers
-- ---------------------------------------------------------------------------

create or replace function sutra.can_read_approved_fact(p_fact uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
    from sutra.approved_facts f
    join sutra.documents d on d.id = f.document_id
    where f.id = p_fact
      and (
        sutra.is_clinic_member(f.clinic_id)
        or (sutra.is_linked_patient(f.patient_id) and d.released_to_patient)
      )
  );
$$;

create or replace function sutra.review_blockers(p_batch uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_batch sutra.review_batches;
  v_unreviewed integer;
  v_unreadable jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_page jsonb;
  v_excluded jsonb;
begin
  select * into v_batch from sutra.review_batches b where b.id = p_batch;
  if not found then
    return jsonb_build_array('batch_not_found');
  end if;

  if v_batch.identity_state in ('unchecked', 'mismatch') then
    v_blockers := v_blockers || to_jsonb('identity_unresolved'::text);
  end if;

  select count(*) into v_unreviewed
  from sutra.draft_facts f
  where f.review_batch_id = p_batch and f.review_state = 'unreviewed';
  if v_unreviewed > 0 then
    v_blockers := v_blockers || to_jsonb('entries_unreviewed'::text);
  end if;

  v_unreadable := coalesce(v_batch.coverage_json -> 'unreadablePages', '[]'::jsonb);
  v_excluded := coalesce(v_batch.excluded_pages, '[]'::jsonb);
  for v_page in select * from jsonb_array_elements(v_unreadable)
  loop
    if not v_excluded @> jsonb_build_array(v_page) then
      v_blockers := v_blockers || to_jsonb('unreadable_page_not_excluded'::text);
      exit;
    end if;
  end loop;

  if v_batch.state = 'published' then
    v_blockers := v_blockers || to_jsonb('already_published'::text);
  end if;

  return v_blockers;
end
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table sutra.approval_batches enable row level security;
alter table sutra.approved_facts enable row level security;
alter table sutra.approved_fact_evidence enable row level security;
alter table sutra.fact_status_events enable row level security;

drop policy if exists approved_facts_read on sutra.approved_facts;
create policy approved_facts_read on sutra.approved_facts
  for select to :api_role
  using (
    sutra.is_clinic_member(clinic_id)
    or exists (
      select 1 from sutra.documents d
      where d.id = approved_facts.document_id
        and d.released_to_patient
        and sutra.is_linked_patient(approved_facts.patient_id)
    )
  );

drop policy if exists approved_fact_evidence_read on sutra.approved_fact_evidence;
create policy approved_fact_evidence_read on sutra.approved_fact_evidence
  for select to :api_role
  using (sutra.can_read_approved_fact(fact_id));

drop policy if exists approval_batches_read on sutra.approval_batches;
create policy approval_batches_read on sutra.approval_batches
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id));

drop policy if exists fact_status_events_read on sutra.fact_status_events;
create policy fact_status_events_read on sutra.fact_status_events
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id));

drop policy if exists worker_approved_facts_read on sutra.approved_facts;
create policy worker_approved_facts_read on sutra.approved_facts
  for select to sutra_worker using (true);

drop policy if exists worker_approved_fact_evidence_read on sutra.approved_fact_evidence;
create policy worker_approved_fact_evidence_read on sutra.approved_fact_evidence
  for select to sutra_worker using (true);

-- ---------------------------------------------------------------------------
-- Review mutation
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Publication
-- ---------------------------------------------------------------------------

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
  v_prior record;
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

-- ---------------------------------------------------------------------------
-- Identity holds, amendments and correction revisions
-- ---------------------------------------------------------------------------

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
    order by b.revision desc limit 1 for update;
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

create or replace function sutra.link_amendment(
  p_document uuid,
  p_session uuid,
  p_expected_version uuid,
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
  v_session sutra.upload_sessions;
  v_candidate sutra.documents;
  v_candidate_version uuid;
  v_published integer;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'linking an amendment requires a reason' using errcode = '22023';
  end if;
  select * into v_document from sutra.documents d where d.id = p_document for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if not sutra.is_clinic_member(v_document.clinic_id, 'reviewer') then
    raise exception 'reviewer capability required' using errcode = '42501';
  end if;
  if v_document.current_version_id <> p_expected_version then
    raise exception 'the document changed while you were linking it' using errcode = '40001';
  end if;

  select * into v_session from sutra.upload_sessions s where s.id = p_session;
  if not found or v_session.state <> 'completed' or v_session.document_id is null then
    raise exception 'only a completed upload can be linked' using errcode = '22023';
  end if;
  select * into v_candidate from sutra.documents d where d.id = v_session.document_id for update;
  if v_candidate.patient_id <> v_document.patient_id then
    raise exception 'the amendment belongs to a different patient' using errcode = '22023';
  end if;
  if v_candidate.assignment_state = 'quarantined' then
    raise exception 'a quarantined upload cannot be linked' using errcode = 'P0001';
  end if;
  select count(*) into v_published from sutra.approval_batches ab where ab.document_id = v_candidate.id;
  if v_published > 0 then
    raise exception 'this upload is already published' using errcode = 'P0001';
  end if;
  if exists (select 1 from sutra.review_batches b
             where b.document_id = v_candidate.id and b.identity_state = 'mismatch') then
    raise exception 'an upload with an identity hold cannot be linked' using errcode = 'P0001';
  end if;

  v_candidate_version := v_candidate.current_version_id;

  update sutra.documents set supersedes_document_id = v_document.id where id = v_candidate.id;
  update sutra.document_versions
    set supersedes_version_id = p_expected_version
    where id = v_candidate_version;
  update sutra.documents set amendment_pending = true where id = v_document.id;

  perform sutra.write_audit(v_document.clinic_id, v_document.patient_id, v_actor,
    'document', v_candidate.id, 'amendment_linked', null, p_reason);

  return jsonb_build_object(
    'documentId', p_document,
    'amendmentDocumentId', v_candidate.id,
    'amendmentVersionId', v_candidate_version,
    'amendmentPending', true
  );
end
$$;

create or replace function sutra.create_review_revision(
  p_document uuid,
  p_expected_approval_revision integer,
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
  v_patient sutra.patients;
  v_published_batch sutra.review_batches;
  v_new_batch uuid;
  v_fact sutra.draft_facts;
  v_new_fact uuid;
  v_ordinal integer := 0;
  v_evidence uuid;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'creating a correction draft requires a reason' using errcode = '22023';
  end if;
  select * into v_document from sutra.documents d where d.id = p_document for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if not sutra.is_clinic_member(v_document.clinic_id, 'reviewer') then
    raise exception 'reviewer capability required' using errcode = '42501';
  end if;
  select * into v_patient from sutra.patients p where p.id = v_document.patient_id for update;
  if v_patient.approval_revision <> p_expected_approval_revision then
    raise exception 'this record changed while you were reviewing it' using errcode = '40001';
  end if;

  select * into v_published_batch from sutra.review_batches b
    where b.document_id = p_document and b.state = 'published'
    order by b.revision desc limit 1;
  if not found then
    raise exception 'there is no published version to correct' using errcode = 'P0001';
  end if;

  insert into sutra.review_batches (
    clinic_id, patient_id, document_id, document_version_id, revision,
    identity_state, identity_reason, state, supersedes_batch_id, coverage_json, document_issues
  )
  values (
    v_published_batch.clinic_id, v_published_batch.patient_id, v_published_batch.document_id,
    v_published_batch.document_version_id, 0,
    case when v_published_batch.identity_state = 'missing_confirmed'
      then 'missing_confirmed' else 'matched' end,
    v_published_batch.identity_reason, 'draft', v_published_batch.id,
    v_published_batch.coverage_json, v_published_batch.document_issues
  )
  returning id into v_new_batch;

  -- Copy the published entries back into a fresh unreviewed draft.
  for v_fact in
    select * from sutra.draft_facts f
    where f.review_batch_id = v_published_batch.id and f.review_state = 'reviewed'
    order by f.ordinal
  loop
    v_ordinal := v_ordinal + 1;
    insert into sutra.draft_facts (
      clinic_id, patient_id, document_id, document_version_id, review_batch_id,
      kind, raw_label, raw_value, raw_unit, event_date, date_raw, date_kind, date_precision,
      normalized_json, issues_json, review_state, ordinal, group_id, source_only
    )
    values (
      v_fact.clinic_id, v_fact.patient_id, v_fact.document_id, v_fact.document_version_id, v_new_batch,
      v_fact.kind, v_fact.raw_label, v_fact.raw_value, v_fact.raw_unit, v_fact.event_date,
      v_fact.date_raw, v_fact.date_kind, v_fact.date_precision, v_fact.normalized_json,
      v_fact.issues_json, 'unreviewed', v_ordinal, v_fact.group_id, v_fact.source_only
    )
    returning id into v_new_fact;

    for v_evidence in select fe.evidence_id from sutra.draft_fact_evidence fe where fe.draft_fact_id = v_fact.id
    loop
      insert into sutra.draft_fact_evidence (draft_fact_id, evidence_id, clinic_id)
      values (v_new_fact, v_evidence, v_fact.clinic_id);
    end loop;
  end loop;

  perform sutra.write_audit(v_document.clinic_id, v_document.patient_id, v_actor,
    'review_batch', v_new_batch, 'review_revision_created', null, p_reason);

  return jsonb_build_object(
    'documentId', p_document,
    'reviewBatchId', v_new_batch,
    'revision', 0,
    'state', 'draft'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select on sutra.approved_facts, sutra.approved_fact_evidence, sutra.approval_batches,
  sutra.fact_status_events to :api_role;

grant select on sutra.approved_facts, sutra.approved_fact_evidence to sutra_worker;

grant execute on function sutra.update_review(uuid, integer, jsonb) to :api_role;
grant execute on function sutra.publish_review(uuid, integer, jsonb) to :api_role;
grant execute on function sutra.reject_assignment(uuid, integer, text) to :api_role;
grant execute on function sutra.link_amendment(uuid, uuid, uuid, text) to :api_role;
grant execute on function sutra.create_review_revision(uuid, integer, text) to :api_role;
grant execute on function sutra.review_blockers(uuid) to :api_role, sutra_worker;
grant execute on function sutra.can_read_approved_fact(uuid) to :api_role, sutra_worker;

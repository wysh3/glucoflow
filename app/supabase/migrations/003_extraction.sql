-- 003_extraction.sql
-- Extraction runs, provider call ledger, evidence spans, draft facts and review batches.
-- Sources: docs/mvp/04-extraction-engine.md, docs/mvp/05-data-and-api.md,
-- docs/mvp/09-fixed-contracts.md "Jobs and budget".

create table sutra.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references sutra.jobs (id) on delete cascade,
  document_id uuid not null references sutra.documents (id) on delete cascade,
  version_id uuid not null references sutra.document_versions (id) on delete cascade,
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  provider text not null,
  model text not null,
  mode text not null,
  prompt_hash text not null,
  schema_version text not null,
  alias_map_version text not null,
  state text not null default 'running',
  usage_json jsonb not null default '{}'::jsonb,
  call_count integer not null default 0,
  reserved_cost_usd numeric(12, 6) not null default 0,
  actual_cost_usd numeric(12, 6) not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  run_number integer not null default 1,
  first_leased_at timestamptz,
  deadline_at timestamptz,
  finished_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  constraint extraction_runs_mode_check check (mode in ('fixture', 'live')),
  constraint extraction_runs_state_check
    check (state in ('running', 'succeeded', 'failed', 'abandoned')),
  constraint extraction_runs_call_budget check (call_count >= 0 and call_count <= 12)
);

create index extraction_runs_version_idx on sutra.extraction_runs (version_id, created_at desc);

create table sutra.provider_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references sutra.extraction_runs (id) on delete cascade,
  ordinal integer not null,
  state text not null default 'reserved',
  reserved_cost_usd numeric(12, 6) not null default 0,
  actual_cost_usd numeric(12, 6) not null default 0,
  token_count integer not null default 0,
  error_category text,
  dispatched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, ordinal),
  constraint provider_calls_state_check
    check (state in ('reserved', 'dispatched', 'succeeded', 'failed'))
);

-- Durable sub-batch outputs for extraction: (run_id, batch_index).
create table sutra.extraction_batches (
  run_id uuid not null references sutra.extraction_runs (id) on delete cascade,
  batch_index integer not null,
  page_from integer not null,
  page_to integer not null,
  state text not null default 'pending',
  result_ref jsonb,
  completed_at timestamptz,
  primary key (run_id, batch_index),
  constraint extraction_batches_state_check
    check (state in ('pending', 'succeeded', 'failed'))
);

create table sutra.evidence_spans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  document_version_id uuid not null references sutra.document_versions (id) on delete cascade,
  page integer not null,
  quote text not null,
  bbox double precision[],
  origin text not null,
  created_at timestamptz not null default now(),
  constraint evidence_spans_page_check check (page >= 1),
  constraint evidence_spans_origin_check
    check (origin in ('pdf_text', 'ocr', 'visual_transcription', 'manual')),
  constraint evidence_spans_bbox_check
    check (bbox is null or array_length(bbox, 1) = 4)
);

create index evidence_spans_version_idx on sutra.evidence_spans (document_version_id, page);

create table sutra.review_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  document_id uuid not null references sutra.documents (id) on delete cascade,
  document_version_id uuid not null references sutra.document_versions (id) on delete cascade,
  extraction_run_id uuid references sutra.extraction_runs (id) on delete set null,
  revision integer not null default 0,
  identity_state text not null default 'unchecked',
  identity_reason text,
  identity_raw text,
  state text not null default 'draft',
  supersedes_batch_id uuid references sutra.review_batches (id) on delete set null,
  approval_revision integer,
  excluded_pages jsonb not null default '[]'::jsonb,
  coverage_json jsonb not null default '{}'::jsonb,
  document_issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint review_batches_identity_check
    check (identity_state in ('unchecked', 'matched', 'missing_confirmed', 'mismatch')),
  constraint review_batches_state_check
    check (state in ('draft', 'identity_hold', 'ready', 'published', 'superseded')),
  constraint review_batches_revision_check check (revision >= 0)
);

create index review_batches_document_idx on sutra.review_batches (document_id, revision desc);
create index review_batches_state_idx on sutra.review_batches (clinic_id, state);

create table sutra.draft_facts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  document_id uuid not null references sutra.documents (id) on delete cascade,
  document_version_id uuid not null references sutra.document_versions (id) on delete cascade,
  review_batch_id uuid not null references sutra.review_batches (id) on delete cascade,
  kind text not null,
  raw_label text not null,
  raw_value text,
  raw_unit text,
  event_date date,
  date_raw text,
  date_kind text not null,
  date_precision text not null,
  normalized_json jsonb not null,
  issues_json jsonb not null default '[]'::jsonb,
  review_state text not null default 'unreviewed',
  review_reason text,
  revision integer not null default 0,
  group_id text,
  ordinal integer not null default 0,
  source_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint draft_facts_kind_check check (kind in ('observation', 'prescription', 'examination')),
  constraint draft_facts_review_state_check
    check (review_state in ('unreviewed', 'reviewed', 'excluded')),
  constraint draft_facts_date_kind_check
    check (date_kind in ('collection', 'report', 'prescription', 'examination', 'reported')),
  constraint draft_facts_date_precision_check
    check (date_precision in ('day', 'month', 'year', 'unknown'))
);

create index draft_facts_batch_idx on sutra.draft_facts (review_batch_id, ordinal);
create index draft_facts_document_idx on sutra.draft_facts (document_id, created_at desc);

create table sutra.draft_fact_evidence (
  draft_fact_id uuid not null references sutra.draft_facts (id) on delete cascade,
  evidence_id uuid not null references sutra.evidence_spans (id) on delete cascade,
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  primary key (draft_fact_id, evidence_id)
);

-- ---------------------------------------------------------------------------
-- Evidence visibility helper (defined after the tables it reads)
-- ---------------------------------------------------------------------------

create or replace function sutra.can_read_evidence(p_version uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
    from sutra.document_versions v
    join sutra.documents d on d.id = v.document_id
    where v.id = p_version
      and (
        sutra.is_clinic_member(v.clinic_id, 'reviewer')
        or sutra.is_clinic_member(v.clinic_id, 'clinician')
        or (sutra.is_linked_patient(d.patient_id) and d.released_to_patient)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table sutra.extraction_runs enable row level security;
alter table sutra.provider_calls enable row level security;
alter table sutra.extraction_batches enable row level security;
alter table sutra.evidence_spans enable row level security;
alter table sutra.review_batches enable row level security;
alter table sutra.draft_facts enable row level security;
alter table sutra.draft_fact_evidence enable row level security;

drop policy if exists review_batches_reviewer on sutra.review_batches;
create policy review_batches_reviewer on sutra.review_batches
  for select to :api_role
  using (sutra.can_review_document(document_id));

drop policy if exists draft_facts_reviewer on sutra.draft_facts;
create policy draft_facts_reviewer on sutra.draft_facts
  for select to :api_role
  using (sutra.can_review_document(document_id));

drop policy if exists draft_fact_evidence_reviewer on sutra.draft_fact_evidence;
create policy draft_fact_evidence_reviewer on sutra.draft_fact_evidence
  for select to :api_role
  using (
    exists (select 1 from sutra.draft_facts f where f.id = draft_fact_evidence.draft_fact_id)
  );

drop policy if exists evidence_spans_read on sutra.evidence_spans;
create policy evidence_spans_read on sutra.evidence_spans
  for select to :api_role
  using (sutra.can_read_evidence(document_version_id));

-- Run telemetry is operational. It is not a patient-facing surface.
drop policy if exists extraction_runs_read on sutra.extraction_runs;
create policy extraction_runs_read on sutra.extraction_runs
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id, 'reviewer'));

drop policy if exists provider_calls_read on sutra.provider_calls;
create policy provider_calls_read on sutra.provider_calls
  for select to :api_role
  using (
    exists (
      select 1 from sutra.extraction_runs r
      where r.id = provider_calls.run_id and sutra.is_clinic_member(r.clinic_id, 'reviewer')
    )
  );

drop policy if exists extraction_batches_read on sutra.extraction_batches;
create policy extraction_batches_read on sutra.extraction_batches
  for select to :api_role
  using (
    exists (
      select 1 from sutra.extraction_runs r
      where r.id = extraction_batches.run_id and sutra.is_clinic_member(r.clinic_id, 'reviewer')
    )
  );

drop policy if exists worker_extraction_runs on sutra.extraction_runs;
create policy worker_extraction_runs on sutra.extraction_runs
  for all to sutra_worker using (true) with check (true);

drop policy if exists worker_provider_calls on sutra.provider_calls;
create policy worker_provider_calls on sutra.provider_calls
  for all to sutra_worker using (true) with check (true);

drop policy if exists worker_extraction_batches on sutra.extraction_batches;
create policy worker_extraction_batches on sutra.extraction_batches
  for all to sutra_worker using (true) with check (true);

drop policy if exists worker_evidence_spans on sutra.evidence_spans;
create policy worker_evidence_spans on sutra.evidence_spans
  for all to sutra_worker using (true) with check (true);

drop policy if exists worker_review_batches on sutra.review_batches;
create policy worker_review_batches on sutra.review_batches
  for all to sutra_worker using (true) with check (true);

drop policy if exists worker_draft_facts on sutra.draft_facts;
create policy worker_draft_facts on sutra.draft_facts
  for all to sutra_worker using (true) with check (true);

drop policy if exists worker_draft_fact_evidence on sutra.draft_fact_evidence;
create policy worker_draft_fact_evidence on sutra.draft_fact_evidence
  for all to sutra_worker using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Grants. The API role reads drafts for review and never writes them directly:
-- every review mutation goes through sutra.update_review in migration 004.
-- ---------------------------------------------------------------------------

grant select on sutra.evidence_spans, sutra.review_batches, sutra.draft_facts,
  sutra.draft_fact_evidence, sutra.extraction_runs, sutra.provider_calls,
  sutra.extraction_batches to :api_role;

grant select, insert, update, delete on sutra.extraction_runs, sutra.provider_calls,
  sutra.extraction_batches, sutra.evidence_spans, sutra.review_batches, sutra.draft_facts,
  sutra.draft_fact_evidence to sutra_worker;

grant execute on function sutra.can_read_evidence(uuid) to :api_role, sutra_worker;

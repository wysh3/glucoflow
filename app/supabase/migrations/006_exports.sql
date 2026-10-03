-- 006_exports.sql
-- Export snapshots. A snapshot freezes approved fact IDs and note version IDs at
-- request time; the renderer reads that manifest and never re-queries current notes.
-- Source: docs/mvp/03-architecture.md "Export", docs/mvp/05-data-and-api.md.

create table sutra.exports (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  approval_revision integer not null,
  state text not null default 'queued',
  object_path text,
  snapshot_manifest_json jsonb not null,
  data_cutoff_at timestamptz not null default now(),
  synthetic boolean not null default false,
  fact_count integer not null default 0,
  note_count integer not null default 0,
  coverage_notes jsonb not null default '[]'::jsonb,
  job_id uuid references sutra.jobs (id) on delete set null,
  error_code text,
  created_by uuid not null references sutra.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  constraint exports_state_check check (state in ('queued', 'running', 'ready', 'failed')),
  constraint exports_approval_revision_check check (approval_revision >= 0)
);

create index exports_patient_idx on sutra.exports (patient_id, created_at desc);

alter table sutra.exports enable row level security;

drop policy if exists exports_read on sutra.exports;
create policy exports_read on sutra.exports
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id) or sutra.is_linked_patient(patient_id));

drop policy if exists worker_exports on sutra.exports;
create policy worker_exports on sutra.exports
  for all to sutra_worker using (true) with check (true);

grant select on sutra.exports to :api_role;
grant select, insert, update on sutra.exports to sutra_worker;

-- Facts that were current at a given approval revision, applying status events.
create or replace function sutra.facts_current_at(p_patient uuid, p_revision integer)
returns setof sutra.approved_facts
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select f.*
  from sutra.approved_facts f
  where f.patient_id = p_patient
    and f.approval_revision <= p_revision
    and coalesce(
      (
        select e.status
        from sutra.fact_status_events e
        where e.fact_id = f.id and e.approval_revision <= p_revision
        order by e.approval_revision desc, e.created_at desc
        limit 1
      ),
      f.status
    ) = 'retained';
$$;

create or replace function sutra.create_export(
  p_patient uuid,
  p_approval_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_patient sutra.patients;
  v_clinic sutra.clinics;
  v_fact_ids uuid[];
  v_note_ids uuid[];
  v_export_id uuid;
  v_job_id uuid;
  v_cutoff timestamptz := now();
  v_coverage jsonb := '[]'::jsonb;
  v_previous uuid;
begin
  select * into v_patient from sutra.patients p where p.id = p_patient;
  if not found then
    raise exception 'patient not found' using errcode = 'P0002';
  end if;
  select * into v_clinic from sutra.clinics c where c.id = v_patient.clinic_id;

  if not (
    sutra.is_clinic_member(v_patient.clinic_id)
    or sutra.is_linked_patient(p_patient)
  ) then
    raise exception 'not authorized to export this record' using errcode = '42501';
  end if;

  if p_approval_revision <> v_patient.approval_revision then
    raise exception 'the approved record changed; reload before exporting' using errcode = '40001';
  end if;
  if p_approval_revision = 0 then
    raise exception 'there is no approved record to export yet' using errcode = 'P0001';
  end if;

  select array_agg(f.id order by f.event_date nulls last, f.ordinal)
  into v_fact_ids
  from sutra.facts_current_at(p_patient, p_approval_revision) f;

  select array_agg(n.id order by n.submitted_at)
  into v_note_ids
  from sutra.patient_notes n
  where n.patient_id = p_patient and n.submitted_at <= v_cutoff;

  select e.id into v_previous
  from sutra.exports e
  where e.patient_id = p_patient and e.state = 'ready'
  order by e.created_at desc limit 1;

  if exists (
    select 1 from sutra.documents d
    where d.patient_id = p_patient and d.amendment_pending
  ) then
    v_coverage := v_coverage || to_jsonb('A newer document is awaiting review for this patient.'::text);
  end if;
  if exists (
    select 1 from sutra.review_batches b
    where b.patient_id = p_patient and jsonb_array_length(b.excluded_pages) > 0
  ) then
    v_coverage := v_coverage || to_jsonb('Some pages were excluded during review. This summary is partially represented.'::text);
  end if;
  if v_clinic.is_demo then
    v_coverage := v_coverage || to_jsonb('Synthetic demonstration record. Not a real patient.'::text);
  end if;

  insert into sutra.exports (
    clinic_id, patient_id, approval_revision, state, snapshot_manifest_json,
    data_cutoff_at, synthetic, fact_count, note_count, coverage_notes, created_by
  )
  values (
    v_patient.clinic_id, p_patient, p_approval_revision, 'queued',
    jsonb_build_object(
      'exportId', null,
      'clinicId', v_patient.clinic_id,
      'patientId', p_patient,
      'approvalRevision', p_approval_revision,
      'dataCutoffAt', v_cutoff,
      'synthetic', v_clinic.is_demo,
      'factIds', coalesce(to_jsonb(v_fact_ids), '[]'::jsonb),
      'noteVersionIds', coalesce(to_jsonb(v_note_ids), '[]'::jsonb),
      'previousExportId', v_previous,
      'coverageNotes', v_coverage
    ),
    v_cutoff, v_clinic.is_demo, coalesce(array_length(v_fact_ids, 1), 0),
    coalesce(array_length(v_note_ids, 1), 0), v_coverage, v_actor
  )
  returning id into v_export_id;

  update sutra.exports
    set snapshot_manifest_json = jsonb_set(snapshot_manifest_json, '{exportId}', to_jsonb(v_export_id))
    where id = v_export_id;

  insert into sutra.jobs (clinic_id, patient_id, kind, target_id, created_by)
  values (v_patient.clinic_id, p_patient, 'render_export', v_export_id, v_actor)
  returning id into v_job_id;

  update sutra.exports set job_id = v_job_id where id = v_export_id;

  perform sutra.write_audit(v_patient.clinic_id, p_patient, v_actor, 'export', v_export_id,
    'export_requested', p_approval_revision, null);

  return jsonb_build_object(
    'exportId', v_export_id,
    'jobId', v_job_id,
    'state', 'queued',
    'approvalRevision', p_approval_revision,
    'factCount', coalesce(array_length(v_fact_ids, 1), 0),
    'noteCount', coalesce(array_length(v_note_ids, 1), 0),
    'dataCutoffAt', v_cutoff
  );
end
$$;

grant execute on function sutra.create_export(uuid, integer) to :api_role;
grant execute on function sutra.facts_current_at(uuid, integer) to :api_role, sutra_worker;

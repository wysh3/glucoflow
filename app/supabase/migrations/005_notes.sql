-- 005_notes.sql
-- Patient notes. Patient statements keep their reporter and never become measured
-- results. Source: docs/mvp/01-product.md, docs/mvp/05-data-and-api.md "Tables".

create table sutra.patient_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references sutra.clinics (id) on delete cascade,
  patient_id uuid not null references sutra.patients (id) on delete cascade,
  author_id uuid not null references sutra.app_users (id) on delete restrict,
  category text not null,
  body text not null,
  event_date date,
  submitted_at timestamptz not null default now(),
  version integer not null default 1,
  supersedes_note_id uuid references sutra.patient_notes (id) on delete set null,
  seen_by uuid references sutra.app_users (id) on delete set null,
  seen_at timestamptz,
  constraint patient_notes_category_check
    check (category in ('medication_taking', 'symptoms', 'diet_activity', 'other')),
  constraint patient_notes_body_check check (length(btrim(body)) between 1 and 1000),
  constraint patient_notes_version_check check (version >= 1)
);

create index patient_notes_patient_idx on sutra.patient_notes (patient_id, submitted_at desc);
create unique index patient_notes_one_successor
  on sutra.patient_notes (supersedes_note_id)
  where supersedes_note_id is not null;

alter table sutra.patient_notes enable row level security;

drop policy if exists patient_notes_read on sutra.patient_notes;
create policy patient_notes_read on sutra.patient_notes
  for select to :api_role
  using (sutra.is_clinic_member(clinic_id) or sutra.is_linked_patient(patient_id));

drop policy if exists worker_patient_notes_read on sutra.patient_notes;
create policy worker_patient_notes_read on sutra.patient_notes
  for select to sutra_worker using (true);

grant select on sutra.patient_notes to :api_role, sutra_worker;

create or replace function sutra.submit_patient_note(
  p_patient uuid,
  p_category text,
  p_body text,
  p_event_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_clinic uuid;
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_category not in ('medication_taking', 'symptoms', 'diet_activity', 'other') then
    raise exception 'unknown note category' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'a note cannot be blank' using errcode = '22023';
  end if;
  if length(p_body) > 1000 then
    raise exception 'a note is limited to 1,000 characters' using errcode = '22023';
  end if;
  select p.clinic_id into v_clinic from sutra.patients p where p.id = p_patient;
  if v_clinic is null then
    raise exception 'patient not found' using errcode = 'P0002';
  end if;
  -- Notes are patient-authored only. Staff cannot write a note as the patient.
  if not sutra.is_linked_patient(p_patient) then
    raise exception 'only the linked patient can submit a note for this record' using errcode = '42501';
  end if;

  insert into sutra.patient_notes (clinic_id, patient_id, author_id, category, body, event_date)
  values (v_clinic, p_patient, v_actor, p_category, btrim(p_body), p_event_date)
  returning id into v_id;

  perform sutra.write_audit(v_clinic, p_patient, v_actor, 'patient_note', v_id, 'note_submitted');
  return v_id;
end
$$;

create or replace function sutra.correct_patient_note(
  p_note uuid,
  p_category text,
  p_body text,
  p_event_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_note sutra.patient_notes;
  v_id uuid;
  v_version integer;
begin
  select * into v_note from sutra.patient_notes n where n.id = p_note for update;
  if not found then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  if v_note.author_id <> v_actor or not sutra.is_linked_patient(v_note.patient_id) then
    raise exception 'only the note author can correct this note' using errcode = '42501';
  end if;
  if exists (select 1 from sutra.patient_notes n where n.supersedes_note_id = p_note) then
    raise exception 'this note already has a correction' using errcode = 'P0001';
  end if;
  if p_category not in ('medication_taking', 'symptoms', 'diet_activity', 'other') then
    raise exception 'unknown note category' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 or length(p_body) > 1000 then
    raise exception 'a note must be between 1 and 1,000 characters' using errcode = '22023';
  end if;

  select coalesce(max(n.version), 0) + 1 into v_version
  from sutra.patient_notes n
  where n.patient_id = v_note.patient_id and (n.id = p_note or n.supersedes_note_id = p_note);

  insert into sutra.patient_notes (
    clinic_id, patient_id, author_id, category, body, event_date, version, supersedes_note_id
  )
  values (
    v_note.clinic_id, v_note.patient_id, v_actor, p_category, btrim(p_body), p_event_date,
    v_version, p_note
  )
  returning id into v_id;

  perform sutra.write_audit(v_note.clinic_id, v_note.patient_id, v_actor,
    'patient_note', v_id, 'note_corrected', v_version, null);
  return v_id;
end
$$;

-- Acknowledgement uses a separate status vocabulary from fact approval.
create or replace function sutra.acknowledge_patient_note(p_note uuid)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_actor uuid := sutra.current_actor_id();
  v_note sutra.patient_notes;
begin
  select * into v_note from sutra.patient_notes n where n.id = p_note for update;
  if not found then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  if not sutra.is_clinic_member(v_note.clinic_id) then
    raise exception 'clinic membership required to acknowledge a note' using errcode = '42501';
  end if;

  update sutra.patient_notes
    set seen_by = v_actor, seen_at = now()
    where id = p_note;

  perform sutra.write_audit(v_note.clinic_id, v_note.patient_id, v_actor,
    'patient_note', p_note, 'note_acknowledged');

  return jsonb_build_object('noteId', p_note, 'seenBy', v_actor, 'seenAt', now());
end
$$;

grant execute on function sutra.submit_patient_note(uuid, text, text, date) to :api_role;
grant execute on function sutra.correct_patient_note(uuid, text, text, date) to :api_role;
grant execute on function sutra.acknowledge_patient_note(uuid) to :api_role;

-- Source binaries are available to clinic staff, the patient who uploaded a
-- pending original, or the linked patient after explicit clinic release.
-- The document-version policy and source availability queries use this helper.
create or replace function sutra.can_read_document(p_document uuid)
returns boolean
language sql
stable
security definer
set search_path = sutra, pg_temp
as $$
  select exists (
    select 1
      from sutra.documents d
     where d.id = p_document
       and (
         sutra.is_clinic_member(d.clinic_id)
         or (
           sutra.is_linked_patient(d.patient_id)
           and d.assignment_state <> 'quarantined'
           and (d.uploader_id = sutra.current_actor_id() or d.released_to_patient)
         )
       )
  );
$$;

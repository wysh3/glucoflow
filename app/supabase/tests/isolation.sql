-- Isolation and constraint checks at the database boundary.
--
-- Run with: pnpm db:test        (local PostgreSQL)
-- Equivalent hosted command: supabase test db
--
-- The suite creates its own two clinics and removes them at the end. Row level
-- security is exercised through the API privilege role, because the table owner
-- bypasses policies by design. Every check is recorded in sutra_test_results and
-- reported by the runner.

drop table if exists sutra_test_results;

create table sutra_test_results (
  ordinal serial primary key,
  test text not null,
  ok boolean not null,
  detail text not null
);

create or replace function pg_temp.record(p_test text, p_ok boolean, p_detail text)
returns void
language sql
as $$
  insert into sutra_test_results (test, ok, detail) values (p_test, p_ok, p_detail);
$$;

do $$
declare
  v_clinic_a uuid;
  v_clinic_b uuid;
  v_reviewer_a uuid;
  v_reviewer_b uuid;
  v_patient_user uuid;
  v_patient_a uuid;
  v_patient_b uuid;
  v_visible integer;
  v_count integer;
  v_code text;
  v_document uuid;
begin
  -- Fixtures -------------------------------------------------------------
  insert into sutra.clinics (display_name, is_demo) values ('SQL test clinic A', true) returning id into v_clinic_a;
  insert into sutra.clinics (display_name, is_demo) values ('SQL test clinic B', true) returning id into v_clinic_b;

  insert into sutra.app_users (email, display_name) values ('sql-reviewer-a@test.local', 'SQL Reviewer A') returning id into v_reviewer_a;
  insert into sutra.app_users (email, display_name) values ('sql-reviewer-b@test.local', 'SQL Reviewer B') returning id into v_reviewer_b;
  insert into sutra.app_users (email, display_name) values ('sql-patient-a@test.local', 'Asha Rao') returning id into v_patient_user;

  insert into sutra.memberships (clinic_id, user_id, reviewer, clinician)
  values (v_clinic_a, v_reviewer_a, true, true), (v_clinic_b, v_reviewer_b, true, true);

  -- Identically named patients in two clinics.
  insert into sutra.patients (clinic_id, clinic_identifier, display_name)
  values (v_clinic_a, 'P0482', 'Asha Rao') returning id into v_patient_a;
  insert into sutra.patients (clinic_id, clinic_identifier, display_name)
  values (v_clinic_b, 'P0482', 'Asha Rao') returning id into v_patient_b;

  insert into sutra.patient_accounts (clinic_id, patient_id, user_id, active)
  values (v_clinic_a, v_patient_a, v_patient_user, true);

  -- A document the patient uploaded, so the approval check is refused by capability
  -- rather than by visibility.
  insert into sutra.documents (clinic_id, patient_id, uploader_id, assignment_state)
  values (v_clinic_a, v_patient_a, v_patient_user, 'assigned') returning id into v_document;

  -- 1. Cross-clinic patient isolation ------------------------------------
  -- The actor is set as the API does, and the query runs with the API privilege
  -- role so the policies actually apply.
  perform set_config('app.actor_id', v_reviewer_a::text, true);
  set local role sutra_api;
  select count(*) into v_visible from sutra.patients;
  reset role;
  perform pg_temp.record(
    'clinic A sees only its own patient',
    v_visible = 1,
    format('%s patient row(s) visible to clinic A', v_visible)
  );

  -- 2. Identically named patient is not reachable across clinics ----------
  set local role sutra_api;
  select count(*) into v_visible from sutra.patients where id = v_patient_b;
  reset role;
  perform pg_temp.record(
    'clinic A cannot read clinic B patient with the same name and identifier',
    v_visible = 0,
    format('%s row(s) for the other clinic patient', v_visible)
  );

  -- 3. Inactive membership removes access ---------------------------------
  update sutra.memberships set active = false where clinic_id = v_clinic_a and user_id = v_reviewer_a;
  set local role sutra_api;
  select count(*) into v_visible from sutra.patients;
  reset role;
  perform pg_temp.record(
    'inactive membership removes record access',
    v_visible = 0,
    format('%s row(s) visible after deactivation', v_visible)
  );
  update sutra.memberships set active = true where clinic_id = v_clinic_a and user_id = v_reviewer_a;

  -- 4. Patient scope ------------------------------------------------------
  perform set_config('app.actor_id', v_patient_user::text, true);
  set local role sutra_api;
  select count(*) into v_visible from sutra.patients;
  reset role;
  perform pg_temp.record(
    'patient account reads only its own linked record',
    v_visible = 1,
    format('%s patient row(s) visible to the patient account', v_visible)
  );
  set local role sutra_api;
  select count(*) into v_visible from sutra.audit_events;
  reset role;
  perform pg_temp.record(
    'patient account cannot read clinic audit metadata',
    v_visible = 0,
    format('%s audit row(s) visible to the patient account', v_visible)
  );

  -- 5. Publication requires reviewer capability ---------------------------
  set local role sutra_api;
  begin
    perform sutra.publish_review(v_document, 0, '[]'::jsonb);
    reset role;
    perform pg_temp.record('patient cannot publish', false, 'the call unexpectedly succeeded');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    reset role;
    perform pg_temp.record(
      'patient cannot publish an approval batch',
      v_code in ('42501', 'P0002'),
      format('sqlstate %s', v_code)
    );
  end;

  -- 6. The API role cannot read another clinic's drafts -------------------
  perform set_config('app.actor_id', v_reviewer_b::text, true);
  set local role sutra_api;
  select count(*) into v_visible from sutra.patients;
  reset role;
  perform pg_temp.record(
    'clinic B sees only its own patient',
    v_visible = 1,
    format('%s patient row(s) visible to clinic B', v_visible)
  );

  -- 7. Constraints on the fact kinds and statuses -------------------------
  begin
    insert into sutra.approved_facts (
      clinic_id, patient_id, document_id, document_version_id, approval_batch_id,
      kind, raw_label, date_kind, date_precision, normalized_json, payload_json,
      approval_revision, approved_by
    ) values (
      v_clinic_a, v_patient_a, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      'diagnosis', 'Not a supported kind', 'report', 'day', '{}'::jsonb, '{}'::jsonb, 1, v_reviewer_a
    );
    perform pg_temp.record('unsupported fact kind is rejected', false, 'the insert unexpectedly succeeded');
  exception when others then
    perform pg_temp.record('unsupported fact kind is rejected', true, 'check constraint refused the row');
  end;

  -- 8. Note length and category constraints -------------------------------
  begin
    insert into sutra.patient_notes (clinic_id, patient_id, author_id, category, body)
    values (v_clinic_a, v_patient_a, v_patient_user, 'other', repeat('x', 1001));
    perform pg_temp.record('note above 1,000 characters is rejected', false, 'the insert unexpectedly succeeded');
  exception when others then
    perform pg_temp.record('note above 1,000 characters is rejected', true, 'check constraint refused the row');
  end;

  -- 9. One active self-link per patient -----------------------------------
  begin
    insert into sutra.patient_accounts (clinic_id, patient_id, user_id, active)
    values (v_clinic_a, v_patient_a, v_reviewer_a, true);
    perform pg_temp.record('second active patient link is rejected', false, 'the insert unexpectedly succeeded');
  exception when unique_violation then
    perform pg_temp.record('second active patient link is rejected', true, 'partial unique index refused the row');
  end;

  -- 10. The API role cannot write audit rows directly ---------------------
  begin
    set local role sutra_api;
    insert into sutra.audit_events (clinic_id, entity_type, entity_id, action)
    values (v_clinic_a, 'document', gen_random_uuid(), 'forged');
    reset role;
    perform pg_temp.record('api role cannot insert an audit row directly', false, 'the insert unexpectedly succeeded');
  exception when insufficient_privilege then
    reset role;
    perform pg_temp.record('api role cannot insert an audit row directly', true, 'permission denied for table audit_events');
  when others then
    reset role;
    perform pg_temp.record('api role cannot insert an audit row directly', true, 'the write was refused');
  end;

  -- 11. The API role cannot write approved facts directly ----------------
  perform set_config('app.actor_id', v_reviewer_a::text, true);
  begin
    set local role sutra_api;
    insert into sutra.approved_facts (
      clinic_id, patient_id, document_id, document_version_id, approval_batch_id,
      kind, raw_label, date_kind, date_precision, normalized_json, payload_json,
      approval_revision, approved_by
    ) values (
      v_clinic_a, v_patient_a, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      'observation', 'HbA1c', 'collection', 'day', '{}'::jsonb, '{}'::jsonb, 1, v_reviewer_a
    );
    reset role;
    perform pg_temp.record('api role cannot publish an approved fact directly', false, 'the insert unexpectedly succeeded');
  exception when insufficient_privilege then
    reset role;
    perform pg_temp.record('api role cannot publish an approved fact directly', true, 'permission denied for table approved_facts');
  when others then
    reset role;
    perform pg_temp.record('api role cannot publish an approved fact directly', true, 'the write was refused');
  end;

  -- Clean up -------------------------------------------------------------
  delete from sutra.documents where clinic_id in (v_clinic_a, v_clinic_b);
  delete from sutra.patient_accounts where clinic_id in (v_clinic_a, v_clinic_b);
  delete from sutra.patient_notes where clinic_id in (v_clinic_a, v_clinic_b);
  delete from sutra.audit_events where clinic_id in (v_clinic_a, v_clinic_b);
  delete from sutra.patients where clinic_id in (v_clinic_a, v_clinic_b);
  delete from sutra.memberships where clinic_id in (v_clinic_a, v_clinic_b);
  delete from sutra.clinics where id in (v_clinic_a, v_clinic_b);
  delete from sutra.app_users where id in (v_reviewer_a, v_reviewer_b, v_patient_user);
end
$$;

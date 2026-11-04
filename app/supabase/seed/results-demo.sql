-- Synthetic result-ledger demo data. Safe to rerun; only rows with the demo ref
-- prefix are replaced. No real patient data.
do $$
declare
  v_clinic uuid;
  v_patient uuid;
  v_owner uuid;
begin
  select id into v_clinic from sutra.clinics where is_demo order by created_at limit 1;
  select id into v_patient from sutra.patients where clinic_id = v_clinic order by created_at limit 1;
  select m.user_id into v_owner
    from sutra.memberships m
    join sutra.app_users u on u.id = m.user_id
    where m.clinic_id = v_clinic and m.active and (m.reviewer or m.clinician)
    order by m.created_at limit 1;
  if v_clinic is null or v_patient is null or v_owner is null then
    raise exception 'seed the demo clinic first';
  end if;

  delete from sutra.results where clinic_id = v_clinic and external_ref like 'demo-res-%';

  insert into sutra.results (
    clinic_id, patient_id, external_ref, source_channel, lab_name, report_received_at,
    patient_name_raw, patient_identifier_raw, test_name, value_text, unit, lab_flag,
    status, owner_id, due_at, acknowledged_at, acknowledged_by, informed_at, informed_by,
    informed_channel, escalation_level, closed_at, closed_by, created_by, created_at
  )
  select v_clinic, v_patient, ref, channel, lab, received, 'Asha Rao (synthetic)', 'P0482',
         test, value, unit, flag, status, owner, due, ack, ack_by, informed, informed_by,
         channel_informed, level, closed, closed_by, v_owner, received
  from (values
    ('demo-res-01', 'whatsapp', 'SRL Diagnostics', now() - interval '40 minutes',
     'Potassium', '6.4', 'mmol/L', 'critical', 'owned', v_owner, now() - interval '25 minutes',
     null::timestamptz, null::uuid, null::timestamptz, null::uuid, null::text, 1,
     null::timestamptz, null::uuid),
    ('demo-res-02', 'pdf', 'Metropolis Healthcare', now() - interval '3 hours',
     'Sodium', '128', 'mmol/L', 'critical', 'acknowledged', v_owner, now() - interval '2 hours 45 minutes',
     now() - interval '2 hours 30 minutes', v_owner, null, null, null, 1, null, null),
    ('demo-res-03', 'pdf', 'Dr Lal PathLabs', now() - interval '5 hours',
     'HbA1c', '9.1', '%', 'abnormal', 'acknowledged', v_owner, now() + interval '19 hours',
     now() - interval '3 hours', v_owner, null, null, null, 0, null, null),
    ('demo-res-04', 'paper', 'Apex Labs', now() - interval '8 hours',
     'Creatinine', '1.6', 'mg/dL', 'abnormal', 'matched', null, null,
     null, null, null, null, null, 0, null, null),
    ('demo-res-05', 'whatsapp', 'SRL Diagnostics', now() - interval '20 hours',
     'Hemoglobin', '8.2', 'g/dL', 'abnormal', 'owned', v_owner, now() + interval '4 hours',
     null, null, null, null, null, 0, null, null),
    ('demo-res-06', 'pdf', 'Metropolis Healthcare', now() - interval '26 hours',
     'TSH', '7.8', 'mIU/L', 'abnormal', 'patient_informed', v_owner, now() + interval '22 hours',
     now() - interval '24 hours', v_owner, now() - interval '5 hours', v_owner, 'call', 0, null, null),
    ('demo-res-07', 'portal', 'Dr Lal PathLabs', now() - interval '3 days',
     'LDL cholesterol', '160', 'mg/dL', 'abnormal', 'closed', v_owner, now() - interval '2 days',
     now() - interval '2 days 20 hours', v_owner, now() - interval '2 days', v_owner, 'in_person',
     0, now() - interval '1 day 19 hours', v_owner),
    ('demo-res-08', 'email', 'Apex Labs', now() - interval '30 hours',
     'eGFR', '52', 'mL/min/1.73m2', 'abnormal', 'matched', null, null,
     null, null, null, null, null, 0, null, null),
    ('demo-res-09', 'whatsapp', 'SRL Diagnostics', now() - interval '2 days',
     'Urine albumin/creatinine ratio', '42', 'mg/g', 'abnormal', 'patient_informed', v_owner,
     now() - interval '18 hours', now() - interval '1 day 20 hours', v_owner,
     now() - interval '1 day', v_owner, 'whatsapp', 0, null, null),
    ('demo-res-10', 'paper', 'Metropolis Healthcare', now() - interval '4 days',
     'Platelets', '90', 'x10^9/L', 'abnormal', 'closed', v_owner, now() - interval '3 days',
     now() - interval '3 days 20 hours', v_owner, now() - interval '2 days 20 hours', v_owner,
     'call', 0, now() - interval '2 days 18 hours', v_owner),
    ('demo-res-11', 'pdf', 'SRL Diagnostics', now() - interval '6 hours',
     'Fasting glucose', '142', 'mg/dL', 'abnormal', 'owned', v_owner, now() + interval '18 hours',
     null, null, null, null, null, 0, null, null),
    ('demo-res-12', 'paper', 'Apex Labs', now() - interval '10 hours',
     'ALT', '68', 'U/L', 'abnormal', 'matched', null, null,
     null, null, null, null, null, 0, null, null)
  ) as rows(ref, channel, lab, received, test, value, unit, flag, status, owner, due,
            ack, ack_by, informed, informed_by, channel_informed, level, closed, closed_by);

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, detail, created_at)
  select r.id, r.clinic_id, r.created_by, 'received', null, r.status,
         jsonb_build_object('labFlag', r.lab_flag, 'criticalitySource', 'lab_flag'), r.report_received_at
  from sutra.results r where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%';

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, detail, created_at)
  select r.id, r.clinic_id, r.created_by, 'assigned', 'matched', 'owned',
         jsonb_build_object('ownerId', r.owner_id, 'dueAt', r.due_at), r.report_received_at + interval '5 minutes'
  from sutra.results r
  where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.owner_id is not null;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, r.acknowledged_by, 'acknowledged', 'owned', 'acknowledged',
         'Reviewed the receipt against the incoming report.', jsonb_build_object('acknowledgedBy', r.acknowledged_by),
         r.acknowledged_at
  from sutra.results r
  where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.acknowledged_at is not null;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, r.informed_by, 'patient_informed', 'acknowledged', 'patient_informed',
         'Patient reached on the recorded channel.', jsonb_build_object('channel', r.informed_channel), r.informed_at
  from sutra.results r
  where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.informed_at is not null;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, created_at)
  select r.id, r.clinic_id, r.closed_by, 'closed', 'patient_informed', 'closed',
         'Receipt complete.', r.closed_at
  from sutra.results r
  where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.closed_at is not null;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, r.created_by, 'escalated', r.status, r.status,
         'Owner did not acknowledge within the critical window.', jsonb_build_object('level', r.escalation_level),
         r.report_received_at + interval '90 minutes'
  from sutra.results r
  where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.escalation_level > 0;
end
$$;

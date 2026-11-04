-- Synthetic diabetes result-closure demo data. Safe to rerun. No real patient data.
do $$
declare
  v_clinic uuid;
  v_owner uuid;
begin
  select id into v_clinic from sutra.clinics where is_demo order by created_at limit 1;
  select m.user_id into v_owner
    from sutra.memberships m
    join sutra.app_users u on u.id = m.user_id
    where m.clinic_id = v_clinic and m.active and (m.reviewer or m.clinician)
    order by m.created_at limit 1;
  if v_clinic is null or v_owner is null then
    raise exception 'seed the demo clinic first';
  end if;

  insert into sutra.patients (clinic_id, clinic_identifier, display_name)
  values
    (v_clinic, 'P0482', 'Asha Rao'),
    (v_clinic, 'P0511', 'Ramesh Patil'),
    (v_clinic, 'P0520', 'Sunita More'),
    (v_clinic, 'P0534', 'Imran Shaikh'),
    (v_clinic, 'P0546', 'Kavita Joshi'),
    (v_clinic, 'P0558', 'Deepak Verma'),
    (v_clinic, 'P0563', 'Meena Kulkarni'),
    (v_clinic, 'P0577', 'Arjun Nair'),
    (v_clinic, 'P0589', 'Fatima Khan'),
    (v_clinic, 'P0594', 'Sanjay Gupta')
  on conflict (clinic_id, clinic_identifier) do nothing;

  delete from sutra.results where clinic_id = v_clinic and (external_ref like 'demo-res-%' or external_ref like 'demo-import-%');

  create temp table _demo_results (
    ref text primary key,
    patient_identifier text,
    patient_name text,
    linked boolean not null default true,
    channel text,
    lab text,
    received timestamptz,
    released timestamptz,
    test text,
    value text,
    unit text,
    flag text,
    kind text,
    protocol text,
    started timestamptz,
    monitoring_due timestamptz,
    status text,
    owner uuid,
    due timestamptz,
    ack_at timestamptz,
    closed_at timestamptz
  ) on commit drop;

  insert into _demo_results (ref, patient_identifier, patient_name, linked, channel, lab, received, released, test, value, unit, flag, kind, protocol, started, monitoring_due, status, owner, due, ack_at, closed_at)
  values
    ('demo-res-01', 'P0482', 'Asha Rao', true, 'whatsapp', 'SRL Diagnostics', now() - interval '40 minutes', now() - interval '35 minutes', 'Potassium', '5.9', 'mmol/L', 'critical', 'monitoring', 'acei_arb_k_egfr_2w', now() - interval '14 days', now() - interval '5 minutes', 'owned', v_owner, now() - interval '20 minutes', null, null),
    ('demo-res-02', 'P0511', 'Ramesh Patil', true, 'pdf', 'Metropolis Healthcare', now() - interval '3 hours', now() - interval '2 hours 55 minutes', 'HbA1c', '8.7', '%', 'abnormal', 'unscheduled', null, null, null, 'acknowledged', v_owner, now() - interval '2 hours 31 minutes', now() - interval '2 hours 30 minutes', null),
    ('demo-res-03', 'P0520', 'Sunita More', true, 'pdf', 'Dr Lal PathLabs', now() - interval '5 hours', now() - interval '4 hours 55 minutes', 'eGFR', '48', 'mL/min/1.73m2', 'abnormal', 'monitoring', 'annual_uacr_egfr', now() - interval '30 days', now() + interval '2 days', 'matched', null, now() + interval '19 hours', null, null),
    ('demo-res-04', 'P0534', 'Imran Shaikh', false, 'paper', 'Apex Labs', now() - interval '6 hours', now() - interval '5 hours 55 minutes', 'Sodium', '128', 'mmol/L', 'critical', 'unscheduled', null, null, null, 'unmatched', null, now() - interval '5 hours 40 minutes', null, null),
    ('demo-res-05', 'P0546', 'Kavita Joshi', true, 'whatsapp', 'SRL Diagnostics', now() - interval '26 hours', now() - interval '25 hours 55 minutes', 'HbA1c', '9.2', '%', 'abnormal', 'unscheduled', null, null, null, 'patient_informed', v_owner, now() + interval '22 hours', now() - interval '24 hours', null),
    ('demo-res-06', 'P0558', 'Deepak Verma', true, 'portal', 'Dr Lal PathLabs', now() - interval '3 days', now() - interval '2 days 23 hours 55 minutes', 'Creatinine', '1.8', 'mg/dL', 'abnormal', 'unscheduled', null, null, null, 'closed', v_owner, now() - interval '2 days 23 hours 31 minutes', now() - interval '2 days 20 hours', now() - interval '1 day 18 hours'),
    ('demo-res-07', 'P0563', 'Meena Kulkarni', true, 'paper', 'Metropolis Healthcare', now() - interval '4 days', now() - interval '3 days 23 hours 55 minutes', 'Potassium', '6.2', 'mmol/L', 'critical', 'monitoring', 'mra_k_egfr_2w', now() - interval '21 days', now() - interval '3 days 23 hours 30 minutes', 'closed', v_owner, now() - interval '3 days 23 hours 40 minutes', now() - interval '3 days 23 hours 30 minutes', now() - interval '3 days 17 hours'),
    ('demo-res-08', 'P0577', 'Arjun Nair', true, 'whatsapp', 'SRL Diagnostics', now() - interval '2 days', now() - interval '1 day 23 hours 55 minutes', 'Urine albumin/creatinine ratio', '42', 'mg/g', 'abnormal', 'monitoring', 'annual_uacr_egfr', now() - interval '60 days', now() - interval '1 day', 'patient_informed', v_owner, now() - interval '18 hours', now() - interval '1 day 20 hours', null),
    ('demo-res-09', 'P0589', 'Fatima Khan', true, 'pdf', 'Apex Labs', now() - interval '6 hours', now() - interval '5 hours 55 minutes', 'Fasting glucose', '142', 'mg/dL', 'abnormal', 'unscheduled', null, null, null, 'acknowledged', v_owner, now() + interval '18 hours', now() - interval '5 hours', null),
    ('demo-res-10', 'P0594', 'Sanjay Gupta', true, 'paper', 'Metropolis Healthcare', now() - interval '10 hours', now() - interval '9 hours 55 minutes', 'ALT', '68', 'U/L', 'abnormal', 'unscheduled', null, null, null, 'matched', null, now() + interval '14 hours', null, null),
    ('demo-res-11', 'P0482', 'Asha Rao', true, 'pdf', 'Dr Lal PathLabs', now() - interval '5 days', now() - interval '4 days 23 hours 55 minutes', 'eGFR', '52', 'mL/min/1.73m2', 'abnormal', 'monitoring', 'annual_uacr_egfr', now() - interval '90 days', now() - interval '4 days 23 hours 31 minutes', 'closed', v_owner, now() - interval '4 days 23 hours 31 minutes', now() - interval '4 days 20 hours', now() - interval '2 days 23 hours'),
    ('demo-res-12', 'P0511', 'Ramesh Patil', true, 'whatsapp', 'SRL Diagnostics', now() - interval '2 days', now() - interval '1 day 23 hours 55 minutes', 'Potassium', '5.6', 'mmol/L', 'abnormal', 'unscheduled', null, null, null, 'closed', v_owner, now() - interval '1 day 23 hours 31 minutes', now() - interval '1 day 20 hours', now() - interval '12 hours');

  create temp table _demo_closure (
    ref text primary key,
    ack_value text,
    ack_flag text,
    notifier text,
    notifier_role text,
    readback text,
    informed_at timestamptz,
    informed_channel text,
    outcome text,
    recipient text,
    relation text,
    language text,
    next_step text,
    teachback boolean not null default false,
    next_due timestamptz,
    completed timestamptz,
    disposition text,
    closed_without boolean not null default false,
    consent boolean not null default false
  ) on commit drop;

  insert into _demo_closure (ref, ack_value, ack_flag, notifier, notifier_role, readback, informed_at, informed_channel, outcome, recipient, relation, language, next_step, teachback, next_due, completed, disposition, closed_without, consent)
  values
    ('demo-res-02', '8.7', 'abnormal', null, null, null, null, 'call', 'unreachable', null, null, 'Hindi', null, false, null, null, null, false, true),
    ('demo-res-05', '9.2', 'abnormal', null, null, null, now() - interval '5 hours', 'call', 'informed_patient', 'Kavita Joshi', 'self', 'Marathi', 'repeat_test', true, now() + interval '2 days', null, null, false, true),
    ('demo-res-06', '1.8', 'abnormal', null, null, null, now() - interval '2 days', 'in_person', 'informed_patient', 'Deepak Verma', 'self', 'Hindi', 'collect_report', true, now() + interval '2 days', now() - interval '1 day 19 hours', 'reviewed_action', false, true),
    ('demo-res-07', '6.2', 'critical', 'Lab technician', 'Metropolis', '6.2', null, 'call', 'unreachable', null, null, 'Marathi', null, false, null, null, 'unreachable', true, true),
    ('demo-res-08', '42', 'abnormal', null, null, null, now() - interval '1 day', 'whatsapp', 'informed_caregiver', 'Rohit Nair', 'son', 'Malayalam', 'see_specialist', true, now() + interval '3 days', null, null, false, true),
    ('demo-res-09', '142', 'abnormal', null, null, null, null, 'call', null, null, null, 'Hindi', null, false, null, null, null, false, false),
    ('demo-res-11', '52', 'abnormal', null, null, null, now() - interval '4 days', 'call', 'informed_patient', 'Asha Rao', 'self', 'Hindi', 'repeat_test', true, now() + interval '7 days', now() - interval '3 days', 'ongoing_management', false, true),
    ('demo-res-12', '5.6', 'abnormal', null, null, null, now() - interval '1 day', 'call', 'informed_patient', 'Ramesh Patil', 'self', 'Hindi', 'collect_report', true, now() + interval '2 days', now() - interval '18 hours', 'no_action', false, true);

  insert into sutra.results (
    clinic_id, patient_id, external_ref, source_channel, lab_name, report_received_at, lab_released_at,
    patient_name_raw, patient_identifier_raw, test_name, value_text, unit, lab_flag,
    result_kind, monitoring_protocol, monitoring_started_at, monitoring_due_at,
    status, owner_id, due_at, acknowledged_at, closed_at, created_by, created_at, contact_consent
  )
  select v_clinic,
         case when d.linked then p.id else null end,
         d.ref, d.channel, d.lab, d.received, d.released,
         d.patient_name, d.patient_identifier, d.test, d.value, d.unit, d.flag,
         d.kind, d.protocol, d.started, d.monitoring_due,
         d.status, d.owner, d.due, d.ack_at, d.closed_at, v_owner, d.received,
         coalesce(c.consent, false)
    from _demo_results d
    left join sutra.patients p on p.clinic_id = v_clinic and p.clinic_identifier = d.patient_identifier
    left join _demo_closure c on c.ref = d.ref;

  update sutra.results r
     set acknowledged_by = case when c.ack_value is not null then v_owner else null end,
         acknowledged_value_text = c.ack_value,
         acknowledged_flag = c.ack_flag,
         lab_notifier_name = c.notifier,
         lab_notifier_role = c.notifier_role,
         lab_read_back_value_text = c.readback,
         lab_read_back_at = case when c.readback is not null then r.acknowledged_at else null end,
         read_back_confirmed = c.readback is not null,
         read_back_at = case when c.readback is not null then r.acknowledged_at else null end,
         read_back_by = case when c.readback is not null then v_owner else null end,
         informed_at = c.informed_at,
         informed_by = case when c.informed_at is not null then v_owner else null end,
         informed_channel = c.informed_channel,
         communication_outcome = c.outcome,
         communication_recipient = c.recipient,
         communication_relation = c.relation,
         communication_language = c.language,
         next_step = c.next_step,
         next_step_due_at = c.next_due,
         next_step_completed_at = c.completed,
         teach_back_confirmed = c.teachback,
         disposition = c.disposition,
         closed_without_informed = c.closed_without,
         closed_by = case when r.closed_at is not null then v_owner else null end,
         consent_reference = case when c.consent then 'demo-consent-' || r.external_ref else null end
    from _demo_closure c
   where r.clinic_id = v_clinic and r.external_ref = c.ref;

  create temp table _demo_attempts (
    ref text,
    channel text,
    outcome text,
    recipient text,
    relation text,
    language text,
    note text,
    attempted_at timestamptz
  ) on commit drop;

  insert into _demo_attempts (ref, channel, outcome, recipient, relation, language, note, attempted_at)
  values
    ('demo-res-02', 'call', 'unreachable', null, null, 'Hindi', 'No answer on the first call.', now() - interval '2 hours'),
    ('demo-res-07', 'call', 'unreachable', null, null, 'Marathi', 'No answer.', now() - interval '3 days 20 hours'),
    ('demo-res-07', 'whatsapp', 'unreachable', null, null, 'Marathi', 'Message not delivered.', now() - interval '3 days 18 hours');

  insert into sutra.result_attempts (result_id, clinic_id, actor_id, channel, outcome, recipient, relation, language, note, attempted_at)
  select r.id, r.clinic_id, v_owner, a.channel, a.outcome, a.recipient, a.relation, a.language, a.note, a.attempted_at
    from _demo_attempts a
    join sutra.results r on r.clinic_id = v_clinic and r.external_ref = a.ref;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, r.created_by, 'received', null,
         case when r.patient_id is null then 'unmatched' else 'matched' end, null,
         jsonb_build_object('labFlag', r.lab_flag, 'criticalitySource', 'lab_flag',
                            'labReleasedAt', r.lab_released_at, 'resultKind', r.result_kind,
                            'monitoringProtocol', r.monitoring_protocol, 'dueAt', r.due_at),
         r.report_received_at
    from sutra.results r
   where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%';

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, v_owner, 'assigned', 'matched', 'owned', null,
         jsonb_build_object('ownerId', r.owner_id, 'dueAt', r.due_at),
         r.report_received_at + interval '5 minutes'
    from sutra.results r
   where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.owner_id is not null;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, v_owner, 'acknowledged', 'owned', 'acknowledged',
         'Printed value echoed by the clinician.',
         jsonb_build_object('acknowledgedBy', v_owner, 'valueEcho', r.acknowledged_value_text,
                            'flagEcho', r.acknowledged_flag, 'notifier', r.lab_notifier_name,
                            'notifierRole', r.lab_notifier_role, 'readBack', r.lab_read_back_value_text),
         r.acknowledged_at
    from sutra.results r
   where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.acknowledged_at is not null;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, v_owner, 'communication_attempt', 'acknowledged', 'acknowledged', a.note,
         jsonb_build_object('channel', a.channel, 'outcome', a.outcome, 'recipient', a.recipient,
                            'relation', a.relation, 'language', a.language, 'attemptedAt', a.attempted_at),
         a.attempted_at
    from _demo_attempts a
    join sutra.results r on r.clinic_id = v_clinic and r.external_ref = a.ref;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, v_owner, 'patient_informed', 'acknowledged', 'patient_informed',
         'Patient or caregiver reached.',
         jsonb_build_object('channel', r.informed_channel, 'outcome', r.communication_outcome,
                            'recipient', r.communication_recipient, 'relation', r.communication_relation,
                            'language', r.communication_language, 'nextStep', r.next_step,
                            'teachBack', r.teach_back_confirmed, 'attemptedAt', r.informed_at),
         r.informed_at
    from sutra.results r
   where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.informed_at is not null;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, v_owner, 'next_step_completed', r.status, r.status,
         'Next administrative step completed.',
         jsonb_build_object('completedAt', r.next_step_completed_at),
         r.next_step_completed_at
    from sutra.results r
   where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.next_step_completed_at is not null;

  insert into sutra.result_events (result_id, clinic_id, actor_id, event_type, from_status, to_status, note, detail, created_at)
  select r.id, r.clinic_id, v_owner, 'closed',
         case when r.closed_without_informed then 'acknowledged' else 'patient_informed' end,
         'closed',
         case when r.closed_without_informed then 'Closed after documented unsuccessful contact.' else 'Receipt complete.' end,
         jsonb_build_object('disposition', r.disposition, 'closedWithoutInformed', r.closed_without_informed,
                            'attempts', (select count(*) from sutra.result_attempts a where a.result_id = r.id)),
         r.closed_at
    from sutra.results r
   where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%' and r.closed_at is not null;
  update sutra.results r
     set custody_state = case when r.status in ('unmatched', 'matched') then 'received' else 'assigned' end,
         review_state = case when r.status in ('acknowledged', 'patient_informed', 'closed') then 'seen' else 'pending' end,
         communication_state = case
           when r.status = 'patient_informed' then 'informed'
           when r.status = 'closed' and not r.closed_without_informed and r.informed_at is not null then 'informed'
           when r.status = 'closed' then 'exception'
           else 'pending'
         end,
         terminal_state = case
           when r.status = 'closed' and (r.closed_without_informed or r.informed_at is null) then 'closed_unreachable'
           when r.status = 'closed' then 'closed'
           else null
         end,
         custody_actor_id = case when r.status <> 'unmatched' then r.owner_id else null end,
         review_actor_id = case when r.status in ('acknowledged', 'patient_informed', 'closed') then r.acknowledged_by else null end,
         communication_actor_id = case when r.status in ('patient_informed', 'closed') then r.informed_by else null end,
         custody_due_at = coalesce(r.custody_due_at, r.due_at),
         review_due_at = coalesce(r.review_due_at, r.due_at),
         communication_due_at = coalesce(r.communication_due_at, r.informed_at, r.due_at)
   where r.clinic_id = v_clinic and r.external_ref like 'demo-res-%';

  update sutra.results
     set review_due_at = case
           when review_state = 'pending' and terminal_state is null
             then now() + sutra.obligation_sla('review', lab_flag)
           else review_due_at end,
         communication_due_at = case
           when communication_state in ('pending', 'in_progress') and terminal_state is null
             then now() + sutra.obligation_sla('communication', lab_flag)
           else communication_due_at end
   where clinic_id = v_clinic and external_ref like 'demo-res-%';

end
$$;

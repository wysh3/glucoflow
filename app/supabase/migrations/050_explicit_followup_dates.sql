-- Preserve human-entered administrative dates; never infer a patient deadline.
-- The seven-day aggregate communication window remains an operational metric.
-- Monitoring-rate eligibility now requires an explicitly documented due date.

create or replace function sutra.record_result_communication(
  p_result uuid,
  p_channel text,
  p_outcome text,
  p_recipient text,
  p_relation text,
  p_language text,
  p_note text,
  p_attempted_at timestamptz,
  p_next_step text,
  p_teach_back boolean,
  p_next_step_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_result sutra.results;
  v_actor uuid := sutra.current_actor_id();
  v_attempt timestamptz := coalesce(p_attempted_at, now());
  v_informed boolean;
begin
  select * into v_result from sutra.results where id = p_result for update;
  if not found then raise exception 'result not found' using errcode = 'P0002'; end if;
  if not (sutra.is_clinic_member(v_result.clinic_id, 'clinician') or sutra.is_clinic_member(v_result.clinic_id, 'reviewer')) then
    raise exception 'clinician or reviewer capability required' using errcode = '42501';
  end if;
  if v_result.status <> 'acknowledged' then
    raise exception 'acknowledge the result before recording patient communication' using errcode = 'P0001';
  end if;
  if p_channel not in ('call', 'whatsapp', 'sms', 'in_person', 'letter', 'other') then
    raise exception 'unknown communication channel' using errcode = '22023';
  end if;
  if p_outcome not in (
    'informed_patient', 'informed_caregiver', 'informed_treating_doctor',
    'declined', 'unreachable', 'invalid_number', 'deceased', 'transferred'
  ) then
    raise exception 'unknown patient communication outcome' using errcode = '22023';
  end if;
  v_informed := p_outcome in ('informed_patient', 'informed_caregiver', 'informed_treating_doctor');
  if v_informed and nullif(btrim(coalesce(p_recipient, '')), '') is null then
    raise exception 'record who was spoken to' using errcode = '22023';
  end if;
  if v_informed and (p_next_step is null or p_next_step not in (
    'book_appointment', 'repeat_test', 'see_specialist', 'collect_report', 'urgent_attendance', 'other'
  )) then
    raise exception 'record the next administrative step' using errcode = '22023';
  end if;
  if not v_informed and p_next_step is not null then
    raise exception 'a next step can only be recorded when the patient or caregiver was reached' using errcode = '22023';
  end if;

  insert into sutra.result_attempts (
    result_id, clinic_id, actor_id, channel, outcome, recipient, relation, language, note, attempted_at
  ) values (
    p_result, v_result.clinic_id, v_actor, p_channel, p_outcome,
    nullif(btrim(coalesce(p_recipient, '')), ''),
    nullif(btrim(coalesce(p_relation, '')), ''),
    nullif(btrim(coalesce(p_language, '')), ''),
    p_note, v_attempt
  );

  if v_informed then
    update sutra.results
       set status = 'patient_informed',
           informed_at = v_attempt,
           informed_by = v_actor,
           informed_channel = p_channel,
           communication_outcome = p_outcome,
           communication_recipient = nullif(btrim(coalesce(p_recipient, '')), ''),
           communication_relation = nullif(btrim(coalesce(p_relation, '')), ''),
           communication_language = nullif(btrim(coalesce(p_language, '')), ''),
           next_step = p_next_step,
           next_step_due_at = p_next_step_due_at,
           teach_back_confirmed = coalesce(p_teach_back, false),
           read_back_confirmed = true,
           read_back_at = coalesce(read_back_at, v_attempt),
           read_back_by = coalesce(read_back_by, v_actor),
           updated_at = now()
     where id = p_result;
    perform sutra.result_event(p_result, v_actor, 'patient_informed', 'acknowledged', 'patient_informed', p_note,
      jsonb_build_object(
        'channel', p_channel,
        'outcome', p_outcome,
        'recipient', p_recipient,
        'relation', p_relation,
        'language', p_language,
        'nextStep', p_next_step,
        'teachBack', coalesce(p_teach_back, false),
        'attemptedAt', v_attempt
      ));
  else
    update sutra.results
       set communication_outcome = p_outcome,
           communication_recipient = nullif(btrim(coalesce(p_recipient, '')), ''),
           communication_relation = nullif(btrim(coalesce(p_relation, '')), ''),
           communication_language = nullif(btrim(coalesce(p_language, '')), ''),
           updated_at = now()
     where id = p_result;
    perform sutra.result_event(p_result, v_actor, 'communication_attempt', 'acknowledged', 'acknowledged', p_note,
      jsonb_build_object(
        'channel', p_channel,
        'outcome', p_outcome,
        'recipient', p_recipient,
        'relation', p_relation,
        'language', p_language,
        'attemptedAt', v_attempt
      ));
  end if;
end
$$;

create or replace function sutra.result_closure_stats(p_clinic uuid)
returns jsonb
language plpgsql
security definer
set search_path = sutra, pg_temp
as $$
declare
  v_total integer;
  v_closed_7d integer;
  v_open_last_mile integer;
  v_informed integer;
  v_teach_back integer;
  v_next_completed integer;
  v_unreachable integer;
  v_median_contact numeric;
  v_critical_open integer;
  v_monitoring_total integer;
  v_monitoring_closed_7d integer;
  v_monitoring_open integer;
begin
  if not sutra.is_clinic_member(p_clinic) then
    raise exception 'clinic membership required' using errcode = '42501';
  end if;
  select
    count(*) filter (where lab_flag in ('critical', 'abnormal')),
    count(*) filter (where lab_flag in ('critical', 'abnormal') and informed_at is not null
      and informed_at <= coalesce(lab_released_at, report_received_at) + interval '7 days'),
    count(*) filter (where lab_flag in ('critical', 'abnormal') and status <> 'closed'),
    count(*) filter (where informed_at is not null),
    count(*) filter (where informed_at is not null and teach_back_confirmed),
    count(*) filter (where next_step_completed_at is not null),
    count(*) filter (where closed_without_informed),
    count(*) filter (where lab_flag = 'critical' and status not in ('patient_informed', 'closed')),
    round(percentile_cont(0.5) within group (
      order by extract(epoch from (informed_at - coalesce(lab_released_at, report_received_at))) / 60
    ) filter (where informed_at is not null))::numeric,
    count(*) filter (where result_kind = 'monitoring' and monitoring_due_at is not null),
    count(*) filter (where result_kind = 'monitoring' and informed_at is not null
      and informed_at <= monitoring_due_at),
    count(*) filter (where result_kind = 'monitoring' and status <> 'closed')
  into v_total, v_closed_7d, v_open_last_mile, v_informed, v_teach_back, v_next_completed,
       v_unreachable, v_critical_open, v_median_contact, v_monitoring_total, v_monitoring_closed_7d,
       v_monitoring_open
  from sutra.results where clinic_id = p_clinic;

  return jsonb_build_object(
    'eligible', coalesce(v_total, 0),
    'closedWithin7Days', coalesce(v_closed_7d, 0),
    'openLastMile', coalesce(v_open_last_mile, 0),
    'informed', coalesce(v_informed, 0),
    'teachBackConfirmed', coalesce(v_teach_back, 0),
    'nextStepCompleted', coalesce(v_next_completed, 0),
    'unreachable', coalesce(v_unreachable, 0),
    'criticalOpen', coalesce(v_critical_open, 0),
    'medianContactMinutes', v_median_contact,
    'closureRate7d', case when coalesce(v_total, 0) = 0 then null
      else round((v_closed_7d::numeric / v_total::numeric), 3) end,
    'teachBackShare', case when coalesce(v_informed, 0) = 0 then null
      else round((v_teach_back::numeric / v_informed::numeric), 3) end,
    'nextStepCompletionShare', case when coalesce(v_informed, 0) = 0 then null
      else round((v_next_completed::numeric / v_informed::numeric), 3) end,
    'monitoringEligible', coalesce(v_monitoring_total, 0),
    'monitoringClosedWithinWindow', coalesce(v_monitoring_closed_7d, 0),
    'monitoringOpen', coalesce(v_monitoring_open, 0),
    'monitoringClosureRate', case when coalesce(v_monitoring_total, 0) = 0 then null
      else round((v_monitoring_closed_7d::numeric / v_monitoring_total::numeric), 3) end
  );
end
$$;

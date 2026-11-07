-- Hosted legacy migrations targeted Supabase's authenticated role. The API uses
-- sutra_api instead, so direct source/proof reads were invisible despite the
-- authorized SECURITY DEFINER worklist returning the same records.
-- Preserve legacy policies and apply the identical clinic boundary to the actual
-- API role. Do not grant membership in authenticated or bypass row security.
drop policy if exists results_api_read on sutra.results;
create policy results_api_read on sutra.results
  for select to sutra_api using (sutra.is_clinic_member(clinic_id));
drop policy if exists result_events_api_read on sutra.result_events;
create policy result_events_api_read on sutra.result_events
  for select to sutra_api using (sutra.is_clinic_member(clinic_id));
drop policy if exists result_attempts_api_read on sutra.result_attempts;
create policy result_attempts_api_read on sutra.result_attempts
  for select to sutra_api using (sutra.is_clinic_member(clinic_id));

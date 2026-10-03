-- 010_worker_read_scopes.sql
-- The worker is an elevated server-side role that reads the identity rows it needs
-- to process a leased job and to render a frozen export. It receives no clinic-wide
-- clinical read scope beyond those rows, and it never writes approved data.

drop policy if exists worker_patients_read on sutra.patients;
create policy worker_patients_read on sutra.patients
  for select to sutra_worker using (true);

drop policy if exists worker_clinics_read on sutra.clinics;
create policy worker_clinics_read on sutra.clinics
  for select to sutra_worker using (true);

drop policy if exists worker_app_users_read on sutra.app_users;
create policy worker_app_users_read on sutra.app_users
  for select to sutra_worker using (true);

drop policy if exists worker_patient_accounts_read on sutra.patient_accounts;
create policy worker_patient_accounts_read on sutra.patient_accounts
  for select to sutra_worker using (true);

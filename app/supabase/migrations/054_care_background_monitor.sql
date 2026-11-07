-- Internal worker may reconcile only the existing synthetic simulator store.
-- API ownership policies and clinical-record privileges are unchanged.
alter table sutra.care_workspaces add column monitor_checked_at timestamptz not null default '-infinity';
create index care_monitor_due_idx on sutra.care_workspaces (monitor_checked_at, id)
where state->'tasks' @? '$[*] ? (@.status == "awaiting_approval" || @.status == "monitoring" || @.status == "awaiting_evidence" || @.status == "paused")';
create policy care_workspaces_background on sutra.care_workspaces
  to sutra_worker
  using (state->'synthetic' = 'true'::jsonb and nullif(current_setting('app.worker_id', true), '') is not null)
  with check (state->'synthetic' = 'true'::jsonb and nullif(current_setting('app.worker_id', true), '') is not null);
grant select on sutra.care_workspaces to sutra_worker;
grant update (state, monitor_checked_at) on sutra.care_workspaces to sutra_worker;

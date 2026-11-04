-- The API still has no insert, update or delete grant on result_events. The
-- database trigger blocks edits. Deletion is allowed only for an owner-led demo
-- reset; the hash chain makes a removed event detectable in any proof.
drop trigger if exists result_events_no_update on sutra.result_events;
create trigger result_events_no_update
  before update on sutra.result_events
  for each row execute function sutra.result_events_immutable();

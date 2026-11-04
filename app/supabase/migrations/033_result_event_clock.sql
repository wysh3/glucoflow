-- 033_result_event_clock.sql
-- Events written inside one transaction must still have a strict order.
--
-- now() is the transaction start time, so several events created in one command
-- can share the same timestamp. The chain is ordered by created_at, id; UUIDs are
-- random, so a same-timestamp pair could verify in the wrong order. clock_timestamp()
-- advances within the transaction and gives the hash chain a deterministic order.
alter table sutra.result_events
  alter column created_at set default clock_timestamp();

comment on column sutra.result_events.created_at is
  'Wall-clock insertion time. clock_timestamp rather than now() so multiple events in one transaction have a strict order.';

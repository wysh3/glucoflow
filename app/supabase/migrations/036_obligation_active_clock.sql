-- 036_obligation_active_clock.sql
-- The breach clock belongs to the stage that currently owns the obligation, not to
-- the earliest deadline ever set. After custody is accepted, the custody deadline
-- is history; after review, the review deadline is history.

create or replace function sutra.obligation_breach(r sutra.results)
returns timestamptz
language sql
stable
as $$
  select case
    when r.terminal_state is not null then null
    when r.paused_at is not null then null
    when r.review_state = 'seen' and r.communication_state in ('pending', 'in_progress')
      then r.communication_due_at
    when r.custody_state = 'assigned' and r.review_state = 'pending'
      then r.review_due_at
    when r.custody_state in ('received', 'accepted')
      then r.custody_due_at
    else null
  end;
$$;

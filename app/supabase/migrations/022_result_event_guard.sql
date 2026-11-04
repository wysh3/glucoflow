-- The append-only event writer is an internal helper. Clinicians must not be able
-- to forge an event by calling it directly; only the state-transition procedures
-- should write the audit trail.
revoke all on function sutra.result_event(uuid, uuid, text, text, text, text, jsonb) from public;

-- Migration 035 replaced the seven-argument internal audit writer with a
-- nine-argument function. New PostgreSQL functions grant EXECUTE to PUBLIC;
-- carry the internal-only boundary forward to this overload.
-- Authorized SECURITY DEFINER transitions still invoke it as its owner.
revoke execute on function sutra.result_event(uuid, uuid, text, text, text, text, jsonb, text, text) from public;
revoke execute on function sutra.result_event(uuid, uuid, text, text, text, text, jsonb, text, text) from :api_role;
revoke execute on function sutra.result_event(uuid, uuid, text, text, text, text, jsonb, text, text) from sutra_worker;

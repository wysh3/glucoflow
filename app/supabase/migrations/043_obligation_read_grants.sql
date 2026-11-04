-- 043_obligation_read_grants.sql
-- The line and calls projections read result_attempts for the attempt count.
-- The API role had select on results and result_events but not on the attempts
-- table added with the closure ledger, so the hosted worklist returned 403.

grant select on sutra.result_attempts to sutra_api;
grant select on sutra.result_attempts to sutra_worker;

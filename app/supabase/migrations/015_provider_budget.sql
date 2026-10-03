-- Durable token reservations and literal usage. Unknown outcomes retain reservations.
alter table sutra.extraction_runs add column reserved_tokens integer not null default 0 check (reserved_tokens >= 0);
alter table sutra.provider_calls add column reserved_tokens integer not null default 0 check (reserved_tokens >= 0);
alter table sutra.provider_calls add column usage_known boolean not null default false;
alter table sutra.provider_calls add column input_tokens integer;
alter table sutra.provider_calls add column output_tokens integer;

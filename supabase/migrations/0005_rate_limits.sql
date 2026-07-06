-- v3.3 §1.1: fixed-window daily rate limits for AI routes.
-- Key is "<route>:<userId|ip-hash>"; one row per key per UTC day.
-- Service-role only — no user-facing policies, same posture as ai_usage.

create table if not exists public.rate_limits (
  key text not null,
  day date not null,
  count integer not null default 0,
  primary key (key, day)
);

alter table public.rate_limits enable row level security;
-- No policies: only the service role (which bypasses RLS) touches this table.

-- Optional hygiene: old windows are dead weight; a daily cron may run
--   delete from public.rate_limits where day < current_date - 7;

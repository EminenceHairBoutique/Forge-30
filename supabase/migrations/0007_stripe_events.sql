-- Forge30 — Stripe webhook idempotency ledger.
-- Stripe retries deliveries, so the same event id can arrive more than once.
-- The webhook inserts each event id here first (on conflict do nothing); a
-- row that already existed means "already processed" → the handler returns
-- 200 and skips. Critical for invoice.* events where a re-run would otherwise
-- re-apply state. SERVICE-ROLE ONLY, same posture as subscriptions.

create table if not exists public.stripe_events (
  id text primary key,               -- Stripe event id (evt_...)
  type text,
  created_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- No policies: only the service-role webhook writes/reads this table.

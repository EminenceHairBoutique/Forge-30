-- Forge30 — extend subscriptions for fuller Stripe lifecycle tracking.
-- ADDITIVE ONLY: 0004's columns (esp. `tier`, not `plan`) are unchanged, so
-- this is safe to run over an existing table. The webhook populates the new
-- columns from the Stripe subscription + price on every lifecycle event.
-- Table stays SERVICE-ROLE ONLY (RLS enabled in 0004, no user policies) —
-- clients read their tier through GET /api/entitlements.

alter table public.subscriptions
  add column if not exists billing_interval text,          -- 'month' | 'year'
  add column if not exists current_period_start timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

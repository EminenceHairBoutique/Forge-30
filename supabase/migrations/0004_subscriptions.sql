-- Forge30 v3 Phase 7 — subscriptions + AI usage metering.
-- Both tables are SERVICE-ROLE ONLY: RLS is enabled with no user policies,
-- so only the Stripe webhook and the AI routes (server) ever touch them.
-- Entitlement checks happen server-side on every AI route — never from
-- client-side flags.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'pro', 'elite')),
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null, -- "YYYY-MM"
  photo_count integer not null default 0,
  coach_count integer not null default 0,
  primary key (user_id, month)
);

alter table public.subscriptions enable row level security;
alter table public.ai_usage enable row level security;

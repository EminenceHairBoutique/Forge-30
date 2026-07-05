-- Forge30 v3 Phase 2 — web-push subscriptions + idempotent send log.
-- push_subscriptions is user-owned (RLS). notification_log has NO user
-- policies: only the service-role cron writes/reads it, and its unique key
-- (user_id, date, type) is what makes a double-fired cron send nothing twice.

create table if not exists public.push_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  tz text not null default 'UTC',
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

create table if not exists public.notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  type text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, date, type)
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

create policy "own subs select" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "own subs insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "own subs update" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subs delete" on public.push_subscriptions for delete using (auth.uid() = user_id);

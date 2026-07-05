-- Forge30 v3 Phase 1 — core sync schema.
--
-- Two generic tables instead of one per collection: the adapter's ~30
-- localStorage collections sync as whole-collection blobs (one row each),
-- and IndexedDB large-store collections (journal notes/audio, assessment
-- results, photo thumbnails later) sync per record. Shape evolution stays in
-- the app's schema-version migrations; the database stores versioned jsonb.
-- RLS: a user can only ever touch their own rows. No public access anywhere.

create table if not exists public.sync_blobs (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection text not null,
  data jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection)
);

create table if not exists public.sync_rows (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection text not null,
  row_id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, row_id)
);

create index if not exists sync_blobs_pull on public.sync_blobs (user_id, updated_at);
create index if not exists sync_rows_pull on public.sync_rows (user_id, updated_at);

alter table public.sync_blobs enable row level security;
alter table public.sync_rows enable row level security;

create policy "own blobs select" on public.sync_blobs for select using (auth.uid() = user_id);
create policy "own blobs insert" on public.sync_blobs for insert with check (auth.uid() = user_id);
create policy "own blobs update" on public.sync_blobs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own blobs delete" on public.sync_blobs for delete using (auth.uid() = user_id);

create policy "own rows select" on public.sync_rows for select using (auth.uid() = user_id);
create policy "own rows insert" on public.sync_rows for insert with check (auth.uid() = user_id);
create policy "own rows update" on public.sync_rows for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows delete" on public.sync_rows for delete using (auth.uid() = user_id);

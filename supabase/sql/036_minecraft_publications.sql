-- General-purpose Minecraft announcements and events. Kept separate from launcher_releases
-- so existing launcher clients keep receiving only versioned release records.
create table if not exists public.minecraft_publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug) between 3 and 180),
  kind text not null check (kind in (
    'announcement','devlog','feature','maintenance','server_event','tournament',
    'community','recruitment','roadmap','incident','guide','other'
  )),
  title text not null check (length(title) between 1 and 180),
  summary text not null check (length(summary) between 1 and 2400),
  body text not null default '' check (length(body) <= 30000),
  cover_image_url text,
  tags text[] not null default '{}',
  cta_label text,
  cta_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  pinned boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint minecraft_publications_event_dates check (
    starts_at is null or ends_at is null or ends_at >= starts_at
  ),
  constraint minecraft_publications_cta_pair check (
    (cta_label is null and cta_url is null) or
    (length(trim(cta_label)) between 1 and 60 and cta_url ~ '^https://')
  )
);
create index if not exists minecraft_publications_feed_idx
  on public.minecraft_publications (pinned desc, coalesce(published_at, scheduled_at) desc)
  where status = 'published';
create index if not exists minecraft_publications_kind_idx
  on public.minecraft_publications (kind, published_at desc)
  where status = 'published';
alter table public.minecraft_publications enable row level security;
revoke all on public.minecraft_publications from anon, authenticated;
grant select on public.minecraft_publications to anon, authenticated;
grant insert, update, delete on public.minecraft_publications to authenticated;
create policy minecraft_publications_public_read on public.minecraft_publications
  for select to anon, authenticated
  using (status = 'published' and (scheduled_at is null or scheduled_at <= now()));
create policy minecraft_publications_admin_read on public.minecraft_publications
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');
create policy minecraft_publications_admin_insert on public.minecraft_publications
  for insert to authenticated
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin'
    and created_by = (select auth.uid())
  );
create policy minecraft_publications_admin_update on public.minecraft_publications
  for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');
create policy minecraft_publications_admin_delete on public.minecraft_publications
  for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

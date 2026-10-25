create table if not exists public.launcher_releases (
    id uuid primary key default gen_random_uuid(),
    version text not null unique check (length(version) between 1 and 64),
    channel text not null default 'stable' check (channel in ('stable', 'beta')),
    title text not null check (length(title) between 1 and 160),
    summary text not null check (length(summary) between 1 and 2000),
    change_notes text[] not null default '{}',
    github_release_url text not null check (github_release_url ~ '^https://github\.com/[^/]+/[^/]+/releases/tag/[^/]+$'),
    status text not null default 'draft' check (status in ('draft', 'published')),
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    published_at timestamptz
);

create index if not exists launcher_releases_public_channel_idx
    on public.launcher_releases (channel, published_at desc)
    where status = 'published';

alter table public.launcher_releases enable row level security;
revoke all on public.launcher_releases from anon, authenticated;
grant select on public.launcher_releases to anon, authenticated;
grant insert, update, delete on public.launcher_releases to authenticated;

create policy launcher_releases_public_read on public.launcher_releases
    for select to anon, authenticated using (status = 'published');
create policy launcher_releases_admin_read on public.launcher_releases
    for select to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');
create policy launcher_releases_admin_insert on public.launcher_releases
    for insert to authenticated with check (
        (select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin'
        and created_by = (select auth.uid())
    );
create policy launcher_releases_admin_update on public.launcher_releases
    for update to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
    with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');
create policy launcher_releases_admin_delete on public.launcher_releases
    for delete to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

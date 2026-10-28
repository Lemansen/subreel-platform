drop policy if exists launcher_releases_read on public.launcher_releases;
drop policy if exists launcher_releases_public_read on public.launcher_releases;
drop policy if exists launcher_releases_admin_read on public.launcher_releases;
create policy launcher_releases_read on public.launcher_releases
    for select to anon, authenticated using (
        status = 'published'
        or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin'
    );

drop policy if exists launcher_releases_admin_insert on public.launcher_releases;
create policy launcher_releases_admin_insert on public.launcher_releases
    for insert to authenticated with check (
        ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin'
        and created_by = (select auth.uid())
    );

drop policy if exists launcher_releases_admin_update on public.launcher_releases;
create policy launcher_releases_admin_update on public.launcher_releases
    for update to authenticated
    using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin')
    with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');

drop policy if exists launcher_releases_admin_delete on public.launcher_releases;
create policy launcher_releases_admin_delete on public.launcher_releases
    for delete to authenticated
    using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');

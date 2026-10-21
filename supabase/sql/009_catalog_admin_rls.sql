-- Grant catalog writes only to accounts with a server-managed app_metadata role.
-- user_metadata is intentionally not used because users can edit it themselves.
revoke all privileges on table
 public.franchises, public.titles, public.title_relationships, public.genres, public.title_genres,
 public.title_seasons, public.title_episodes, public.title_editions, public.title_volumes,
 public.title_chapters, public.video_sources, public.reading_sources
from authenticated;

grant select, insert, update, delete on table
 public.franchises, public.titles, public.title_relationships, public.genres, public.title_genres,
 public.title_seasons, public.title_episodes, public.title_editions, public.title_volumes,
 public.title_chapters, public.video_sources, public.reading_sources
to authenticated;

create policy "Catalog admins can manage franchises"
on public.franchises for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage titles"
on public.titles for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage title relationships"
on public.title_relationships for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage genres"
on public.genres for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage title genres"
on public.title_genres for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage seasons"
on public.title_seasons for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage episodes"
on public.title_episodes for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage editions"
on public.title_editions for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage volumes"
on public.title_volumes for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage chapters"
on public.title_chapters for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage video sources"
on public.video_sources for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');

create policy "Catalog admins can manage reading sources"
on public.reading_sources for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'catalog_admin');


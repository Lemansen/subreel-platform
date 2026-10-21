-- Keep one SELECT policy per table/role, while retaining public reads and admin access.
drop policy "Public can read published franchises" on public.franchises;
create policy "Public can read published franchises" on public.franchises for select to anon, authenticated using (status = 'published' OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read published titles" on public.titles;
create policy "Public can read published titles" on public.titles for select to anon, authenticated using (status = 'published' OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read relationships between published titles" on public.title_relationships;
create policy "Public can read relationships between published titles" on public.title_relationships for select to anon, authenticated using (exists (select 1 from public.titles s join public.titles t on t.id = title_relationships.target_title_id where s.id = title_relationships.source_title_id and s.status='published' and t.status='published') OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read genres" on public.genres;
create policy "Public can read genres" on public.genres for select to anon, authenticated using (true);
drop policy "Public can read genres of published titles" on public.title_genres;
create policy "Public can read genres of published titles" on public.title_genres for select to anon, authenticated using (exists (select 1 from public.titles t where t.id=title_genres.title_id and t.status='published') OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read seasons of published titles" on public.title_seasons;
create policy "Public can read seasons of published titles" on public.title_seasons for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_seasons.title_id and t.status='published') OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read episodes of published titles" on public.title_episodes;
create policy "Public can read episodes of published titles" on public.title_episodes for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_episodes.title_id and t.status='published') and (season_id is null or exists (select 1 from public.title_seasons s where s.id=title_episodes.season_id and s.title_id=title_episodes.title_id and s.status='published')) OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read editions of published titles" on public.title_editions;
create policy "Public can read editions of published titles" on public.title_editions for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_editions.title_id and t.status='published') OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read volumes of published titles" on public.title_volumes;
create policy "Public can read volumes of published titles" on public.title_volumes for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_volumes.title_id and t.status='published') and (edition_id is null or exists (select 1 from public.title_editions e where e.id=title_volumes.edition_id and e.title_id=title_volumes.title_id and e.status='published')) OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read chapters of published titles" on public.title_chapters;
create policy "Public can read chapters of published titles" on public.title_chapters for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_chapters.title_id and t.status='published') and (edition_id is null or exists (select 1 from public.title_editions e where e.id=title_chapters.edition_id and e.title_id=title_chapters.title_id and e.status='published')) and (volume_id is null or exists (select 1 from public.title_volumes v where v.id=title_chapters.volume_id and v.title_id=title_chapters.title_id and v.edition_id=title_chapters.edition_id and v.status='published')) OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read approved available video sources" on public.video_sources;
create policy "Public can read approved available video sources" on public.video_sources for select to anon, authenticated using (publication_status='published' and rights_status='approved' and availability_status='available' and exists (select 1 from public.titles t where t.id=video_sources.title_id and t.status='published') and (episode_id is null or exists (select 1 from public.title_episodes e where e.id=video_sources.episode_id and e.title_id=video_sources.title_id and e.status='published')) OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');
drop policy "Public can read approved available reading sources" on public.reading_sources;
create policy "Public can read approved available reading sources" on public.reading_sources for select to anon, authenticated using (publication_status='published' and rights_status='approved' and availability_status='available' and exists (select 1 from public.titles t where t.id=reading_sources.title_id and t.status='published') and (chapter_id is null or exists (select 1 from public.title_chapters c where c.id=reading_sources.chapter_id and c.title_id=reading_sources.title_id and c.status='published')) OR ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');

do $$
declare item record;
begin
 for item in select * from (values
 ('franchises', 'Catalog admins can manage franchises'),
 ('titles', 'Catalog admins can manage titles'),
 ('title_relationships', 'Catalog admins can manage title relationships'),
 ('genres', 'Catalog admins can manage genres'),
 ('title_genres', 'Catalog admins can manage title genres'),
 ('title_seasons', 'Catalog admins can manage seasons'),
 ('title_episodes', 'Catalog admins can manage episodes'),
 ('title_editions', 'Catalog admins can manage editions'),
 ('title_volumes', 'Catalog admins can manage volumes'),
 ('title_chapters', 'Catalog admins can manage chapters'),
 ('video_sources', 'Catalog admins can manage video sources'),
 ('reading_sources', 'Catalog admins can manage reading sources')
 ) as policies(table_name, old_policy)
 loop
  execute format('drop policy %I on public.%I', item.old_policy, item.table_name);
  execute format('create policy %I on public.%I for insert to authenticated with check (((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''catalog_admin'')', 'Catalog admin insert', item.table_name);
  execute format('create policy %I on public.%I for update to authenticated using (((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''catalog_admin'') with check (((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''catalog_admin'')', 'Catalog admin update', item.table_name);
  execute format('create policy %I on public.%I for delete to authenticated using (((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''catalog_admin'')', 'Catalog admin delete', item.table_name);
 end loop;
end $$;


-- Hide child units when any optional parent is still unpublished.
drop policy "Public can read episodes of published titles" on public.title_episodes;
create policy "Public can read episodes of published titles"
on public.title_episodes for select to anon, authenticated
using (
 status='published'
 and exists (select 1 from public.titles t where t.id=title_episodes.title_id and t.status='published')
 and (season_id is null or exists (
   select 1 from public.title_seasons s
   where s.id=title_episodes.season_id and s.title_id=title_episodes.title_id and s.status='published'
 ))
);

drop policy "Public can read volumes of published titles" on public.title_volumes;
create policy "Public can read volumes of published titles"
on public.title_volumes for select to anon, authenticated
using (
 status='published'
 and exists (select 1 from public.titles t where t.id=title_volumes.title_id and t.status='published')
 and (edition_id is null or exists (
   select 1 from public.title_editions e
   where e.id=title_volumes.edition_id and e.title_id=title_volumes.title_id and e.status='published'
 ))
);

drop policy "Public can read chapters of published titles" on public.title_chapters;
create policy "Public can read chapters of published titles"
on public.title_chapters for select to anon, authenticated
using (
 status='published'
 and exists (select 1 from public.titles t where t.id=title_chapters.title_id and t.status='published')
 and (edition_id is null or exists (
   select 1 from public.title_editions e
   where e.id=title_chapters.edition_id and e.title_id=title_chapters.title_id and e.status='published'
 ))
 and (volume_id is null or exists (
   select 1 from public.title_volumes v
   where v.id=title_chapters.volume_id
     and v.title_id=title_chapters.title_id
     and v.edition_id=title_chapters.edition_id
     and v.status='published'
 ))
);


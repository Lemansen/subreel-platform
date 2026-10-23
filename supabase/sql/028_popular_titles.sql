-- Public "popular titles" ranking for the home page.
-- user_library is private (RLS: own rows only), so aggregate counts are exposed
-- only through this function. It returns published titles and no per-user data.
begin;

create or replace function public.popular_titles(limit_count integer default 12)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  cover_url text,
  content_type text,
  release_year integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.slug, t.description, t.cover_url, t.content_type, t.release_year
  from public.titles t
  where t.status = 'published'
  order by
    (select count(*) from public.user_library l where l.title_id = t.id)
      + (select count(*) from public.title_reviews r where r.title_id = t.id) desc,
    t.created_at desc
  limit least(greatest(coalesce(limit_count, 12), 1), 50);
$$;

revoke all on function public.popular_titles(integer) from public;
grant execute on function public.popular_titles(integer) to anon, authenticated;

commit;

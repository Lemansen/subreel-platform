-- Opt-in public reviews and ratings for published titles.
begin;

create table if not exists public.title_reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title_id uuid not null references public.titles(id) on delete cascade,
 rating smallint not null check (rating between 1 and 10),
 body text not null default '' check (char_length(body) <= 3000),
 is_public boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (user_id, title_id)
);

create index if not exists title_reviews_title_created_idx
 on public.title_reviews(title_id, created_at desc);
create index if not exists title_reviews_user_updated_idx
 on public.title_reviews(user_id, updated_at desc);

create trigger title_reviews_set_updated_at
 before update on public.title_reviews
 for each row execute function public.set_updated_at();

alter table public.title_reviews enable row level security;
revoke all privileges on table public.title_reviews from public, anon, authenticated;
grant select on table public.title_reviews to anon, authenticated;
grant insert, update, delete on table public.title_reviews to authenticated;
grant all privileges on table public.title_reviews to service_role;

drop policy if exists "Public can read opted-in reviews" on public.title_reviews;
create policy "Public can read opted-in reviews"
 on public.title_reviews for select to anon, authenticated
 using (
  is_public
  and exists (
   select 1 from public.profiles p
   where p.id = user_id and p.is_public and not p.is_suspended
  )
 );

drop policy if exists "Users can read own reviews" on public.title_reviews;
create policy "Users can read own reviews"
 on public.title_reviews for select to authenticated
 using ((select auth.uid()) = user_id);

drop policy if exists "Users can write own reviews for published titles" on public.title_reviews;
create policy "Users can write own reviews for published titles"
 on public.title_reviews for insert to authenticated
 with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.titles t where t.id = title_id and t.status = 'published')
 );

drop policy if exists "Users can update own reviews for published titles" on public.title_reviews;
create policy "Users can update own reviews for published titles"
 on public.title_reviews for update to authenticated
 using ((select auth.uid()) = user_id)
 with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.titles t where t.id = title_id and t.status = 'published')
 );

drop policy if exists "Users can delete own reviews" on public.title_reviews;
create policy "Users can delete own reviews"
 on public.title_reviews for delete to authenticated
 using ((select auth.uid()) = user_id);

create or replace function public.title_review_stats(target_title_id uuid)
returns table (average_rating numeric, review_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
 select coalesce(round(avg(r.rating)::numeric, 1), 0), count(*)
 from public.title_reviews r
 join public.profiles p on p.id = r.user_id
 join public.titles t on t.id = r.title_id
 where r.title_id = target_title_id
   and r.is_public
   and p.is_public
   and not p.is_suspended
   and t.status = 'published';
$$;

revoke all on function public.title_review_stats(uuid) from public;
grant execute on function public.title_review_stats(uuid) to anon, authenticated;

commit;

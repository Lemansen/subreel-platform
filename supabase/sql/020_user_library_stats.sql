-- Exact private counters for the currently authenticated user's library.
begin;

create or replace function public.user_library_stats()
returns table (
 library_count bigint,
 favorite_count bigint,
 planned_count bigint,
 in_progress_count bigint,
 completed_count bigint,
 on_hold_count bigint,
 dropped_count bigint,
 video_positions bigint,
 completed_video_positions bigint,
 reading_positions bigint,
 completed_reading_positions bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
 select
  (select count(*) from public.user_library l where l.user_id = (select auth.uid())),
  (select count(*) from public.user_library l where l.user_id = (select auth.uid()) and l.is_favorite),
  (select count(*) from public.user_library l where l.user_id = (select auth.uid()) and l.status = 'planned'),
  (select count(*) from public.user_library l where l.user_id = (select auth.uid()) and l.status = 'in_progress'),
  (select count(*) from public.user_library l where l.user_id = (select auth.uid()) and l.status = 'completed'),
  (select count(*) from public.user_library l where l.user_id = (select auth.uid()) and l.status = 'on_hold'),
  (select count(*) from public.user_library l where l.user_id = (select auth.uid()) and l.status = 'dropped'),
  (select count(*) from public.video_progress v where v.user_id = (select auth.uid()) and (v.position_seconds > 0 or v.completed_at is not null)),
  (select count(*) from public.video_progress v where v.user_id = (select auth.uid()) and v.completed_at is not null),
  (select count(*) from public.reading_progress r where r.user_id = (select auth.uid())),
  (select count(*) from public.reading_progress r where r.user_id = (select auth.uid()) and r.completed_at is not null)
 where (select auth.uid()) is not null;
$$;

revoke all on function public.user_library_stats() from public, anon;
grant execute on function public.user_library_stats() to authenticated;

commit;

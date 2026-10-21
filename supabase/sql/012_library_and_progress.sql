-- Private per-user library and resumable video/reading progress.

create table public.user_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'on_hold', 'dropped')),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create table public.video_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  episode_id uuid,
  unit_id uuid generated always as (coalesce(episode_id, title_id)) stored,
  position_seconds integer not null default 0 check (position_seconds >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (episode_id, title_id)
    references public.title_episodes(id, title_id) on delete cascade,
  primary key (user_id, title_id, unit_id)
);

create table public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  chapter_id uuid,
  unit_id uuid generated always as (coalesce(chapter_id, title_id)) stored,
  current_page integer not null default 1 check (current_page > 0),
  total_pages integer check (total_pages is null or total_pages > 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (chapter_id, title_id)
    references public.title_chapters(id, title_id) on delete cascade,
  primary key (user_id, title_id, unit_id)
);

create index user_library_recent_idx on public.user_library(user_id, updated_at desc);
create index user_library_status_idx on public.user_library(user_id, status, updated_at desc);
create index video_progress_recent_idx on public.video_progress(user_id, updated_at desc);
create index reading_progress_recent_idx on public.reading_progress(user_id, updated_at desc);

create trigger user_library_set_updated_at
  before update on public.user_library
  for each row execute function public.set_updated_at();
create trigger video_progress_set_updated_at
  before update on public.video_progress
  for each row execute function public.set_updated_at();
create trigger reading_progress_set_updated_at
  before update on public.reading_progress
  for each row execute function public.set_updated_at();

alter table public.user_library enable row level security;
alter table public.video_progress enable row level security;
alter table public.reading_progress enable row level security;

revoke all privileges on table public.user_library, public.video_progress, public.reading_progress
  from PUBLIC, anon, authenticated;
grant select, insert, update, delete on table public.user_library, public.video_progress, public.reading_progress
  to authenticated;
grant all privileges on table public.user_library, public.video_progress, public.reading_progress
  to service_role;

create policy "Users read own library"
  on public.user_library for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users add own library entries"
  on public.user_library for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update own library entries"
  on public.user_library for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete own library entries"
  on public.user_library for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read own video progress"
  on public.video_progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users save own video progress"
  on public.video_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update own video progress"
  on public.video_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete own video progress"
  on public.video_progress for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read own reading progress"
  on public.reading_progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users save own reading progress"
  on public.reading_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update own reading progress"
  on public.reading_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete own reading progress"
  on public.reading_progress for delete to authenticated
  using ((select auth.uid()) = user_id);

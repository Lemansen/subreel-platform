-- Index foreign-key lookups used when titles, episodes, or chapters are removed.
create index user_library_title_fk_idx
  on public.user_library(title_id);

create index video_progress_title_fk_idx
  on public.video_progress(title_id);
create index video_progress_episode_fk_idx
  on public.video_progress(episode_id, title_id)
  where episode_id is not null;

create index reading_progress_title_fk_idx
  on public.reading_progress(title_id);
create index reading_progress_chapter_fk_idx
  on public.reading_progress(chapter_id, title_id)
  where chapter_id is not null;

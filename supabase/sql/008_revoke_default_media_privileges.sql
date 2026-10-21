-- New tables inherit broad default privileges in this project.
-- Revoke them explicitly; RLS does not govern TRUNCATE/REFERENCES/TRIGGER.
revoke all privileges on table
 public.title_seasons, public.title_episodes, public.title_editions,
 public.title_volumes, public.title_chapters, public.video_sources, public.reading_sources
from anon, authenticated;

grant select on table
 public.title_seasons, public.title_episodes, public.title_editions,
 public.title_volumes, public.title_chapters, public.video_sources, public.reading_sources
to anon, authenticated;


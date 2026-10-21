-- Cover composite foreign keys for efficient parent updates/deletes.
create index title_episodes_season_fk_idx on public.title_episodes(season_id, title_id);
create index title_volumes_edition_fk_idx on public.title_volumes(edition_id, title_id);
create index title_chapters_edition_fk_idx on public.title_chapters(edition_id, title_id);
create index title_chapters_volume_fk_idx on public.title_chapters(volume_id, title_id, edition_id);
create index video_sources_episode_fk_idx on public.video_sources(episode_id, title_id);
create index reading_sources_chapter_fk_idx on public.reading_sources(chapter_id, title_id);


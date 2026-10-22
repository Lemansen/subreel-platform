-- Cover moderator foreign keys used for history, joins and account cleanup.
create index if not exists content_reports_moderator_id_idx on public.content_reports(moderator_id);
create index if not exists moderation_appeals_moderator_id_idx on public.moderation_appeals(moderator_id);
create index if not exists profiles_moderated_by_idx on public.profiles(moderated_by);

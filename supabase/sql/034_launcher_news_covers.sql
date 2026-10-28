alter table public.launcher_releases
    add column if not exists cover_url text,
    add column if not exists news_tag text not null default 'launcher';

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.launcher_releases'::regclass
          and conname = 'launcher_releases_news_tag_check'
    ) then
        alter table public.launcher_releases
            add constraint launcher_releases_news_tag_check
            check (news_tag in ('launcher', 'server', 'event'));
    end if;
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.launcher_releases'::regclass
          and conname = 'launcher_releases_cover_url_check'
    ) then
        alter table public.launcher_releases
            add constraint launcher_releases_cover_url_check
            check (cover_url is null or (length(cover_url) <= 2048 and cover_url ~ '^https://[^[:space:]]+$'));
    end if;
end $$;

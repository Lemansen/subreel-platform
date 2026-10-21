-- SubReel: fixes after the SQL/RLS audit (stage 4)
-- Additive migration: run after 001_catalog.sql and 002_profiles.sql.
-- CHECK constraints are added NOT VALID so they never fail on existing rows;
-- they apply to all new and updated rows immediately. After cleaning old data,
-- run the VALIDATE statements at the bottom.

-- 1. updated_at is maintained by the database, not by the client ------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists franchises_set_updated_at on public.franchises;
create trigger franchises_set_updated_at
    before update on public.franchises
    for each row execute function public.set_updated_at();

drop trigger if exists titles_set_updated_at on public.titles;
create trigger titles_set_updated_at
    before update on public.titles
    for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

-- 2. Profile is created together with the account ---------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id)
    values (new.id)
    on conflict (id) do nothing;
    return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Profiles for accounts that already exist.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- 3. Data-quality constraints ----------------------------------------------

alter table public.profiles
    drop constraint if exists profiles_avatar_url_format;
alter table public.profiles
    add constraint profiles_avatar_url_format check (
        avatar_url is null
        or (avatar_url ~* '^https?://[^[:space:]]+$'
            and char_length(avatar_url) <= 500)
    ) not valid;

alter table public.franchises
    drop constraint if exists franchises_slug_format;
alter table public.franchises
    add constraint franchises_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;

alter table public.titles
    drop constraint if exists titles_slug_format;
alter table public.titles
    add constraint titles_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;

alter table public.genres
    drop constraint if exists genres_slug_format;
alter table public.genres
    add constraint genres_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;

alter table public.franchises
    drop constraint if exists franchises_cover_url_format;
alter table public.franchises
    add constraint franchises_cover_url_format check (
        cover_url is null or cover_url ~* '^https?://[^[:space:]]+$'
    ) not valid;

alter table public.titles
    drop constraint if exists titles_image_urls_format;
alter table public.titles
    add constraint titles_image_urls_format check (
        (cover_url is null or cover_url ~* '^https?://[^[:space:]]+$')
        and (banner_url is null or banner_url ~* '^https?://[^[:space:]]+$')
    ) not valid;

-- 4. Index for the home page query (published, newest first) ----------------

create index if not exists titles_published_created_idx
    on public.titles (created_at desc)
    where status = 'published';

-- After checking that old rows are clean, run:
--   alter table public.profiles    validate constraint profiles_avatar_url_format;
--   alter table public.franchises  validate constraint franchises_slug_format;
--   alter table public.titles      validate constraint titles_slug_format;
--   alter table public.genres      validate constraint genres_slug_format;
--   alter table public.franchises  validate constraint franchises_cover_url_format;
--   alter table public.titles      validate constraint titles_image_urls_format;

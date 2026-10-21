-- SubReel: user profiles

create table if not exists public.profiles (
    id uuid primary key
        references auth.users(id) on delete cascade,

    username text,
    display_name text,
    avatar_url text,
    bio text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint profiles_username_format check (
        username is null
        or username ~ '^[a-zA-Z0-9_]{3,24}$'
    ),

    constraint profiles_display_name_length check (
        display_name is null
        or char_length(display_name) between 1 and 40
    ),

    constraint profiles_bio_length check (
        bio is null
        or char_length(bio) <= 300
    )
);

-- Nicknames are unique regardless of letter case.
create unique index if not exists profiles_username_lower_uidx
    on public.profiles (lower(username))
    where username is not null;

alter table public.profiles enable row level security;

-- Explicit privileges for the Supabase Data API.
revoke all on public.profiles from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, username, display_name, avatar_url, bio)
    on public.profiles to authenticated;
grant update (username, display_name, avatar_url, bio, updated_at)
    on public.profiles to authenticated;

grant all on public.profiles to service_role;

drop policy if exists "Public can read profiles"
    on public.profiles;
drop policy if exists "Users can read their own profile"
    on public.profiles;
create policy "Users can read their own profile"
    on public.profiles
    for select to authenticated
    using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile"
    on public.profiles;
create policy "Users can create their own profile"
    on public.profiles
    for insert to authenticated
    with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile"
    on public.profiles;
create policy "Users can update their own profile"
    on public.profiles
    for update to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

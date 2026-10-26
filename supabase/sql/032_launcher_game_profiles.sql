create table if not exists public.launcher_game_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    minecraft_uuid text not null,
    minecraft_username text not null,
    updated_at timestamptz not null default now(),
    constraint launcher_game_profiles_uuid_not_empty check (length(trim(minecraft_uuid)) > 0),
    constraint launcher_game_profiles_username_not_empty check (length(trim(minecraft_username)) > 0)
);

alter table public.launcher_game_profiles enable row level security;
revoke all on public.launcher_game_profiles from public, anon;
grant select, insert, update, delete on public.launcher_game_profiles to authenticated;

drop policy if exists "Users can read own launcher game profile" on public.launcher_game_profiles;
create policy "Users can read own launcher game profile"
    on public.launcher_game_profiles for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own launcher game profile" on public.launcher_game_profiles;
create policy "Users can insert own launcher game profile"
    on public.launcher_game_profiles for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own launcher game profile" on public.launcher_game_profiles;
create policy "Users can update own launcher game profile"
    on public.launcher_game_profiles for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own launcher game profile" on public.launcher_game_profiles;
create policy "Users can delete own launcher game profile"
    on public.launcher_game_profiles for delete to authenticated
    using ((select auth.uid()) = user_id);

-- Normalize legacy UUID values before the API starts storing canonical UUIDs.
-- Migration 033 already guarantees that equivalent normalized UUIDs are unique.
update public.launcher_game_profiles
set minecraft_uuid = lower(replace(trim(minecraft_uuid), '-', ''))
where minecraft_uuid is distinct from lower(replace(trim(minecraft_uuid), '-', ''));

-- Profile associations may only be changed by the trusted server API.
-- RLS does not protect against TRUNCATE, so revoke every table privilege and
-- explicitly restore only SELECT for authenticated users. The existing SELECT
-- policy continues to scope visible rows to auth.uid() = user_id.
revoke all on public.launcher_game_profiles from anon, authenticated;
grant select on public.launcher_game_profiles to authenticated;

drop policy if exists "Users can insert own launcher game profile"
    on public.launcher_game_profiles;
drop policy if exists "Users can update own launcher game profile"
    on public.launcher_game_profiles;
drop policy if exists "Users can delete own launcher game profile"
    on public.launcher_game_profiles;

-- The server API uses the server-only service-role client after validating
-- the signed-in SubReel user and verifying the Minecraft Java profile.

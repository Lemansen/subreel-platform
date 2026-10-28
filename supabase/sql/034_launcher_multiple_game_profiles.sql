-- Allow one SubReel ID to link multiple Minecraft Java profiles.
-- Keep Minecraft UUID globally unique so a profile cannot belong to two SubReel IDs.
-- Existing rows remain intact.
alter table public.launcher_game_profiles
    drop constraint if exists launcher_game_profiles_pkey;

alter table public.launcher_game_profiles
    add constraint launcher_game_profiles_pkey
    primary key (user_id, minecraft_uuid);

create index if not exists launcher_game_profiles_user_id_idx
    on public.launcher_game_profiles (user_id);

-- Migration 033 already creates the normalized global UUID unique index:
-- launcher_game_profiles_minecraft_uuid_unique.

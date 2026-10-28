-- A Minecraft Java profile must be linked to at most one SubReel ID.
-- Normalize case and optional UUID dashes so equivalent UUID representations collide.
create unique index if not exists launcher_game_profiles_minecraft_uuid_unique
    on public.launcher_game_profiles (
        lower(replace(trim(minecraft_uuid), '-', ''))
    );

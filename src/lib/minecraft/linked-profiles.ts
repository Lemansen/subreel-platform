import { createClient } from "@/lib/supabase/server";

export type LinkedMinecraftProfile = {
  minecraft_uuid: string;
  minecraft_username: string;
  updated_at: string | null;
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Reads every Minecraft Java profile linked to the authenticated SubReel ID.
 *
 * This helper deliberately does not create, link, or unlink profiles. Those
 * mutations must be performed by a trusted server endpoint after validating
 * the launcher session; a browser-supplied UUID or username is not proof of
 * Minecraft account ownership.
 */
export async function getLinkedMinecraftProfiles(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<{ profiles: LinkedMinecraftProfile[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("launcher_game_profiles")
    .select("minecraft_uuid, minecraft_username, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("minecraft_username", { ascending: true });

  if (error) {
    return { profiles: [], error: new Error(error.message) };
  }

  return {
    profiles: (data ?? []) as LinkedMinecraftProfile[],
    error: null,
  };
}

/**
 * Checks whether this SubReel ID has a particular Minecraft UUID linked.
 * UUID comparison is case-insensitive and tolerates optional hyphens to
 * match the database's normalized global-uniqueness rule.
 */
export async function isMinecraftProfileLinked(
  supabase: ServerSupabaseClient,
  userId: string,
  minecraftUuid: string,
): Promise<boolean> {
  const normalizedUuid = minecraftUuid.replace(/-/g, "").trim().toLowerCase();
  if (!normalizedUuid) return false;

  const { profiles, error } = await getLinkedMinecraftProfiles(supabase, userId);
  if (error) return false;

  return profiles.some(
    (profile) =>
      profile.minecraft_uuid.replace(/-/g, "").trim().toLowerCase() === normalizedUuid,
  );
}

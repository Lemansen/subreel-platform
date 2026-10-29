import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function normalizeUuid(value: string) {
  return value.replace(/-/g, "").toLowerCase();
}

function isUuid(value: string) {
  return /^[0-9a-f]{32}$/i.test(normalizeUuid(value));
}

async function getAuthenticatedUser(request: Request) {
  const supabase = await createClient();
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data, error } = bearer
    ? await supabase.auth.getUser(bearer)
    : await supabase.auth.getUser();
  return error || !data.user ? null : data.user;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return json({ error: "UNAUTHENTICATED" }, 401);

  const admin = createSupabaseAdminClient();
  if (!admin) return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);

  const { data, error } = await admin
    .from("launcher_game_profiles")
    .select("minecraft_uuid,minecraft_username,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[minecraft-profiles] Failed to list profiles:", error.code);
    return json({ error: "PROFILE_LIST_FAILED" }, 500);
  }

  return json({
    profiles: (data ?? []).map((profile) => ({
      minecraftUuid: profile.minecraft_uuid,
      minecraftUsername: profile.minecraft_username,
      linkedAt: profile.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return json({ error: "UNAUTHENTICATED" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "VALIDATION_ERROR" }, 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("minecraftAccessToken" in body) ||
    typeof body.minecraftAccessToken !== "string" ||
    body.minecraftAccessToken.length < 20 ||
    body.minecraftAccessToken.length > 8192
  ) {
    return json({ error: "VALIDATION_ERROR" }, 400);
  }

  const minecraftAccessToken = body.minecraftAccessToken;
  let verifiedProfile: { id?: unknown; name?: unknown };

  try {
    const response = await fetch("https://api.minecraftservices.com/minecraft/profile", {
      headers: { Authorization: `Bearer ${minecraftAccessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 401 || response.status === 403) {
      return json({ error: "MINECRAFT_PROFILE_UNVERIFIED" }, 403);
    }
    if (!response.ok) {
      return json({ error: "MINECRAFT_VERIFICATION_UNAVAILABLE" }, 502);
    }

    verifiedProfile = await response.json();
  } catch {
    return json({ error: "MINECRAFT_VERIFICATION_UNAVAILABLE" }, 502);
  }

  if (
    typeof verifiedProfile.id !== "string" ||
    !isUuid(verifiedProfile.id) ||
    typeof verifiedProfile.name !== "string" ||
    !/^[A-Za-z0-9_]{1,16}$/.test(verifiedProfile.name)
  ) {
    return json({ error: "MINECRAFT_PROFILE_UNVERIFIED" }, 403);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);

  const minecraftUuid = normalizeUuid(verifiedProfile.id);
  const { error } = await admin.from("launcher_game_profiles").insert({
    user_id: user.id,
    minecraft_uuid: minecraftUuid,
    minecraft_username: verifiedProfile.name,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      // Do not disclose whether this UUID is linked to this or another SubReel ID.
      return json({ error: "MINECRAFT_PROFILE_ALREADY_LINKED" }, 409);
    }
    console.error("[minecraft-profiles] Failed to link profile:", error.code);
    return json({ error: "PROFILE_LINK_FAILED" }, 500);
  }

  return json({
    profile: {
      minecraftUuid,
      minecraftUsername: verifiedProfile.name,
      linkedAt: new Date().toISOString(),
    },
  }, 201);
}

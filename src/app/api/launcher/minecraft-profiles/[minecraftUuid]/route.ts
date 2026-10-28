import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function normalizeUuid(value: string) {
  return value.replace(/-/g, "").toLowerCase();
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ minecraftUuid: string }> },
) {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) return json({ error: "UNAUTHENTICATED" }, 401);

  const { minecraftUuid: rawUuid } = await context.params;
  const minecraftUuid = normalizeUuid(rawUuid);
  if (!/^[0-9a-f]{32}$/.test(minecraftUuid)) {
    return json({ error: "VALIDATION_ERROR" }, 400);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);

  const { data: removed, error } = await admin
    .from("launcher_game_profiles")
    .delete()
    .eq("user_id", data.user.id)
    .eq("minecraft_uuid", minecraftUuid)
    .select("minecraft_uuid")
    .maybeSingle();

  if (error) {
    console.error("[minecraft-profiles] Failed to unlink profile:", error.code);
    return json({ error: "PROFILE_UNLINK_FAILED" }, 500);
  }
  if (!removed) return json({ error: "MINECRAFT_PROFILE_NOT_LINKED" }, 404);

  return json({ success: true, minecraftUuid });
}

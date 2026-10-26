import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isState, NO_STORE_HEADERS, safeEqualHex, sha256Hex } from "@/lib/launcher-auth-handoff";

function invalid() {
  return Response.json({ valid: false }, { status: 404, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestId = url.searchParams.get("request_id") ?? "";
  const state = url.searchParams.get("state");
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !isState(state)) return invalid();

  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "Сервис входа временно недоступен." }, { status: 503, headers: NO_STORE_HEADERS });

  const { data: authRequest, error } = await admin.from("launcher_auth_requests")
    .select("state_hash,expires_at,approved_at")
    .eq("id", requestId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !authRequest || !safeEqualHex(authRequest.state_hash, sha256Hex(state))) return invalid();

  let email: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  } catch {
    // Treat missing or unavailable site auth as signed out; approval still revalidates it.
  }

  return Response.json({ valid: true, status: authRequest.approved_at ? "used" : "pending", signed_in: Boolean(email), email }, { headers: NO_STORE_HEADERS });
}

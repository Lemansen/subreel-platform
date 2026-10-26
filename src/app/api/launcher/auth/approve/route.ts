import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createOpaqueToken,
  encryptSession,
  isSameOriginPost,
  isState,
  NO_STORE_HEADERS,
  readSmallJson,
  RequestValidationError,
  safeEqualHex,
  sha256Hex,
} from "@/lib/launcher-auth-handoff";

export const runtime = "nodejs";

function failure(status: number, error: string) {
  return Response.json({ error }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return failure(403, "Запрос подтверждения отклонён.");

  let body: Record<string, unknown>;
  try {
    body = await readSmallJson(request);
  } catch (error) {
    return failure(error instanceof RequestValidationError && error.message === "request-too-large" ? 413 : 400, "Некорректный запрос подтверждения.");
  }

  const requestId = body.request_id;
  const state = body.state;
  if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId) || !isState(state))
    return failure(400, "Запрос входа истёк или повреждён.");

  const supabase = await createClient();
  // Resolve the user first so any refreshed cookies are written before reading the session.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const user = userData.user;
  const session = sessionData.session;
  if (userError || sessionError || !user || !session || session.user.id !== user.id || !session.access_token || !session.refresh_token)
    return failure(401, "Войди в аккаунт SubReel, чтобы подтвердить запрос.");

  const admin = createSupabaseAdminClient();
  if (!admin) return failure(503, "Сервис входа временно недоступен.");

  const { data: pending, error: pendingError } = await admin.from("launcher_auth_requests")
    .select("state_hash,redirect_uri,code_challenge")
    .eq("id", requestId)
    .is("approved_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (pendingError || !pending || !safeEqualHex(pending.state_hash, sha256Hex(state)))
    return failure(410, "Запрос входа истёк или уже использован. Начни вход в лаунчере заново.");

  const code = createOpaqueToken();
  let encryptedSession: string;
  try {
    encryptedSession = encryptSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: Math.min(86400, Math.max(60, Number.isFinite(session.expires_in) ? session.expires_in : 3600)),
      user: { id: user.id, email: user.email ?? null },
    });
  } catch (error) {
    console.error("[launcher-auth/approve] Session encryption is not configured:", error);
    return failure(503, "Сервис входа временно не настроен.");
  }

  const { data: approved, error: approvalError } = await admin.from("launcher_auth_requests")
    .update({ user_id: user.id, code_hash: sha256Hex(code), encrypted_session: encryptedSession, approved_at: new Date().toISOString() })
    .eq("id", requestId)
    .is("approved_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (approvalError || !approved) return failure(410, "Запрос входа истёк или уже использован. Начни вход в лаунчере заново.");

  const callbackUrl = new URL(pending.redirect_uri);
  callbackUrl.searchParams.set("code", code);
  callbackUrl.searchParams.set("state", state);
  return Response.json({ callback_url: callbackUrl.toString() }, { headers: NO_STORE_HEADERS });
}

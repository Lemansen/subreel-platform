import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  decryptSession,
  isCodeVerifier,
  NO_STORE_HEADERS,
  pkceChallenge,
  readSmallJson,
  RequestValidationError,
  sha256Hex,
} from "@/lib/launcher-auth-handoff";

export const runtime = "nodejs";

function failure(status: number, error: string) {
  return Response.json({ error }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await readSmallJson(request);
  } catch (error) {
    return failure(error instanceof RequestValidationError && error.message === "request-too-large" ? 413 : 400, "Некорректный запрос обмена кода.");
  }

  const requestId = body.request_id;
  const code = body.code;
  const verifier = body.code_verifier;
  if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId) ||
      typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code) || !isCodeVerifier(verifier))
    return failure(400, "Неверный или истёкший код входа.");

  const admin = createSupabaseAdminClient();
  if (!admin) return failure(503, "Сервис входа временно недоступен.");

  const { data, error } = await admin.rpc("consume_launcher_auth_request", {
    p_id: requestId,
    p_code_hash: sha256Hex(code),
    p_code_challenge: pkceChallenge(verifier),
  });
  const consumed = Array.isArray(data) ? data[0] : null;
  if (error || !consumed || typeof consumed.encrypted_session !== "string")
    return failure(400, "Код входа истёк, уже использован или не прошёл проверку PKCE.");

  try {
    const session = decryptSession(consumed.encrypted_session) as Record<string, unknown>;
    if (typeof session.access_token !== "string" || typeof session.refresh_token !== "string" ||
        typeof session.expires_in !== "number" || !session.user || typeof session.user !== "object")
      return failure(500, "Не удалось восстановить сессию SubReel.");
    return Response.json(session, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[launcher-auth/exchange] Encrypted session could not be opened:", error);
    return failure(500, "Не удалось восстановить сессию SubReel.");
  }
}

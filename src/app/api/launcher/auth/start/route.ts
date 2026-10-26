import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getClientAddress,
  hashIpAddress,
  isCodeChallenge,
  isLoopbackCallback,
  isState,
  NO_STORE_HEADERS,
  readSmallJson,
  RequestValidationError,
  sha256Hex,
} from "@/lib/launcher-auth-handoff";

function failure(status: number, error: string) {
  return Response.json({ error }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await readSmallJson(request);
  } catch (error) {
    return failure(error instanceof RequestValidationError && error.message === "request-too-large" ? 413 : 400, "Некорректный запрос входа.");
  }

  const { state, code_challenge: challenge, redirect_uri: redirectUri } = body;
  if (!isState(state) || !isCodeChallenge(challenge) || !isLoopbackCallback(redirectUri))
    return failure(400, "Неверные параметры браузерного входа.");

  const admin = createSupabaseAdminClient();
  if (!admin) return failure(503, "Серверный сервис входа временно недоступен.");

  try {
    const requestId = randomUUID();
    const { data, error } = await admin.rpc("create_launcher_auth_request", {
      p_id: requestId,
      p_state_hash: sha256Hex(state),
      p_code_challenge: challenge,
      p_redirect_uri: redirectUri,
      p_ip_hash: hashIpAddress(getClientAddress(request)),
    });
    if (error) {
      console.error("[launcher-auth/start] Request creation failed:", error.message);
      return failure(503, "Не удалось начать вход в лаунчер.");
    }
    if (data !== requestId) return failure(429, "Слишком много попыток. Подожди минуту и попробуй снова.");

    const authorizationUrl = new URL("/launcher/authorize", new URL(request.url).origin);
    authorizationUrl.searchParams.set("request_id", requestId);
    authorizationUrl.searchParams.set("state", state);
    return Response.json({ authorization_url: authorizationUrl.toString() }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[launcher-auth/start] Unexpected error:", error);
    return failure(503, "Не удалось начать вход в лаунчер.");
  }
}

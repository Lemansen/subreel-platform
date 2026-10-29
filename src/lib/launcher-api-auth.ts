import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";

type AuthenticatedUserResult = { userId: string } | { response: Response };

/** Accepts the launcher's bearer token or the signed-in website's Supabase cookie session. */
export async function getLauncherApiUser(request: Request, unauthenticatedMessage: string): Promise<AuthenticatedUserResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { response: jsonError(503, "На сервере SubReel не настроена проверка сессии.") };

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  try {
    const result = token
      ? await createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token)
      : await (await createCookieClient()).auth.getUser();

    if (result.error) {
      const status = (result.error as { status?: number }).status;
      if (result.error.name === "AuthSessionMissingError" || status === 401 || status === 403)
        return { response: jsonError(401, unauthenticatedMessage) };
      return { response: jsonError(503, "Не удалось проверить сессию SubReel. Повторите попытку позже.") };
    }

    if (!result.data.user) return { response: jsonError(401, unauthenticatedMessage) };
    return { userId: result.data.user.id };
  } catch {
    return { response: jsonError(503, "Не удалось проверить сессию SubReel. Повторите попытку позже.") };
  }
}

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

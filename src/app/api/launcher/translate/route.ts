import { getLauncherApiUser } from "@/lib/launcher-api-auth";

export const maxDuration = 30;

const requestsByUser = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_BODY_CHARS = 30_000;

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function getUserId(request: Request): Promise<string | Response> {
  const authenticated = await getLauncherApiUser(request, "Войдите в аккаунт SubReel, чтобы переводить описания.");
  if ("response" in authenticated) return authenticated.response;

  const now = Date.now();
  const entry = requestsByUser.get(authenticated.userId);
  if (!entry || now - entry.startedAt >= WINDOW_MS) requestsByUser.set(authenticated.userId, { startedAt: now, count: 1 });
  else if (++entry.count > MAX_REQUESTS_PER_WINDOW) return jsonError(429, "Слишком много запросов на перевод. Подождите минуту.");
  if (requestsByUser.size > 10_000) {
    for (const [userId, limit] of requestsByUser) if (now - limit.startedAt >= WINDOW_MS) requestsByUser.delete(userId);
  }
  return authenticated.userId;
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (userId instanceof Response) return userId;

  const key = process.env.DEEPL_AUTH_KEY?.trim();
  if (!key) return jsonError(503, "Перевод временно не настроен на сервере SubReel.");

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 64_000) return jsonError(413, "Слишком большой запрос перевода.");
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > 64_000) return jsonError(413, "Слишком большой запрос перевода.");
    const body = JSON.parse(bodyText) as { text?: unknown; target_lang?: unknown };
    if (!Array.isArray(body.text) || body.text.length < 1 || body.text.length > 50 ||
        !body.text.every((value) => typeof value === "string" && value.length <= 5_000))
      return jsonError(400, "Передайте от 1 до 50 текстов длиной не более 5000 символов каждый.");
    const totalChars = (body.text as string[]).reduce((sum, value) => sum + value.length, 0);
    if (totalChars > MAX_BODY_CHARS) return jsonError(413, "Суммарный объём текста превышает 30 000 символов.");
    const targetLanguage = body.target_lang;
    if (targetLanguage !== "RU" && targetLanguage !== "EN-US") return jsonError(400, "Поддерживаются только RU и EN-US.");

    let deeplUrl: URL;
    try {
      deeplUrl = new URL(process.env.DEEPL_API_URL?.trim() || "https://api-free.deepl.com");
    } catch {
      return jsonError(503, "На сервере SubReel указан некорректный адрес DeepL.");
    }
    if (deeplUrl.protocol !== "https:" || !["api-free.deepl.com", "api.deepl.com"].includes(deeplUrl.hostname))
      return jsonError(503, "Адрес DeepL на сервере SubReel не прошёл проверку безопасности.");
    const upstream = await fetch(new URL("/v2/translate", deeplUrl), {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ text: body.text, target_lang: targetLanguage }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      if (upstream.status === 429 || upstream.status === 456)
        return jsonError(503, "Сервис перевода временно исчерпал лимит. Попробуйте позже.");
      return jsonError(502, "Сервис перевода временно недоступен.");
    }

    const payload = await upstream.json() as { translations?: Array<{ text?: unknown }> };
    const translated = payload.translations?.map((item) => typeof item.text === "string" ? item.text : "");
    if (!translated || translated.length !== body.text.length || translated.some((item) => !item))
      return jsonError(502, "Сервис перевода вернул неполный ответ.");
    return Response.json({ translations: translated }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return jsonError(502, "Не удалось выполнить перевод. Попробуйте позже.");
  }
}

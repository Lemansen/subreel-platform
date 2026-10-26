import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export const maxDuration = 60;

const apiBase = "https://api.curseforge.com/v1";
const downloadHostSuffix = ".forgecdn.net";
const requestsByUser = new Map<string, { startedAt: number; count: number }>();
const verifiedTokens = new Map<string, { userId: string; expiresAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 600;

type Action = "search" | "versions" | "batch-files" | "download";

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(request: Request): Promise<{ userId: string } | Response> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonError(401, "Войдите в аккаунт SubReel, чтобы открыть CurseForge.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return jsonError(503, "На сервере SubReel не настроены NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");

  const now = Date.now();
  const fingerprint = createHash("sha256").update(token).digest("hex");
  const cached = verifiedTokens.get(fingerprint);
  let userId = cached && cached.expiresAt > now ? cached.userId : "";
  if (!userId) {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return jsonError(401, "Сессия SubReel истекла. Войдите снова.");
    userId = data.user.id;
    let tokenExpiresAt = now + 120_000;
    try {
      const payload = token.split(".")[1];
      if (!payload) throw new Error("Missing token payload");
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
      if (typeof claims.exp === "number") tokenExpiresAt = Math.min(tokenExpiresAt, claims.exp * 1000);
    } catch { /* The verified token may use a non-JWT opaque format; keep the short cache window. */ }
    verifiedTokens.set(fingerprint, { userId, expiresAt: tokenExpiresAt });
  }
  const entry = requestsByUser.get(userId);
  if (!entry || now - entry.startedAt >= WINDOW_MS) requestsByUser.set(userId, { startedAt: now, count: 1 });
  else if (++entry.count > MAX_REQUESTS_PER_WINDOW) return jsonError(429, "Слишком много запросов CurseForge. Подождите минуту.");
  if (requestsByUser.size > 10_000 || verifiedTokens.size > 10_000) {
    for (const [id, limit] of requestsByUser) if (now - limit.startedAt >= WINDOW_MS) requestsByUser.delete(id);
    for (const [hash, tokenEntry] of verifiedTokens) if (tokenEntry.expiresAt <= now) verifiedTokens.delete(hash);
  }
  return { userId };
}

function curseForgeKey(): string | Response {
  const key = process.env.CURSEFORGE_API_KEY?.trim();
  return key || jsonError(503, "Каталог CurseForge ещё не настроен на сервере SubReel.");
}

async function curseForgeJson(path: string, key: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: { Accept: "application/json", "x-api-key": key, ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
}

function safeInteger(value: string | null, min = 1, max = 2_147_483_647): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  const key = curseForgeKey();
  if (key instanceof Response) return key;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") as Action | null;

  try {
    if (action === "search") {
      const pageSize = safeInteger(url.searchParams.get("limit"), 1, 50) ?? 20;
      const index = safeInteger(url.searchParams.get("offset"), 0, 10_000 - pageSize) ?? 0;
      const params = new URLSearchParams({ gameId: "432", classId: "4471", pageSize: String(pageSize), index: String(index), sortField: "2", sortOrder: "desc" });
      const query = (url.searchParams.get("query") ?? "").trim().slice(0, 100);
      const version = (url.searchParams.get("gameVersion") ?? "").trim().slice(0, 32);
      const loader = url.searchParams.get("loader")?.toLowerCase();
      const loaderType = loader === "forge" ? "1" : loader === "fabric" ? "4" : loader === "quilt" ? "5" : loader === "neoforge" ? "6" : null;
      if (query) params.set("searchFilter", query);
      if (version) params.set("gameVersion", version);
      if (loaderType) params.set("modLoaderType", loaderType);
      const upstream = await curseForgeJson(`/mods/search?${params}`, key);
      return Response.json(await upstream.json(), { status: upstream.status, headers: { "Cache-Control": "private, no-store" } });
    }

    if (action === "versions") {
      const projectId = safeInteger(url.searchParams.get("projectId"));
      if (!projectId) return jsonError(400, "Некорректный идентификатор проекта.");
      const pageSize = safeInteger(url.searchParams.get("limit"), 1, 50) ?? 50;
      const index = safeInteger(url.searchParams.get("offset"), 0, 10_000 - pageSize) ?? 0;
      const upstream = await curseForgeJson(`/mods/${projectId}/files?pageSize=${pageSize}&index=${index}`, key);
      return Response.json(await upstream.json(), { status: upstream.status, headers: { "Cache-Control": "private, no-store" } });
    }

    if (action === "download") {
      const projectId = safeInteger(url.searchParams.get("projectId"));
      const fileId = safeInteger(url.searchParams.get("fileId"));
      if (!projectId || !fileId) return jsonError(400, "Некорректный идентификатор файла.");
      const urlResponse = await curseForgeJson(`/mods/${projectId}/files/${fileId}/download-url`, key);
      if (!urlResponse.ok) return jsonError(urlResponse.status, "CurseForge не предоставил ссылку на этот файл.");
      const payload = (await urlResponse.json()) as { data?: unknown };
      if (typeof payload.data !== "string") return jsonError(404, "Файл недоступен для загрузки через CurseForge API.");
      const fileUrl = new URL(payload.data);
      if (fileUrl.protocol !== "https:" || !fileUrl.hostname.endsWith(downloadHostSuffix)) return jsonError(502, "CurseForge вернул неожиданный адрес файла.");
      let fileResponse = await fetch(fileUrl, {
        headers: { "x-api-key": key },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(50_000),
      });
      for (let redirectCount = 0; [301, 302, 303, 307, 308].includes(fileResponse.status) && redirectCount < 4; redirectCount++) {
        const location = fileResponse.headers.get("location");
        if (!location) break;
        const redirectedUrl = new URL(location, fileUrl);
        if (redirectedUrl.protocol !== "https:" || !redirectedUrl.hostname.endsWith(downloadHostSuffix)) {
          await fileResponse.body?.cancel();
          return jsonError(502, "CDN CurseForge вернул небезопасный адрес перенаправления.");
        }
        await fileResponse.body?.cancel();
        fileResponse = await fetch(redirectedUrl, {
          headers: { "x-api-key": key }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(50_000),
        });
      }
      if (!fileResponse.ok || !fileResponse.body) return jsonError(fileResponse.status || 502, "Не удалось получить файл с CDN CurseForge.");
      return new Response(fileResponse.body, {
        status: 200,
        headers: {
          "Content-Type": fileResponse.headers.get("content-type") ?? "application/octet-stream",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": "attachment",
        },
      });
    }

    return jsonError(400, "Неизвестное действие CurseForge.");
  } catch {
    return jsonError(502, "CurseForge временно недоступен.");
  }
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  const key = curseForgeKey();
  if (key instanceof Response) return key;
  const url = new URL(request.url);
  if (url.searchParams.get("action") !== "batch-files") return jsonError(400, "Неизвестное действие CurseForge.");

  try {
    const body = (await request.json()) as { fileIds?: unknown };
    if (!Array.isArray(body.fileIds) || body.fileIds.length < 1 || body.fileIds.length > 50 ||
        !body.fileIds.every((id) => Number.isSafeInteger(id) && id > 0))
      return jsonError(400, "Нужен список из 1–50 корректных file ID.");
    const upstream = await curseForgeJson("/mods/files", key, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: body.fileIds }),
    });
    return Response.json(await upstream.json(), { status: upstream.status, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return jsonError(502, "Не удалось запросить файлы CurseForge.");
  }
}

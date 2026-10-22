"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const providers = ["anilist", "tmdb", "openlibrary", "custom"] as const;
const contentTypes = ["anime", "movie", "series", "drama", "cartoon", "manga", "manhwa", "manhua", "light_novel", "web_novel", "book"] as const;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxBytes = 1_000_000;
const maxItems = 100;

type Provider = typeof providers[number];
type ImportItem = {
  name: string; original_name?: string; slug: string; content_type: typeof contentTypes[number];
  release_year?: number; description?: string; cover_url?: string; banner_url?: string;
  external?: { provider: Provider; id: string; url?: string };
};
type CheckedItem = { row: number; value: ImportItem | null; error: string | null };

async function requireCatalogAdmin() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin%2Fimport");
  if (user.app_metadata?.role !== "catalog_admin") notFound();
  return { db, user };
}

function httpsUrl(value: unknown) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string" || value.length > 2048) return false;
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}

function allowedSourceHost(provider: Provider, hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (provider === "anilist") return host === "anilist.co" || host === "www.anilist.co";
  if (provider === "tmdb") return host === "themoviedb.org" || host === "www.themoviedb.org";
  if (provider === "openlibrary") return host === "openlibrary.org" || host === "www.openlibrary.org";
  return (process.env.CATALOG_IMPORT_ALLOWED_CUSTOM_SOURCE_HOSTS ?? "").split(",").map((value) => value.trim().toLowerCase().replace(/\.$/, "")).filter(Boolean).includes(host);
}

function allowedMediaHost(provider: Provider, hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (provider === "anilist") return host === "anilist.co" || /^s\d+\.anilist\.co$/.test(host);
  if (provider === "tmdb") return host === "image.tmdb.org";
  if (provider === "openlibrary") return host === "covers.openlibrary.org";
  return (process.env.CATALOG_IMPORT_ALLOWED_CUSTOM_MEDIA_HOSTS ?? "").split(",").map((value) => value.trim().toLowerCase().replace(/\.$/, "")).filter(Boolean).includes(host);
}

function hasAllowedHost(provider: Provider, value: string | undefined, allowedHost: (provider: Provider, hostname: string) => boolean) {
  if (!value) return true;
  try { return allowedHost(provider, new URL(value).hostname); }
  catch { return false; }
}

function parsePackage(raw: string): { items: CheckedItem[]; error: string | null } {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > maxBytes) return { items: [], error: "Файл превышает ограничение 1 МБ." };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { items: [], error: "Файл не является корректным JSON." }; }
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { titles?: unknown }).titles)) return { items: [], error: "Ожидается объект с массивом titles." };
  const values = (parsed as { titles: unknown[] }).titles;
  if (!values.length || values.length > maxItems) return { items: [], error: `В пакете должно быть от 1 до ${maxItems} тайтлов.` };
  const items = values.map((rawItem, index): CheckedItem => {
    const fail = (error: string): CheckedItem => ({ row: index + 1, value: null, error });
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return fail("Запись должна быть объектом.");
    const item = rawItem as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const slug = typeof item.slug === "string" ? item.slug.trim().toLowerCase() : "";
    const content_type = item.content_type;
    if (!name || name.length > 160 || !slugPattern.test(slug) || slug.length > 160 || !contentTypes.includes(content_type as typeof contentTypes[number])) return fail("Проверь name (1–160), slug и content_type.");
    const optionalText = ["original_name", "description", "cover_url", "banner_url"] as const;
    if (optionalText.some((key) => item[key] !== undefined && item[key] !== null && typeof item[key] !== "string")) return fail("Текстовые поля должны быть строками.");
    const original_name = typeof item.original_name === "string" ? item.original_name.trim().slice(0, 200) : undefined;
    const description = typeof item.description === "string" ? item.description.trim().slice(0, 5000) : undefined;
    const cover_url = typeof item.cover_url === "string" ? item.cover_url.trim() : undefined;
    const banner_url = typeof item.banner_url === "string" ? item.banner_url.trim() : undefined;
    if (!httpsUrl(cover_url) || !httpsUrl(banner_url)) return fail("Ссылки изображений должны использовать HTTPS.");
    let release_year: number | undefined;
    if (item.release_year !== undefined && item.release_year !== null && item.release_year !== "") {
      if (!Number.isInteger(item.release_year) || (item.release_year as number) < 1800 || (item.release_year as number) > 2200) return fail("release_year должен быть от 1800 до 2200.");
      release_year = item.release_year as number;
    }
    let external: ImportItem["external"];
    if (item.external !== undefined && item.external !== null) {
      if (!item.external || typeof item.external !== "object" || Array.isArray(item.external)) return fail("external должен содержать provider и id.");
      const ext = item.external as Record<string, unknown>;
      if (!providers.includes(ext.provider as Provider) || typeof ext.id !== "string" || !ext.id.trim() || ext.id.trim().length > 120 || typeof ext.url !== "string" || !ext.url.trim() || !httpsUrl(ext.url)) return fail("Проверь external.provider, external.id и HTTPS external.url.");
      const provider = ext.provider as Provider;
      if (typeof ext.url !== "string" || !allowedSourceHost(provider, new URL(ext.url).hostname)) return fail(`Источник ${provider} не входит в разрешённый список доменов.`);
      if (!hasAllowedHost(provider, cover_url, allowedMediaHost) || !hasAllowedHost(provider, banner_url, allowedMediaHost)) return fail(`Изображения для источника ${provider} должны загружаться с разрешённого домена.`);
      external = { provider, id: ext.id.trim(), url: ext.url.trim() };
    }
    return { row: index + 1, value: { name, slug, content_type: content_type as ImportItem["content_type"], ...(original_name ? { original_name } : {}), ...(description ? { description } : {}), ...(cover_url ? { cover_url } : {}), ...(banner_url ? { banner_url } : {}), ...(release_year ? { release_year } : {}), ...(external ? { external } : {}) }, error: null };
  });
  return { items, error: null };
}

export type ImportDuplicateMatch = { id: string; name: string; original_name: string | null; slug: string; content_type: string; status: string };
export type ImportPreviewRow = { row: number; name: string; slug: string; outcome: "create" | "enrich" | "skip" | "error"; detail: string; possibleDuplicates?: ImportDuplicateMatch[] };
export type ImportPreview = { ok: boolean; error?: string; rows: ImportPreviewRow[]; counts: { create: number; enrich: number; skip: number; error: number; duplicates: number } };

function normalizeDuplicateText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function duplicateTokens(value: string) {
  const words = normalizeDuplicateText(value).split(" ").filter((word) => word.length >= 4);
  if (words.length === 1 && words[0].length > 5) {
    const word = words[0];
    return [...new Set([word.slice(0, 4), word.slice(Math.floor((word.length - 4) / 2), Math.floor((word.length - 4) / 2) + 4), word.slice(-4)])];
  }
  return words;
}

function duplicateSimilarity(left: string, right: string) {
  const a = normalizeDuplicateText(left);
  const b = normalizeDuplicateText(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const leftTokens = new Set(duplicateTokens(a));
  const rightTokens = new Set(duplicateTokens(b));
  const union = new Set([...leftTokens, ...rightTokens]);
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const tokenScore = union.size ? intersection / union.size : 0;
  if (tokenScore >= 0.8) return true;
  const bigrams = (text: string) => new Set(Array.from({ length: Math.max(0, text.length - 1) }, (_, index) => text.slice(index, index + 2)));
  const leftBigrams = bigrams(a);
  const rightBigrams = bigrams(b);
  if (!leftBigrams.size || !rightBigrams.size) return false;
  const common = [...leftBigrams].filter((gram) => rightBigrams.has(gram)).length;
  return (2 * common) / (leftBigrams.size + rightBigrams.size) >= 0.76;
}

async function findPotentialDuplicates(db: Awaited<ReturnType<typeof createClient>>, rows: ImportPreviewRow[], checked: CheckedItem[]) {
  const createRows = rows.filter((row) => row.outcome === "create");
  const candidates = createRows.flatMap((row) => {
    const item = checked[row.row - 1]?.value;
    return item ? [item] : [];
  });
  const terms = [...new Set(candidates.flatMap((item) => [item.name, item.original_name ?? ""].flatMap(duplicateTokens).slice(0, 3)))].slice(0, 120);
  if (!terms.length) return { rows, error: null as string | null };
  const byId = new Map<string, ImportDuplicateMatch>();
  try {
    for (let index = 0; index < terms.length; index += 10) {
      const filters = terms.slice(index, index + 10).flatMap((term) => [`name.ilike.%${term}%`, `original_name.ilike.%${term}%`]);
      const { data, error } = await db.from("titles").select("id,name,original_name,slug,content_type,status").or(filters.join(",")).limit(500);
      if (error) return { rows, error: "Не удалось проверить похожие названия. Импорт заблокирован до успешной проверки." };
      for (const title of data ?? []) byId.set(title.id, { id: title.id, name: title.name, original_name: title.original_name, slug: title.slug, content_type: title.content_type, status: title.status });
    }
    const titles = [...byId.values()];
    const updatedRows = rows.map((row) => {
      if (row.outcome !== "create") return row;
      const item = checked[row.row - 1]?.value;
      if (!item) return row;
      const matches = titles.filter((title) => duplicateSimilarity(item.name, title.name)
        || Boolean(item.original_name && (duplicateSimilarity(item.original_name, title.name) || (title.original_name && duplicateSimilarity(item.name, title.original_name)))))
        .slice(0, 3);
      return matches.length ? { ...row, possibleDuplicates: matches } : row;
    });
    return { rows: updatedRows, error: null as string | null };
  } catch {
    return { rows, error: "Проверка похожих названий завершилась ошибкой. Импорт заблокирован до успешной проверки." };
  }
}

export type AniListCandidate = {
  name: string;
  original_name?: string;
  slug: string;
  content_type: ImportItem["content_type"];
  release_year?: number;
  description?: string;
  cover_url?: string;
  banner_url?: string;
  external: { provider: "anilist"; id: string; url: string };
};

export type TmdbCandidate = {
  name: string;
  original_name?: string;
  slug: string;
  content_type: "movie" | "series";
  release_year?: number;
  description?: string;
  cover_url?: string;
  banner_url?: string;
  external: { provider: "tmdb"; id: string; url: string };
};

export type OpenLibraryCandidate = {
  name: string;
  slug: string;
  content_type: "book";
  release_year?: number;
  cover_url?: string;
  external: { provider: "openlibrary"; id: string; url: string };
};

export type CatalogSourceCandidate = AniListCandidate | TmdbCandidate | OpenLibraryCandidate;

type OpenLibrarySearchDoc = { key?: string; title?: string; first_publish_year?: number; cover_i?: number };

function toOpenLibraryCandidate(doc: OpenLibrarySearchDoc): OpenLibraryCandidate | null {
  const key = typeof doc.key === "string" ? doc.key : "";
  const match = /^\/works\/(OL\d+W)$/.exec(key);
  const name = typeof doc.title === "string" ? doc.title.trim() : "";
  if (!match || !name || name.length > 160) return null;
  const id = match[1];
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140).replace(/-+$/g, "");
  const cover = Number.isInteger(doc.cover_i) && doc.cover_i! > 0 && doc.cover_i! < 100_000_000 ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined;
  return { name, slug: normalized || `openlibrary-${id.toLowerCase()}`, content_type: "book", ...(Number.isInteger(doc.first_publish_year) && doc.first_publish_year! >= 1400 && doc.first_publish_year! <= 2200 ? { release_year: doc.first_publish_year } : {}), ...(cover ? { cover_url: cover } : {}), external: { provider: "openlibrary", id, url: `https://openlibrary.org${key}` } };
}

export async function searchOpenLibraryTitles(query: string) {
  await requireCatalogAdmin();
  const search = typeof query === "string" ? query.trim().slice(0, 120) : "";
  if (search.length < 2) return { ok: false as const, error: "Введи не менее двух символов." };
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", search);
  url.searchParams.set("fields", "key,title,first_publish_year,cover_i");
  url.searchParams.set("limit", "10");
  url.searchParams.set("page", "1");
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "SubReel/1.0 (catalog metadata discovery)" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (response.status === 429) return { ok: false as const, error: "Open Library ограничил частоту запросов. Подожди и попробуй ещё раз." };
    if (!response.ok) return { ok: false as const, error: "Open Library не смог выполнить поиск. Попробуй позже." };
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { docs?: unknown }).docs)) return { ok: false as const, error: "Open Library вернул неожиданный ответ." };
    const results = ((payload as { docs: unknown[] }).docs).map((doc) => doc && typeof doc === "object" ? toOpenLibraryCandidate(doc as OpenLibrarySearchDoc) : null).filter((doc): doc is OpenLibraryCandidate => doc !== null);
    return { ok: true as const, results };
  } catch (error) {
    console.warn("[admin import] Open Library search failed:", error instanceof Error ? error.name : "unknown error");
    return { ok: false as const, error: "Не удалось связаться с Open Library. Проверь подключение и повтори попытку." };
  }
}

type AniListMedia = {
  id: number;
  type: "ANIME" | "MANGA";
  isAdult?: boolean;
  format: string | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  startDate: { year: number | null } | null;
  coverImage: { extraLarge: string | null; large: string | null } | null;
  bannerImage: string | null;
  siteUrl: string | null;
};

function safeMediaSlug(value: string, id: number) {
  const slug = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140).replace(/-+$/g, "");
  return slug || `anilist-${id}`;
}

function safeTmdbSlug(value: string, id: number) {
  const slug = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140).replace(/-+$/g, "");
  return slug || `tmdb-${id}`;
}

type TmdbSearchResult = {
  id: number;
  adult?: boolean;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
};

function toTmdbCandidate(result: TmdbSearchResult, kind: "movie" | "tv"): TmdbCandidate | null {
  const name = (kind === "movie" ? result.title : result.name)?.trim();
  if (!name || !Number.isInteger(result.id) || result.id < 1 || result.adult === true) return null;
  const original = (kind === "movie" ? result.original_title : result.original_name)?.trim();
  const date = kind === "movie" ? result.release_date : result.first_air_date;
  const year = typeof date === "string" && /^(\d{4})-\d{2}-\d{2}$/.test(date) ? Number(date.slice(0, 4)) : undefined;
  const imageUrl = (path: string | null | undefined, size: "w500" | "w780") => path && /^\/[A-Za-z0-9._-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
  const overview = typeof result.overview === "string" ? result.overview.trim().slice(0, 5000) : "";
  return {
    name,
    ...(original && original !== name ? { original_name: original.slice(0, 200) } : {}),
    slug: safeTmdbSlug(name, result.id),
    content_type: kind === "movie" ? "movie" : "series",
    ...(year && year >= 1800 && year <= 2200 ? { release_year: year } : {}),
    ...(overview ? { description: overview } : {}),
    ...(imageUrl(result.poster_path, "w500") ? { cover_url: imageUrl(result.poster_path, "w500") } : {}),
    ...(imageUrl(result.backdrop_path, "w780") ? { banner_url: imageUrl(result.backdrop_path, "w780") } : {}),
    external: { provider: "tmdb", id: String(result.id), url: `https://www.themoviedb.org/${kind === "movie" ? "movie" : "tv"}/${result.id}` },
  };
}

export async function searchTmdbTitles(query: string, kind: "movie" | "tv") {
  await requireCatalogAdmin();
  const search = typeof query === "string" ? query.trim().slice(0, 120) : "";
  if (search.length < 2) return { ok: false as const, error: "Введи не менее двух символов." };
  if (kind !== "movie" && kind !== "tv") return { ok: false as const, error: "Выбери фильм или сериал." };
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false as const, error: "Поиск TMDB не настроен: добавь серверную переменную TMDB_API_READ_ACCESS_TOKEN в локальное окружение и Vercel." };
  const url = new URL(`https://api.themoviedb.org/3/search/${kind}`);
  url.searchParams.set("query", search);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "ru-RU");
  url.searchParams.set("page", "1");
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (response.status === 401) return { ok: false as const, error: "TMDB отклонил ключ. Проверь TMDB_API_READ_ACCESS_TOKEN." };
    if (response.status === 429) return { ok: false as const, error: "TMDB ограничил частоту запросов. Подожди и попробуй ещё раз." };
    if (!response.ok) return { ok: false as const, error: "TMDB не смог выполнить поиск. Попробуй позже." };
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) return { ok: false as const, error: "TMDB вернул неожиданный ответ." };
    const results = ((payload as { results: unknown[] }).results).slice(0, 10).map((item) => item && typeof item === "object" ? toTmdbCandidate(item as TmdbSearchResult, kind) : null).filter((item): item is TmdbCandidate => item !== null);
    return { ok: true as const, results };
  } catch (error) {
    console.warn("[admin import] TMDB search failed:", error instanceof Error ? error.name : "unknown error");
    return { ok: false as const, error: "Не удалось связаться с TMDB. Проверь подключение и повтори попытку." };
  }
}

function toAniListCandidate(media: AniListMedia): AniListCandidate | null {
  const name = media.title.english?.trim() || media.title.romaji?.trim() || media.title.native?.trim();
  if (!name || !Number.isInteger(media.id) || media.id < 1 || media.isAdult === true || !["ANIME", "MANGA"].includes(media.type)) return null;
  const cover = media.coverImage?.extraLarge || media.coverImage?.large || undefined;
  const coverUrl = httpsUrl(cover) ? cover : undefined;
  const bannerUrl = httpsUrl(media.bannerImage) ? media.bannerImage ?? undefined : undefined;
  const description = media.description?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000) || undefined;
  const content_type: AniListCandidate["content_type"] = media.type === "ANIME"
    ? media.format === "MOVIE" ? "movie" : "anime"
    : media.format === "NOVEL" ? "light_novel" : "manga";
  let url = `https://anilist.co/${media.type === "ANIME" ? "anime" : "manga"}/${media.id}`;
  if (media.siteUrl && httpsUrl(media.siteUrl)) {
    try { const parsedUrl = new URL(media.siteUrl); if (parsedUrl.hostname === "anilist.co" || parsedUrl.hostname === "www.anilist.co") url = parsedUrl.toString(); }
    catch { /* Use the canonical AniList URL above. */ }
  }
  return {
    name,
    ...(media.title.native && media.title.native !== name ? { original_name: media.title.native.slice(0, 200) } : {}),
    slug: safeMediaSlug(name, media.id),
    content_type,
    ...(Number.isInteger(media.startDate?.year) && media.startDate!.year! >= 1800 && media.startDate!.year! <= 2200 ? { release_year: media.startDate!.year! } : {}),
    ...(description ? { description } : {}),
    ...(coverUrl ? { cover_url: coverUrl } : {}),
    ...(bannerUrl ? { banner_url: bannerUrl } : {}),
    external: { provider: "anilist", id: String(media.id), url },
  };
}

const refreshableAniListFields = ["name", "original_name", "description", "cover_url", "banner_url", "release_year"] as const;
type RefreshableAniListField = typeof refreshableAniListFields[number];
type RefreshableTitle = Pick<ImportItem, RefreshableAniListField>;

async function fetchAniListById(externalId: string, kind: "ANIME" | "MANGA") {
  const queryText = `query ($id: Int!, $type: MediaType!) {
    Media(id: $id, type: $type) {
      id type format isAdult title { romaji english native } description(asHtml: false)
      startDate { year } coverImage { extraLarge large } bannerImage siteUrl
    }
  }`;
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "SubReel catalog importer" },
    body: JSON.stringify({ query: queryText, variables: { id: Number(externalId), type: kind } }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 429) return { ok: false as const, error: "AniList ограничил частоту запросов. Подожди минуту и попробуй ещё раз." };
  if (!response.ok) return { ok: false as const, error: response.status === 403 ? "AniList временно недоступен." : "Не удалось загрузить произведение из AniList." };
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") return { ok: false as const, error: "AniList вернул неожиданный ответ." };
  const media = (payload as { data?: { Media?: unknown } }).data?.Media;
  if (!media || typeof media !== "object") return { ok: false as const, error: "Произведение не найдено в AniList." };
  const candidate = toAniListCandidate(media as AniListMedia);
  if (!candidate || candidate.external.id !== externalId || (kind === "ANIME" ? !["anime", "movie"].includes(candidate.content_type) : !["manga", "light_novel"].includes(candidate.content_type))) {
    return { ok: false as const, error: "AniList вернул неподходящее произведение или контент для взрослых." };
  }
  return { ok: true as const, candidate };
}

export type AniListRefreshPreview = {
  title: { id: string; slug: string; name: string };
  changes: { field: RefreshableAniListField; label: string; current: string | number | null; incoming: string | number | null }[];
};

function refreshValue(value: RefreshableTitle, field: RefreshableAniListField) {
  return value[field] ?? null;
}

export async function previewAniListRefresh(externalId: string, kind: "ANIME" | "MANGA") {
  const { db } = await requireCatalogAdmin();
  const id = typeof externalId === "string" ? externalId.trim() : "";
  if (!/^\d{1,10}$/.test(id) || Number(id) < 1) return { ok: false as const, error: "Введи корректный числовой AniList ID." };
  if (kind !== "ANIME" && kind !== "MANGA") return { ok: false as const, error: "Выбери тип произведения." };
  const { data: mapping, error: mappingError } = await db.from("catalog_external_ids").select("title_id").eq("provider", "anilist").eq("external_id", id).maybeSingle();
  if (mappingError) return { ok: false as const, error: "Не удалось проверить AniList ID в базе." };
  if (!mapping) return { ok: false as const, error: "Этот AniList ID ещё не связан с тайтлом каталога. Сначала импортируй произведение." };
  const { data: title, error: titleError } = await db.from("titles").select("id,slug,name,original_name,description,cover_url,banner_url,release_year").eq("id", mapping.title_id).maybeSingle();
  if (titleError || !title) return { ok: false as const, error: "Связанный тайтл не найден." };
  try {
    const fetched = await fetchAniListById(id, kind);
    if (!fetched.ok) return fetched;
    const candidate = fetched.candidate;
    const incoming: RefreshableTitle = { name: candidate.name, original_name: candidate.original_name, description: candidate.description, cover_url: candidate.cover_url, banner_url: candidate.banner_url, release_year: candidate.release_year };
    const current = title as RefreshableTitle;
    const labels: Record<RefreshableAniListField, string> = { name: "Название", original_name: "Оригинальное название", description: "Описание", cover_url: "Постер", banner_url: "Баннер", release_year: "Год" };
    const changes = refreshableAniListFields.filter((field) => incoming[field] !== undefined && incoming[field] !== current[field]).map((field) => ({ field, label: labels[field], current: refreshValue(current, field), incoming: refreshValue(incoming, field) }));
    return { ok: true as const, preview: { title: { id: title.id, slug: title.slug, name: title.name }, changes } satisfies AniListRefreshPreview };
  } catch (error) {
    console.warn("[admin import] AniList refresh preview failed:", error instanceof Error ? error.name : "unknown error");
    return { ok: false as const, error: "Не удалось связаться с AniList. Проверь подключение и повтори попытку." };
  }
}

export async function applyAniListRefresh(titleId: string, externalId: string, kind: "ANIME" | "MANGA", selectedFields: string[]) {
  const { db } = await requireCatalogAdmin();
  const id = typeof externalId === "string" ? externalId.trim() : "";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(titleId) || !/^\d{1,10}$/.test(id) || Number(id) < 1 || (kind !== "ANIME" && kind !== "MANGA")) return { ok: false as const, error: "Некорректные данные для обновления." };
  if (!Array.isArray(selectedFields) || selectedFields.length === 0 || selectedFields.length > refreshableAniListFields.length || selectedFields.some((field) => !refreshableAniListFields.includes(field as RefreshableAniListField))) return { ok: false as const, error: "Выбери поля для обновления." };
  const { data: mapping, error: mappingError } = await db.from("catalog_external_ids").select("title_id").eq("provider", "anilist").eq("external_id", id).maybeSingle();
  if (mappingError || mapping?.title_id !== titleId) return { ok: false as const, error: "Связь с AniList изменилась. Заново подготовь предпросмотр." };
  const { data: title, error: titleError } = await db.from("titles").select("id,slug,name,original_name,description,cover_url,banner_url,release_year").eq("id", titleId).maybeSingle();
  if (titleError || !title) return { ok: false as const, error: "Тайтл каталога не найден." };
  try {
    const fetched = await fetchAniListById(id, kind);
    if (!fetched.ok) return fetched;
    const candidate = fetched.candidate;
    const incoming: RefreshableTitle = { name: candidate.name, original_name: candidate.original_name, description: candidate.description, cover_url: candidate.cover_url, banner_url: candidate.banner_url, release_year: candidate.release_year };
    const patch: Partial<RefreshableTitle> = {};
    for (const field of selectedFields as RefreshableAniListField[]) {
      if (incoming[field] === undefined) continue;
      if (incoming[field] === title[field]) continue;
      patch[field] = incoming[field] as never;
    }
    if (Object.keys(patch).length === 0) return { ok: false as const, error: "Выбранные значения не отличаются от текущих. Обнови предпросмотр." };
    const { data: updated, error: updateError } = await db.from("titles").update(patch).eq("id", titleId).select("id").maybeSingle();
    if (updateError || !updated) return { ok: false as const, error: "Не удалось сохранить обновление. Проверь права администратора и повтори попытку." };
    revalidatePath("/admin/import"); revalidatePath("/admin/titles"); revalidatePath("/catalog"); revalidatePath("/"); revalidatePath(`/title/${title.slug}`);
    return { ok: true as const, message: `Обновлено полей: ${Object.keys(patch).length}. Название, slug и статус публикации не менялись.` };
  } catch (error) {
    console.warn("[admin import] AniList refresh apply failed:", error instanceof Error ? error.name : "unknown error");
    return { ok: false as const, error: "Не удалось связаться с AniList. Обновление не сохранено." };
  }
}

export async function searchAniListTitles(query: string, kind: "ANIME" | "MANGA") {
  await requireCatalogAdmin();
  const search = typeof query === "string" ? query.trim().slice(0, 120) : "";
  if (search.length < 2) return { ok: false as const, error: "Введи не менее двух символов." };
  if (kind !== "ANIME" && kind !== "MANGA") return { ok: false as const, error: "Выбери тип каталога AniList." };
  const queryText = `query ($search: String!, $type: MediaType!) {
    Page(page: 1, perPage: 10) {
      media(search: $search, type: $type, isAdult: false, sort: SEARCH_MATCH) {
        id type format title { romaji english native } description(asHtml: false)
        startDate { year } coverImage { extraLarge large } bannerImage siteUrl
      }
    }
  }`;
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "SubReel catalog importer" },
      body: JSON.stringify({ query: queryText, variables: { search, type: kind } }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 429) return { ok: false as const, error: "AniList ограничил частоту запросов. Подожди минуту и попробуй ещё раз." };
    if (!response.ok) return { ok: false as const, error: response.status === 403 ? "AniList временно недоступен." : "AniList не смог выполнить поиск. Попробуй позже." };
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return { ok: false as const, error: "AniList вернул неожиданный ответ." };
    const data = (payload as { data?: { Page?: { media?: unknown[] } }; errors?: unknown[] }).data;
    const mediaRows = data?.Page?.media;
    if (!Array.isArray(mediaRows)) return { ok: false as const, error: "AniList не вернул список произведений." };
    const results = mediaRows.map((media) => media && typeof media === "object" ? toAniListCandidate(media as AniListMedia) : null).filter((media): media is AniListCandidate => media !== null);
    return { ok: true as const, results };
  } catch (error) {
    console.warn("[admin import] AniList search failed:", error instanceof Error ? error.name : "unknown error");
    return { ok: false as const, error: "Не удалось связаться с AniList. Проверь подключение и повтори попытку." };
  }
}

async function previewItems(db: Awaited<ReturnType<typeof createClient>>, checked: CheckedItem[]): Promise<ImportPreview> {
  const rows: ImportPreviewRow[] = [];
  for (const entry of checked) {
    if (entry.error || !entry.value) { rows.push({ row: entry.row, name: "—", slug: "—", outcome: "error", detail: entry.error ?? "Некорректная запись." }); continue; }
    const item = entry.value;
    let externalTitle: { id: string } | null = null;
    if (item.external) {
      const { data, error } = await db.from("catalog_external_ids").select("title_id").eq("provider", item.external.provider).eq("external_id", item.external.id).maybeSingle();
      if (error) { rows.push({ row: entry.row, name: item.name, slug: item.slug, outcome: "error", detail: "Не удалось проверить внешний ID. Убедись, что применена миграция импорта." }); continue; }
      if (data) externalTitle = { id: data.title_id };
    }
    const { data: slugTitle, error: slugError } = await db.from("titles").select("id,name,slug,original_name,description,cover_url,banner_url,release_year").eq("slug", item.slug).maybeSingle();
    if (slugError) { rows.push({ row: entry.row, name: item.name, slug: item.slug, outcome: "error", detail: "Не удалось проверить slug." }); continue; }
    if (externalTitle && slugTitle && externalTitle.id !== slugTitle.id) { rows.push({ row: entry.row, name: item.name, slug: item.slug, outcome: "error", detail: "Внешний ID и slug указывают на разные тайтлы." }); continue; }
    const matchId = externalTitle?.id ?? slugTitle?.id;
    if (!matchId) { rows.push({ row: entry.row, name: item.name, slug: item.slug, outcome: "create", detail: "Будет создан черновик." }); continue; }
    const { data: matchedTitle, error: matchedTitleError } = slugTitle?.id === matchId
      ? { data: slugTitle, error: null }
      : await db.from("titles").select("id,name,slug,original_name,description,cover_url,banner_url,release_year").eq("id", matchId).maybeSingle();
    if (matchedTitleError || !matchedTitle) { rows.push({ row: entry.row, name: item.name, slug: item.slug, outcome: "error", detail: "Не удалось загрузить сопоставленный тайтл." }); continue; }
    if (item.external) {
      const { data: sameProvider, error } = await db.from("catalog_external_ids").select("title_id").eq("provider", item.external.provider).eq("title_id", matchId).maybeSingle();
      if (error || (sameProvider && sameProvider.title_id === matchId && externalTitle?.id !== matchId)) { rows.push({ row: entry.row, name: item.name, slug: item.slug, outcome: "error", detail: "У тайтла уже связан другой ID этого источника." }); continue; }
    }
    const missing = [item.original_name && !matchedTitle.original_name, item.description && !matchedTitle.description, item.cover_url && !matchedTitle.cover_url, item.banner_url && !matchedTitle.banner_url, item.release_year && !matchedTitle.release_year].some(Boolean);
    rows.push({ row: entry.row, name: item.name, slug: item.slug, outcome: missing || (item.external && !externalTitle) ? "enrich" : "skip", detail: missing ? "Будут заполнены только пустые поля; название, slug и статус сохранятся." : item.external && !externalTitle ? "Будет добавлена связь внешнего ID." : "Совпадение уже полное, запись пропускается." });
  }
  const duplicateScan = await findPotentialDuplicates(db, rows, checked);
  if (duplicateScan.error) {
    const failedRows = rows.map((row) => row.outcome === "create" ? { ...row, outcome: "error" as const, detail: duplicateScan.error! } : row);
    return { ok: true, rows: failedRows, counts: { create: 0, enrich: failedRows.filter((x) => x.outcome === "enrich").length, skip: failedRows.filter((x) => x.outcome === "skip").length, error: failedRows.filter((x) => x.outcome === "error").length, duplicates: 0 } };
  }
  const finalRows = duplicateScan.rows;
  const counts = { create: finalRows.filter((x) => x.outcome === "create").length, enrich: finalRows.filter((x) => x.outcome === "enrich").length, skip: finalRows.filter((x) => x.outcome === "skip").length, error: finalRows.filter((x) => x.outcome === "error").length, duplicates: finalRows.filter((x) => Boolean(x.possibleDuplicates?.length)).length };
  return { ok: true, rows: finalRows, counts };
}

export async function previewCatalogImport(raw: string): Promise<ImportPreview> {
  const { db } = await requireCatalogAdmin();
  const parsed = parsePackage(raw);
  if (parsed.error) return { ok: false, error: parsed.error, rows: [], counts: { create: 0, enrich: 0, skip: 0, error: 0, duplicates: 0 } };
  return previewItems(db, parsed.items);
}

type ImportJobSummary = { jobId: string; status: "queued" | "running" | "completed" | "partial" | "failed"; progress: number; inputCount: number; counts: { created: number; updated: number; skipped: number; errors: number }; busy?: boolean };

class CatalogImportRowError extends Error {}

async function applyImportEntry(db: Awaited<ReturnType<typeof createClient>>, entry: CheckedItem) {
  if (entry.error || !entry.value) throw new CatalogImportRowError(entry.error ?? "Некорректная запись.");
  const item = entry.value;
  const check = await previewItems(db, [entry]);
  const row = check.rows[0];
  if (!row || row.outcome === "error") throw new CatalogImportRowError(row?.detail ?? "Не удалось сопоставить запись.");
  const { data: extMatch, error: extLookupError } = item.external ? await db.from("catalog_external_ids").select("title_id").eq("provider", item.external.provider).eq("external_id", item.external.id).maybeSingle() : { data: null, error: null };
  if (extLookupError) throw new CatalogImportRowError("Не удалось проверить внешний ID.");
  const { data: slugMatch, error: titleLookupError } = await db.from("titles").select("id,name,slug,original_name,description,cover_url,banner_url,release_year").eq("slug", item.slug).maybeSingle();
  if (titleLookupError) throw new CatalogImportRowError("Не удалось проверить slug.");
  if (extMatch && slugMatch && extMatch.title_id !== slugMatch.id) throw new CatalogImportRowError("Внешний ID и slug указывают на разные тайтлы.");
  let titleId = extMatch?.title_id ?? slugMatch?.id ?? "";
  let created = false;
  let changed = false;
  const affectedSlugs = new Set<string>();
  if (!titleId) {
    const { data, error } = await db.from("titles").insert({ name: item.name, slug: item.slug, content_type: item.content_type, original_name: item.original_name ?? null, description: item.description ?? null, cover_url: item.cover_url ?? null, banner_url: item.banner_url ?? null, release_year: item.release_year ?? null, status: "draft" }).select("id").single();
    if (error || !data) throw new CatalogImportRowError(error?.code === "23505" ? "Slug занят другой записью." : "Не удалось создать черновик.");
    titleId = data.id; created = true; changed = true;
  } else {
    const { data: matchedTitle, error: matchedTitleError } = slugMatch?.id === titleId
      ? { data: slugMatch, error: null }
      : await db.from("titles").select("id,name,slug,original_name,description,cover_url,banner_url,release_year").eq("id", titleId).maybeSingle();
    if (matchedTitleError || !matchedTitle) throw new CatalogImportRowError("Не удалось загрузить сопоставленный тайтл.");
    const patch: Record<string, string | number | null> = {};
    if (!matchedTitle.original_name && item.original_name) patch.original_name = item.original_name;
    if (!matchedTitle.description && item.description) patch.description = item.description;
    if (!matchedTitle.cover_url && item.cover_url) patch.cover_url = item.cover_url;
    if (!matchedTitle.banner_url && item.banner_url) patch.banner_url = item.banner_url;
    if (!matchedTitle.release_year && item.release_year) patch.release_year = item.release_year;
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      const { error } = await db.from("titles").update(patch).eq("id", titleId);
      if (error) throw new CatalogImportRowError("Не удалось заполнить пустые поля существующего тайтла.");
      changed = true;
    }
    affectedSlugs.add(matchedTitle.slug);
  }
  if (item.external) {
    const { data: providerMatch, error } = await db.from("catalog_external_ids").select("title_id").eq("provider", item.external.provider).eq("title_id", titleId).maybeSingle();
    if (error) throw new CatalogImportRowError("Не удалось проверить связь внешнего ID.");
    if (!providerMatch) {
      const { error: insertError } = await db.from("catalog_external_ids").insert({ title_id: titleId, provider: item.external.provider, external_id: item.external.id, source_url: item.external.url ?? null });
      if (insertError) throw new CatalogImportRowError(insertError.code === "23505" ? "Внешний ID уже привязан к другому тайтлу или источнику." : "Не удалось сохранить внешний ID.");
      changed = true;
    }
  }
  if (!changed) return { created: 0, updated: 0, skipped: 1, slug: item.slug, affectedSlugs: [...affectedSlugs] };
  return { created: created ? 1 : 0, updated: created ? 0 : 1, skipped: 0, slug: item.slug, affectedSlugs: [...affectedSlugs] };
}

function isTerminalImportStatus(status: string): status is "completed" | "partial" | "failed" {
  return status === "completed" || status === "partial" || status === "failed";
}

export async function commitCatalogImport(raw: string, sourceName: string, acknowledgedDuplicateMatches: string[] = []) {
  const { db, user } = await requireCatalogAdmin();
  const parsed = parsePackage(raw);
  if (parsed.error) return { ok: false as const, error: parsed.error };
  const initialPreview = await previewItems(db, parsed.items);
  if (!initialPreview.ok || initialPreview.counts.error > 0) return { ok: false as const, error: "Исправь ошибки предпросмотра и запусти импорт заново." };
  if (!Array.isArray(acknowledgedDuplicateMatches) || acknowledgedDuplicateMatches.length > 300 || acknowledgedDuplicateMatches.some((match) => typeof match !== "string" || !/^\d{1,3}:[0-9a-f-]{36}$/i.test(match))) return { ok: false as const, error: "Некорректное подтверждение проверки дублей." };
  const acknowledged = new Set(acknowledgedDuplicateMatches);
  const unseenDuplicate = initialPreview.rows.some((row) => row.possibleDuplicates?.some((match) => !acknowledged.has(`${row.row}:${match.id}`)));
  if (unseenDuplicate) return { ok: false as const, error: `Найдены возможные дубликаты (${initialPreview.counts.duplicates}). Обнови предпросмотр, просмотри новые совпадения и подтверди их.` };
  const { data: job, error: jobError } = await db.from("catalog_import_jobs").insert({
    actor_id: user.id,
    source_name: (sourceName.trim() || "JSON импорт").slice(0, 160),
    input_count: parsed.items.length,
    status: "queued",
    payload: parsed.items.map((entry) => entry.value),
    next_row: 1,
  }).select("id").single();
  if (jobError || !job) { console.error("[catalog import] enqueue job:", jobError?.message); return { ok: false as const, error: "Не удалось добавить задание в очередь. Проверь, что миграция 026 применена в Supabase." }; }
  revalidatePath("/admin/import");
  return { ok: true as const, jobId: job.id, status: "queued" as const, counts: { created: 0, updated: 0, skipped: 0, errors: 0 }, progress: 0, inputCount: parsed.items.length };
}

export async function processCatalogImportJob(jobId: string, workerSecret?: string): Promise<{ ok: boolean; error?: string; summary?: ImportJobSummary }> {
  const validWorker = Boolean(process.env.CRON_SECRET) && workerSecret === process.env.CRON_SECRET;
  let db: Awaited<ReturnType<typeof createClient>>;
  if (validWorker) {
    const serviceClient = createSupabaseAdminClient();
    if (!serviceClient) return { ok: false, error: "Служебный клиент очереди не настроен." };
    db = serviceClient;
  } else {
    const session = await requireCatalogAdmin();
    db = session.db;
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(jobId)) return { ok: false, error: "Некорректный идентификатор задания." };
  const { data: job, error: jobError } = await db.from("catalog_import_jobs").select("id,status,payload,next_row,input_count,created_count,updated_count,skipped_count,error_count,lease_until").eq("id", jobId).maybeSingle();
  if (jobError || !job) return { ok: false, error: "Задание импорта не найдено." };
  const counts = { created: job.created_count, updated: job.updated_count, skipped: job.skipped_count, errors: job.error_count };
  const summary = (status: ImportJobSummary["status"], busy = false): ImportJobSummary => ({ jobId, status, progress: Math.max(0, Math.min(job.input_count, job.next_row - 1)), inputCount: job.input_count, counts, ...(busy ? { busy: true } : {}) });
  if (isTerminalImportStatus(job.status)) return { ok: true, summary: summary(job.status) };
  const token = crypto.randomUUID();
  const now = new Date();
  let claim = db.from("catalog_import_jobs").update({ status: "running", lease_owner: token, lease_until: new Date(now.getTime() + 180_000).toISOString() }).eq("id", jobId);
  if (job.status === "queued") claim = claim.eq("status", "queued");
  else if (job.status === "running" && job.lease_until) claim = claim.eq("status", "running").lt("lease_until", now.toISOString());
  else if (job.status === "running") claim = claim.eq("status", "running").is("lease_until", null);
  else return { ok: false, error: "Неизвестный статус задания." };
  const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
  if (claimError) return { ok: false, error: "Не удалось получить задание из очереди." };
  if (!claimed) return { ok: true, summary: summary(job.status, true) };
  if (!Array.isArray(job.payload)) {
    await db.from("catalog_import_jobs").update({ status: "failed", lease_owner: null, lease_until: null, error_count: job.input_count, completed_at: new Date().toISOString() }).eq("id", jobId).eq("lease_owner", token);
    return { ok: false, error: "В задании нет сохранённого пакета. Оно отмечено как неудачное." };
  }
  const reparsed = parsePackage(JSON.stringify({ titles: job.payload }));
  if (reparsed.error || reparsed.items.some((entry) => !entry.value || entry.error)) {
    await db.from("catalog_import_jobs").update({ status: "failed", lease_owner: null, lease_until: null, error_count: job.input_count, completed_at: new Date().toISOString() }).eq("id", jobId).eq("lease_owner", token);
    return { ok: false, error: "Сохранённый пакет не прошёл повторную проверку и задание остановлено." };
  }
  let { next_row: nextRow, created_count: created, updated_count: updated, skipped_count: skipped, error_count: errors } = job;
  const affectedSlugs = new Set<string>();
  const batchEnd = Math.min(job.input_count, nextRow + 4);
  while (nextRow <= batchEnd) {
    const { data: lease, error: leaseError } = await db.from("catalog_import_jobs").update({ lease_until: new Date(Date.now() + 180_000).toISOString() }).eq("id", jobId).eq("status", "running").eq("lease_owner", token).select("id").maybeSingle();
    if (leaseError || !lease) return { ok: false, error: "Обработка остановлена: аренда задания потеряна. Его можно продолжить из очереди." };
    const entry = reparsed.items[nextRow - 1];
    try {
      const result = await applyImportEntry(db, entry);
      created += result.created; updated += result.updated; skipped += result.skipped;
      result.affectedSlugs.forEach((slug) => affectedSlugs.add(slug));
      affectedSlugs.add(result.slug);
      await db.from("catalog_import_job_errors").delete().eq("job_id", jobId).eq("row_number", nextRow);
    } catch (error) {
      const item = entry.value;
      const knownError = error instanceof CatalogImportRowError;
      const message = knownError ? error.message.slice(0, 1000) : "Внутренняя ошибка при обработке записи. Проверь журналы сервера и повтори строку.";
      if (!knownError) console.error("[catalog import] unexpected row failure:", { jobId, row: nextRow, errorName: error instanceof Error ? error.name : "unknown" });
      const { error: logError } = await db.from("catalog_import_job_errors").upsert({ job_id: jobId, row_number: nextRow, external_id: item?.external?.id ?? null, item_name: item?.name ?? null, message, payload: item ?? null }, { onConflict: "job_id,row_number" });
      if (logError) {
        console.error("[catalog import] could not persist row error:", { jobId, row: nextRow, errorCode: logError.code });
        const { error: releaseError } = await db.from("catalog_import_jobs").update({ status: "queued", lease_owner: null, lease_until: null }).eq("id", jobId).eq("status", "running").eq("lease_owner", token);
        return { ok: false, error: releaseError ? "Не удалось сохранить ошибку или освободить задание. Оно автоматически станет доступно после окончания аренды." : "Не удалось записать ошибку строки. Задание оставлено в очереди и можно безопасно продолжить." };
      }
      errors += 1;
    }
    nextRow += 1;
    const finished = nextRow > job.input_count;
    const status = finished ? errors === 0 ? "completed" : created + updated + skipped > 0 ? "partial" : "failed" : "running";
    const { data: progressRow, error: progressError } = await db.from("catalog_import_jobs").update({
      next_row: nextRow, created_count: created, updated_count: updated, skipped_count: skipped, error_count: errors,
      status, completed_at: finished ? new Date().toISOString() : null,
      ...(finished ? { lease_owner: null, lease_until: null } : {}),
    }).eq("id", jobId).eq("status", "running").eq("lease_owner", token).select("id").maybeSingle();
    if (progressError || !progressRow) return { ok: false, error: "Не удалось сохранить прогресс. Задание можно безопасно продолжить из очереди." };
  }
  if (nextRow <= job.input_count) {
    const { error: releaseError } = await db.from("catalog_import_jobs").update({ status: "queued", lease_owner: null, lease_until: null }).eq("id", jobId).eq("status", "running").eq("lease_owner", token);
    if (releaseError) return { ok: false, error: "Пакет обработан частично, но не удалось вернуть задание в очередь." };
  } else {
    revalidatePath("/admin/titles"); revalidatePath("/catalog"); revalidatePath("/");
    for (const slug of affectedSlugs) revalidatePath(`/title/${slug}`);
  }
  revalidatePath("/admin/import");
  return { ok: true, summary: { jobId, status: nextRow > job.input_count ? errors === 0 ? "completed" : created + updated + skipped > 0 ? "partial" : "failed" : "queued", progress: nextRow - 1, inputCount: job.input_count, counts: { created, updated, skipped, errors } } };
}

export type CatalogImportErrorRow = { id: string; row_number: number; external_id: string | null; item_name: string | null; message: string; retryable: boolean };

export async function getCatalogImportJobErrors(jobId: string) {
  const { db } = await requireCatalogAdmin();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(jobId)) return { ok: false as const, error: "Некорректный идентификатор задания." };
  const { data, error } = await db.from("catalog_import_job_errors").select("id,row_number,external_id,item_name,message,payload").eq("job_id", jobId).order("row_number", { ascending: true }).limit(100);
  if (error) return { ok: false as const, error: "Не удалось загрузить ошибки задания." };
  return { ok: true as const, rows: (data ?? []).map((row) => ({ id: row.id, row_number: row.row_number, external_id: row.external_id, item_name: row.item_name, message: row.message, retryable: Boolean(row.payload) })) };
}

export async function retryCatalogImportError(errorId: string) {
  const { db } = await requireCatalogAdmin();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(errorId)) return { ok: false as const, error: "Некорректный идентификатор ошибки." };
  const { data: row, error: lookupError } = await db.from("catalog_import_job_errors").select("id,job_id,row_number,item_name,payload,retry_started_at").eq("id", errorId).maybeSingle();
  if (lookupError || !row) return { ok: false as const, error: "Строка ошибки не найдена." };
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return { ok: false as const, error: "Эта строка не прошла проверку формата и не может быть повторена. Исправь исходный JSON и импортируй заново." };
  const raw = JSON.stringify({ titles: [row.payload] });
  const parsed = parsePackage(raw);
  if (parsed.error || !parsed.items[0]?.value) return { ok: false as const, error: "Сохранённые данные строки не прошли повторную проверку." };
  const retryCutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  let claim = db.from("catalog_import_job_errors").update({ retry_started_at: new Date().toISOString() }).eq("id", row.id);
  claim = row.retry_started_at ? claim.lt("retry_started_at", retryCutoff) : claim.is("retry_started_at", null);
  const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
  if (claimError) return { ok: false as const, error: "Не удалось заблокировать строку для повтора." };
  if (!claimed) return { ok: false as const, error: "Эта строка уже повторяется. Обнови журнал через несколько секунд." };

  const clearClaim = async () => {
    const { error } = await db.from("catalog_import_job_errors").update({ retry_started_at: null }).eq("id", row.id);
    if (error) console.error("[catalog import] release retry claim:", { errorCode: error.code });
  };
  try {
    const result = await commitCatalogImport(raw, `Повтор · ${row.item_name || `строка ${row.row_number}`}`);
    if (!result.ok) { await clearClaim(); return result; }
    const processed = await processCatalogImportJob(result.jobId);
    if (!processed.ok || !processed.summary || processed.summary.status !== "completed") {
      await clearClaim();
      return { ok: false as const, error: processed.error ?? "Повтор снова завершился ошибкой. Подробности доступны в журнале задания." };
    }

    const { data: completed, error: completionError } = await db.rpc("complete_catalog_import_retry", {
      p_error_id: row.id,
      p_created_count: processed.summary.counts.created,
      p_updated_count: processed.summary.counts.updated,
      p_skipped_count: processed.summary.counts.skipped,
    });
    if (completionError || completed !== true) {
      await clearClaim();
      return { ok: false as const, error: "Повтор выполнен, но не удалось атомарно обновить исходное задание. Обнови журнал." };
    }
  } catch {
    await clearClaim();
    return { ok: false as const, error: "Не удалось выполнить повтор. Проверь журнал заданий и попробуй ещё раз." };
  }
  revalidatePath("/admin/import");
  return { ok: true as const, message: "Строка успешно обработана повторно." };
}

import type { LibraryStatus } from "@/app/progress/actions";
import { firstOf } from "@/lib/catalog";
import type { createClient } from "@/lib/supabase/server";
import {
  isReadable,
  type ContinueItem,
  type LibraryData,
  type LibraryItem,
  type LibraryProgress,
} from "@/lib/library-shared";

type Db = Awaited<ReturnType<typeof createClient>>;
type QueryResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

const ROWS_LIMIT = 1000;
const CHUNK = 100;
const CONTINUE_LIMIT = 20;

type TitleLite = {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  cover_url: string | null;
  release_year: number | null;
};
type EntryRow = {
  title_id: string;
  status: LibraryStatus;
  is_favorite: boolean;
  updated_at: string;
  titles: TitleLite | TitleLite[] | null;
};
type VideoRow = {
  title_id: string;
  episode_id: string | null;
  position_seconds: number;
  duration_seconds: number | null;
  completed_at: string | null;
  updated_at: string;
};
type ReadingRow = {
  title_id: string;
  chapter_id: string | null;
  current_page: number;
  total_pages: number | null;
  completed_at: string | null;
  updated_at: string;
};
type StatsRow = {
  library_count: number;
  favorite_count: number;
  completed_count: number;
  completed_video_positions: number;
  completed_reading_positions: number;
};
type Latest = {
  kind: "video" | "read";
  unitId: string | null;
  percent: number;
  done: boolean;
  updatedAt: number;
};

const ratio = (done: number, total: number | null) =>
  total && total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

/** PostgREST кладёт все id в URL, поэтому длинные списки режем на части. */
async function inChunks<T>(ids: string[], load: (chunk: string[]) => QueryResult<T>) {
  const unique = [...new Set(ids)];
  const parts: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) parts.push(unique.slice(i, i + CHUNK));
  const results = await Promise.all(parts.map((part) => load(part)));
  return { rows: results.flatMap((result) => result.data ?? []), failed: results.some((result) => result.error) };
}

export async function loadLibrary(db: Db, userId: string): Promise<{ ok: true; data: LibraryData } | { ok: false }> {
  const [entriesRes, videoRes, readingRes, reviewsRes, statsRes] = await Promise.all([
    db
      .from("user_library")
      .select("title_id,status,is_favorite,updated_at,titles(id,name,slug,content_type,cover_url,release_year)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(ROWS_LIMIT),
    db
      .from("video_progress")
      .select("title_id,episode_id,position_seconds,duration_seconds,completed_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(ROWS_LIMIT),
    db
      .from("reading_progress")
      .select("title_id,chapter_id,current_page,total_pages,completed_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(ROWS_LIMIT),
    db.from("title_reviews").select("title_id,rating").eq("user_id", userId).limit(ROWS_LIMIT),
    db.rpc("user_library_stats"),
  ]);

  // Оценки и счётчики — приятное дополнение: если их нет, библиотека всё равно открывается.
  if (entriesRes.error || videoRes.error || readingRes.error) return { ok: false };

  const entries = (entriesRes.data ?? []) as unknown as EntryRow[];
  const video = (videoRes.data ?? []) as VideoRow[];
  const reading = (readingRes.data ?? []) as ReadingRow[];
  const ratingByTitle = new Map(
    ((reviewsRes.error ? [] : reviewsRes.data ?? []) as { title_id: string; rating: number }[]).map((row) => [
      row.title_id,
      row.rating,
    ]),
  );
  const stats = (statsRes.error ? null : (statsRes.data?.[0] ?? null)) as StatsRow | null;

  // Последняя запись прогресса на каждый тайтл (видео и чтение вместе).
  const latest = new Map<string, Latest>();
  const consider = (titleId: string, next: Latest) => {
    const current = latest.get(titleId);
    if (!current || next.updatedAt > current.updatedAt) latest.set(titleId, next);
  };
  for (const row of video) {
    consider(row.title_id, {
      kind: "video",
      unitId: row.episode_id,
      percent: ratio(row.position_seconds, row.duration_seconds),
      done: Boolean(row.completed_at),
      updatedAt: Date.parse(row.updated_at),
    });
  }
  for (const row of reading) {
    consider(row.title_id, {
      kind: "read",
      unitId: row.chapter_id,
      percent: ratio(row.current_page, row.total_pages),
      done: Boolean(row.completed_at),
      updatedAt: Date.parse(row.updated_at),
    });
  }

  const libraryTitleIds = new Set(entries.map((entry) => entry.title_id));
  const continuePicks = [...latest.entries()]
    .filter(([, value]) => !value.done)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, CONTINUE_LIMIT);

  // Для подписей «Серия 5» / «Глава 12» и для карточек «Продолжить» вне библиотеки.
  const labelTitleIds = new Set([...libraryTitleIds, ...continuePicks.map(([id]) => id)]);
  const episodeIds: string[] = [];
  const chapterIds: string[] = [];
  for (const titleId of labelTitleIds) {
    const entry = latest.get(titleId);
    if (!entry?.unitId) continue;
    (entry.kind === "video" ? episodeIds : chapterIds).push(entry.unitId);
  }
  const missingTitleIds = continuePicks.map(([id]) => id).filter((id) => !libraryTitleIds.has(id));

  const [episodes, chapters, extraTitles] = await Promise.all([
    inChunks<{ id: string; episode_number: number | string }>(episodeIds, (chunk) =>
      db.from("title_episodes").select("id,episode_number").in("id", chunk),
    ),
    inChunks<{ id: string; chapter_label: string }>(chapterIds, (chunk) =>
      db.from("title_chapters").select("id,chapter_label").in("id", chunk),
    ),
    inChunks<TitleLite>(missingTitleIds, (chunk) =>
      db
        .from("titles")
        .select("id,name,slug,content_type,cover_url,release_year")
        .in("id", chunk)
        .eq("status", "published"),
    ),
  ]);
  const episodeNo = new Map(episodes.rows.map((row) => [row.id, Number(row.episode_number)] as const));
  const chapterLabel = new Map(chapters.rows.map((row) => [row.id, row.chapter_label] as const));

  const progressOf = (titleId: string): LibraryProgress | null => {
    const entry = latest.get(titleId);
    if (!entry) return null;
    const unit = entry.unitId
      ? entry.kind === "video"
        ? episodeNo.has(entry.unitId)
          ? `Серия ${episodeNo.get(entry.unitId)}`
          : null
        : (chapterLabel.get(entry.unitId) ?? null)
      : null;
    const fallback = entry.kind === "video" ? "Просмотр" : "Чтение";
    return { kind: entry.kind, label: unit ?? fallback, percent: entry.percent, done: entry.done };
  };

  const items: LibraryItem[] = [];
  for (const entry of entries) {
    const title = firstOf(entry.titles);
    if (!title) continue; // тайтл снят с публикации — в библиотеке не показываем
    items.push({
      titleId: entry.title_id,
      slug: title.slug,
      name: title.name,
      coverUrl: title.cover_url,
      contentType: title.content_type,
      releaseYear: title.release_year,
      status: entry.status,
      favorite: entry.is_favorite,
      updatedAt: entry.updated_at,
      rating: ratingByTitle.get(entry.title_id) ?? null,
      progress: progressOf(entry.title_id),
    });
  }

  const known = new Map<string, TitleLite>();
  for (const item of items) {
    known.set(item.titleId, {
      id: item.titleId,
      name: item.name,
      slug: item.slug,
      content_type: item.contentType,
      cover_url: item.coverUrl,
      release_year: item.releaseYear,
    });
  }
  for (const title of extraTitles.rows) known.set(title.id, title);

  const continueItems: ContinueItem[] = [];
  for (const [titleId, entry] of continuePicks) {
    const title = known.get(titleId);
    if (!title) continue;
    const progress = progressOf(titleId);
    const readable = entry.kind === "read" || isReadable(title.content_type);
    continueItems.push({
      titleId,
      href: `${entry.kind === "read" ? "/read" : "/watch"}/${title.slug}`,
      name: title.name,
      coverUrl: title.cover_url,
      label: progress?.label ?? (readable ? "Продолжить чтение" : "Продолжить просмотр"),
      percent: entry.percent,
      kind: entry.kind,
    });
  }

  const passedUnits = (stats?.completed_video_positions ?? 0) + (stats?.completed_reading_positions ?? 0);
  return {
    ok: true,
    data: {
      items,
      continueItems,
      summary: {
        total: stats?.library_count ?? items.length,
        favorites: stats?.favorite_count ?? items.filter((item) => item.favorite).length,
        completed: stats?.completed_count ?? items.filter((item) => item.status === "completed").length,
        passedUnits: stats
          ? passedUnits
          : [...latest.values()].filter((entry) => entry.done).length,
      },
      truncated: entries.length >= ROWS_LIMIT,
    },
  };
}

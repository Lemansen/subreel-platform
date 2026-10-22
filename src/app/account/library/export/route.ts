import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
const MAX_ROWS_PER_TABLE = 100_000;

type Page<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function collectRows<T>(loadPage: (start: number, end: number) => PromiseLike<Page<T>>) {
  const rows: T[] = [];
  for (let start = 0; start < MAX_ROWS_PER_TABLE; start += PAGE_SIZE) {
    const { data, error } = await loadPage(start, start + PAGE_SIZE - 1);
    if (error) return { rows: null, error: error.message };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, error: null };
  }
  return { rows: null, error: "limit" };
}

export async function GET(request: Request) {
  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/account/library/export");
    return Response.redirect(loginUrl, 303);
  }

  const [library, videoProgress, readingProgress, reviews] = await Promise.all([
    collectRows((start, end) => db.from("user_library").select("user_id,title_id,status,is_favorite,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: true }).order("title_id", { ascending: true }).range(start, end)),
    collectRows((start, end) => db.from("video_progress").select("user_id,title_id,episode_id,unit_id,position_seconds,duration_seconds,completed_at,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: true }).order("unit_id", { ascending: true }).range(start, end)),
    collectRows((start, end) => db.from("reading_progress").select("user_id,title_id,chapter_id,unit_id,current_page,total_pages,completed_at,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: true }).order("unit_id", { ascending: true }).range(start, end)),
    collectRows((start, end) => db.from("title_reviews").select("user_id,title_id,rating,body,is_public,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: true }).order("title_id", { ascending: true }).range(start, end)),
  ]);

  if (library.error || videoProgress.error || readingProgress.error || reviews.error) {
    console.error("[library export] data query failed");
    const status = [library.error, videoProgress.error, readingProgress.error, reviews.error].includes("limit") ? 413 : 500;
    return Response.json({ error: status === 413 ? "Экспорт слишком большой." : "Не удалось подготовить экспорт. Проверь миграции библиотеки." }, { status, headers: { "Cache-Control": "private, no-store" } });
  }

  const exportedAt = new Date().toISOString();
  const fileDate = exportedAt.slice(0, 10);
  const payload = {
    format: "subreel-library",
    version: 1,
    exported_at: exportedAt,
    library: library.rows,
    video_progress: videoProgress.rows,
    reading_progress: readingProgress.rows,
    ratings_and_reviews: reviews.rows,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="subreel-library-${fileDate}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

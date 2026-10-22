import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import type { LibraryStatus } from "@/app/progress/actions";

type Entry = { title_id: string; status: LibraryStatus; is_favorite: boolean; updated_at: string };
type Title = { id: string; name: string; slug: string; content_type: string; cover_url: string | null };
type VideoProgress = { title_id: string; position_seconds: number; completed_at: string | null; updated_at: string };
type ReadingProgress = { title_id: string; chapter_id: string | null; completed_at: string | null; updated_at: string };
type LibraryStats = { library_count: number; favorite_count: number; planned_count: number; in_progress_count: number; completed_count: number; on_hold_count: number; dropped_count: number; video_positions: number; completed_video_positions: number; reading_positions: number; completed_reading_positions: number };
const labels: Record<LibraryStatus, string> = { planned: "Запланировано", in_progress: "В процессе", completed: "Завершено", on_hold: "Отложено", dropped: "Брошено" };

async function LibraryContent() {
  await connection();
  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) redirect("/login?next=%2Faccount%2Flibrary");

  const [entriesRes, videoRes, readingRes, statsRes] = await Promise.all([
    db.from("user_library").select("title_id,status,is_favorite,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(200),
    db.from("video_progress").select("title_id,position_seconds,completed_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(200),
    db.from("reading_progress").select("title_id,chapter_id,completed_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(200),
    db.rpc("user_library_stats"),
  ]);
  const entries = (entriesRes.data ?? []) as Entry[];
  const videoProgress = (videoRes.data ?? []) as VideoProgress[];
  const readingProgress = (readingRes.data ?? []) as ReadingProgress[];
  const stats = (statsRes.data?.[0] ?? null) as LibraryStats | null;
  const titleIds = [...new Set([...entries.map((entry) => entry.title_id), ...videoProgress.map((entry) => entry.title_id), ...readingProgress.map((entry) => entry.title_id)])];
  const titlesRes = titleIds.length ? await db.from("titles").select("id,name,slug,content_type,cover_url").in("id", titleIds) : { data: [], error: null };
  const titles = (titlesRes.data ?? []) as Title[];
  const titleById = new Map(titles.map((title) => [title.id, title]));
  const firstVideo = new Map<string, VideoProgress>();
  for (const progress of videoProgress) if (!progress.completed_at && progress.position_seconds > 0 && !firstVideo.has(progress.title_id)) firstVideo.set(progress.title_id, progress);
  const firstReading = new Map<string, ReadingProgress>();
  for (const progress of readingProgress) if (!progress.completed_at && !firstReading.has(progress.title_id)) firstReading.set(progress.title_id, progress);
  const dataError = entriesRes.error || videoRes.error || readingRes.error || titlesRes.error;

  function formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <Link href="/account" className="text-sm text-accent hover:brightness-125">← В профиль</Link>
        <h1 className="mt-4 text-3xl font-black">Моя библиотека</h1>
        <p className="mt-2 text-sm text-text-secondary">Твои статусы и избранные произведения. Эти записи видны только тебе.</p>
        {dataError ? <p role="alert" className="mt-6 rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">Не удалось загрузить библиотеку. Проверь миграцию и повтори попытку.</p> : <>
        {stats ? <section aria-label="Статистика библиотеки" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "В библиотеке", value: stats.library_count },
            { label: "В избранном", value: stats.favorite_count },
            { label: "Завершено", value: stats.completed_count },
            { label: "В процессе", value: stats.in_progress_count },
            { label: "Запланировано", value: stats.planned_count },
            { label: "Отложено или брошено", value: stats.on_hold_count + stats.dropped_count },
            { label: "Позиции просмотра", value: stats.video_positions, detail: `${stats.completed_video_positions} завершено` },
            { label: "Позиции чтения", value: stats.reading_positions, detail: `${stats.completed_reading_positions} завершено` },
          ].map((item) => <div key={item.label} className="rounded-2xl border border-border-subtle bg-surface-1 p-4"><p className="text-sm text-text-secondary">{item.label}</p><p className="mt-2 text-2xl font-black">{item.value}</p>{item.detail && <p className="mt-1 text-xs text-text-muted">{item.detail}</p>}</div>)}
        </section> : <p role="status" className="mt-6 rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm text-warning">Статистика появится после применения миграции 020.</p>}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface-1 p-5"><div><h2 className="font-semibold">Экспорт личных данных</h2><p className="mt-1 text-sm text-text-secondary">Скачай библиотеку, прогресс, оценки и отзывы в формате JSON.</p></div><a href="/account/library/export" className="inline-flex min-h-11 items-center rounded-xl border border-accent/30 px-4 text-sm font-semibold text-accent transition hover:bg-accent/10">Скачать JSON</a></section>
        {(firstVideo.size > 0 || firstReading.size > 0) && <section className="mt-8"><h2 className="text-xl font-bold">Продолжить</h2><ul className="mt-3 grid gap-3 sm:grid-cols-2">{[...firstVideo.entries()].map(([titleId, progress]) => {
          const title = titleById.get(titleId);
          return title ? <li key={`video-${titleId}`} className="rounded-xl border border-border-subtle bg-surface-1 p-4"><Link href={`/watch/${title.slug}`} className="font-semibold hover:text-accent">{title.name}</Link><p className="mt-1 text-xs text-text-muted">Просмотр остановлен на {formatTime(progress.position_seconds)}</p><Link href={`/watch/${title.slug}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-3 text-sm font-semibold text-white hover:brightness-110">Продолжить просмотр</Link></li> : null;
        })}{[...firstReading.entries()].map(([titleId, progress]) => {
          const title = titleById.get(titleId);
          return title ? <li key={`reading-${titleId}`} className="rounded-xl border border-border-subtle bg-surface-1 p-4"><Link href={`/read/${title.slug}`} className="font-semibold hover:text-accent">{title.name}</Link><p className="mt-1 text-xs text-text-muted">{progress.chapter_id ? "Остановился на главе" : "Читалка"}</p><Link href={`/read/${title.slug}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-3 text-sm font-semibold text-white hover:brightness-110">Продолжить чтение</Link></li> : null;
        })}</ul></section>}
        {entries.length === 0 ? <div className="mt-8 rounded-2xl border border-border-subtle bg-surface-1 p-8"><p className="text-text-secondary">Библиотека пока пустая.</p><Link href="/catalog" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-semibold text-white hover:brightness-110">Открыть каталог</Link></div> : <><h2 className="mt-10 text-xl font-bold">Сохранённые произведения</h2><ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{entries.map((entry) => {
          const title = titleById.get(entry.title_id);
          if (!title) return null;
          return <li key={entry.title_id} className="rounded-2xl border border-border-subtle bg-surface-1 p-4"><Link href={`/title/${title.slug}`} className="font-semibold hover:text-accent">{title.name}</Link><div className="mt-2 flex flex-wrap gap-2 text-xs text-text-secondary"><span>{labels[entry.status]}</span>{entry.is_favorite && <span className="text-accent-secondary">♥ Избранное</span>}<span>{title.content_type}</span></div></li>;
        })}</ul></>}
        </>}
      </div>
    </main>
  );
}

export default function LibraryPage() {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-background p-8"><div className="mx-auto h-12 max-w-6xl rounded-xl bg-white/5" /></main>}><LibraryContent /></Suspense>;
}

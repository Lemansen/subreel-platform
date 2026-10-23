import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { VideoPlayback } from "@/components/video-playback";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const videoTypes = ["anime", "movie", "series", "drama", "cartoon"];
type Episode = { id: string; episode_number: number; name: string | null; season_id: string | null };
type VideoSource = { id: string; episode_id: string | null; source_url: string; source_format: "hls" | "dash" | "mp4" | "embed"; provider_name: string | null; language_code: string | null; quality_label: string | null };
type VideoProgress = { episode_id: string | null; position_seconds: number; duration_seconds: number | null; completed_at: string | null; updated_at: string };

async function WatchContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  await connection();
  const { slug } = await params;
  const query = await searchParams;
  const requestedId = Array.isArray(query.episode) ? query.episode[0] : query.episode;
  const supabase = await createClient();
  const { data: title, error } = await supabase
    .from("titles")
    .select("id, name, slug, content_type")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <SiteHeader active="catalog" />
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold">Не удалось открыть просмотр</h1>
          <p className="mt-3 text-sm text-text-secondary">Каталог временно недоступен. Попробуй позже.</p>
          <Link href="/catalog" className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm hover:bg-surface-1">← В каталог</Link>
        </div>
      </main>
    );
  }

  if (!title) notFound();

  const [episodesRes, sourcesRes] = await Promise.all([
    supabase.from("title_episodes").select("id, episode_number, name, season_id").eq("title_id", title.id).eq("status", "published").order("sort_order"),
    supabase.from("video_sources").select("id, episode_id, source_url, source_format, provider_name, language_code, quality_label").eq("title_id", title.id).order("created_at"),
  ]);
  if (episodesRes.error) console.error(`[watch/${slug}] episodes query failed:`, episodesRes.error.message);
  if (sourcesRes.error) console.error(`[watch/${slug}] sources query failed:`, sourcesRes.error.message);
  const episodes = (episodesRes.data ?? []) as Episode[];
  const sources = (sourcesRes.data ?? []) as VideoSource[];
  const { data: { user } } = await supabase.auth.getUser();
  const progressRes = user
    ? await supabase.from("video_progress").select("episode_id, position_seconds, duration_seconds, completed_at, updated_at").eq("user_id", user.id).eq("title_id", title.id).order("updated_at", { ascending: false }).limit(100)
    : { data: [], error: null };
  if (progressRes.error) console.error(`[watch/${slug}] progress query failed:`, progressRes.error.message);
  const progress = (progressRes.data ?? []) as VideoProgress[];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader active="catalog" />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Link href={`/title/${title.slug}`} className="text-sm text-text-secondary transition hover:text-white">← К странице тайтла</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Просмотр</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title.name}</h1>
          </div>
          <span className="rounded-full border border-border-subtle px-3 py-1.5 text-xs text-text-muted">{sources.length ? `${sources.length} разрешённых источников` : "Источник не подключён"}</span>
        </div>

        {!videoTypes.includes(title.content_type) ? (
          <section className="mt-6 rounded-2xl border border-border-subtle bg-surface-1 p-6 sm:p-8">
            <h2 className="font-semibold">Для этого формата не нужен видеоплеер</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Открой страницу тайтла и перейди в подходящий режим чтения.</p>
            <Link href={`/title/${title.slug}`} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-semibold text-white hover:bg-violet-600">К тайтлу</Link>
          </section>
        ) : (
          <section className="mt-6 overflow-hidden rounded-2xl border border-border-subtle bg-surface-1">
            {sources.length > 0 ? (
              <VideoPlayback titleId={title.id} episodes={episodes} sources={sources} initialProgress={progress} canSaveProgress={Boolean(user)} initialEpisodeId={requestedId ?? null} />
            ) : <div className="flex aspect-video flex-col items-center justify-center bg-black px-6 text-center">
              <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-2xl text-text-muted">▶</div>
              <h2 className="mt-5 text-lg font-semibold">Видеоисточник пока не добавлен</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-text-secondary">Для этого тайтла ещё нет подключённого разрешённого источника. Когда он появится в каталоге, просмотр будет доступен здесь.</p>
            </div>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:px-5">
              <p className="text-sm text-text-muted">{episodes.length ? `${episodes.length} опубликованных серий` : "Воспроизведение доступно для опубликованных источников."}</p>
              <Link href={`/title/${title.slug}`} className="inline-flex min-h-10 items-center rounded-lg border border-border-subtle px-3 text-sm font-medium hover:bg-surface-2">Вернуться к тайтлу</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}


export default function WatchPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="min-h-screen animate-pulse bg-background"><div className="h-[68px] border-b border-border-subtle" /><div className="mx-auto mt-10 aspect-video max-w-6xl rounded-2xl bg-surface-1" /></main>}>
      <WatchContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

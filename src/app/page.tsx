import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { contentLabels } from "@/lib/catalog";
import { SiteHeader } from "@/components/site-header";
import { ContentCard } from "@/components/content-card";
import { ContentRow } from "@/components/content-row";
import { HeroSlider, type Banner } from "@/components/hero-slider";

const ROW_SIZE = 12;
const READ_TYPES = new Set(["manga", "manhwa", "manhua", "light_novel", "web_novel", "book"]);
const titleHref = (slug: string) => `/title/${slug}`;
const COLS = "id, name, slug, description, cover_url, content_type, release_year";

type CatalogTitle = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  content_type: string;
  release_year: number | null;
};

type BannerRow = CatalogTitle & { banner_url: string };
type TitleLite = { id: string; name: string; slug: string; cover_url: string | null };
type EpisodeRow = { id: string; episode_number: number };
type ChapterRow = { id: string; chapter_label: string };

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

type ContinueItem = { href: string; name: string; cover_url: string | null; label: string; percent: number };

type Home = {
  banners: Banner[];
  continueItems: ContinueItem[];
  fresh: CatalogTitle[];
  popular: CatalogTitle[];
  anime: CatalogTitle[];
  manga: CatalogTitle[];
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

const EMPTY: Home = { banners: [], continueItems: [], fresh: [], popular: [], anime: [], manga: [] };

async function rows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const { data, error } = await query;
  if (error) console.error("SubReel query failed:", error.message);
  return data ?? [];
}

const ratio = (done: number, total: number | null) =>
  total && total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

async function loadContinue(supabase: Supabase, userId: string): Promise<ContinueItem[]> {
  const [video, reading] = await Promise.all([
    rows<VideoRow>(
      supabase
        .from("video_progress")
        .select("title_id, episode_id, position_seconds, duration_seconds, completed_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(30)
    ),
    rows<ReadingRow>(
      supabase
        .from("reading_progress")
        .select("title_id, chapter_id, current_page, total_pages, completed_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(30)
    ),
  ]);

  const entries = [
    ...video.map((r) => ({
      kind: "video" as const,
      titleId: r.title_id,
      unitId: r.episode_id,
      percent: ratio(r.position_seconds, r.duration_seconds),
      done: Boolean(r.completed_at),
      updatedAt: Date.parse(r.updated_at),
    })),
    ...reading.map((r) => ({
      kind: "read" as const,
      titleId: r.title_id,
      unitId: r.chapter_id,
      percent: ratio(r.current_page, r.total_pages),
      done: Boolean(r.completed_at),
      updatedAt: Date.parse(r.updated_at),
    })),
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  // Последняя запись на тайтл; завершённые в «Продолжить» не нужны.
  const seen = new Set<string>();
  const picked = entries
    .filter((e) => {
      if (seen.has(e.titleId)) return false;
      seen.add(e.titleId);
      return true;
    })
    .filter((e) => !e.done)
    .slice(0, ROW_SIZE);
  if (picked.length === 0) return [];

  const unitIds = (kind: "video" | "read") =>
    picked.flatMap((e) => (e.kind === kind && e.unitId ? [e.unitId] : []));
  const episodeIds = unitIds("video");
  const chapterIds = unitIds("read");

  const [titles, episodes, chapters] = await Promise.all([
    rows<TitleLite>(
      supabase
        .from("titles")
        .select("id, name, slug, cover_url")
        .in("id", picked.map((e) => e.titleId))
        .eq("status", "published")
    ),
    episodeIds.length
      ? rows<EpisodeRow>(supabase.from("title_episodes").select("id, episode_number").in("id", episodeIds))
      : Promise.resolve<EpisodeRow[]>([]),
    chapterIds.length
      ? rows<ChapterRow>(supabase.from("title_chapters").select("id, chapter_label").in("id", chapterIds))
      : Promise.resolve<ChapterRow[]>([]),
  ]);

  const titleById = new Map(titles.map((t) => [t.id, t] as const));
  const episodeNo = new Map(episodes.map((e) => [e.id, e.episode_number] as const));
  const chapterLabel = new Map(chapters.map((c) => [c.id, c.chapter_label] as const));

  return picked.flatMap((e) => {
    const t = titleById.get(e.titleId);
    if (!t) return [];
    const isVideo = e.kind === "video";
    const no = isVideo && e.unitId ? episodeNo.get(e.unitId) : undefined;
    const label = isVideo
      ? no !== undefined
        ? `Серия ${Number(no)}`
        : "Продолжить просмотр"
      : (e.unitId && chapterLabel.get(e.unitId)) || "Продолжить чтение";
    return [
      {
        href: `${isVideo ? "/watch" : "/read"}/${t.slug}`,
        name: t.name,
        cover_url: t.cover_url,
        label,
        percent: e.percent,
      },
    ];
  });
}

async function loadHome(): Promise<Home> {
  const supabase = await createClient();
  const published = () => supabase.from("titles").select(COLS).eq("status", "published");
  const newest = { ascending: false } as const;

  const [bannerRows, fresh, popular, anime, manga, continueItems] = await Promise.all([
    rows<BannerRow>(
      supabase
        .from("titles")
        .select(`${COLS}, banner_url`)
        .eq("status", "published")
        .not("banner_url", "is", null)
        .order("created_at", newest)
        .limit(5)
    ),
    rows<CatalogTitle>(published().order("created_at", newest).limit(ROW_SIZE)),
    // Функция из supabase/sql/028_popular_titles.sql. Пока её нет, ряд просто скрыт.
    rows<CatalogTitle>(supabase.rpc("popular_titles", { limit_count: ROW_SIZE })),
    rows<CatalogTitle>(published().eq("content_type", "anime").order("created_at", newest).limit(ROW_SIZE)),
    rows<CatalogTitle>(published().eq("content_type", "manga").order("created_at", newest).limit(ROW_SIZE)),
    supabase.auth
      .getUser()
      .then(({ data }) => (data.user ? loadContinue(supabase, data.user.id) : [])),
  ]);

  const banners: Banner[] = bannerRows.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    image: b.banner_url,
    href: titleHref(b.slug),
    badge: [contentLabels[b.content_type] ?? b.content_type, b.release_year].filter(Boolean).join(" · "),
    cta: READ_TYPES.has(b.content_type) ? "Читать" : "Смотреть",
  }));

  return { banners, continueItems, fresh, popular, anime, manga };
}

const Slot = ({ children }: { children: ReactNode }) => (
  <div className="w-36 shrink-0 snap-start sm:w-44">{children}</div>
);

function TitleRow({ heading, href, titles }: { heading: string; href: string; titles: CatalogTitle[] }) {
  if (titles.length === 0) return null;
  return (
    <ContentRow title={heading} href={href}>
      {titles.map((t) => (
        <Slot key={t.id}>
          <ContentCard title={t} />
        </Slot>
      ))}
    </ContentRow>
  );
}

function ContinueCard({ item }: { item: ContinueItem }) {
  return (
    <Link href={item.href} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-[#111119]">
        {item.cover_url && (
          <img
            src={item.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-10">
          <p className="text-xs font-medium text-zinc-200">{item.label}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-violet-400" style={{ width: `${item.percent}%` }} />
          </div>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium leading-5">{item.name}</p>
    </Link>
  );
}

async function HomeContent() {
  await connection();

  let data = EMPTY;
  try {
    data = await loadHome();
  } catch (error) {
    unstable_rethrow(error);
    console.error("SubReel home is unavailable:", error);
  }

  const { banners, continueItems, fresh, popular, anime, manga } = data;
  const isEmpty = !banners.length && !fresh.length && !popular.length && !anime.length && !manga.length;

  return (
    <main className="min-h-screen bg-[#09090d] text-white">
      <SiteHeader active="home" />

      {banners.length > 0 && <HeroSlider banners={banners} />}

      <div className="pb-8 pt-3">
        {continueItems.length > 0 && (
          <ContentRow title="Продолжить">
            {continueItems.map((item) => (
              <Slot key={item.href}>
                <ContinueCard item={item} />
              </Slot>
            ))}
          </ContentRow>
        )}

        <TitleRow heading="Новинки" href="/catalog" titles={fresh} />
        <TitleRow heading="Популярное" href="/catalog" titles={popular} />
        <TitleRow heading="Аниме" href="/catalog?type=anime" titles={anime} />
        <TitleRow heading="Манга" href="/catalog?type=manga" titles={manga} />

        {isEmpty && (
          <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
              <h2 className="text-xl font-semibold">Здесь начнётся твоя следующая история</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-400">
                Опубликованных тайтлов пока нет, либо каталог недоступен. Проверь подключение Supabase
                и таблицу titles — детали ошибки в терминале.
              </p>
            </div>
          </section>
        )}
      </div>

      <footer className="mx-auto max-w-7xl border-t border-white/[0.06] px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="font-bold text-zinc-300">
            Sub<span className="text-violet-400">Reel</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" aria-label="The Movie Database (TMDB)">
              <img
                src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
                alt="The Movie Database (TMDB)"
                className="h-auto w-14"
              />
            </a>
            <p className="max-w-xs text-xs leading-5 text-zinc-500">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#09090d] text-white">
          <div className="mx-auto max-w-7xl px-5 pt-5 sm:px-8">
            <div className="h-[320px] animate-pulse rounded-3xl bg-white/[0.04] sm:h-[400px] lg:h-[480px]" />
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

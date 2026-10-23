import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { ContentCard } from "@/components/content-card";
import { ContentRow } from "@/components/content-row";
import { HeroSlider, type Banner } from "@/components/hero-slider";

/* ───────── Настройки: поправь под свою схему ───────── */
const POPULAR_COLUMN = "views_count"; // колонка в titles, по которой считаем популярность
const ROW_SIZE = 12;
const titleHref = (slug: string) => `/titles/${slug}`;
const TYPE_LABELS: Record<string, string> = {
  anime: "Аниме",
  manga: "Манга",
  manhwa: "Манхва",
  ranobe: "Ранобэ",
  movie: "Фильм",
  series: "Сериал",
  dorama: "Дорама",
  cartoon: "Мультфильм",
  book: "Книга",
};
const READ_TYPES = new Set(["manga", "manhwa", "ranobe", "webnovel", "book"]);
/* ──────────────────────────────────────────────────── */

const COLS = "id, name, slug, description, cover_url, content_type, release_year";
const PROGRESS_SELECT = "*, titles(name, slug, cover_url)";

type CatalogTitle = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  content_type: string;
  release_year: number | null;
};

type BannerRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string;
  content_type: string;
  release_year: number | null;
};

type ProgressRow = {
  updated_at: string;
  titles: { name: string; slug: string; cover_url: string | null } | null;
  [key: string]: unknown;
};

type ContinueItem = {
  name: string;
  slug: string;
  cover_url: string | null;
  label: string;
  percent: number;
  updatedAt: string;
};

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

const num = (v: unknown) => (typeof v === "number" ? v : 0);
const percent = (done: unknown, total: unknown) =>
  num(total) > 0 ? Math.min(100, Math.round((num(done) / num(total)) * 100)) : 0;

async function loadContinue(supabase: Supabase, userId: string): Promise<ContinueItem[]> {
  const latest = (table: string) =>
    rows<ProgressRow>(
      supabase
        .from(table)
        .select(PROGRESS_SELECT)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20)
    );

  const [video, reading] = await Promise.all([latest("video_progress"), latest("reading_progress")]);

  const toItem = (r: ProgressRow, isVideo: boolean): ContinueItem | null => {
    if (!r.titles) return null;
    const n = isVideo ? r.episode_number : r.chapter_number;
    return {
      ...r.titles,
      label: `${isVideo ? "Серия" : "Глава"}${n ? ` ${n}` : ""}`,
      percent: isVideo
        ? percent(r.progress_seconds, r.duration_seconds)
        : percent(r.page, r.total_pages),
      updatedAt: r.updated_at,
    };
  };

  const seen = new Set<string>();
  return [...video.map((r) => toItem(r, true)), ...reading.map((r) => toItem(r, false))]
    .filter((i): i is ContinueItem => i !== null && i.percent < 95)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((i) => {
      if (seen.has(i.slug)) return false;
      seen.add(i.slug);
      return true;
    })
    .slice(0, ROW_SIZE);
}

async function loadHome(): Promise<Home> {
  const supabase = await createClient();
  const published = () => supabase.from("titles").select(COLS).eq("status", "published");
  const newest = { ascending: false } as const;

  const [bannerRows, fresh, popular, anime, manga, continueItems] = await Promise.all([
    rows<BannerRow>(
      supabase
        .from("titles")
        .select("id, name, slug, description, banner_url, content_type, release_year")
        .eq("status", "published")
        .not("banner_url", "is", null)
        .order("created_at", newest)
        .limit(5)
    ),
    rows<CatalogTitle>(published().order("created_at", newest).limit(ROW_SIZE)),
    rows<CatalogTitle>(
      published().order(POPULAR_COLUMN, { ascending: false, nullsFirst: false }).limit(ROW_SIZE)
    ),
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
    badge: [TYPE_LABELS[b.content_type] ?? b.content_type, b.release_year].filter(Boolean).join(" · "),
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
    <Link href={titleHref(item.slug)} className="group block">
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
              <Slot key={item.slug}>
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

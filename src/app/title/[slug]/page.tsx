import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { notFound, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { LibraryControl } from "@/components/library-control";
import { TitleReviews, type ReviewItem } from "@/components/title-reviews";
import { TitleHero, type Cta } from "@/components/title/title-hero";
import { TitleTabs, type TabItem } from "@/components/title/title-tabs";
import {
  EpisodesPanel,
  type ChapterItem,
  type EditionItem,
  type EpisodeItem,
  type SeasonItem,
  type VolumeItem,
} from "@/components/title/episodes-panel";
import { RelatedPanel, type RelationItem, type TitleBrief } from "@/components/title/related-panel";
import { ReportForm } from "@/app/reports/report-form";
import type { LibraryStatus } from "@/app/progress/actions";
import { contentLabels, firstOf, incomingRelationLabels, outgoingRelationLabels } from "@/lib/catalog";

type Params = Promise<{ slug: string }>;

type TitleRow = {
  id: string;
  franchise_id: string | null;
  name: string;
  original_name: string | null;
  slug: string;
  description: string | null;
  cover_url: string | null;
  banner_url: string | null;
  content_type: string;
  release_year: number | null;
};

type LibraryEntry = { status: LibraryStatus; is_favorite: boolean };
type TitleReviewRow = { id: string; user_id: string; rating: number; body: string; is_public: boolean; created_at: string };
type ReviewProfile = { id: string; username: string | null; display_name: string | null; is_public: boolean };
type ProgressItem = { unitId: string | null; completed: boolean };

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BRIEF = "name, slug, content_type, release_year, cover_url";
const VIDEO_TYPES = ["anime", "movie", "series", "drama", "cartoon"];
const READING_TYPES = ["manga", "manhwa", "manhua", "light_novel", "web_novel", "book"];
const NONE = { data: [], error: null };

async function loadTitle(slug: string) {
  const supabase = await createClient();

  const { data: title, error } = await supabase
    .from("titles")
    .select("id, franchise_id, name, original_name, slug, description, cover_url, banner_url, content_type, release_year")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw new Error(`titles query failed: ${error.message}`);
  if (!title) return null;

  const row = title as TitleRow;
  const isVideo = VIDEO_TYPES.includes(row.content_type);
  const isReading = READING_TYPES.includes(row.content_type);
  const { data: { user } } = await supabase.auth.getUser();

  const [genresRes, outRes, inRes, franchiseRes, siblingsRes, seasonsRes, episodesRes, editionsRes, volumesRes, chaptersRes, libraryRes, reviewsRes, reviewStatsRes, progressRes, sourcesRes] =
    await Promise.all([
      supabase.from("title_genres").select("genres(name, slug)").eq("title_id", row.id),
      supabase
        .from("title_relationships")
        .select(`relationship_type, target:titles!title_relationships_target_title_id_fkey(${BRIEF})`)
        .eq("source_title_id", row.id),
      supabase
        .from("title_relationships")
        .select(`relationship_type, source:titles!title_relationships_source_title_id_fkey(${BRIEF})`)
        .eq("target_title_id", row.id),
      row.franchise_id
        ? supabase.from("franchises").select("name, slug").eq("id", row.franchise_id).eq("status", "published").maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      row.franchise_id
        ? supabase
            .from("titles")
            .select(BRIEF)
            .eq("franchise_id", row.franchise_id)
            .eq("status", "published")
            .neq("id", row.id)
            .order("release_year", { ascending: true, nullsFirst: false })
            .limit(12)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("title_seasons").select("id, season_number, name").eq("title_id", row.id).eq("status", "published").order("season_number"),
      supabase.from("title_episodes").select("id, season_id, episode_number, name").eq("title_id", row.id).eq("status", "published").order("sort_order"),
      supabase.from("title_editions").select("id, edition_kind, edition_number, name, language_code").eq("title_id", row.id).eq("status", "published").order("edition_number"),
      supabase.from("title_volumes").select("id, edition_id, volume_number, name").eq("title_id", row.id).eq("status", "published").order("volume_number"),
      supabase.from("title_chapters").select("id, edition_id, volume_id, chapter_number, chapter_label, name, sort_order").eq("title_id", row.id).eq("status", "published").order("sort_order"),
      user
        ? supabase.from("user_library").select("status, is_favorite").eq("user_id", user.id).eq("title_id", row.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("title_reviews").select("id,user_id,rating,body,is_public,created_at").eq("title_id", row.id).order("created_at", { ascending: false }).limit(100),
      supabase.rpc("title_review_stats", { target_title_id: row.id }),
      // Последняя серия/глава пользователя: от неё зависит подпись главной кнопки.
      user && isVideo
        ? supabase.from("video_progress").select("episode_id, completed_at").eq("user_id", user.id).eq("title_id", row.id).order("updated_at", { ascending: false }).limit(500)
        : user && isReading
          ? supabase.from("reading_progress").select("chapter_id, completed_at").eq("user_id", user.id).eq("title_id", row.id).order("updated_at", { ascending: false }).limit(500)
          : Promise.resolve(NONE),
      // Есть ли вообще источник: без него кнопка «Смотреть/Читать» будет неактивной.
      isVideo
        ? supabase.from("video_sources").select("episode_id").eq("title_id", row.id).limit(2000)
        : isReading
          ? supabase.from("reading_sources").select("chapter_id").eq("title_id", row.id).limit(5000)
          : Promise.resolve(NONE),
    ]);

  const reviewRows = (reviewsRes.data ?? []) as TitleReviewRow[];
  const reviewUserIds = [...new Set(reviewRows.filter((review) => review.is_public).map((review) => review.user_id))];
  const profilesRes = reviewUserIds.length > 0
    ? await supabase.from("profiles").select("id,username,display_name,is_public").in("id", reviewUserIds)
    : { data: [], error: null };
  const reviewProfiles = new Map(((profilesRes.data ?? []) as ReviewProfile[]).map((profile) => [profile.id, profile]));
  const publicReviews: ReviewItem[] = reviewRows
    .filter((review) => review.is_public && reviewProfiles.get(review.user_id)?.is_public)
    .map((review) => {
      const profile = reviewProfiles.get(review.user_id);
      const showIdentity = profile?.is_public === true;
      return {
        id: review.id,
        userId: review.user_id,
        name: showIdentity ? profile.display_name || profile.username || "Пользователь" : "Анонимный читатель",
        rating: review.rating,
        body: review.body,
        createdAt: review.created_at,
      };
    });
  const ownReview = user ? reviewRows.find((review) => review.user_id === user.id) : undefined;

  // Второстепенные блоки не должны ронять страницу целиком.
  for (const [name, res] of [
    ["genres", genresRes],
    ["relations_out", outRes],
    ["relations_in", inRes],
    ["franchise", franchiseRes],
    ["siblings", siblingsRes],
    ["seasons", seasonsRes],
    ["episodes", episodesRes],
    ["editions", editionsRes],
    ["volumes", volumesRes],
    ["chapters", chaptersRes],
    ["library", libraryRes],
    ["reviews", reviewsRes],
    ["review_stats", reviewStatsRes],
    ["progress", progressRes],
    ["sources", sourcesRes],
  ] as const) {
    if (res.error) console.error(`[title/${slug}] ${name} failed:`, res.error.message);
  }

  const genres = ((genresRes.data ?? []) as { genres: unknown }[])
    .map((g) => firstOf(g.genres as { name: string; slug: string } | null))
    .filter((g): g is { name: string; slug: string } => g !== null);

  const relations: RelationItem[] = [];
  for (const r of (outRes.data ?? []) as { relationship_type: string; target: TitleBrief | TitleBrief[] | null }[]) {
    const t = firstOf(r.target);
    if (t) relations.push({ label: outgoingRelationLabels[r.relationship_type] ?? r.relationship_type, title: t });
  }
  for (const r of (inRes.data ?? []) as { relationship_type: string; source: TitleBrief | TitleBrief[] | null }[]) {
    const t = firstOf(r.source);
    if (t) relations.push({ label: incomingRelationLabels[r.relationship_type] ?? r.relationship_type, title: t });
  }

  const progress: ProgressItem[] = (
    (progressRes.data ?? []) as unknown as { episode_id?: string | null; chapter_id?: string | null; completed_at: string | null }[]
  ).map((p) => ({ unitId: p.episode_id ?? p.chapter_id ?? null, completed: Boolean(p.completed_at) }));

  const sourceRows = (sourcesRes.data ?? []) as unknown as { episode_id?: string | null; chapter_id?: string | null }[];
  const sourceUnitIds = new Set(
    sourceRows.map((s) => s.episode_id ?? s.chapter_id).filter((id): id is string => Boolean(id))
  );

  return {
    title: row,
    isVideo,
    isReading,
    genres,
    relations,
    franchise: (franchiseRes.data ?? null) as { name: string; slug: string } | null,
    siblings: (siblingsRes.data ?? []) as TitleBrief[],
    seasons: (seasonsRes.data ?? []) as SeasonItem[],
    episodes: (episodesRes.data ?? []) as EpisodeItem[],
    editions: (editionsRes.data ?? []) as EditionItem[],
    volumes: (volumesRes.data ?? []) as VolumeItem[],
    chapters: (chaptersRes.data ?? []) as ChapterItem[],
    signedIn: Boolean(user),
    libraryEntry: (libraryRes.data ?? null) as LibraryEntry | null,
    progress,
    sourceUnitIds,
    hasSources: sourceRows.length > 0,
    ownReview: ownReview ? { rating: ownReview.rating, body: ownReview.body, isPublic: ownReview.is_public } : null,
    publicReviews,
    reviewAverage: Number((reviewStatsRes.data?.[0] as { average_rating: number | string } | undefined)?.average_rating ?? 0),
    reviewCount: Number((reviewStatsRes.data?.[0] as { review_count: number | string } | undefined)?.review_count ?? 0),
    reviewsAvailable: !reviewsRes.error && !reviewStatsRes.error,
  };
}

type LoadedTitle = NonNullable<Awaited<ReturnType<typeof loadTitle>>>;

/**
 * Подпись главной кнопки повторяет выбор плеера/читалки: они открывают последнюю
 * серию/главу из прогресса, а без прогресса — первую, у которой есть источник.
 * Поэтому «Читать с главы N» всегда совпадает с тем, что реально откроется.
 */
function buildCta(d: LoadedTitle): Cta | null {
  if (!d.isVideo && !d.isReading) return null;
  const href = `${d.isVideo ? "/watch" : "/read"}/${d.title.slug}`;
  const icon = d.isVideo ? ("play" as const) : ("book" as const);

  if (!d.hasSources) {
    return { href, icon, disabled: true, label: d.isVideo ? "Смотреть" : "Читать", note: "Источник пока не подключён" };
  }

  const last = d.progress[0];
  if (d.isVideo) {
    const episode = last?.unitId ? d.episodes.find((e) => e.id === last.unitId) : undefined;
    if (episode) return { href, icon, disabled: false, label: `Продолжить с серии ${episode.episode_number}` };
    if (last) return { href, icon, disabled: false, label: "Продолжить просмотр" };
    return { href, icon, disabled: false, label: "Смотреть" };
  }

  const ordered = [...d.chapters].sort((a, b) => a.sort_order - b.sort_order);
  const resume = last?.unitId ? ordered.find((c) => c.id === last.unitId) : undefined;
  if (resume) return { href, icon, disabled: false, label: `Продолжить с главы ${resume.chapter_label}` };
  const first = ordered.find((c) => d.sourceUnitIds.has(c.id));
  return { href, icon, disabled: false, label: first ? `Читать с главы ${first.chapter_label}` : "Читать" };
}

function DescriptionPanel({
  title,
  franchise,
  unitCount,
  unitLabel,
}: {
  title: TitleRow;
  franchise: { name: string; slug: string } | null;
  unitCount: number;
  unitLabel: string | null;
}) {
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Формат", value: contentLabels[title.content_type] ?? title.content_type },
  ];
  if (title.release_year) facts.push({ label: "Год выхода", value: title.release_year });
  if (title.original_name && title.original_name !== title.name) facts.push({ label: "Оригинал", value: title.original_name });
  if (unitLabel && unitCount > 0) facts.push({ label: unitLabel, value: unitCount });
  if (franchise) {
    facts.push({
      label: "Франшиза",
      value: (
        <Link href={`/franchise/${franchise.slug}`} className="text-accent transition hover:brightness-125">
          {franchise.name}
        </Link>
      ),
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        {title.description ? (
          <p className="max-w-[68ch] whitespace-pre-line text-base leading-8 text-text-secondary">{title.description}</p>
        ) : (
          <p className="text-sm text-text-muted">Описание пока не добавлено.</p>
        )}
      </div>
      <aside className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 rounded-2xl border border-border-subtle bg-surface-1 p-5 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-text-muted">{fact.label}</dt>
              <dd className="min-w-0 break-words text-right">{fact.value}</dd>
            </div>
          ))}
        </dl>
        <ReportForm target={{ type: "title", id: title.id }} />
      </aside>
    </div>
  );
}

async function TitleContent({ params }: { params: Params }) {
  await connection();
  const { slug } = await params;

  if (!SLUG_RE.test(slug)) notFound();

  let data: Awaited<ReturnType<typeof loadTitle>>;
  try {
    data = await loadTitle(slug);
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[title/${slug}] load failed:`, error);
    return (
      <main className="min-h-screen bg-background px-5 py-16 text-foreground sm:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-warning/20 bg-warning/5 p-8">
          <h1 className="font-semibold text-warning">Не удалось загрузить страницу</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Попробуй обновить страницу чуть позже.</p>
          <Link href="/" className="mt-5 inline-block text-sm text-accent hover:brightness-125">
            ← На главную
          </Link>
        </div>
      </main>
    );
  }

  if (!data) notFound();

  const { title, isVideo, isReading, genres, relations, franchise, siblings, seasons, episodes, editions, volumes, chapters, signedIn, libraryEntry, progress } = data;
  const hasUnits = (isVideo && title.content_type !== "movie") || isReading;
  const unitCount = isVideo ? episodes.length : chapters.length;
  const currentId = progress[0]?.unitId ?? null;
  const done = new Set(progress.filter((p) => p.completed && p.unitId).map((p) => p.unitId as string));

  const tabs: TabItem[] = [
    {
      id: "description",
      label: "Описание",
      content: (
        <DescriptionPanel
          title={title}
          franchise={franchise}
          unitCount={unitCount}
          unitLabel={hasUnits ? (isVideo ? "Серий" : "Глав") : null}
        />
      ),
    },
    ...(hasUnits
      ? [
          {
            id: "episodes",
            label: isVideo ? "Серии" : "Главы",
            count: unitCount,
            content: (
              <EpisodesPanel
                slug={title.slug}
                isVideo={isVideo}
                seasons={seasons}
                episodes={episodes}
                editions={editions}
                volumes={volumes}
                chapters={chapters}
                done={done}
                currentId={currentId}
              />
            ),
          },
        ]
      : []),
    {
      id: "reviews",
      label: "Отзывы",
      count: data.reviewCount,
      content: (
        <TitleReviews
          titleId={title.id}
          slug={title.slug}
          signedIn={signedIn}
          initialReview={data.ownReview}
          reviews={data.publicReviews}
          average={data.reviewAverage}
          count={data.reviewCount}
          available={data.reviewsAvailable}
        />
      ),
    },
    {
      id: "related",
      label: "Связанное",
      count: relations.length + siblings.length,
      content: <RelatedPanel relations={relations} siblings={siblings} franchise={franchise} />,
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader active="catalog" />
      <TitleHero
        title={title}
        genres={genres}
        franchise={franchise}
        rating={{ average: data.reviewAverage, count: data.reviewCount }}
        cta={buildCta(data)}
        actions={
          <LibraryControl
            titleId={title.id}
            slug={title.slug}
            signedIn={signedIn}
            initialStatus={libraryEntry?.status ?? null}
            initialFavorite={libraryEntry?.is_favorite ?? false}
          />
        }
      />
      <div className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
        <TitleTabs tabs={tabs} />
      </div>
    </main>
  );
}

export default function TitlePage({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background p-8 text-foreground">
          <p className="animate-pulse text-sm text-text-secondary">Загружаем тайтл...</p>
        </main>
      }
    >
      <TitleContent params={params} />
    </Suspense>
  );
}

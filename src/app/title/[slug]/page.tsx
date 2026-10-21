import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { notFound, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { LibraryControl } from "@/components/library-control";
import type { LibraryStatus } from "@/app/progress/actions";
import {
  contentLabels,
  coverBackground,
  firstOf,
  incomingRelationLabels,
  outgoingRelationLabels,
} from "@/lib/catalog";

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

type TitleBrief = {
  name: string;
  slug: string;
  content_type: string;
  release_year: number | null;
  cover_url: string | null;
};

type RelationItem = { label: string; title: TitleBrief };
type SeasonItem = { id: string; season_number: number; name: string | null };
type EpisodeItem = { id: string; season_id: string | null; episode_number: number; name: string | null };
type EditionItem = { id: string; edition_kind: string; edition_number: number; name: string; language_code: string | null };
type VolumeItem = { id: string; edition_id: string | null; volume_number: number; name: string | null };
type ChapterItem = { id: string; edition_id: string | null; volume_id: string | null; chapter_number: number | null; chapter_label: string; name: string | null; sort_order: number };
type LibraryEntry = { status: LibraryStatus; is_favorite: boolean };


const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BRIEF = "name, slug, content_type, release_year, cover_url";

async function loadTitle(slug: string) {
  const supabase = await createClient();

  const { data: title, error } = await supabase
    .from("titles")
    .select(
      "id, franchise_id, name, original_name, slug, description, cover_url, banner_url, content_type, release_year"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw new Error(`titles query failed: ${error.message}`);
  if (!title) return null;

  const row = title as TitleRow;
  const { data: { user } } = await supabase.auth.getUser();

  const [genresRes, outRes, inRes, franchiseRes, siblingsRes, seasonsRes, episodesRes, editionsRes, volumesRes, chaptersRes, libraryRes] =
    await Promise.all([
      supabase
        .from("title_genres")
        .select("genres(name, slug)")
        .eq("title_id", row.id),
      supabase
        .from("title_relationships")
        .select(
          `relationship_type, target:titles!title_relationships_target_title_id_fkey(${BRIEF})`
        )
        .eq("source_title_id", row.id),
      supabase
        .from("title_relationships")
        .select(
          `relationship_type, source:titles!title_relationships_source_title_id_fkey(${BRIEF})`
        )
        .eq("target_title_id", row.id),
      row.franchise_id
        ? supabase
            .from("franchises")
            .select("name, slug")
            .eq("id", row.franchise_id)
            .eq("status", "published")
            .maybeSingle()
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
    ]);

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
  ] as const) {
    if (res.error) console.error(`[title/${slug}] ${name} failed:`, res.error.message);
  }

  const genres = ((genresRes.data ?? []) as { genres: unknown }[])
    .map((g) => firstOf(g.genres as { name: string; slug: string } | null))
    .filter((g): g is { name: string; slug: string } => g !== null);

  const relations: RelationItem[] = [];
  for (const r of (outRes.data ?? []) as {
    relationship_type: string;
    target: TitleBrief | TitleBrief[] | null;
  }[]) {
    const t = firstOf(r.target);
    if (t) {
      relations.push({
        label: outgoingRelationLabels[r.relationship_type] ?? r.relationship_type,
        title: t,
      });
    }
  }
  for (const r of (inRes.data ?? []) as {
    relationship_type: string;
    source: TitleBrief | TitleBrief[] | null;
  }[]) {
    const t = firstOf(r.source);
    if (t) {
      relations.push({
        label: incomingRelationLabels[r.relationship_type] ?? r.relationship_type,
        title: t,
      });
    }
  }

  return {
    title: row,
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
  };
}

function ChapterList({ chapters }: { chapters: ChapterItem[] }) {
  return (
    <ol className="mt-3 grid gap-2 sm:grid-cols-2">
      {chapters.map((chapter) => (
        <li key={chapter.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <span className="text-xs text-zinc-400">Глава {chapter.chapter_label}</span>
          {chapter.name && <p className="mt-1 font-medium">{chapter.name}</p>}
        </li>
      ))}
    </ol>
  );
}

function MiniCard({ title, caption }: { title: TitleBrief; caption?: string }) {
  return (
    <Link
      href={`/title/${title.slug}`}
      className="group flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition hover:border-violet-400/40 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
    >
      <div className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-violet-950 via-[#171321] to-[#0e0e14]">
        {title.cover_url && (
          <div
            role="img"
            aria-label={`Обложка: ${title.name}`}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: coverBackground(title.cover_url) }}
          />
        )}
      </div>
      <div className="min-w-0 py-1">
        {caption && <p className="text-xs text-violet-300">{caption}</p>}
        <p className="mt-1 line-clamp-2 font-semibold transition group-hover:text-violet-300">
          {title.name}
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {contentLabels[title.content_type] ?? title.content_type}
          {title.release_year ? `, ${title.release_year}` : ""}
        </p>
      </div>
    </Link>
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
      <main className="min-h-screen bg-[#09090d] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-8">
          <h1 className="font-semibold text-amber-200">
            Не удалось загрузить страницу
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Попробуй обновить страницу чуть позже.
          </p>
          <Link href="/" className="mt-5 inline-block text-sm text-violet-300 hover:text-violet-200">
            ← На главную
          </Link>
        </div>
      </main>
    );
  }

  if (!data) notFound();

  const { title, genres, relations, franchise, siblings, seasons, episodes, editions, volumes, chapters, signedIn, libraryEntry } = data;
  const isVideo = ["anime", "movie", "series", "drama", "cartoon"].includes(title.content_type);
  const isReading = ["manga", "manhwa", "manhua", "light_novel", "web_novel", "book"].includes(title.content_type);
  const heroImage = title.banner_url ?? title.cover_url;

  return (
    <main className="min-h-screen bg-[#09090d] text-white">
      <SiteHeader active="catalog" />

      <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
        {heroImage && (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 scale-110 bg-cover bg-center opacity-25 blur-2xl"
            style={{ backgroundImage: coverBackground(heroImage) }}
          />
        )}
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[240px_1fr] md:py-16">
          <div className="relative mx-auto aspect-[3/4] w-48 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-950 via-[#171321] to-[#0e0e14] md:w-full">
            {title.cover_url ? (
              <div
                role="img"
                aria-label={`Обложка: ${title.name}`}
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: coverBackground(title.cover_url) }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white/25">
                SubReel
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-zinc-300">
              {contentLabels[title.content_type] ?? title.content_type}
              {title.release_year ? `, ${title.release_year}` : ""}
              {franchise ? (
                <>
                  {" · "}
                  <Link href={`/franchise/${franchise.slug}`} className="text-accent transition hover:text-violet-200">
                    Франшиза «{franchise.name}»
                  </Link>
                </>
              ) : ""}
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              {title.name}
            </h1>
            {title.original_name && title.original_name !== title.name && (
              <p className="mt-2 text-base text-zinc-400">{title.original_name}</p>
            )}

            {genres.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {genres.map((g) => (
                  <li
                    key={g.slug}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300"
                  >
                    {g.name}
                  </li>
                ))}
              </ul>
            )}

            {title.description ? (
              <p className="mt-6 max-w-2xl whitespace-pre-line text-sm leading-7 text-zinc-300">
                {title.description}
              </p>
            ) : (
              <p className="mt-6 text-sm text-zinc-500">Описание пока не добавлено.</p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {["anime", "movie", "series", "drama", "cartoon"].includes(title.content_type) && (
                <Link
                  href={`/watch/${title.slug}`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-violet-500 px-5 text-sm font-semibold transition hover:bg-violet-400"
                >
                  Открыть просмотр
                </Link>
              )}
              {["manga", "manhwa", "manhua", "light_novel", "web_novel", "book"].includes(title.content_type) && (
                <Link
                  href={`/read/${title.slug}`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-violet-500 px-5 text-sm font-semibold transition hover:bg-violet-400"
                >
                  Открыть читалку
                </Link>
              )}
            </div>
            <LibraryControl titleId={title.id} slug={title.slug} signedIn={signedIn} initialStatus={libraryEntry?.status ?? null} initialFavorite={libraryEntry?.is_favorite ?? false} />
          </div>
        </div>
      </section>

      {((isVideo && title.content_type !== "movie") || isReading) && (
        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <h2 className="text-2xl font-bold tracking-tight">
            {isVideo ? "Сезоны и серии" : "Издания и главы"}
          </h2>

          {isVideo && episodes.length === 0 && (
            <p className="mt-4 text-sm text-zinc-400">Серии пока не добавлены.</p>
          )}
          {isVideo && seasons.map((season) => {
            const seasonEpisodes = episodes.filter((episode) => episode.season_id === season.id);
            return (
              <div key={season.id} className="mt-6">
                <h3 className="font-semibold text-violet-200">
                  {season.name || `Сезон ${season.season_number}`}
                </h3>
                {seasonEpisodes.length > 0 ? (
                  <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                    {seasonEpisodes.map((episode) => (
                      <li key={episode.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                        <span className="text-xs text-zinc-400">Серия {episode.episode_number}</span>
                        {episode.name && <p className="mt-1 font-medium">{episode.name}</p>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">Серии пока не добавлены.</p>
                )}
              </div>
            );
          })}
          {isVideo && episodes.some((episode) => episode.season_id === null) && (
            <div className="mt-6">
              {seasons.length > 0 && <h3 className="font-semibold text-violet-200">Без сезона</h3>}
              <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                {episodes.filter((episode) => episode.season_id === null).map((episode) => (
                  <li key={episode.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <span className="text-xs text-zinc-400">Серия {episode.episode_number}</span>
                    {episode.name && <p className="mt-1 font-medium">{episode.name}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {isReading && editions.length === 0 && chapters.length === 0 && volumes.length === 0 && (
            <p className="mt-4 text-sm text-zinc-400">Главы пока не добавлены.</p>
          )}
          {isReading && editions.map((edition) => {
            const editionVolumes = volumes.filter((volume) => volume.edition_id === edition.id);
            const editionChapters = chapters.filter((chapter) => chapter.edition_id === edition.id && chapter.volume_id === null);
            return (
              <div key={edition.id} className="mt-6">
                <h3 className="font-semibold text-violet-200">{edition.name}</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {edition.edition_kind === "graphic" ? "Графическое издание" : "Текстовое издание"}
                  {edition.language_code ? ` · ${edition.language_code}` : ""}
                </p>
                {editionVolumes.map((volume) => {
                  const volumeChapters = chapters.filter((chapter) => chapter.volume_id === volume.id);
                  return (
                    <div key={volume.id} className="mt-4">
                      <h4 className="text-sm font-medium text-zinc-200">{volume.name || `Том ${volume.volume_number}`}</h4>
                      {volumeChapters.length > 0 && (
                        <ChapterList chapters={volumeChapters} />
                      )}
                    </div>
                  );
                })}
                {editionChapters.length > 0 && <ChapterList chapters={editionChapters} />}
              </div>
            );
          })}
          {isReading && volumes.some((volume) => volume.edition_id === null) && (
            <div className="mt-6">
              <h3 className="font-semibold text-violet-200">Тома</h3>
              {volumes.filter((volume) => volume.edition_id === null).map((volume) => (
                <div key={volume.id} className="mt-3">
                  <h4 className="text-sm font-medium">{volume.name || `Том ${volume.volume_number}`}</h4>
                  {chapters.some((chapter) => chapter.volume_id === volume.id) && (
                    <ChapterList chapters={chapters.filter((chapter) => chapter.volume_id === volume.id)} />
                  )}
                </div>
              ))}
            </div>
          )}
          {isReading && chapters.some((chapter) => chapter.edition_id === null && chapter.volume_id === null) && (
            <div className="mt-6">
              <h3 className="font-semibold text-violet-200">Главы</h3>
              <ChapterList chapters={chapters.filter((chapter) => chapter.edition_id === null && chapter.volume_id === null)} />
            </div>
          )}
        </section>
      )}

      {relations.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <h2 className="text-2xl font-bold tracking-tight">Связанные произведения</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relations.map((r) => (
              <MiniCard key={`${r.label}-${r.title.slug}`} title={r.title} caption={r.label} />
            ))}
          </div>
        </section>
      )}

      {siblings.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
          <h2 className="text-2xl font-bold tracking-tight">
            Ещё во франшизе{franchise ? ` «${franchise.name}»` : ""}
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {siblings.map((s) => (
              <MiniCard key={s.slug} title={s} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default function TitlePage({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#09090d] p-8 text-white">
          <p className="animate-pulse text-sm text-zinc-400">Загружаем тайтл...</p>
        </main>
      }
    >
      <TitleContent params={params} />
    </Suspense>
  );
}

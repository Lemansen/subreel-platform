import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContentCard, type CatalogCardTitle } from "@/components/content-card";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import { contentLabels } from "@/lib/catalog";

type SearchParams = Promise<{
  q?: string | string[];
  type?: string | string[];
  genre?: string | string[];
  year_from?: string | string[];
  year_to?: string | string[];
  sort?: string | string[];
  page?: string | string[];
}>;

const PAGE_SIZE = 24;
const CONTENT_TYPES = Object.keys(contentLabels);

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function safeSearch(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function readYear(value: string): number | null {
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 1800 && year <= 2200 ? year : null;
}

function pageHref(page: number, params: URLSearchParams) {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const query = next.toString();
  return query ? `/catalog?${query}` : "/catalog";
}

export const metadata = {
  title: "Каталог",
  description: "Ищи и открывай аниме, фильмы, сериалы, мангу и книги в SubReel.",
};

async function CatalogContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  const params = await searchParams;
  const rawQuery = one(params.q);
  const queryText = safeSearch(rawQuery);
  const type = one(params.type);
  const genreSlug = one(params.genre).toLowerCase();
  const yearFrom = readYear(one(params.year_from));
  const yearTo = readYear(one(params.year_to));
  const sort = ["newest", "title", "year"].includes(one(params.sort))
    ? one(params.sort)
    : "newest";
  const requestedPage = Number.parseInt(one(params.page), 10);
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), 10000)
    : 1;

  let titles: CatalogCardTitle[] = [];
  let genres: { id: string; name: string; slug: string }[] = [];
  let total = 0;
  let catalogError = false;

  try {
    const supabase = await createClient();
    const genresResult = await supabase
      .from("genres")
      .select("id, name, slug")
      .order("name");
    if (genresResult.error) throw genresResult.error;
    genres = genresResult.data ?? [];

    const selectedGenre = genres.find((genre) => genre.slug === genreSlug);
    const invalidGenre = genreSlug.length > 0 && !selectedGenre;

    if (!invalidGenre) {
      const selectFields = selectedGenre
        ? "id, name, slug, description, cover_url, content_type, release_year, title_genres!inner(genre_id)"
        : "id, name, slug, description, cover_url, content_type, release_year";
      let catalogQuery = supabase
        .from("titles")
        .select(selectFields, { count: "exact" })
        .eq("status", "published");

      if (CONTENT_TYPES.includes(type)) {
        catalogQuery = catalogQuery.eq("content_type", type);
      }
      if (queryText) {
        catalogQuery = catalogQuery.or(
          `name.ilike.%${queryText}%,original_name.ilike.%${queryText}%`
        );
      }
      if (yearFrom !== null) catalogQuery = catalogQuery.gte("release_year", yearFrom);
      if (yearTo !== null) catalogQuery = catalogQuery.lte("release_year", yearTo);
      if (selectedGenre) {
        catalogQuery = catalogQuery.eq("title_genres.genre_id", selectedGenre.id);
      }
      if (sort === "title") catalogQuery = catalogQuery.order("name");
      else if (sort === "year") {
        catalogQuery = catalogQuery.order("release_year", {
          ascending: false,
          nullsFirst: false,
        });
      } else catalogQuery = catalogQuery.order("created_at", { ascending: false });

      const start = (page - 1) * PAGE_SIZE;
      const result = await catalogQuery.range(start, start + PAGE_SIZE - 1);
      if (result.error) throw result.error;
      titles = (result.data ?? []) as unknown as CatalogCardTitle[];
      total = result.count ?? 0;
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("SubReel catalog page failed:", error);
    catalogError = true;
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentFilters = new URLSearchParams();
  if (queryText) currentFilters.set("q", queryText);
  if (CONTENT_TYPES.includes(type)) currentFilters.set("type", type);
  if (genres.some((genre) => genre.slug === genreSlug)) currentFilters.set("genre", genreSlug);
  if (yearFrom !== null) currentFilters.set("year_from", String(yearFrom));
  if (yearTo !== null) currentFilters.set("year_to", String(yearTo));
  if (sort !== "newest") currentFilters.set("sort", sort);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader active="catalog" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold text-accent">ИССЛЕДУЙ ВСЕЛЕННЫЕ</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Каталог</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Находи произведения и переходи между историями в одной франшизе.
          </p>
        </div>

        <form action="/catalog" className="grid gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="catalog-query" className="mb-1.5 block text-sm font-medium">Название</label>
            <input
              id="catalog-query"
              name="q"
              type="search"
              maxLength={100}
              defaultValue={queryText}
              placeholder="Название на русском или оригинальное"
              className="h-11 w-full rounded-xl border border-border-subtle bg-background px-3 text-sm outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="catalog-type" className="mb-1.5 block text-sm font-medium">Тип</label>
            <select id="catalog-type" name="type" defaultValue={CONTENT_TYPES.includes(type) ? type : ""} className="h-11 w-full rounded-xl border border-border-subtle bg-background px-3 text-sm">
              <option value="">Все типы</option>
              {CONTENT_TYPES.map((value) => <option key={value} value={value}>{contentLabels[value]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="catalog-genre" className="mb-1.5 block text-sm font-medium">Жанр</label>
            <select id="catalog-genre" name="genre" defaultValue={genres.some((genre) => genre.slug === genreSlug) ? genreSlug : ""} className="h-11 w-full rounded-xl border border-border-subtle bg-background px-3 text-sm">
              <option value="">Все жанры</option>
              {genres.map((genre) => <option key={genre.id} value={genre.slug}>{genre.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="catalog-year-from" className="mb-1.5 block text-sm font-medium">Год от</label>
            <input id="catalog-year-from" name="year_from" type="number" min="1800" max="2200" defaultValue={yearFrom ?? ""} className="h-11 w-full rounded-xl border border-border-subtle bg-background px-3 text-sm" />
          </div>
          <div>
            <label htmlFor="catalog-year-to" className="mb-1.5 block text-sm font-medium">Год до</label>
            <input id="catalog-year-to" name="year_to" type="number" min="1800" max="2200" defaultValue={yearTo ?? ""} className="h-11 w-full rounded-xl border border-border-subtle bg-background px-3 text-sm" />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label htmlFor="catalog-sort" className="text-sm text-text-secondary">Сортировка</label>
              <select id="catalog-sort" name="sort" defaultValue={sort} className="h-10 rounded-lg border border-border-subtle bg-background px-3 text-sm">
                <option value="newest">Недавно добавленные</option>
                <option value="title">По названию</option>
                <option value="year">Сначала новые по году</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Link href="/catalog" className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-medium transition hover:bg-surface-2">Сбросить</Link>
              <button type="submit" className="min-h-11 rounded-xl bg-accent-strong px-5 text-sm font-semibold text-white transition hover:bg-violet-600">Показать</button>
            </div>
          </div>
        </form>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary" aria-live="polite">
            {catalogError ? "Каталог временно недоступен" : `${total} ${total === 1 ? "произведение" : "произведений"}`}
          </p>
          {!catalogError && pageCount > 1 && <p className="text-sm text-text-muted">Страница {page} из {pageCount}</p>}
        </div>

        {catalogError ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-6 sm:p-8" role="alert">
            <h2 className="font-semibold text-amber-200">Не удалось загрузить каталог</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Фильтры сохранены. Попробуй обновить страницу чуть позже.</p>
            <Link href={pageHref(page, currentFilters)} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-medium hover:bg-surface-2">Повторить</Link>
          </div>
        ) : titles.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-6 py-14 text-center sm:py-20">
            <p className="text-lg font-semibold">Ничего не найдено</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">
              Попробуй изменить запрос или сбросить часть фильтров.
            </p>
            <Link href="/catalog" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-semibold text-white hover:bg-violet-600">Сбросить фильтры</Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {titles.map((title) => <ContentCard key={title.id ?? title.slug} title={title} />)}
          </div>
        )}

        {!catalogError && pageCount > 1 && (
          <nav aria-label="Страницы каталога" className="mt-10 flex items-center justify-center gap-3">
            {page > 1 ? <Link href={pageHref(page - 1, currentFilters)} className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm hover:bg-surface-1">Назад</Link> : <span className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm text-text-muted">Назад</span>}
            <span className="px-2 text-sm text-text-secondary">{page} / {pageCount}</span>
            {page < pageCount ? <Link href={pageHref(page + 1, currentFilters)} className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm hover:bg-surface-1">Дальше</Link> : <span className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm text-text-muted">Дальше</span>}
          </nav>
        )}
      </div>
    </main>
  );
}

export default function CatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background text-foreground">
          <SiteHeaderFallback />
          <div className="mx-auto max-w-7xl animate-pulse px-4 py-12 sm:px-6 lg:px-8">
            <div className="h-9 w-48 rounded-lg bg-surface-2" />
            <div className="mt-8 h-40 rounded-2xl bg-surface-1" />
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="aspect-[3/4] rounded-2xl bg-surface-1" />
              ))}
            </div>
          </div>
        </main>
      }
    >
      <CatalogContent searchParams={searchParams} />
    </Suspense>
  );
}

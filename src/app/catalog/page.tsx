import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContentCard, type CatalogCardTitle } from "@/components/content-card";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import { CatalogFilters, FiltersButton } from "@/components/catalog/catalog-filters";
import { contentLabels } from "@/lib/catalog";
import {
  DEFAULT_SORT,
  activeFilterCount,
  catalogHref,
  parseFilters,
  pluralRu,
  yearLabel,
  type CatalogFilterState,
} from "@/lib/catalog-query";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Genre = { id: string; name: string; slug: string };
type Chip = { key: string; label: string; href: string };

const PAGE_SIZE = 24;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export const metadata = {
  title: "Каталог",
  description: "Ищи и открывай аниме, фильмы, сериалы, мангу и книги в SubReel.",
};

async function CatalogContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const requestedPage = Number.parseInt(one(params.page), 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), 10000) : 1;

  let filters: CatalogFilterState = parseFilters(params);
  let titles: CatalogCardTitle[] = [];
  let genres: Genre[] = [];
  let total = 0;
  let catalogError = false;

  try {
    const supabase = await createClient();
    const genresResult = await supabase.from("genres").select("id, name, slug").order("name");
    if (genresResult.error) throw genresResult.error;
    genres = genresResult.data ?? [];

    // Неизвестные жанры из URL игнорируем.
    const selectedGenres = genres.filter((genre) => filters.genres.includes(genre.slug));
    filters = { ...filters, genres: selectedGenres.map((genre) => genre.slug) };

    const selectFields = selectedGenres.length
      ? "id, name, slug, description, cover_url, content_type, release_year, title_genres!inner(genre_id)"
      : "id, name, slug, description, cover_url, content_type, release_year";
    let query = supabase.from("titles").select(selectFields, { count: "exact" }).eq("status", "published");

    if (filters.types.length) query = query.in("content_type", filters.types);
    if (filters.q) query = query.or(`name.ilike.%${filters.q}%,original_name.ilike.%${filters.q}%`);
    if (filters.yearFrom !== null) query = query.gte("release_year", filters.yearFrom);
    if (filters.yearTo !== null) query = query.lte("release_year", filters.yearTo);
    if (selectedGenres.length) query = query.in("title_genres.genre_id", selectedGenres.map((genre) => genre.id));

    if (filters.sort === "title") query = query.order("name");
    else if (filters.sort === "year") query = query.order("release_year", { ascending: false, nullsFirst: false });
    else query = query.order("created_at", { ascending: false });
    // Уникальный хвост сортировки: без него записи с одинаковым годом «прыгают» между страницами.
    query = query.order("id");

    const start = (page - 1) * PAGE_SIZE;
    const result = await query.range(start, start + PAGE_SIZE - 1);
    if (result.error) {
      // Страница за пределами выдачи (например, после смены фильтров по старой ссылке) — на первую.
      if (page > 1 && result.error.code === "PGRST103") redirect(catalogHref(filters));
      throw result.error;
    }
    titles = (result.data ?? []) as unknown as CatalogCardTitle[];
    total = result.count ?? 0;
  } catch (error) {
    unstable_rethrow(error);
    console.error("SubReel catalog page failed:", error);
    catalogError = true;
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCount = activeFilterCount(filters);

  const chips: Chip[] = [];
  if (filters.q) chips.push({ key: "q", label: `Поиск: ${filters.q}`, href: catalogHref({ ...filters, q: "" }) });
  for (const type of filters.types) {
    chips.push({
      key: `type-${type}`,
      label: contentLabels[type] ?? type,
      href: catalogHref({ ...filters, types: filters.types.filter((item) => item !== type) }),
    });
  }
  for (const genre of genres.filter((item) => filters.genres.includes(item.slug))) {
    chips.push({
      key: `genre-${genre.slug}`,
      label: genre.name,
      href: catalogHref({ ...filters, genres: filters.genres.filter((slug) => slug !== genre.slug) }),
    });
  }
  if (filters.yearFrom !== null || filters.yearTo !== null) {
    chips.push({
      key: "years",
      label: yearLabel(filters.yearFrom, filters.yearTo),
      href: catalogHref({ ...filters, yearFrom: null, yearTo: null }),
    });
  }

  const pagerLink = "inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm";

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

        <div className="grid gap-8 lg:grid-cols-[272px_minmax(0,1fr)]">
          <CatalogFilters genres={genres} filters={filters} total={total} />

          <div className="min-w-0">
            <div className="flex gap-3">
              <form action="/catalog" role="search" className="relative min-w-0 flex-1">
                {filters.types.map((type) => <input key={type} type="hidden" name="type" value={type} />)}
                {filters.genres.map((slug) => <input key={slug} type="hidden" name="genre" value={slug} />)}
                {filters.yearFrom !== null && <input type="hidden" name="year_from" value={filters.yearFrom} />}
                {filters.yearTo !== null && <input type="hidden" name="year_to" value={filters.yearTo} />}
                {filters.sort !== DEFAULT_SORT && <input type="hidden" name="sort" value={filters.sort} />}
                <label htmlFor="catalog-query" className="sr-only">Поиск по названию</label>
                <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">⌕</span>
                <input
                  id="catalog-query"
                  name="q"
                  type="search"
                  maxLength={100}
                  defaultValue={filters.q}
                  placeholder="Название на русском или оригинальное"
                  className="h-11 w-full rounded-xl border border-border-subtle bg-surface-1 pl-9 pr-24 text-sm outline-none placeholder:text-text-muted focus:border-accent"
                />
                <button type="submit" className="absolute right-1.5 top-1.5 min-h-8 rounded-lg bg-accent-strong px-3 text-sm font-semibold text-white transition hover:brightness-110">
                  Найти
                </button>
              </form>
              <FiltersButton count={activeCount} />
            </div>

            {chips.length > 0 && (
              <ul aria-label="Выбранные фильтры" className="mt-4 flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <Link
                      href={chip.href}
                      aria-label={`Убрать: ${chip.label}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-accent/30 bg-accent/10 py-1 pl-3.5 pr-2 text-sm text-accent transition hover:bg-accent/20"
                    >
                      {chip.label}
                      <span aria-hidden className="grid size-5 place-items-center rounded-full bg-accent/20 text-[10px]">✕</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/catalog" className="inline-flex min-h-10 items-center px-2 text-sm text-text-secondary underline-offset-4 transition hover:text-foreground hover:underline">
                    Сбросить
                  </Link>
                </li>
              </ul>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-secondary" aria-live="polite">
                {catalogError
                  ? "Каталог временно недоступен"
                  : `${total} ${pluralRu(total, ["произведение", "произведения", "произведений"])}`}
              </p>
              {!catalogError && pageCount > 1 && <p className="text-sm text-text-muted">Страница {page} из {pageCount}</p>}
            </div>

            {catalogError ? (
              <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/5 p-6 sm:p-8" role="alert">
                <h2 className="font-semibold text-warning">Не удалось загрузить каталог</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">Фильтры сохранены. Попробуй обновить страницу чуть позже.</p>
                <Link href={catalogHref(filters, page)} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-medium hover:bg-surface-2">
                  Повторить
                </Link>
              </div>
            ) : titles.length === 0 ? (
              chips.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-6 py-14 text-center sm:py-20">
                  <p className="text-lg font-semibold">Каталог пока наполняется</p>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">
                    Опубликованных произведений ещё нет. Загляни позже: новые тайтлы появятся здесь.
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-6 py-14 text-center sm:py-20">
                  <p className="text-lg font-semibold">Ничего не найдено</p>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">
                    {filters.q ? `По запросу «${filters.q}» с этими фильтрами ничего нет. ` : ""}
                    Убери часть фильтров выше или сбрось их все.
                  </p>
                  <Link href="/catalog" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-semibold text-white hover:brightness-110">
                    Сбросить фильтры
                  </Link>
                </div>
              )
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {titles.map((title) => <ContentCard key={title.id ?? title.slug} title={title} />)}
              </div>
            )}

            {!catalogError && pageCount > 1 && (
              <nav aria-label="Страницы каталога" className="mt-10 flex items-center justify-center gap-3">
                {page > 1 ? <Link href={catalogHref(filters, page - 1)} className={`${pagerLink} hover:bg-surface-1`}>Назад</Link> : <span className={`${pagerLink} text-text-muted`}>Назад</span>}
                <span className="px-2 text-sm text-text-secondary">{page} / {pageCount}</span>
                {page < pageCount ? <Link href={catalogHref(filters, page + 1)} className={`${pagerLink} hover:bg-surface-1`}>Дальше</Link> : <span className={`${pagerLink} text-text-muted`}>Дальше</span>}
              </nav>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background text-foreground">
          <SiteHeaderFallback />
          <div className="mx-auto max-w-7xl animate-pulse px-4 py-12 sm:px-6 lg:px-8">
            <div className="h-9 w-48 rounded-lg bg-surface-2" />
            <div className="mt-8 grid gap-8 lg:grid-cols-[272px_minmax(0,1fr)]">
              <div className="hidden h-[34rem] rounded-2xl bg-surface-1 lg:block" />
              <div>
                <div className="h-11 rounded-xl bg-surface-1" />
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }, (_, index) => (
                    <div key={index} className="aspect-[2/3] rounded-xl bg-surface-1" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      }
    >
      <CatalogContent searchParams={searchParams} />
    </Suspense>
  );
}

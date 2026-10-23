/**
 * Фильтры каталога ↔ URL. Модуль без серверных зависимостей: его используют
 * и страница (server), и панель фильтров (client), поэтому формат URL один.
 *
 *   /catalog?q=наруто&type=anime&type=manga&genre=action&genre=drama&year_from=2000&year_to=2020&sort=year&page=2
 */
export const SORT_OPTIONS = [
  { value: "newest", label: "Недавно добавленные" },
  { value: "title", label: "По названию" },
  { value: "year", label: "Сначала новые по году" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];
export const DEFAULT_SORT: SortValue = "newest";

export const TYPE_GROUPS = [
  { label: "Смотреть", types: ["anime", "movie", "series", "drama", "cartoon"] },
  { label: "Читать", types: ["manga", "manhwa", "manhua", "light_novel", "web_novel", "book"] },
] as const;

export const CONTENT_TYPES: string[] = TYPE_GROUPS.flatMap((group) => [...group.types]);

export type CatalogFilterState = {
  q: string;
  types: string[];
  genres: string[];
  yearFrom: number | null;
  yearTo: number | null;
  sort: SortValue;
};

type RawParams = Record<string, string | string[] | undefined>;

function many(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

export function safeSearch(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function readYear(value: string): number | null {
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 1800 && year <= 2200 ? year : null;
}

export function parseFilters(params: RawParams): CatalogFilterState {
  const types = [...new Set(many(params.type).filter((type) => CONTENT_TYPES.includes(type)))];
  const genres = [
    ...new Set(many(params.genre).map((slug) => slug.trim().toLowerCase()).filter((slug) => slug.length > 0 && slug.length <= 80)),
  ].slice(0, 30);

  let yearFrom = readYear(many(params.year_from)[0] ?? "");
  let yearTo = readYear(many(params.year_to)[0] ?? "");
  if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];

  const sortRaw = many(params.sort)[0] ?? "";
  const sort = SORT_OPTIONS.find((option) => option.value === sortRaw)?.value ?? DEFAULT_SORT;

  return { q: safeSearch(many(params.q)[0] ?? ""), types, genres, yearFrom, yearTo, sort };
}

/** Ссылка на выдачу. Страница по умолчанию — первая: любое изменение фильтров её сбрасывает. */
export function catalogHref(filters: Partial<CatalogFilterState>, page = 1): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const type of filters.types ?? []) params.append("type", type);
  for (const slug of filters.genres ?? []) params.append("genre", slug);
  if (filters.yearFrom != null) params.set("year_from", String(filters.yearFrom));
  if (filters.yearTo != null) params.set("year_to", String(filters.yearTo));
  if (filters.sort && filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/catalog?${query}` : "/catalog";
}

/** Сколько фильтров выбрано: каждый тип и жанр отдельно, диапазон лет — один. Поиск и сортировка не считаются. */
export function activeFilterCount(filters: CatalogFilterState): number {
  return filters.types.length + filters.genres.length + (filters.yearFrom !== null || filters.yearTo !== null ? 1 : 0);
}

export function yearLabel(from: number | null, to: number | null): string {
  if (from !== null && to !== null) return from === to ? String(from) : `${from}–${to}`;
  return from !== null ? `с ${from}` : `до ${to}`;
}

export function pluralRu(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? forms[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? forms[1] : forms[2];
}

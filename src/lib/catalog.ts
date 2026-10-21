export const contentLabels: Record<string, string> = {
  anime: "Аниме",
  movie: "Фильм",
  series: "Сериал",
  drama: "Дорама",
  cartoon: "Мультфильм",
  manga: "Манга",
  manhwa: "Манхва",
  manhua: "Маньхуа",
  light_novel: "Лайт-новелла",
  web_novel: "Веб-новелла",
  book: "Книга",
};

/**
 * Как читать строку title_relationships (source → target):
 * «source является {type} для target».
 * Это допущение: PRD не фиксирует направление. Если решите иначе —
 * поменяйте местами два словаря ниже.
 */
export const outgoingRelationLabels: Record<string, string> = {
  adaptation: "Адаптация произведения",
  sequel: "Продолжение произведения",
  prequel: "Приквел к произведению",
  spin_off: "Спин-офф произведения",
  remake: "Ремейк произведения",
  side_story: "Побочная история к произведению",
  alternative_version: "Альтернативная версия произведения",
  same_universe: "Из той же вселенной",
};

export const incomingRelationLabels: Record<string, string> = {
  adaptation: "Адаптация этого произведения",
  sequel: "Продолжение этого произведения",
  prequel: "Приквел этого произведения",
  spin_off: "Спин-офф этого произведения",
  remake: "Ремейк этого произведения",
  side_story: "Побочная история этого произведения",
  alternative_version: "Альтернативная версия",
  same_universe: "Из той же вселенной",
};

/** CSS-значение для background-image; кавычки и переносы вырезаются. */
export function coverBackground(url: string): string {
  return `url("${url.replace(/["\\\n\r]/g, "")}")`;
}

/** Supabase отдаёт встроенную связь то объектом, то массивом. */
export function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

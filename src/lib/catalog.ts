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
 * Направление title_relationships: source_title_id → target_title_id.
 * relationship_type описывает source относительно target. Поэтому при показе
 * карточки target на странице source подпись prequel/sequel инвертируется;
 * при показе карточки source на странице target подпись сохраняется.
 * Основано на контракте схемы; фактические строки production-БД нужно отдельно проверить.
 */
export const outgoingRelationLabels: Record<string, string> = {
  adaptation: "Адаптация произведения",
  sequel: "Приквел",
  prequel: "Продолжение",
  spin_off: "Спин-офф произведения",
  remake: "Ремейк произведения",
  side_story: "Побочная история к произведению",
  alternative_version: "Альтернативная версия произведения",
  same_universe: "Из той же вселенной",
};

export const incomingRelationLabels: Record<string, string> = {
  adaptation: "Адаптация этого произведения",
  sequel: "Продолжение",
  prequel: "Приквел",
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

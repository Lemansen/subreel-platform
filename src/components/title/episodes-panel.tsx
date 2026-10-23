import Link from "next/link";
export type SeasonItem = { id: string; season_number: number; name: string | null };
export type EpisodeItem = { id: string; season_id: string | null; episode_number: number; name: string | null };
export type EditionItem = { id: string; edition_kind: string; edition_number: number; name: string; language_code: string | null };
export type VolumeItem = { id: string; edition_id: string | null; volume_number: number; name: string | null };
export type ChapterItem = {
  id: string;
  edition_id: string | null;
  volume_id: string | null;
  chapter_number: number | null;
  chapter_label: string;
  name: string | null;
  sort_order: number;
};

type Unit = { id: string; number: string; name: string | null };
type Group = { key: string; title: string; hint?: string; units: Unit[] };

function buildGroups(p: Omit<Props, "done" | "currentId">): Group[] {
  const groups: Group[] = [];

  if (p.isVideo) {
    const toUnits = (list: EpisodeItem[]): Unit[] => list.map((e) => ({ id: e.id, number: String(e.episode_number), name: e.name }));
    for (const season of p.seasons) {
      const units = toUnits(p.episodes.filter((e) => e.season_id === season.id));
      if (units.length) groups.push({ key: season.id, title: season.name || `Сезон ${season.season_number}`, units });
    }
    const loose = toUnits(p.episodes.filter((e) => e.season_id === null));
    if (loose.length) groups.push({ key: "loose", title: p.seasons.length ? "Без сезона" : "Серии", units: loose });
    return groups;
  }

  const toUnits = (list: ChapterItem[]): Unit[] => list.map((c) => ({ id: c.id, number: c.chapter_label, name: c.name }));
  for (const edition of p.editions) {
    const hint = `${edition.edition_kind === "graphic" ? "Графическое издание" : "Текстовое издание"}${edition.language_code ? `, ${edition.language_code}` : ""}`;
    const loose = toUnits(p.chapters.filter((c) => c.edition_id === edition.id && c.volume_id === null));
    if (loose.length) groups.push({ key: `e-${edition.id}`, title: edition.name, hint, units: loose });
    for (const volume of p.volumes.filter((v) => v.edition_id === edition.id)) {
      const units = toUnits(p.chapters.filter((c) => c.volume_id === volume.id));
      if (units.length) groups.push({ key: `v-${volume.id}`, title: `${edition.name}: ${volume.name || `Том ${volume.volume_number}`}`, hint, units });
    }
  }
  for (const volume of p.volumes.filter((v) => v.edition_id === null)) {
    const units = toUnits(p.chapters.filter((c) => c.volume_id === volume.id));
    if (units.length) groups.push({ key: `v-${volume.id}`, title: volume.name || `Том ${volume.volume_number}`, units });
  }
  const loose = toUnits(p.chapters.filter((c) => c.edition_id === null && c.volume_id === null));
  if (loose.length) groups.push({ key: "loose", title: "Главы", units: loose });
  return groups;
}

type Props = {
  isVideo: boolean;
  slug: string;
  seasons: SeasonItem[];
  episodes: EpisodeItem[];
  editions: EditionItem[];
  volumes: VolumeItem[];
  chapters: ChapterItem[];
  /** id серий/глав, которые пользователь уже завершил. */
  done: Set<string>;
  /** Последняя открытая серия/глава — с неё продолжится просмотр/чтение. */
  currentId: string | null;
};

export function EpisodesPanel({ done, currentId, ...data }: Props) {
  const groups = buildGroups(data);
  const noun = data.isVideo ? "Серия" : "Глава";

  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-border-subtle bg-surface-1 p-6 text-sm text-text-secondary">
        {data.isVideo ? "Серии пока не добавлены." : "Главы пока не добавлены."}
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h3 className="text-lg font-semibold">{group.title}</h3>
            {group.hint && <p className="text-sm text-text-muted">{group.hint}</p>}
          </div>
          <div tabIndex={0} role="region" aria-label={group.title} className="mt-3 max-h-[32rem] overflow-y-auto pr-1">
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {group.units.map((unit) => {
                const state = unit.id === currentId ? "current" : done.has(unit.id) ? "done" : null;
                return (
                  <li key={unit.id}>
                    <Link
                      href={`/${data.isVideo ? "watch" : "read"}/${data.slug}?${data.isVideo ? "episode" : "chapter"}=${encodeURIComponent(unit.id)}`}
                      aria-current={state === "current" ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:border-accent/50 hover:bg-accent/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                        state === "current" ? "border-accent/50 bg-accent/10" : "border-border-subtle bg-surface-1"
                      }`}
                    >
                    <span className="grid h-10 min-w-10 place-items-center rounded-lg bg-surface-2 px-2 text-sm font-semibold tabular-nums">
                      {unit.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{unit.name || `${noun} ${unit.number}`}</span>
                    {state && (
                      <span className={`shrink-0 text-xs ${state === "current" ? "text-accent" : "text-text-muted"}`}>
                        {state === "current" ? "Продолжить" : data.isVideo ? "✓ Просмотрено" : "✓ Прочитано"}
                      </span>
                    )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      ))}
    </div>
  );
}

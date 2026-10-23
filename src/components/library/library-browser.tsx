"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { removeLibraryEntry, saveLibraryEntry, type LibraryStatus } from "@/app/progress/actions";
import { contentLabels, coverBackground } from "@/lib/catalog";
import { pluralRu } from "@/lib/catalog-query";
import { isReadable, statusLabels, statusOrder, type LibraryItem } from "@/lib/library-shared";

type Tab = "all" | "favorite" | LibraryStatus;
type Kind = "all" | "video" | "read";
type Sort = "recent" | "name" | "rating" | "year";
type Patch = Partial<Pick<LibraryItem, "status" | "favorite">>;
type Toast = { text: string; undo?: () => void; error?: boolean };

const tabs: { key: Tab; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "in_progress", label: statusLabels.in_progress },
  { key: "planned", label: statusLabels.planned },
  { key: "completed", label: statusLabels.completed },
  { key: "on_hold", label: statusLabels.on_hold },
  { key: "dropped", label: statusLabels.dropped },
  { key: "favorite", label: "Избранное" },
];

const kinds: { key: Kind; label: string }[] = [
  { key: "all", label: "Всё" },
  { key: "video", label: "Видео" },
  { key: "read", label: "Чтение" },
];

const sortLabels: Record<Sort, string> = {
  recent: "Недавно обновлённые",
  name: "По названию",
  rating: "По моей оценке",
  year: "По году выхода",
};

const statusDot: Record<LibraryStatus, string> = {
  in_progress: "bg-accent",
  planned: "bg-text-muted",
  completed: "bg-success",
  on_hold: "bg-warning",
  dropped: "bg-danger",
};

const REMOVE = "__remove";

function compare(sort: Sort) {
  const byName = (a: LibraryItem, b: LibraryItem) => a.name.localeCompare(b.name, "ru");
  switch (sort) {
    case "name":
      return byName;
    case "rating":
      return (a: LibraryItem, b: LibraryItem) => (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b);
    case "year":
      return (a: LibraryItem, b: LibraryItem) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || byName(a, b);
    default:
      return (a: LibraryItem, b: LibraryItem) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  }
}

export function LibraryBrowser({ initialItems, truncated }: { initialItems: LibraryItem[]; truncated: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<Tab>("all");
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function say(next: Toast) {
    window.clearTimeout(timer.current);
    setToast(next);
    timer.current = window.setTimeout(() => setToast(null), next.undo ? 7000 : 5000);
  }

  const counts = useMemo(() => {
    const result: Record<Tab, number> = { all: items.length, favorite: 0, planned: 0, in_progress: 0, completed: 0, on_hold: 0, dropped: 0 };
    for (const item of items) {
      result[item.status] += 1;
      if (item.favorite) result.favorite += 1;
    }
    return result;
  }, [items]);

  const needle = query.trim().toLocaleLowerCase("ru");
  const filtersActive = tab !== "all" || kind !== "all" || needle !== "";
  const visible = useMemo(() => {
    return items
      .filter((item) => {
        if (tab === "favorite" ? !item.favorite : tab !== "all" && item.status !== tab) return false;
        if (kind !== "all" && (kind === "read") !== isReadable(item.contentType)) return false;
        return !needle || item.name.toLocaleLowerCase("ru").includes(needle);
      })
      .sort(compare(sort));
  }, [items, tab, kind, needle, sort]);

  function reset() {
    setTab("all");
    setKind("all");
    setQuery("");
  }

  function patchItem(titleId: string, patch: Patch) {
    setItems((current) => current.map((item) => (item.titleId === titleId ? { ...item, ...patch } : item)));
  }

  function update(item: LibraryItem, patch: Patch, announce: string | null) {
    const before: Patch = { status: item.status, favorite: item.favorite };
    const next = { ...before, ...patch } as Required<Patch>;
    patchItem(item.titleId, patch);
    if (announce) say({ text: announce, undo: () => update({ ...item, ...next }, before, null) });
    startTransition(async () => {
      const result = await saveLibraryEntry(item.titleId, next.status, next.favorite);
      if (!result.ok) {
        patchItem(item.titleId, before);
        say({ text: "Не удалось сохранить. Попробуй ещё раз.", error: true });
      }
    });
  }

  function restore(item: LibraryItem) {
    setItems((current) => (current.some((entry) => entry.titleId === item.titleId) ? current : [...current, item]));
    startTransition(async () => {
      const result = await saveLibraryEntry(item.titleId, item.status, item.favorite);
      if (!result.ok) {
        setItems((current) => current.filter((entry) => entry.titleId !== item.titleId));
        say({ text: "Не удалось вернуть запись. Добавь её заново на странице тайтла.", error: true });
      }
    });
  }

  function remove(item: LibraryItem) {
    setItems((current) => current.filter((entry) => entry.titleId !== item.titleId));
    say({ text: `«${item.name}» убрано из библиотеки`, undo: () => restore(item) });
    startTransition(async () => {
      const result = await removeLibraryEntry(item.titleId);
      if (!result.ok) {
        setItems((current) => (current.some((entry) => entry.titleId === item.titleId) ? current : [...current, item]));
        say({ text: "Не удалось убрать запись. Попробуй ещё раз.", error: true });
      }
    });
  }

  function changeStatus(item: LibraryItem, value: string) {
    if (value === REMOVE) return remove(item);
    const status = value as LibraryStatus;
    if (status !== item.status) update(item, { status }, `«${item.name}»: ${statusLabels[status]}`);
  }

  function toggleFavorite(item: LibraryItem) {
    const favorite = !item.favorite;
    update(item, { favorite }, `«${item.name}» ${favorite ? "добавлено в избранное" : "убрано из избранного"}`);
  }

  const chip = (active: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
      active
        ? "border-accent/40 bg-accent/15 text-foreground"
        : "border-border-subtle bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <section aria-label="Сохранённые произведения" className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pb-14 lg:px-8">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-subtle px-6 py-14 text-center sm:py-20">
          <p className="text-lg font-semibold">В библиотеке пока ничего нет</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">
            Открой страницу произведения и нажми «Добавить». Здесь можно будет менять статус и отмечать избранное в один тап.
          </p>
          <Link href="/catalog" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-semibold text-white transition hover:brightness-110">
            Открыть каталог
          </Link>
        </div>
      ) : (
        <>
          <div className="-mx-4 bg-background/85 px-4 pb-3 pt-2 backdrop-blur-xl sm:-mx-6 sm:px-6 md:sticky md:top-16 md:z-30 lg:-mx-8 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="library-query" className="sr-only">Поиск по библиотеке</label>
                <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">⌕</span>
                <input
                  id="library-query"
                  type="search"
                  maxLength={100}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Найти в моей библиотеке"
                  className="h-11 w-full rounded-xl border border-border-subtle bg-surface-1 pl-9 pr-4 text-sm outline-none placeholder:text-text-muted focus:border-accent"
                />
              </div>
              <div className="flex gap-3">
                <div role="group" aria-label="Тип произведений" className="inline-flex rounded-xl border border-border-subtle bg-surface-1 p-0.5">
                  {kinds.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={kind === option.key}
                      onClick={() => setKind(option.key)}
                      className={`min-h-10 rounded-[10px] px-3 text-sm font-medium transition ${kind === option.key ? "bg-surface-hover text-foreground" : "text-text-secondary hover:text-foreground"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="min-w-0 flex-1 sm:flex-none">
                  <span className="sr-only">Сортировка</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as Sort)}
                    className="h-11 w-full rounded-xl border border-border-subtle bg-surface-1 px-3 text-sm outline-none focus:border-accent"
                  >
                    {(Object.keys(sortLabels) as Sort[]).map((key) => (
                      <option key={key} value={key}>{sortLabels[key]}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div role="group" aria-label="Статус" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((option) => (
                <button key={option.key} type="button" aria-pressed={tab === option.key} onClick={() => setTab(option.key)} className={chip(tab === option.key)}>
                  {option.label}
                  <span className={`text-xs ${tab === option.key ? "text-accent" : "text-text-muted"}`}>{counts[option.key]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p aria-live="polite" className="text-sm text-text-secondary">
              {filtersActive
                ? `Показано ${visible.length} из ${items.length}`
                : `${items.length} ${pluralRu(items.length, ["произведение", "произведения", "произведений"])}`}
            </p>
            {filtersActive && (
              <button type="button" onClick={reset} className="inline-flex min-h-11 items-center px-2 text-sm text-text-secondary underline-offset-4 transition hover:text-foreground hover:underline">
                Сбросить фильтры
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-border-subtle px-6 py-14 text-center sm:py-20">
              <p className="text-lg font-semibold">Ничего не найдено</p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">
                {needle ? `По запросу «${query.trim()}» с выбранными фильтрами ничего нет.` : "В этом разделе пока пусто."} Попробуй другой раздел или сбрось фильтры.
              </p>
              <button type="button" onClick={reset} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-semibold text-white transition hover:brightness-110">
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 xl:grid-cols-4">
              {visible.map((item) => (
                <LibraryCard key={item.titleId} item={item} onStatus={changeStatus} onFavorite={toggleFavorite} />
              ))}
            </ul>
          )}

          {truncated && <p className="mt-8 text-center text-xs text-text-muted">Показаны последние 1000 записей. Остальные доступны в экспорте.</p>}
        </>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6">
        {toast && (
          <div
            role={toast.error ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border bg-surface-1 py-1 pl-4 pr-1 text-sm shadow-2xl shadow-black/40 ${toast.error ? "border-danger/30 text-danger" : "border-border-subtle"}`}
          >
            <span className="min-w-0 flex-1 truncate py-2">{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 font-semibold text-accent transition hover:bg-accent/10"
              >
                Отменить
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function LibraryCard({
  item,
  onStatus,
  onFavorite,
}: {
  item: LibraryItem;
  onStatus: (item: LibraryItem, value: string) => void;
  onFavorite: (item: LibraryItem) => void;
}) {
  const readable = isReadable(item.contentType);
  const progress = item.progress;
  const showBar = progress && !progress.done && progress.percent > 0;
  const meta = [item.releaseYear, contentLabels[item.contentType] ?? item.contentType].filter(Boolean).join(" · ");

  return (
    <li className="group min-w-0">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 shadow-lg shadow-black/30 ring-1 ring-white/5 transition duration-300 group-hover:ring-accent/40">
        <Link href={`/title/${item.slug}`} tabIndex={-1} aria-hidden className="absolute inset-0 block">
          {item.coverUrl ? (
            <div className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105" style={{ backgroundImage: coverBackground(item.coverUrl) }} />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-accent-strong/60 to-background p-4 text-center">
              <span className="text-lg font-bold text-white/40">{item.name}</span>
            </div>
          )}
        </Link>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/0 to-black/30" />

        <span className={`pointer-events-none absolute left-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white ${readable ? "bg-emerald-600/90" : "bg-accent-strong/90"}`}>
          {contentLabels[item.contentType] ?? item.contentType}
        </span>

        <button
          type="button"
          aria-pressed={item.favorite}
          aria-label={`В избранное: ${item.name}`}
          onClick={() => onFavorite(item)}
          className="absolute right-0 top-0 grid size-11 place-items-center"
        >
          <span aria-hidden className={`grid size-8 place-items-center rounded-full text-base backdrop-blur transition ${item.favorite ? "bg-accent-secondary/90 text-white" : "bg-black/60 text-white/80 hover:bg-black/80"}`}>
            {item.favorite ? "♥" : "♡"}
          </span>
        </button>

        {progress && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 pt-8">
            <p className="truncate text-xs font-medium text-zinc-100">{progress.done ? `Последнее: ${progress.label}` : progress.label}</p>
            {showBar && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress.percent}%` }} />
                <span className="sr-only">{progress.kind === "read" ? "Прочитано" : "Просмотрено"} {progress.percent}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5">
          <Link href={`/title/${item.slug}`} className="transition hover:text-accent">{item.name}</Link>
        </h3>
        <p className="mt-0.5 text-xs text-text-muted">
          {meta}
          {item.rating !== null && (
            <span aria-label={`Моя оценка: ${item.rating} из 10`} className="ml-1.5 font-semibold text-warning">★ {item.rating}</span>
          )}
        </p>

        <label className="relative mt-2 block">
          <span className="sr-only">Статус: {item.name}</span>
          <span aria-hidden className={`pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full ${statusDot[item.status]}`} />
          <select
            value={item.status}
            onChange={(event) => onStatus(item, event.target.value)}
            className="h-11 w-full appearance-none rounded-lg border border-border-subtle bg-surface-1 pl-7 pr-7 text-sm outline-none transition hover:bg-surface-2 focus:border-accent sm:h-10"
          >
            <optgroup label="Статус">
              {statusOrder.map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </optgroup>
            <optgroup label="Действия">
              <option value={REMOVE}>Убрать из библиотеки</option>
            </optgroup>
          </select>
          <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">▾</span>
        </label>
      </div>
    </li>
  );
}
